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
    row.price_annual_thb = None  # /packs fills this for subscriptions
    row.sort_order = sort_order
    row.is_active = is_active
    row.description = f"{credits} credits"
    return row


def _order(
    order_id=None,
    pack_code="starter",
    credits=500,
    amount_thb=990.0,
    status="in_progress",
    tenant_id="t-test",
):
    row = MagicMock()
    row.id = order_id or str(uuid.uuid4())
    row.pack_code = pack_code
    row.credits = credits
    row.amount_thb = Decimal(str(amount_thb))
    row.billing_period = "monthly"
    row.status = status
    row.tenant_id = tenant_id
    row.deleted_at = None
    row.slip_object_key = None
    row.slip_uploaded_at = None
    # Full CreditOrderResponse surface so model_validate(row) succeeds.
    row.tenant_name = None
    row.created_at = None
    row.approved_at = None
    row.approved_by = None
    row.expires_at = None
    row.rejected_reason = None
    row.admin_note = None
    row.carmen_ar_posted_at = None
    row.carmen_ar_ref = None
    row.proforma_number = None
    row.buyer_name = None
    row.carmen_ar_code = None
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
    doc.buyer_email = None
    doc.buyer_contact_name = None
    doc.buyer_tel = None
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


def test_list_packs_adds_annual_price_for_subscriptions():
    """Subscription packs get a computed annual price (12mo − 10%); top-ups don't."""
    packs = [
        _pack("sub_pro", 1500, 2490.0, 0, kind="subscription"),
        _pack("pack_small", 500, 1200.0, 1, kind="topup"),
    ]
    scalars_result = MagicMock()
    scalars_result.all.return_value = packs
    execute_result = MagicMock()
    execute_result.scalars.return_value = scalars_result
    mock_db = make_mock_db()
    mock_db.execute = AsyncMock(return_value=execute_result)

    with make_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/packs", headers=AUTH)

    assert resp.status_code == 200
    body = resp.json()
    sub = next(p for p in body if p["code"] == "sub_pro")
    topup = next(p for p in body if p["code"] == "pack_small")
    assert sub["price_annual_thb"] == 26892.0  # 2490 × 12 × 0.9
    assert topup["price_annual_thb"] is None


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
    # 1st execute = one-open-order pre-check (none), 2nd = pack lookup.
    mock_db.execute.side_effect = [_scalar(None), _scalar(pack)]

    # The router builds a CreditOrder and relies on flush to populate the
    # uuid default; mirror that here so CreditOrderResponse.id validates.
    added = {}
    mock_db.add.side_effect = lambda obj: added.setdefault("order", obj)

    async def _flush():
        order = added.get("order")
        if order is not None and getattr(order, "id", None) is None:
            order.id = uuid.uuid4()

    mock_db.flush.side_effect = _flush

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


def test_create_order_annual_subscription_uses_discounted_price():
    """Annual subscription order is priced at 12 months − 10%, with VAT on top."""
    from app.services.credit_service import annual_price
    from app.utils.tax import vat_on_top

    pack = _pack("sub_pro", 1500, 2490.0, kind="subscription")
    mock_db = make_mock_db()
    # pre-check (no open order), pack lookup, active-subscription guard (none).
    mock_db.execute.side_effect = [_scalar(None), _scalar(pack), _scalar(None)]

    added = {}
    mock_db.add.side_effect = lambda obj: added.setdefault("order", obj)

    async def _flush():
        order = added.get("order")
        if order is not None and getattr(order, "id", None) is None:
            order.id = uuid.uuid4()

    mock_db.flush.side_effect = _flush

    with (
        patch(
            "app.routers.credits.bds.issue_document",
            new=AsyncMock(return_value=_billing_doc(pack_code="sub_pro", credits=1500)),
        ),
        patch("app.routers.credits.bds.get_promptpay_id", new=AsyncMock(return_value="0812345678")),
        make_test_client(mock_db) as client,
    ):
        resp = client.post(
            f"{BASE}/orders",
            json={
                "pack_code": "sub_pro",
                "billing_period": "annual",
                "buyer": {"name": "Test Co", "tax_id": "", "address": "", "branch": ""},
            },
            headers=AUTH,
        )

    assert resp.status_code == 200
    order = resp.json()["order"]
    assert order["billing_period"] == "annual"
    _net, _vat, gross = vat_on_top(annual_price(Decimal("2490")))
    assert order["amount_thb"] == float(gross)  # annual net + VAT, not monthly


