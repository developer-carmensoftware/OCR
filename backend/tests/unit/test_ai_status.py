"""GET /api/v1/carmen/ai-status — the public stage of Carmen's AI sales popup."""

from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.services.shared.credits import ai_stage
from app.services.shared.rate_limit import InMemoryRateLimiter
from tests.conftest import make_mock_db


@pytest.mark.parametrize(
    ("balance", "purchased", "has_sub", "stage"),
    [
        (None, 0, False, "never_used"),  # no tenant row
        (30, 0, False, "never_used"),
        (29, 0, False, "trial"),  # 1 used
        (6, 0, False, "trial"),  # 24 used
        (5, 0, False, "near_limit"),  # 25 used
        (1, 0, False, "near_limit"),  # 29 used
        (0, 0, False, "exhausted"),
        (0, 0, True, "paid"),
        (12, 100, False, "paid"),  # bought a top-up
    ],
)
def test_ai_stage(balance, purchased, has_sub, stage):
    assert ai_stage(balance, purchased, has_sub) == stage


@contextmanager
def _client(row, subscription=None, modules=(), ceiling=None):
    from starlette.testclient import TestClient

    from app.database import get_db
    from app.main import app

    db = make_mock_db()
    db.execute.return_value.first.return_value = row
    db.execute.return_value.scalar_one_or_none.return_value = subscription
    db.execute.return_value.scalars.return_value.all.return_value = list(modules)

    async def _db():
        yield db

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
            patch(
                "app.routers.carmen._ai_status_ceiling",
                ceiling or InMemoryRateLimiter(max_calls=300, window_seconds=60.0),
            ),
            TestClient(app) as client,
        ):
            yield client, db
    finally:
        app.dependency_overrides.clear()


_PARAMS = {"uri": "https://dev.carmen.example/x", "bu": " CarmenCloud "}


def test_unknown_bu_reads_never_used_and_writes_nothing():
    with _client(row=None) as (client, db):
        resp = client.get("/api/v1/carmen/ai-status", params=_PARAMS)
    assert resp.status_code == 200
    assert resp.json() == {"stage": "never_used", "modules": []}
    assert resp.headers["cache-control"] == "max-age=300"
    params = db.execute.call_args.args[0].compile().params.values()
    assert "dev.carmen.example" in params and "carmencloud" in params  # the /exchange key
    db.add.assert_not_called()
    db.commit.assert_not_called()


def test_known_bu_reads_its_balance_and_modules():
    row = SimpleNamespace(id="t-1", balance=3, credits_purchased=0)
    used = ["ap_invoice", "credit_card_ocr"]
    with _client(row=row, modules=used) as (client, db):
        resp = client.get("/api/v1/carmen/ai-status", params=_PARAMS)
    assert resp.json() == {"stage": "near_limit", "modules": used}
    modules_sql = str(db.execute.call_args.args[0].compile())
    assert "ocr_tasks" in modules_sql and "sum(ocr_tasks.charged_docs) >" in modules_sql


def test_endpoint_ceiling_answers_429():
    ceiling = InMemoryRateLimiter(max_calls=1, window_seconds=60.0)
    with _client(row=None, ceiling=ceiling) as (client, _db):
        assert client.get("/api/v1/carmen/ai-status", params=_PARAMS).status_code == 200
        assert client.get("/api/v1/carmen/ai-status", params=_PARAMS).status_code == 429
