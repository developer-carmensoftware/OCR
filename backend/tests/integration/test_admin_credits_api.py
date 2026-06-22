"""
Integration tests for admin credit-order endpoints:
  GET  /api/v1/admin/credit-orders
  GET  /api/v1/admin/credit-orders/{id}/slip-url
  POST /api/v1/admin/credit-orders/{id}/approve
  POST /api/v1/admin/credit-orders/{id}/reject
  Scope guard: scoped admin cannot access another tenant's order
"""

import uuid
from contextlib import contextmanager
from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from tests.conftest import make_mock_db
from tests.integration.conftest import make_test_client

BASE = "/api/v1/admin"
AUTH = {"Authorization": "Bearer dummy"}
TENANT_ID = "t-test"  # matches FAKE_SESSION.tenant_id


# ── Helpers ───────────────────────────────────────────────────────────────────


def _order(
    order_id=None,
    status="awaiting_review",
    tenant_id=TENANT_ID,
    pack_code="starter",
    credits=500,
    amount_thb=990.0,
):
    row = MagicMock()
    row.id = order_id or str(uuid.uuid4())
    row.pack_code = pack_code
    row.credits = credits
    row.amount_thb = Decimal(str(amount_thb))
    row.status = status
    row.tenant_id = tenant_id
    row.deleted_at = None
    row.slip_object_key = f"{tenant_id}/slip.jpg"
    row.slip_uploaded_at = datetime.now(UTC)
    # Remaining CreditOrderResponse fields — set so model_validate(row) succeeds
    # (a bare MagicMock attribute is a child mock, not a valid str/datetime).
    row.tenant_name = None
    row.created_at = None
    row.approved_at = None
    row.approved_by = None
    row.expires_at = None
    row.rejected_reason = None
    row.admin_note = None
    return row


def _proforma(order_id=None):
    doc = MagicMock()
    doc.id = str(uuid.uuid4())
    doc.buyer_name = "Test Co"
    doc.buyer_tax_id = "1234567890123"
    doc.buyer_address = "Bangkok"
    doc.buyer_branch = "HQ"
    doc.order_id = order_id or str(uuid.uuid4())
    doc.deleted_at = None
    return doc


def _scalar(row):
    r = MagicMock()
    r.scalar_one_or_none.return_value = row
    return r


def _scalars(rows):
    m = MagicMock()
    m.all.return_value = list(rows)
    r = MagicMock()
    r.scalars.return_value = m
    return r


@contextmanager
def make_admin_test_client(mock_db, perms=None, tenant_scope=""):
    """
    Extend make_test_client to also override get_current_admin with a
    global (or scoped) AdminPrincipal so admin routes pass auth checks.
    """
    from app.auth.admin_session import AdminPrincipal
    from app.routers.admin.deps import get_current_admin

    if perms is None:
        perms = {"quotas:read", "quotas:write"}

    def _admin():
        return AdminPrincipal(
            admin_id="admin-1",
            email="admin@test.com",
            perms=perms,
            tenant_scope=tenant_scope,
        )

    with make_test_client(mock_db) as client:
        from app.main import app

        app.dependency_overrides[get_current_admin] = _admin
        yield client


# ── GET /admin/credit-orders ──────────────────────────────────────────────────


def _list_result(orders):
    """The list endpoint reads (order, tenant_name) tuples via `.all()`."""
    execute_result = MagicMock()
    execute_result.all.return_value = [(o, "Acme Co") for o in orders]
    return execute_result


def test_list_credit_orders_returns_awaiting_review_by_default():
    orders = [_order(status="awaiting_review"), _order(status="awaiting_review")]
    mock_db = make_mock_db()
    mock_db.execute = AsyncMock(return_value=_list_result(orders))

    with make_admin_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/credit-orders", headers=AUTH)

    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    assert body[0]["tenant_name"] == "Acme Co"


def test_list_credit_orders_with_explicit_status_filter():
    orders = [_order(status="pending")]
    mock_db = make_mock_db()
    mock_db.execute = AsyncMock(return_value=_list_result(orders))

    with make_admin_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/credit-orders?status=pending", headers=AUTH)

    assert resp.status_code == 200
    assert len(resp.json()) == 1


# ── GET /admin/credit-orders/{id}/slip-url ────────────────────────────────────


def test_get_slip_url_returns_signed_url():
    order = _order()
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with (
        patch(
            "app.routers.admin.credits.storage_service.signed_url",
            new=AsyncMock(return_value="https://x.supabase.co/signed?token=abc"),
        ),
        make_admin_test_client(mock_db) as client,
    ):
        resp = client.get(f"{BASE}/credit-orders/{order.id}/slip-url", headers=AUTH)

    assert resp.status_code == 200
    body = resp.json()
    assert "signed_url" in body
    assert body["signed_url"].startswith("https://")


def test_get_slip_url_returns_404_when_no_slip():
    order = _order()
    order.slip_object_key = None
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with make_admin_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/credit-orders/{order.id}/slip-url", headers=AUTH)

    assert resp.status_code == 404


# ── POST /admin/credit-orders/{id}/approve ────────────────────────────────────


