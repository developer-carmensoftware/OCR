"""
Integration tests for tenant-facing credit endpoints:
  GET  /api/v1/credits/packs
  GET  /api/v1/credits/company-profile
  POST /api/v1/credits/orders
  POST /api/v1/credits/orders/{id}/slip
  GET  /api/v1/credits/orders
"""

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.exc import IntegrityError

from tests.conftest import make_mock_db
from tests.integration.conftest import make_test_client

BASE = "/api/v1/credits"
AUTH = {"Authorization": "Bearer dummy"}


# ── Mock row helpers ──────────────────────────────────────────────────────────


def _pack(code="starter", credits=500, price_thb=990.0, sort_order=0, is_active=True, kind="topup"):
    row = MagicMock()
    row.code = code
    row.kind = kind
    row.credits = credits
    row.price_thb = Decimal(str(price_thb))
    row.sort_order = sort_order
    row.is_active = is_active
    return row


def _order(
    order_id=None,
    pack_code="starter",
    credits=500,
    amount_thb=990.0,
    status="pending",
    tenant_id="t-test",
):
    row = MagicMock()
    row.id = order_id or str(uuid.uuid4())
    row.pack_code = pack_code
    row.credits = credits
    row.amount_thb = Decimal(str(amount_thb))
    row.status = status
    row.tenant_id = tenant_id
    row.deleted_at = None
    row.slip_object_key = None
    row.slip_uploaded_at = None
    return row


def _billing_doc(
    doc_type="proforma",
    number="PF-202606-0001",
    pack_code="starter",
    credits=500,
):
    doc = MagicMock()
    doc.id = str(uuid.uuid4())
    doc.doc_type = doc_type
    doc.number = number
    doc.issue_date = datetime.now(UTC)
    doc.seller_name = None
    doc.seller_tax_id = None
    doc.seller_address = None
    doc.seller_branch = None
    doc.buyer_name = None
    doc.buyer_tax_id = None
    doc.buyer_address = None
    doc.buyer_branch = None
    doc.pack_code = pack_code
    doc.description = f"{credits} credits"
    doc.credits = credits
    doc.subtotal = Decimal("925.23")
    doc.vat_rate = Decimal("7.00")
    doc.vat_amount = Decimal("64.77")
    doc.total = Decimal("990.00")
    doc.currency = "THB"
    doc.created_at = datetime.now(UTC)
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


# ── GET /credits/packs ────────────────────────────────────────────────────────


def test_list_packs_returns_active_packs():
    packs = [_pack("starter", 500, 990.0, 0), _pack("pro", 2000, 2990.0, 1)]
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalars(packs).scalars.return_value.__class__()
    # Use side_effect to return scalars result
    scalars_result = MagicMock()
    scalars_result.all.return_value = packs
    execute_result = MagicMock()
    execute_result.scalars.return_value = scalars_result
    mock_db.execute = AsyncMock(return_value=execute_result)

    with make_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/packs", headers=AUTH)

    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    assert body[0]["code"] == "starter"
    assert body[1]["code"] == "pro"


def test_list_packs_empty_returns_empty_list():
    scalars_result = MagicMock()
    scalars_result.all.return_value = []
    execute_result = MagicMock()
    execute_result.scalars.return_value = scalars_result
    mock_db = make_mock_db()
    mock_db.execute = AsyncMock(return_value=execute_result)

    with make_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/packs", headers=AUTH)

    assert resp.status_code == 200
    assert resp.json() == []


# ── GET /credits/company-profile ─────────────────────────────────────────────


def test_company_profile_returns_form_source_when_no_data():
    mock_db = make_mock_db()
    # _fetch_billing_configs → all() returns []
    # get_last_buyer_info → first() returns None
    empty_all = MagicMock()
    empty_all.all.return_value = []
    empty_all.first.return_value = None
    mock_db.execute = AsyncMock(return_value=empty_all)

    with (
        patch(
            "app.routers.credits.carmen_service.get_company_profile", new=AsyncMock(return_value={})
        ),
        make_test_client(mock_db) as client,
    ):
        resp = client.get(f"{BASE}/company-profile", headers=AUTH)

    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "form"
    assert body["name"] == ""


# ── POST /credits/orders ──────────────────────────────────────────────────────


