"""
Integration tests for /api/v1/carmen/* proxy endpoints.
Sync test functions using starlette TestClient.

Covers:
- Happy-path 200 responses when service returns data
- CarmenAPIError → correct HTTP status code propagation
- Missing auth → 401/422
"""

import uuid
from contextlib import contextmanager
from datetime import UTC, date, datetime
from unittest.mock import AsyncMock

import app.routers.carmen as _carmen_router
from tests.conftest import make_mock_db
from tests.integration.conftest import FAKE_SESSION, make_test_client

BASE = "/api/v1/carmen"
AUTH = {"Authorization": "Bearer dummy"}

# The duplicate guard resolves the tenant via uuid.UUID(session.tenant_id); the shared
# FAKE_SESSION uses a non-UUID id ("t-test"), which the router treats as "no card to
# guard". These tests need a real UUID tenant to exercise the guard at all.
_TENANT_UUID = "11111111-1111-1111-1111-111111111111"


@contextmanager
def _patch_service(name: str, mock_fn):
    """Directly replace a name on app.routers.carmen and restore after."""
    original = getattr(_carmen_router, name)
    setattr(_carmen_router, name, mock_fn)
    try:
        yield mock_fn
    finally:
        setattr(_carmen_router, name, original)


def _use_uuid_tenant_session():
    """Point get_current_session at a session whose tenant_id is a real UUID."""
    from dataclasses import replace

    from app.auth.dependencies import get_current_session
    from app.main import app

    session = replace(FAKE_SESSION, tenant_id=_TENANT_UUID)

    async def _session():
        from app.context import current_tenant_id

        current_tenant_id.set(session.tenant_id)
        return session

    app.dependency_overrides[get_current_session] = _session


def _ok(payload=None):
    return AsyncMock(return_value=payload or {"Data": [], "Status": "ok"})


def _err(status: int, detail: str = "upstream error"):
    from app.services.carmen_service import CarmenAPIError

    return AsyncMock(side_effect=CarmenAPIError(status, detail))


# ── GET /account-codes ────────────────────────────────────────────────────────


def test_account_codes_200():
    mock_db = make_mock_db()
    with _patch_service("get_account_codes", _ok({"Data": [{"Code": "5100"}]})):
        with make_test_client(mock_db) as client:
            resp = client.get(f"{BASE}/account-codes", headers=AUTH)
    assert resp.status_code == 200
    assert "Data" in resp.json()


def test_account_codes_forwards_401():
    mock_db = make_mock_db()
    with _patch_service("get_account_codes", _err(401, "Unauthorized")):
        with make_test_client(mock_db) as client:
            resp = client.get(f"{BASE}/account-codes", headers=AUTH)
    assert resp.status_code == 401


# ── GET /departments ──────────────────────────────────────────────────────────


def test_departments_200():
    mock_db = make_mock_db()
    with _patch_service("get_departments", _ok({"Data": [{"Code": "FIN"}]})):
        with make_test_client(mock_db) as client:
            resp = client.get(f"{BASE}/departments", headers=AUTH)
    assert resp.status_code == 200
    assert "Data" in resp.json()


def test_departments_forwards_502():
    mock_db = make_mock_db()
    with _patch_service("get_departments", _err(502, "Gateway error")):
        with make_test_client(mock_db) as client:
            resp = client.get(f"{BASE}/departments", headers=AUTH)
    assert resp.status_code == 502


# ── GET /gl-prefix (soft error — returns degraded response) ──────────────────