def test_create_order_rejects_unknown_billing_period():
    with make_test_client(make_mock_db()) as client:
        resp = client.post(
            f"{BASE}/orders",
            json={"pack_code": "sub_pro", "billing_period": "weekly"},
            headers=AUTH,
        )
    assert resp.status_code == 422


def test_annual_price_is_ten_percent_off():
    """Annual = monthly × 12 × 0.9 — the one money-path check that must hold."""
    from app.services.credit_service import annual_price

    assert annual_price(Decimal("490")) == Decimal("5292.00")
    assert annual_price(Decimal("990")) == Decimal("10692.00")
    assert annual_price(Decimal("2490")) == Decimal("26892.00")


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
    # 1st execute = one-open-order pre-check (none), 2nd = inactive pack lookup.
    mock_db.execute.side_effect = [_scalar(None), _scalar(pack)]

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


def test_upload_slip_keeps_order_in_progress():
    order_id = str(uuid.uuid4())
    order = _order(order_id=order_id, status="in_progress")
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
    # Slip recorded but order stays in_progress (admin still must review).
    assert resp.json()["status"] == "in_progress"


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
    order = _order(status="paid")
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
    order = _order(status="in_progress")
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


# ── POST /credits/orders/{id}/cancel ──────────────────────────────────────────


def test_cancel_in_progress_order_returns_void():
    order = _order(status="in_progress")
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with make_test_client(mock_db) as client:
        resp = client.post(f"{BASE}/orders/{order.id}/cancel", headers=AUTH)

    assert resp.status_code == 200
    assert resp.json()["status"] == "void"


def test_cancel_order_not_found_returns_404():
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(None)

    with make_test_client(mock_db) as client:
        resp = client.post(f"{BASE}/orders/nonexistent-id/cancel", headers=AUTH)

    assert resp.status_code == 404


def test_cancel_non_in_progress_order_returns_409():
    order = _order(status="paid")
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with make_test_client(mock_db) as client:
        resp = client.post(f"{BASE}/orders/{order.id}/cancel", headers=AUTH)

    assert resp.status_code == 409


# ── GET /credits/orders ───────────────────────────────────────────────────────


def _paged_orders_db(orders, total):
    """Mock AsyncSession for the paged /orders route: COUNT(*) first, then the rows."""
    calls = []

    async def fake_execute(_stmt):
        result = MagicMock()
        calls.append(_stmt)
        if len(calls) == 1:  # paginate's COUNT(*)
            result.scalar_one.return_value = total
        else:
            result.scalars.return_value.all.return_value = orders
        return result

    mock_db = make_mock_db()
    mock_db.execute = fake_execute
    return mock_db


def test_list_orders_returns_tenants_orders():
    orders = [_order(status="in_progress"), _order(status="paid")]
    mock_db = _paged_orders_db(orders, total=2)

    with make_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/orders", headers=AUTH)

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["data"]) == 2
    assert body["total"] == 2
    assert body["limit"] == 8
    assert body["offset"] == 0


def test_list_orders_total_is_the_full_count_not_the_page():
    """A pager needs to know there are 57 orders while holding 8 of them."""
    mock_db = _paged_orders_db([_order(status="paid")], total=57)

    with make_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/orders?limit=1&offset=8", headers=AUTH)

    body = resp.json()
    assert body["total"] == 57
    assert body["offset"] == 8
    assert len(body["data"]) == 1


def test_list_orders_rejects_an_out_of_range_limit():
    """The cap is the point — an unbounded limit re-opens the unbounded query."""
    mock_db = _paged_orders_db([], total=0)

    with make_test_client(mock_db) as client:
        assert client.get(f"{BASE}/orders?limit=101", headers=AUTH).status_code == 422
        assert client.get(f"{BASE}/orders?offset=-1", headers=AUTH).status_code == 422
