"""
Billing document service — issues proforma and tax invoices.

Each order gets:
  • A PROFORMA at order creation (request for payment).
  • A TAX_INVOICE after admin approval (official VAT receipt).

Document numbers are gapless via the document_sequences table:
  PF-YYYYMM-0001  (proforma)
  IV-YYYYMM-0001  (tax invoice)

Caller owns the DB transaction — this service never commits.
"""

import logging
from datetime import UTC, datetime
from decimal import Decimal
from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import BillingDocument, DocumentSequence, SystemConfig
from app.models.enums import BillingDocumentType
from app.utils.tax import split_inclusive

logger = logging.getLogger(__name__)

_DOC_PREFIX = {
    BillingDocumentType.PROFORMA: "PF",
    BillingDocumentType.TAX_INVOICE: "IV",
}


class BuyerInfo(TypedDict, total=False):
    name: str
    tax_id: str
    address: str
    branch: str
    email: str


class SellerSnapshot(TypedDict, total=False):
    name: str
    tax_id: str
    address: str
    branch: str
    promptpay_id: str
    vat_rate: str


async def _fetch_billing_configs(db: AsyncSession) -> dict[str, str]:
    """Load all billing.* system_config values in one query."""
    rows = (
        await db.execute(
            select(SystemConfig.key_name, SystemConfig.value).where(
                SystemConfig.key_name.like("billing.%")
            )
        )
    ).all()
    result: dict[str, str] = {}
    for key_name, value in rows:
        # value is stored as a JSON string (e.g. '"some text"') — unwrap the quotes
        if isinstance(value, str):
            result[key_name] = value.strip('"')
        else:
            result[key_name] = str(value) if value is not None else ""
    return result


async def get_seller_snapshot(db: AsyncSession) -> SellerSnapshot:
    """Read seller identity from system_configs at issue time (snapshot, not live ref)."""
    cfg = await _fetch_billing_configs(db)
    return SellerSnapshot(
        name=cfg.get("billing.seller_name", ""),
        tax_id=cfg.get("billing.seller_tax_id", ""),
        address=cfg.get("billing.seller_address", ""),
        branch=cfg.get("billing.seller_branch", ""),
        promptpay_id=cfg.get("billing.promptpay_id", ""),
        vat_rate=cfg.get("billing.vat_rate", "7"),
    )


async def get_promptpay_id(db: AsyncSession) -> str:
    """Return the configured PromptPay ID, or '' if not set."""
    cfg = await _fetch_billing_configs(db)
    return cfg.get("billing.promptpay_id", "")


async def _next_document_number(db: AsyncSession, doc_type: BillingDocumentType) -> str:
    """
    Atomically increment the sequence for (scope, YYYYMM) and return the formatted number.
    Uses INSERT ... ON CONFLICT DO UPDATE so the counter is gapless under concurrency.
    """
    scope = doc_type.value  # 'proforma' or 'tax_invoice'
    period_key = datetime.now(UTC).strftime("%Y%m")

    stmt = (
        pg_insert(DocumentSequence)
        .values(scope=scope, period_key=period_key, last_no=1)
        .on_conflict_do_update(
            index_elements=["scope", "period_key"],
            set_={"last_no": DocumentSequence.last_no + 1},
        )
        .returning(DocumentSequence.last_no)
    )
    last_no: int = (await db.execute(stmt)).scalar_one()
    prefix = _DOC_PREFIX[doc_type]
    return f"{prefix}-{period_key}-{last_no:04d}"


async def issue_document(
    db: AsyncSession,
    *,
    tenant_id: str,
    order_id: str,
    doc_type: BillingDocumentType,
    pack_code: str,
    pack_description: str,
    credits: int,
    amount_thb: Decimal,
    buyer: BuyerInfo,
) -> BillingDocument:
    """
    Create and add a BillingDocument to the session.
    Caller must commit (or flush) after this returns.

    Args:
        db: Active async session (caller owns txn).
        tenant_id: Issuing tenant.
        order_id: Linked credit_orders row.
        doc_type: PROFORMA or TAX_INVOICE.
        pack_code: Pack identifier (e.g. 'starter').
        pack_description: Human-readable label for the line item.
        credits: Number of credits in this pack.
        amount_thb: VAT-inclusive gross (Decimal).
        buyer: Dict with name/tax_id/address/branch (all optional).
    """
    seller = await get_seller_snapshot(db)
    vat_rate = Decimal(seller.get("vat_rate") or "7") / 100
    subtotal, vat_amount = split_inclusive(amount_thb, vat_rate)
    number = await _next_document_number(db, doc_type)

    doc = BillingDocument(
        tenant_id=tenant_id,
        order_id=order_id,
        doc_type=doc_type,
        number=number,
        issue_date=datetime.now(UTC),
        # Seller snapshot
        seller_name=seller.get("name") or None,
        seller_tax_id=seller.get("tax_id") or None,
        seller_address=seller.get("address") or None,
        seller_branch=seller.get("branch") or None,
        # Buyer snapshot
        buyer_name=buyer.get("name") or None,
        buyer_tax_id=buyer.get("tax_id") or None,
        buyer_address=buyer.get("address") or None,
        buyer_branch=buyer.get("branch") or None,
        buyer_email=buyer.get("email") or None,
        # Line item
        pack_code=pack_code,
        description=pack_description,
        credits=credits,
        subtotal=subtotal,
        vat_rate=Decimal(seller.get("vat_rate") or "7"),
        vat_amount=vat_amount,
        total=amount_thb,
        currency="THB",
    )
    db.add(doc)
    logger.info(
        "billing document issued: type=%s number=%s order=%s total=%s",
        doc_type.value,
        number,
        order_id,
        amount_thb,
    )
    return doc


async def get_last_buyer_info(db: AsyncSession, tenant_id: str) -> BuyerInfo:
    """
    Return buyer info from the tenant's most recent billing document,
    as a prefill fallback when Carmen doesn't provide company profile.
    Returns an empty dict if no prior document exists.
    """
    row = (
        await db.execute(
            select(
                BillingDocument.buyer_name,
                BillingDocument.buyer_tax_id,
                BillingDocument.buyer_address,
                BillingDocument.buyer_branch,
            )
            .where(
                BillingDocument.tenant_id == tenant_id,
                BillingDocument.deleted_at.is_(None),
            )
            .order_by(BillingDocument.created_at.desc())
            .limit(1)
        )
    ).first()

    if row is None:
        return BuyerInfo()
    return BuyerInfo(
        name=row.buyer_name or "",
        tax_id=row.buyer_tax_id or "",
        address=row.buyer_address or "",
        branch=row.buyer_branch or "",
    )