def test_create_order_returns_qr_and_proforma():
    pack = _pack("starter", 500, 990.0)
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(pack)

    mock_doc = _billing_doc()

    with (
        patch("app.routers.credits.bds.issue_document", new=AsyncMock(return_value=mock_doc)),
        patch("app.routers.credits.bds.get_promptpay_id", new=AsyncMock(return_value="0812345678")),
        make_test_client(mock_db) as client,
    ):
        resp = client.post(
            f"{BASE}/orders",
            json={
                "pack_code": "starter",
                "buyer": {"name": "Test Co", "tax_id": "", "address": "", "branch": ""},
            },
            headers=AUTH,
        )

    assert resp.status_code == 200
    body = resp.json()
    assert "order" in body
    assert body["qr"]["payload"].startswith("000201")
    assert body["qr"]["promptpay_id"] == "0812345678"
    assert body["proforma"]["number"] == "PF-202606-0001"


def test_create_order_pack_not_found_returns_404():
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(None)

    with make_test_client(mock_db) as client:
        resp = client.post(
            f"{BASE}/orders",
            json={"pack_code": "nonexistent"},
            headers=AUTH,
        )

    assert resp.status_code == 404


def test_create_order_inactive_pack_returns_404():
    pack = _pack("starter", 500, 990.0, is_active=False)
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(pack)

    with make_test_client(mock_db) as client:
        resp = client.post(
            f"{BASE}/orders",
            json={"pack_code": "starter"},
            headers=AUTH,
        )

    assert resp.status_code == 404


def test_create_order_duplicate_open_order_returns_409():
    pack = _pack("starter", 500, 990.0)
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(pack)
    mock_db.flush = AsyncMock(side_effect=IntegrityError("dup", {}, None))

    with make_test_client(mock_db) as client:
        resp = client.post(
            f"{BASE}/orders",
            json={"pack_code": "starter"},
            headers=AUTH,
        )

    assert resp.status_code == 409


# ── POST /credits/orders/{id}/slip ────────────────────────────────────────────


def test_upload_slip_moves_order_to_awaiting_review():
    order_id = str(uuid.uuid4())
    order = _order(order_id=order_id, status="pending")
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with (
        patch(
            "app.routers.credits.FileService.validate_and_read",
            new=AsyncMock(return_value=(b"fake-jpeg-data", "slip.jpg")),
        ),
        patch(
            "app.routers.credits.storage_service.upload_slip",
            new=AsyncMock(return_value=f"t-test/{order_id}.jpg"),
        ),
        make_test_client(mock_db) as client,
    ):
        resp = client.post(
            f"{BASE}/orders/{order_id}/slip",
            files={"file": ("slip.jpg", b"fake-jpeg-data", "image/jpeg")},
            headers=AUTH,
        )

    assert resp.status_code == 200
    assert resp.json()["status"] == "awaiting_review"


def test_upload_slip_order_not_found_returns_404():
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(None)

    with make_test_client(mock_db) as client:
        resp = client.post(
            f"{BASE}/orders/nonexistent-id/slip",
            files={"file": ("slip.jpg", b"data", "image/jpeg")},
            headers=AUTH,
        )

    assert resp.status_code == 404


def test_upload_slip_wrong_status_returns_409():
    order = _order(status="awaiting_review")
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with make_test_client(mock_db) as client:
        resp = client.post(
            f"{BASE}/orders/{order.id}/slip",
            files={"file": ("slip.jpg", b"data", "image/jpeg")},
            headers=AUTH,
        )

    assert resp.status_code == 409


def test_upload_slip_unsupported_content_type_returns_422():
    order = _order(status="pending")
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with (
        patch(
            "app.routers.credits.FileService.validate_and_read",
            new=AsyncMock(return_value=(b"data", "file.txt")),
        ),
        make_test_client(mock_db) as client,
    ):
        resp = client.post(
            f"{BASE}/orders/{order.id}/slip",
            files={"file": ("file.txt", b"data", "text/plain")},
            headers=AUTH,
        )

    assert resp.status_code == 422


# ── GET /credits/orders ───────────────────────────────────────────────────────


def test_list_orders_returns_tenants_orders():
    orders = [_order(status="pending"), _order(status="awaiting_review")]
    scalars_result = MagicMock()
    scalars_result.all.return_value = orders
    execute_result = MagicMock()
    execute_result.scalars.return_value = scalars_result
    mock_db = make_mock_db()
    mock_db.execute = AsyncMock(return_value=execute_result)

    with make_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/orders", headers=AUTH)

    assert resp.status_code == 200
    assert len(resp.json()) == 2
