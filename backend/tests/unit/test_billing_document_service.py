"""
Unit tests for billing_document_service:
  - _fetch_billing_configs
  - get_seller_snapshot
  - get_promptpay_id
  - issue_document
  - get_last_buyer_info
"""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.enums import BillingDocumentType
from app.services.billing_document_service import (
    BuyerInfo,
    _fetch_billing_configs,
    get_last_buyer_info,
    get_promptpay_id,
    get_seller_snapshot,
    issue_document,
)


def _make_db(all_rows=None, first_row=None):
    """AsyncMock session with configurable execute results."""
    db = AsyncMock()
    result = MagicMock()
    result.all.return_value = list(all_rows or [])
    result.first.return_value = first_row
    result.scalar_one.return_value = 1
    db.execute = AsyncMock(return_value=result)
    db.add = MagicMock()
    return db


# ── _fetch_billing_configs ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_fetch_configs_unwraps_json_quotes():
    rows = [
        ("billing.seller_name", '"บริษัท XYZ จำกัด"'),
        ("billing.promptpay_id", '"0812345678"'),
    ]
    db = _make_db(all_rows=rows)
    cfg = await _fetch_billing_configs(db)
    assert cfg["billing.seller_name"] == "บริษัท XYZ จำกัด"
    assert cfg["billing.promptpay_id"] == "0812345678"


@pytest.mark.asyncio
async def test_fetch_configs_empty_db():
    db = _make_db(all_rows=[])
    cfg = await _fetch_billing_configs(db)
    assert cfg == {}


@pytest.mark.asyncio
async def test_fetch_configs_numeric_value():
    rows = [("billing.vat_rate", 7)]  # stored as integer, not string
    db = _make_db(all_rows=rows)
    cfg = await _fetch_billing_configs(db)
    assert cfg["billing.vat_rate"] == "7"


# ── get_seller_snapshot ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_seller_snapshot_full():
    rows = [
        ("billing.seller_name", '"My Company Ltd."'),
        ("billing.seller_tax_id", '"1234567890123"'),
        ("billing.seller_address", '"123 Bangkok"'),
        ("billing.seller_branch", '"Head Office"'),
        ("billing.promptpay_id", '"0812345678"'),
        ("billing.vat_rate", '"7"'),
    ]
    db = _make_db(all_rows=rows)
    snap = await get_seller_snapshot(db)
    assert snap["name"] == "My Company Ltd."
    assert snap["tax_id"] == "1234567890123"
    assert snap["vat_rate"] == "7"
    assert snap["promptpay_id"] == "0812345678"


@pytest.mark.asyncio
async def test_get_seller_snapshot_defaults_when_empty():
    db = _make_db(all_rows=[])
    snap = await get_seller_snapshot(db)
    assert snap["name"] == ""
    assert snap["tax_id"] == ""
    assert snap["vat_rate"] == "7"  # hard-coded default


# ── get_promptpay_id ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_promptpay_id_returns_configured_value():
    rows = [("billing.promptpay_id", '"0918592274"')]
    db = _make_db(all_rows=rows)
    pid = await get_promptpay_id(db)
    assert pid == "0918592274"


@pytest.mark.asyncio
async def test_get_promptpay_id_returns_empty_when_missing():
    db = _make_db(all_rows=[])
    pid = await get_promptpay_id(db)
    assert pid == ""


# ── issue_document ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_issue_document_proforma_vat_math():
    db = _make_db()
    with (
        patch(
            "app.services.billing_document_service._fetch_billing_configs",
            new=AsyncMock(return_value={"billing.vat_rate": "7"}),
        ),
        patch(
            "app.services.billing_document_service._next_document_number",
            new=AsyncMock(return_value="PF-202606-0001"),
        ),
    ):
        doc = await issue_document(
            db,
            tenant_id="t-1",
            order_id="o-1",
            doc_type=BillingDocumentType.PROFORMA,
            pack_code="starter",
            pack_description="500 credits",
            credits=500,
            amount_thb=Decimal("990"),
            buyer=BuyerInfo(name="Buyer Co"),
        )

    assert doc.subtotal == Decimal("925.23")
    assert doc.vat_amount == Decimal("64.77")
    assert doc.total == Decimal("990")
    assert doc.doc_type == BillingDocumentType.PROFORMA
    assert doc.number == "PF-202606-0001"
    assert db.add.called


@pytest.mark.asyncio
async def test_issue_document_buyer_snapshot_saved():
    db = _make_db()
    with (
        patch(
            "app.services.billing_document_service._fetch_billing_configs",
            new=AsyncMock(return_value={"billing.vat_rate": "7", "billing.seller_name": "Seller"}),
        ),
        patch(
            "app.services.billing_document_service._next_document_number",
            new=AsyncMock(return_value="IV-202606-0001"),
        ),
    ):
        doc = await issue_document(
            db,
            tenant_id="t-1",
            order_id="o-1",
            doc_type=BillingDocumentType.TAX_INVOICE,
            pack_code="pro",
            pack_description="2000 credits",
            credits=2000,
            amount_thb=Decimal("2990"),
            buyer=BuyerInfo(
                name="Test Buyer Co",
                tax_id="9876543210123",
                address="1 Silom Rd",
                branch="HQ",
            ),
        )

    assert doc.buyer_name == "Test Buyer Co"
    assert doc.buyer_tax_id == "9876543210123"
    assert doc.buyer_address == "1 Silom Rd"
    assert doc.doc_type == BillingDocumentType.TAX_INVOICE


@pytest.mark.asyncio
async def test_issue_document_empty_buyer_fields_are_none():
    db = _make_db()
    with (
        patch(
            "app.services.billing_document_service._fetch_billing_configs",
            new=AsyncMock(return_value={}),
        ),
        patch(
            "app.services.billing_document_service._next_document_number",
            new=AsyncMock(return_value="PF-202606-0001"),
        ),
    ):
        doc = await issue_document(
            db,
            tenant_id="t-1",
            order_id="o-1",
            doc_type=BillingDocumentType.PROFORMA,
            pack_code="starter",
            pack_description="500 credits",
            credits=500,
            amount_thb=Decimal("990"),
            buyer=BuyerInfo(),
        )

    assert doc.buyer_name is None
    assert doc.buyer_tax_id is None
    assert doc.buyer_address is None


# ── get_last_buyer_info ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_last_buyer_info_returns_most_recent():
    row = MagicMock()
    row.buyer_name = "Acme Co."
    row.buyer_tax_id = "1111111111111"
    row.buyer_address = "Bangkok"
    row.buyer_branch = "Main"
    db = _make_db(first_row=row)
    info = await get_last_buyer_info(db, "t-1")
    assert info["name"] == "Acme Co."
    assert info["tax_id"] == "1111111111111"
    assert info["address"] == "Bangkok"
    assert info["branch"] == "Main"


@pytest.mark.asyncio
async def test_get_last_buyer_info_returns_empty_when_no_prior_doc():
    db = _make_db(first_row=None)
    info = await get_last_buyer_info(db, "t-1")
    assert info == {}
