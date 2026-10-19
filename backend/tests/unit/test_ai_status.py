"""GET /api/v1/carmen/ai-status — what Carmen's AI sales popup rule reads, behind its token."""

from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from app.exceptions import FieldValidationError, ValidationError
from app.services.shared.credits import trial_used
from app.services.shared.rate_limit import InMemoryRateLimiter
from tests.conftest import make_mock_db

TOKEN = "direct 9f3ac1|3fa85f64-5717-4562-b3fc-2c963f66afa6"  # Carmen's `<hash>|<user uuid>`
_PARAMS = {"uri": "https://dev.carmen.example/x", "bu": "carmencloud"}
_AUTH = {"Authorization": TOKEN}


@pytest.mark.parametrize(
    ("balance", "used"),
    [
        (None, 0),  # no credits row
        (50, 0),  # an admin granted more than the trial
        (30, 0),
        (29, 1),
        (6, 24),
        (5, 25),
        (1, 29),
        (0, 30),
    ],
)
def test_trial_used(balance, used):
    assert trial_used(balance) == used


@contextmanager
def _client(credit=None, modules=(), subscription=None, resolve=None):
    """`resolve`: what settings_api._resolve returns (a tenant) or raises."""
    from starlette.testclient import TestClient

    from app.database import get_db
    from app.main import app

    db = make_mock_db()
    db.execute.return_value.first.return_value = credit
    db.execute.return_value.all.return_value = list(modules)  # (module_id, SUM(charged_docs))
    db.execute.return_value.scalar_one_or_none.return_value = subscription

    async def _db():
        yield db

    if isinstance(resolve, Exception):
        resolver = AsyncMock(side_effect=resolve)
    else:
        resolver = AsyncMock(return_value=resolve or SimpleNamespace(id="t-1"))
    app.dependency_overrides[get_db] = _db
    try:
        with (
            patch("app.lifecycle.ensure_db", new_callable=AsyncMock),
            patch(
                "app.services.shared.pricing_cache.fetch_openrouter_pricing",
                new_callable=AsyncMock,
            ),
            patch("app.lifecycle._perf_flush_loop", new_callable=AsyncMock),
            patch("app.lifecycle.asyncio.sleep", new_callable=AsyncMock),
            # _caller's limiters are module-level: give each test its own.
            patch(
                "app.routers.email_automation.settings_api._settings_limiter",
                InMemoryRateLimiter(max_calls=20, window_seconds=60.0),
            ),
            patch(
                "app.routers.email_automation.settings_api._probe_ceiling",
                InMemoryRateLimiter(max_calls=300, window_seconds=60.0),
            ),
            patch("app.routers.carmen._resolve", resolver),
            TestClient(app) as client,
        ):
            yield client, db, resolver
    finally:
        app.dependency_overrides.clear()


def _get(client, headers=_AUTH):
    return client.get("/api/v1/carmen/ai-status", params=_PARAMS, headers=headers)


def test_no_token_is_401_before_any_lookup():
    with _client() as (client, db, resolver):
        resp = _get(client, headers={})
    assert resp.status_code == 401
    resolver.assert_not_awaited()
    db.execute.assert_not_called()


def test_trial_bu_reads_its_balance_and_modules():
    credit = SimpleNamespace(balance=3, credits_purchased=0)
    # both Credit Card ids fold into jv; a module with 0 documents is left out
    used = [("credit_card_ocr", 20), ("cc_ar_reconcile", 5), ("ap_invoice", 2), ("x", 0)]
    with _client(credit=credit, modules=used) as (client, db, resolver):
        resp = _get(client)
    assert resp.status_code == 200
    assert resp.json() == {
        "paid": False,
        "trial": {"used": 27, "total": 30},
        "modules": {"ap_invoice": 2, "jv": 25},
    }
    assert resp.headers["cache-control"] == "private, max-age=300"
    assert resolver.await_args.args[1].carmen_token == TOKEN  # proven the Settings API way
    assert resolver.await_args.args[2:] == (_PARAMS["uri"], _PARAMS["bu"])


def test_a_plan_is_paid_and_sends_no_trial():
    credit = SimpleNamespace(balance=0, credits_purchased=0)
    with _client(credit=credit, modules=[("ap_invoice", 40)], subscription=object()) as (
        client,
        _db,
        _r,
    ):
        resp = _get(client)
    assert resp.json() == {"paid": True, "trial": None, "modules": {"ap_invoice": 40}}


def test_a_top_up_alone_is_paid():
    credit = SimpleNamespace(balance=128, credits_purchased=100)
    with _client(credit=credit, modules=[("credit_card_ocr", 2)]) as (client, _db, _r):
        resp = _get(client)
    assert resp.json() == {"paid": True, "trial": None, "modules": {"jv": 2}}


def test_unknown_bu_proves_the_token_against_its_uri_and_writes_nothing():
    unknown = ValidationError("Unknown business unit")
    with (
        patch("app.routers.carmen.validate_uri", return_value="https://dev.carmen.example"),
        patch("app.routers.carmen.validate_token", new_callable=AsyncMock) as validate,
        _client(resolve=unknown) as (client, db, _r),
    ):
        resp = _get(client)
    assert resp.status_code == 200
    assert resp.json() == {"paid": False, "trial": {"used": 0, "total": 30}, "modules": {}}
    validate.assert_awaited_once_with(TOKEN, "https://dev.carmen.example")
    db.add.assert_not_called()
    db.commit.assert_not_called()


def test_unknown_bu_with_a_rejected_token_is_401():
    rejected = HTTPException(status_code=401, detail="Carmen token rejected")
    with (
        patch("app.routers.carmen.validate_uri", return_value="https://dev.carmen.example"),
        patch("app.routers.carmen.validate_token", AsyncMock(side_effect=rejected)),
        _client(resolve=ValidationError("Unknown business unit")) as (client, _db, _r),
    ):
        assert _get(client).status_code == 401


def test_a_stored_host_failing_the_ssrf_gate_is_not_read_as_unknown():
    bad_host = FieldValidationError([{"field": "carmen_uri", "code": "invalid_uri"}])
    with (
        patch("app.routers.carmen.validate_token", new_callable=AsyncMock) as validate,
        _client(resolve=bad_host) as (client, _db, _r),
    ):
        assert _get(client).status_code == 422
    validate.assert_not_awaited()