def test_approve_order_marks_paid_and_grants_credits():
    order_id = str(uuid.uuid4())
    order = _order(order_id=order_id, status="awaiting_review")
    proforma = _proforma(order_id=order_id)

    # A top-up pack fulfils via grant_credits (subscription packs take the
    # activate_subscription branch instead).
    pack = MagicMock()
    pack.code = order.pack_code
    pack.kind = "topup"

    mock_db = make_mock_db()
    # grant_credits calls scalar_one() directly on the execute result
    grant_result = MagicMock()
    grant_result.scalar_one.return_value = 500
    mock_db.execute.side_effect = [
        _scalar(order),  # select CreditOrder
        _scalar(proforma),  # select BillingDocument (proforma)
        _scalar(pack),  # select CreditPack (kind branch)
        grant_result,  # grant_credits: pg_insert returning balance
    ]

    with (
        patch(
            "app.routers.admin.credits.bds.issue_document",
            new=AsyncMock(return_value=MagicMock()),
        ),
        make_admin_test_client(mock_db) as client,
    ):
        resp = client.post(f"{BASE}/credit-orders/{order_id}/approve", headers=AUTH)

    assert resp.status_code == 200
    assert resp.json()["status"] == "paid"


def test_approve_order_wrong_status_returns_409():
    order = _order(status="pending")
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with make_admin_test_client(mock_db) as client:
        resp = client.post(f"{BASE}/credit-orders/{order.id}/approve", headers=AUTH)

    assert resp.status_code == 409


# ── POST /admin/credit-orders/{id}/reject ─────────────────────────────────────


def test_reject_order_sets_rejected_status_and_reason():
    order_id = str(uuid.uuid4())
    order = _order(order_id=order_id, status="awaiting_review")
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with make_admin_test_client(mock_db) as client:
        resp = client.post(
            f"{BASE}/credit-orders/{order_id}/reject",
            json={"reason": "ยอดเงินไม่ตรงกับที่ระบุ"},
            headers=AUTH,
        )

    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"


def test_reject_order_wrong_status_returns_409():
    order = _order(status="paid")
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with make_admin_test_client(mock_db) as client:
        resp = client.post(
            f"{BASE}/credit-orders/{order.id}/reject",
            json={"reason": "Already paid"},
            headers=AUTH,
        )

    assert resp.status_code == 409


# ── POST /admin/credit-orders/{id}/hold ───────────────────────────────────────


def test_hold_order_parks_awaiting_review():
    order = _order(status="awaiting_review")
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with make_admin_test_client(mock_db) as client:
        resp = client.post(
            f"{BASE}/credit-orders/{order.id}/hold",
            json={"hold": True, "note": "emailed buyer to confirm amount"},
            headers=AUTH,
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "on_hold"
    assert body["admin_note"] == "emailed buyer to confirm amount"


def test_resume_order_returns_to_awaiting_review():
    order = _order(status="on_hold")
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with make_admin_test_client(mock_db) as client:
        resp = client.post(
            f"{BASE}/credit-orders/{order.id}/hold", json={"hold": False}, headers=AUTH
        )

    assert resp.status_code == 200
    assert resp.json()["status"] == "awaiting_review"


def test_hold_order_wrong_status_returns_409():
    order = _order(status="paid")
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with make_admin_test_client(mock_db) as client:
        resp = client.post(
            f"{BASE}/credit-orders/{order.id}/hold", json={"hold": True}, headers=AUTH
        )

    assert resp.status_code == 409


def test_approve_works_on_on_hold_order():
    """An on_hold order is still decidable — approve must succeed."""
    order_id = str(uuid.uuid4())
    order = _order(order_id=order_id, status="on_hold")
    proforma = _proforma(order_id=order_id)
    pack = MagicMock()
    pack.code = order.pack_code
    pack.kind = "topup"

    mock_db = make_mock_db()
    grant_result = MagicMock()
    grant_result.scalar_one.return_value = 500
    mock_db.execute.side_effect = [
        _scalar(order),
        _scalar(proforma),
        _scalar(pack),
        grant_result,
    ]

    with (
        patch(
            "app.routers.admin.credits.bds.issue_document",
            new=AsyncMock(return_value=MagicMock()),
        ),
        make_admin_test_client(mock_db) as client,
    ):
        resp = client.post(f"{BASE}/credit-orders/{order_id}/approve", headers=AUTH)

    assert resp.status_code == 200
    assert resp.json()["status"] == "paid"


# ── POST /admin/credit-orders/{id}/cancel ─────────────────────────────────────


def test_cancel_pending_order():
    order = _order(status="pending")
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with make_admin_test_client(mock_db) as client:
        resp = client.post(f"{BASE}/credit-orders/{order.id}/cancel", headers=AUTH)

    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


def test_cancel_non_pending_returns_409():
    order = _order(status="awaiting_review")
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with make_admin_test_client(mock_db) as client:
        resp = client.post(f"{BASE}/credit-orders/{order.id}/cancel", headers=AUTH)

    assert resp.status_code == 409


# ── Scope guard ───────────────────────────────────────────────────────────────


def test_scoped_admin_cannot_access_other_tenants_order():
    """A scoped admin (tenant_scope='other-tenant') must not see TENANT_ID's order."""
    order = _order(tenant_id=TENANT_ID)
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with make_admin_test_client(mock_db, tenant_scope="other-tenant") as client:
        resp = client.get(f"{BASE}/credit-orders/{order.id}/slip-url", headers=AUTH)

    assert resp.status_code == 403
