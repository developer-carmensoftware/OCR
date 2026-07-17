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
from app.services.billing.documents import (
    BuyerInfo,
    _fetch_billing_configs,
    get_last_buyer_info,
    get_promptpay_id,
    get_seller_snapshot,
    get_vat_rate,
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
    rows = [("billing.promptpay_id", '"0815659547"')]
    db = _make_db(all_rows=rows)
    pid = await get_promptpay_id(db)
    assert pid == "0815659547"


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
            "app.services.billing.documents._fetch_billing_configs",
            new=AsyncMock(return_value={"billing.vat_rate": "7"}),
        ),
        patch(
            "app.services.billing.documents._next_document_number",
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

    # Catalog prices are ex-VAT (checkout: "Prices exclude 7% VAT") → VAT on top.
    assert doc.subtotal == Decimal("990")
    assert doc.vat_amount == Decimal("69.30")
    assert doc.total == Decimal("1059.30")
    assert doc.doc_type == BillingDocumentType.PROFORMA
    assert doc.number == "PF-202606-0001"
    assert db.add.called


@pytest.mark.asyncio
async def test_issue_document_uses_the_configured_vat_rate():
    """The other half of the single-source invariant: routers/credits.py prices the
    order with get_vat_rate(), and the proforma must be issued at that same rate.
    Both read billing.vat_rate, so amount_thb and total cannot drift apart.
    """
    db = _make_db()
    with (
        patch(
            "app.services.billing.documents._fetch_billing_configs",
            new=AsyncMock(return_value={"billing.vat_rate": "10"}),
        ),
        patch(
            "app.services.billing.documents._next_document_number",
            new=AsyncMock(return_value="PF-202606-0002"),
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

    # 1059.30 here would mean vat_on_top's 7% default won over the config.
    assert doc.vat_amount == Decimal("99.00")
    assert doc.total == Decimal("1089.00")


@pytest.mark.asyncio
async def test_get_vat_rate_returns_fraction_and_defaults_to_seven():
    db = _make_db(all_rows=[("billing.vat_rate", '"10"')])
    assert await get_vat_rate(db) == Decimal("0.10")
    # Unset config → the 7% the catalog copy promises, not a crash.
    assert await get_vat_rate(_make_db(all_rows=[])) == Decimal("0.07")


@pytest.mark.asyncio
async def test_issue_document_buyer_snapshot_saved():
    db = _make_db()
    with (
        patch(
            "app.services.billing.documents._fetch_billing_configs",
            new=AsyncMock(return_value={"billing.vat_rate": "7", "billing.seller_name": "Seller"}),
        ),
        patch(
            "app.services.billing.documents._next_document_number",
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
            "app.services.billing.documents._fetch_billing_configs",
            new=AsyncMock(return_value={}),
        ),
        patch(
            "app.services.billing.documents._next_document_number",
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


def _buyer_row(**overrides):
    row = MagicMock()
    row.buyer_name = "Acme Co."
    row.buyer_tax_id = "1111111111111"
    row.buyer_address = "Bangkok"
    row.buyer_branch = "Main"
    row.buyer_email = "ap@acme.co.th"
    row.buyer_contact_name = "Somchai"
    row.buyer_tel = "021234567"
    for k, v in overrides.items():
        setattr(row, k, v)
    return row


@pytest.mark.asyncio
async def test_get_last_buyer_info_returns_most_recent():
    db = _make_db(first_row=_buyer_row())
    info = await get_last_buyer_info(db, "t-1")
    assert info["name"] == "Acme Co."
    assert info["tax_id"] == "1111111111111"
    assert info["address"] == "Bangkok"
    assert info["branch"] == "Main"


@pytest.mark.asyncio
async def test_get_last_buyer_info_carries_every_field_issue_document_writes():
    """Regression: buyer_email was missing from the SELECT, so a repeat buyer whose
    Carmen lookup came back empty got a prefill (and a proforma) with no email —
    while the Carmen branch of the same endpoint returned one. Any field
    issue_document persists has to survive the round trip, or it silently dies here.
    """
    db = _make_db(first_row=_buyer_row())
    info = await get_last_buyer_info(db, "t-1")
    assert info == BuyerInfo(
        name="Acme Co.",
        tax_id="1111111111111",
        address="Bangkok",
        branch="Main",
        email="ap@acme.co.th",
        contact_name="Somchai",
        tel="021234567",
    )
    # BuyerInfo is total=False, so a dropped key is not a type error — only this
    # whole-dict compare catches the next one.
    assert set(info) == set(BuyerInfo.__annotations__)


@pytest.mark.asyncio
async def test_get_last_buyer_info_nulls_become_empty_strings():
    db = _make_db(first_row=_buyer_row(buyer_email=None, buyer_tel=None))
    info = await get_last_buyer_info(db, "t-1")
    assert info["email"] == ""
    assert info["tel"] == ""


@pytest.mark.asyncio
async def test_get_last_buyer_info_returns_empty_when_no_prior_doc():
    db = _make_db(first_row=None)
    info = await get_last_buyer_info(db, "t-1")
    assert info == {}