def test_gl_prefix_200_even_on_carmen_error():
    """gl-prefix silently degrades instead of returning 4xx/5xx."""
    mock_db = make_mock_db()
    with _patch_service("get_gl_prefix", _err(503, "Carmen down")):
        with make_test_client(mock_db) as client:
            resp = client.get(f"{BASE}/gl-prefix", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert "Data" in body
    assert "upstream_503" in body.get("Status", "")


# ── POST /gljv ────────────────────────────────────────────────────────────────


def test_gljv_200():
    mock_db = make_mock_db()
    payload = {"JvhSeq": -1, "JvhNo": "Auto", "Status": "Draft", "Detail": []}
    with _patch_service("post_gljv", _ok({"Code": 0, "InternalMessage": "JV-1"})):
        with make_test_client(mock_db) as client:
            resp = client.post(f"{BASE}/gljv", json=payload, headers=AUTH)
    assert resp.status_code == 200
    assert resp.json().get("Code") == 0


def test_gljv_forwards_409():
    mock_db = make_mock_db()
    with _patch_service("post_gljv", _err(409, "Duplicate JV")):
        with make_test_client(mock_db) as client:
            resp = client.post(f"{BASE}/gljv", json={}, headers=AUTH)
    assert resp.status_code == 409
    assert "Carmen" in resp.json().get("detail", "")


# ── POST /gljv — duplicate-submit guard ──────────────────────────────────────


def _card(*, submitted: bool, bank_code: str | None = "KBANK"):
    """A CreditCard row as the locked pre-post lookup would return it."""
    from app.models.orm import CreditCard

    return CreditCard(
        id=uuid.uuid4(),
        tenant_id=uuid.UUID(_TENANT_UUID),
        bank_code=bank_code,
        doc_no="INV-123",
        doc_date=date(2026, 7, 31),
        submitted_at=datetime.now(UTC) if submitted else None,
    )


def test_gljv_rejects_resubmit_of_an_already_submitted_card():
    """Double-click / retry after a successful submit must not post a second JV."""
    card = _card(submitted=True)
    mock_db = make_mock_db(execute_rows=[card])
    post = _ok({"Code": 0, "InternalMessage": "JV-9"})

    with _patch_service("post_gljv", post), make_test_client(mock_db) as client:
        _use_uuid_tenant_session()
        resp = client.post(
            f"{BASE}/gljv?credit_card_id={card.id}&doc_no=INV-123&bank_code=KBANK",
            json={"JvhSeq": -1, "Detail": []},
            headers=AUTH,
        )

    assert resp.status_code == 409
    # The guard must run BEFORE the post — a 409 after posting would still duplicate.
    post.assert_not_awaited()


def test_gljv_rejects_a_second_document_with_the_same_doc_no():
    """A different draft of an already-submitted (tenant, doc_no, doc_date) is a duplicate."""
    card = _card(submitted=False)
    mock_db = make_mock_db(execute_rows=[card])
    post = _ok({"Code": 0, "InternalMessage": "JV-9"})
    dup = AsyncMock(return_value=True)

    with (
        _patch_service("post_gljv", post),
        _patch_service("has_submitted_doc", dup),
        make_test_client(mock_db) as client,
    ):
        _use_uuid_tenant_session()
        resp = client.post(
            f"{BASE}/gljv?credit_card_id={card.id}&doc_no=INV-123&bank_code=KBANK",
            json={"JvhSeq": -1, "Detail": []},
            headers=AUTH,
        )

    assert resp.status_code == 409
    post.assert_not_awaited()
    # **bank_code is deliberately not in the key.** The wizard fills it from the user's
    # dropdown and the email job from the matched rule, so keying on it let one document
    # exist as two rows and post twice. doc_date keeps the key specific instead.
    assert "bank_code" not in dup.await_args.kwargs
    assert dup.await_args.kwargs["doc_date"] == date(2026, 7, 31)


def test_gljv_guards_a_card_whose_bank_was_never_identified():
    """The guard used to require a bank_code to run at all, so a card the detector could
    not name skipped the duplicate check entirely — the one case most likely to be
    re-scanned by a confused user."""
    card = _card(submitted=False, bank_code=None)
    mock_db = make_mock_db(execute_rows=[card])
    post = _ok({"Code": 0, "InternalMessage": "JV-9"})

    with (
        _patch_service("post_gljv", post),
        _patch_service("has_submitted_doc", AsyncMock(return_value=True)),
        make_test_client(mock_db) as client,
    ):
        _use_uuid_tenant_session()
        resp = client.post(
            f"{BASE}/gljv?credit_card_id={card.id}&doc_no=INV-123",
            json={"JvhSeq": -1, "Detail": []},
            headers=AUTH,
        )

    assert resp.status_code == 409
    post.assert_not_awaited()


def test_gljv_posts_and_stamps_when_not_a_duplicate():
    card = _card(submitted=False)
    mock_db = make_mock_db(execute_rows=[card])
    post = _ok({"Code": 0, "InternalMessage": "JV-9"})

    with (
        _patch_service("post_gljv", post),
        _patch_service("has_submitted_doc", AsyncMock(return_value=False)),
        make_test_client(mock_db) as client,
    ):
        _use_uuid_tenant_session()
        resp = client.post(
            f"{BASE}/gljv?credit_card_id={card.id}&doc_no=INV-123&bank_code=KBANK",
            json={"JvhSeq": -1, "Detail": []},
            headers=AUTH,
        )

    assert resp.status_code == 200
    assert resp.json().get("Code") == 0
    post.assert_awaited_once()
    assert card.submitted_at is not None  # stamped, so the next submit is rejected


def test_gljv_non_uuid_credit_card_id_does_not_500():
    """Regression: on duplicate re-submission the frontend sends doc_no (not a
    UUID) as credit_card_id. The post-submit bookkeeping must fall back to a
    doc_no lookup and must never turn a successful Carmen submit into a 500."""
    mock_db = make_mock_db()  # no rows → card lookup returns None
    with _patch_service("post_gljv", _ok({"Code": 0, "InternalMessage": "JV-2"})):
        with make_test_client(mock_db) as client:
            resp = client.post(
                f"{BASE}/gljv?credit_card_id=26079-0001954&doc_no=26079-0001954&bank_code=BBL",
                json={"JvhSeq": -1, "Detail": []},
                headers=AUTH,
            )
    assert resp.status_code == 200
    assert resp.json().get("Code") == 0
