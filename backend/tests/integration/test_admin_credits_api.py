"""
Integration tests for admin credit-order endpoints:
  GET   /api/v1/admin/credit-orders
  GET   /api/v1/admin/credit-orders/{id}/slip-url
  POST  /api/v1/admin/credit-orders/{id}/approve
  POST  /api/v1/admin/credit-orders/{id}/reject
  POST  /api/v1/admin/credit-orders/{id}/hold     (update admin note)
  POST  /api/v1/admin/credit-orders/{id}/cancel
  POST  /api/v1/admin/credit-orders/post-ar
  GET   /api/v1/admin/credit-orders/kpi
  GET   /api/v1/admin/ar-customer-profiles  + PATCH
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
    status="in_progress",
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
    row.billing_period = "monthly"
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
    row.carmen_ar_posted_at = None
    row.carmen_ar_ref = None
    row.proforma_number = None
    row.buyer_name = None
    row.carmen_ar_code = None
    return row


def _proforma(order_id=None, tax_id="1234567890123", branch="HQ"):
    doc = MagicMock()
    doc.id = str(uuid.uuid4())
    doc.number = "PI-202606-0001"  # AR DealId maps to this, NOT order.id (else FolioNo overflows)
    doc.issue_date = datetime(2026, 6, 15, tzinfo=UTC)
    doc.description = "Starter pack"
    doc.buyer_name = "Test Co"
    doc.buyer_contact_name = "Khun Somchai"
    doc.buyer_tel = "02-123-4567"
    doc.buyer_email = "somchai@test.co"
    doc.buyer_tax_id = tax_id
    doc.buyer_address = "Bangkok"
    doc.buyer_branch = branch
    doc.order_id = order_id or str(uuid.uuid4())
    doc.deleted_at = None
    # Monetary snapshot — net 990 + 7% VAT (matches the 990-net fixtures elsewhere).
    doc.subtotal = Decimal("990")
    doc.vat_amount = Decimal("69.30")
    doc.total = Decimal("1059.30")
    return doc


def _profile(ar_code="AR-TEST001"):
    p = MagicMock()
    p.id = str(uuid.uuid4())
    p.buyer_name = "Test Co"
    p.buyer_tax_id = "1234567890123"
    p.buyer_branch = "HQ"
    p.carmen_ar_code = ar_code
    p.deleted_at = None
    return p


def _scalar(row):
    r = MagicMock()
    r.scalar_one_or_none.return_value = row
    return r


def _scalar_val(value):
    r = MagicMock()
    r.scalar.return_value = value
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
    """The list endpoint reads (order, tenant_name, proforma_number, buyer_name, ar_code) tuples."""
    execute_result = MagicMock()
    execute_result.all.return_value = [
        (o, "Acme Co", "PI-202606-0001", "Acme Co.,Ltd.", "AR-ACME01") for o in orders
    ]
    return execute_result


def test_list_credit_orders_returns_in_progress_by_default():
    orders = [_order(status="in_progress"), _order(status="in_progress")]
    mock_db = make_mock_db()
    mock_db.execute = AsyncMock(return_value=_list_result(orders))

    with make_admin_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/credit-orders", headers=AUTH)

    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    assert body[0]["tenant_name"] == "Acme Co"


def test_list_credit_orders_with_explicit_status_filter():
    orders = [_order(status="complete")]
    mock_db = make_mock_db()
    mock_db.execute = AsyncMock(return_value=_list_result(orders))

    with make_admin_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/credit-orders?status=complete", headers=AUTH)

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
    order = _order(order_id=order_id, status="in_progress", amount_thb=1059.30)

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
        _scalar(pack),  # select CreditPack (kind branch)
        grant_result,  # grant_credits: pg_insert returning balance
    ]

    with make_admin_test_client(mock_db) as client:
        resp = client.post(f"{BASE}/credit-orders/{order_id}/approve", headers=AUTH)

    assert resp.status_code == 200
    assert resp.json()["status"] == "paid"


def test_approve_subscription_order_activates_plan():
    """A subscription order takes the activate_subscription branch (annual here)."""
    order_id = str(uuid.uuid4())
    order = _order(order_id=order_id, status="in_progress", pack_code="sub_pro", credits=1500)
    order.billing_period = "annual"

    pack = MagicMock()
    pack.code = order.pack_code
    pack.kind = "subscription"

    mock_db = make_mock_db()
    mock_db.execute.side_effect = [
        _scalar(order),  # select CreditOrder
        _scalar(pack),  # select CreditPack (kind branch)
        MagicMock(),  # activate_subscription: supersede UPDATE
        MagicMock(),  # activate_subscription: pg_insert new window
    ]

    with make_admin_test_client(mock_db) as client:
        resp = client.post(f"{BASE}/credit-orders/{order_id}/approve", headers=AUTH)

    assert resp.status_code == 200
    assert resp.json()["status"] == "paid"
    assert resp.json()["billing_period"] == "annual"


def test_approve_order_wrong_status_returns_409():
    order = _order(status="paid")
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with make_admin_test_client(mock_db) as client:
        resp = client.post(f"{BASE}/credit-orders/{order.id}/approve", headers=AUTH)

    assert resp.status_code == 409


# ── POST /admin/credit-orders/{id}/reject ─────────────────────────────────────


def test_reject_order_sets_void_status_and_reason():
    order_id = str(uuid.uuid4())
    order = _order(order_id=order_id, status="in_progress")
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with make_admin_test_client(mock_db) as client:
        resp = client.post(
            f"{BASE}/credit-orders/{order_id}/reject",
            json={"reason": "ยอดเงินไม่ตรงกับที่ระบุ"},
            headers=AUTH,
        )

    assert resp.status_code == 200
    assert resp.json()["status"] == "void"


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


# ── POST /admin/credit-orders/{id}/hold (update admin note) ───────────────────


def test_update_note_on_in_progress_order():
    order = _order(status="in_progress")
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with make_admin_test_client(mock_db) as client:
        resp = client.post(
            f"{BASE}/credit-orders/{order.id}/hold",
            json={"note": "emailed buyer to confirm amount"},
            headers=AUTH,
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "in_progress"  # note does not change status
    assert body["admin_note"] == "emailed buyer to confirm amount"


def test_update_note_wrong_status_returns_409():
    order = _order(status="paid")
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with make_admin_test_client(mock_db) as client:
        resp = client.post(
            f"{BASE}/credit-orders/{order.id}/hold", json={"note": "x"}, headers=AUTH
        )

    assert resp.status_code == 409


# ── POST /admin/credit-orders/{id}/cancel ─────────────────────────────────────


def test_cancel_in_progress_order():
    order = _order(status="in_progress")
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with make_admin_test_client(mock_db) as client:
        resp = client.post(f"{BASE}/credit-orders/{order.id}/cancel", headers=AUTH)

    assert resp.status_code == 200
    assert resp.json()["status"] == "void"


def test_cancel_non_in_progress_returns_409():
    order = _order(status="paid")
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with make_admin_test_client(mock_db) as client:
        resp = client.post(f"{BASE}/credit-orders/{order.id}/cancel", headers=AUTH)

    assert resp.status_code == 409


# ── POST /admin/credit-orders/post-ar ─────────────────────────────────────────


def test_post_ar_marks_complete_with_ref():
    order_id = str(uuid.uuid4())
    order = _order(order_id=order_id, status="paid")
    proforma = _proforma(order_id=order_id)
    profile = _profile(ar_code="AR-TEST001")

    mock_db = make_mock_db()
    mock_db.execute.side_effect = [
        _scalar(order),  # select CreditOrder
        _scalar(proforma),  # select BillingDocument (proforma)
        _scalar(profile),  # select ArCustomerProfile
    ]

    posted = AsyncMock(return_value={"success": True, "carmen_ar_ref": "AR-REF-1"})
    with patch("app.routers.admin.credits.ar_posting_service.post_ar_entry", posted):
        with make_admin_test_client(mock_db) as client:
            resp = client.post(
                f"{BASE}/credit-orders/post-ar", json={"order_ids": [order_id]}, headers=AUTH
            )

    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == 1
    assert results[0]["success"] is True
    assert results[0]["carmen_ar_ref"] == "AR-REF-1"
    assert order.status == "complete"
    # Exact figures come from the proforma (single source of truth) — no internal
    # tax invoice is issued/queried anymore.
    kwargs = posted.call_args.kwargs
    assert kwargs["total"] == 1059.30
    assert kwargs["net"] == 990.00
    assert kwargs["vat"] == 69.30
    assert kwargs["ar_code"] == "AR-TEST001"
    # Carmen field mapping: DealId = Proforma Invoice No (the FolioNo-overflow fix —
    # must NOT be the order UUID), ClosingDate = Proforma Date,
    # Remark = Contact Name/Tel/Email (newline-separated).
    assert kwargs["deal_id"] == "PI-202606-0001"
    assert kwargs["deal_id"] != order_id
    assert kwargs["closing_date"] == "2026-06-15T00:00:00+00:00"
    assert kwargs["remark"] == (
        "Contact Name : Khun Somchai\nTel. : 02-123-4567\nEmail : somchai@test.co"
    )
    assert kwargs["description"].startswith("Package :")


def test_post_ar_rejects_when_no_ar_code():
    order_id = str(uuid.uuid4())
    order = _order(order_id=order_id, status="paid")
    proforma = _proforma(order_id=order_id)
    profile = _profile(ar_code=None)  # unmapped

    mock_db = make_mock_db()
    mock_db.execute.side_effect = [
        _scalar(order),
        _scalar(proforma),
        _scalar(profile),
    ]

    with make_admin_test_client(mock_db) as client:
        resp = client.post(
            f"{BASE}/credit-orders/post-ar", json={"order_ids": [order_id]}, headers=AUTH
        )

    assert resp.status_code == 200
    results = resp.json()["results"]
    assert results[0]["success"] is False
    assert "AR code" in results[0]["error"]


def test_post_ar_rejects_non_paid_order():
    order_id = str(uuid.uuid4())
    order = _order(order_id=order_id, status="in_progress")
    mock_db = make_mock_db()
    mock_db.execute.side_effect = [_scalar(order)]

    with make_admin_test_client(mock_db) as client:
        resp = client.post(
            f"{BASE}/credit-orders/post-ar", json={"order_ids": [order_id]}, headers=AUTH
        )

    assert resp.status_code == 200
    results = resp.json()["results"]
    assert results[0]["success"] is False
    assert "paid" in results[0]["error"]


# ── GET /admin/credit-orders/kpi ──────────────────────────────────────────────


def test_kpi_returns_funnel_amounts():
    # One grouped query over (status, slip?) → (sum, count). in_progress splits
    # into awaiting (no slip) / to_review (slip).
    grouped = MagicMock()
    grouped.all.return_value = [
        ("in_progress", False, Decimal("20000"), 2),  # awaiting payment
        ("in_progress", True, Decimal("120000"), 3),  # to review
        ("on_hold", False, Decimal("5000"), 1),  # expired, awaiting buyer contact
        ("paid", True, Decimal("35000"), 1),  # to post
        ("complete", True, Decimal("60000"), 4),  # posted
        ("void", False, Decimal("15000"), 1),  # rejected — excluded from total
    ]
    mock_db = make_mock_db()
    mock_db.execute.side_effect = [
        _scalar_val(3),  # unmapped count
        grouped,  # grouped funnel query
    ]

    with make_admin_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/credit-orders/kpi", headers=AUTH)

    assert resp.status_code == 200
    body = resp.json()
    assert body["unmapped_count"] == 3
    assert body["to_review_count"] == 3
    assert body["to_post_count"] == 1
    assert body["awaiting_amount"] == 20000.0
    assert body["to_review_amount"] == 120000.0
    assert body["on_hold_amount"] == 5000.0
    assert body["to_post_amount"] == 35000.0
    assert body["posted_amount"] == 60000.0
    assert body["rejected_amount"] == 15000.0
    # Funnel reconciles: total_active = awaiting + to_review + on_hold + to_post + posted (void excluded).
    assert body["total_amount"] == 240000.0
    assert body["status_counts"] == {
        "awaiting_payment": 2,
        "to_review": 3,
        "on_hold": 1,
        "to_post": 1,
        "posted": 4,
        "rejected": 1,
    }


def test_list_credit_orders_carries_proforma_and_ar_code():
    orders = [_order(status="paid")]
    mock_db = make_mock_db()
    mock_db.execute = AsyncMock(return_value=_list_result(orders))

    with make_admin_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/credit-orders?status=paid", headers=AUTH)

    assert resp.status_code == 200
    row = resp.json()[0]
    assert row["proforma_number"] == "PI-202606-0001"
    assert row["carmen_ar_code"] == "AR-ACME01"


# ── AR customer profiles ──────────────────────────────────────────────────────


def test_list_ar_profiles():
    profiles = [_profile(), _profile(ar_code=None)]
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalars_result(profiles)

    with make_admin_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/ar-customer-profiles", headers=AUTH)

    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_update_ar_profile_sets_code():
    profile = _profile(ar_code=None)
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(profile)

    with make_admin_test_client(mock_db) as client:
        resp = client.patch(
            f"{BASE}/ar-customer-profiles/{profile.id}",
            json={"carmen_ar_code": "ar-new-001"},
            headers=AUTH,
        )

    assert resp.status_code == 200
    assert resp.json()["carmen_ar_code"] == "AR-NEW-001"  # upper-cased


def _scalars_result(rows):
    m = MagicMock()
    m.all.return_value = list(rows)
    r = MagicMock()
    r.scalars.return_value = m
    return r


# ── Sync AR profiles ─────────────────────────────────────────────────────────


def test_sync_ar_profiles_inserts_new_buyers():
    """Sync scans billing_documents and inserts new AR profiles."""
    mock_db = make_mock_db()

    # 1st execute = distinct buyer rows from billing_documents
    buyer_rows = MagicMock()
    buyer_rows.all.return_value = [
        ("Acme Co", "1234567890123", "HQ"),
        ("Beta Inc", "", ""),  # empty tax_id
    ]
    # 2nd execute = existing empty-tax-id profiles (none yet)
    existing_empty = MagicMock()
    existing_empty.all.return_value = []
    # 3rd execute = pg_insert on_conflict_do_nothing result
    insert_result = MagicMock()
    insert_result.rowcount = 1

    mock_db.execute.side_effect = [buyer_rows, existing_empty, insert_result]

    with make_admin_test_client(mock_db) as client:
        resp = client.post(f"{BASE}/ar-customer-profiles/sync", headers=AUTH)

    assert resp.status_code == 200
    body = resp.json()
    assert body["scanned"] == 2
    assert body["inserted"] == 2  # 1 via pg_insert + 1 via db.add (empty tax_id)


def test_sync_ar_profiles_skips_duplicate_empty_tax_id():
    """Empty-tax-id buyers already in the DB are not re-inserted."""
    mock_db = make_mock_db()

    buyer_rows = MagicMock()
    buyer_rows.all.return_value = [("Existing Co", "", "")]
    existing_empty = MagicMock()
    existing_empty.all.return_value = [("Existing Co", "")]

    mock_db.execute.side_effect = [buyer_rows, existing_empty]

    with make_admin_test_client(mock_db) as client:
        resp = client.post(f"{BASE}/ar-customer-profiles/sync", headers=AUTH)

    assert resp.status_code == 200
    assert resp.json()["inserted"] == 0


# ── List order documents ─────────────────────────────────────────────────────


def test_list_order_documents_returns_docs():
    order = _order()
    doc = MagicMock()
    doc.id = str(uuid.uuid4())
    doc.doc_type = "proforma"
    doc.number = "PF-202606-0001"
    doc.issue_date = datetime.now(UTC)
    doc.seller_name = None
    doc.seller_tax_id = None
    doc.seller_address = None
    doc.seller_branch = None
    doc.buyer_name = "Test Co"
    doc.buyer_tax_id = "1234567890123"
    doc.buyer_address = "Bangkok"
    doc.buyer_branch = "HQ"
    doc.buyer_email = None
    doc.buyer_contact_name = None
    doc.buyer_tel = None
    doc.pack_code = "starter"
    doc.description = "500 credits"
    doc.credits = 500
    doc.subtotal = Decimal("925.23")
    doc.vat_rate = Decimal("7.00")
    doc.vat_amount = Decimal("64.77")
    doc.total = Decimal("990.00")
    doc.currency = "THB"
    doc.created_at = datetime.now(UTC)
    doc.deleted_at = None

    mock_db = make_mock_db()
    mock_db.execute.side_effect = [_scalar(order), _scalars_result([doc])]

    with make_admin_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/credit-orders/{order.id}/documents", headers=AUTH)

    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["number"] == "PF-202606-0001"


# ── Scope guard ───────────────────────────────────────────────────────────────


def test_scoped_admin_cannot_access_other_tenants_order():
    """A scoped admin (tenant_scope='other-tenant') must not see TENANT_ID's order."""
    order = _order(tenant_id=TENANT_ID)
    mock_db = make_mock_db()
    mock_db.execute.return_value = _scalar(order)

    with make_admin_test_client(mock_db, tenant_scope="other-tenant") as client:
        resp = client.get(f"{BASE}/credit-orders/{order.id}/slip-url", headers=AUTH)

    assert resp.status_code == 403
