"""DB layer for a settlement report's per-(tenant, bank) posting profile.

Decision #3 (2026-09-22, docs/email-automation/06-decision-log.md #29) folded this
feature's own mapping table (`ar_reconcile_mappings`) into `bu_accounting_mapping_entries`
— the credit-card wizard's table, which the settlement JV's three fixed debit legs were
already reading (decision #28). Ticket D (2026-09-22, same day) folded the JV
description the same way: `jv_description_template` is no longer read or written here —
a settlement JV's wording now comes from `bu_accounting_mapping_entries`'s config via
`cc_jv.resolve_jv_description`, the same call the fee-invoice path always used. What
this module owns now is only `enabled` / `post_type`, one row per (tenant, bank).
`ar_reconcile_settings.jv_description_template` stays in the schema, unused — same
precedent as `debit_dept_code`/`debit_account_code` from decision #28.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import Bank
from app.models.email_automation import EmailDocument
from app.models.orm import ARReconcileSetting
from app.models.schemas import (
    ARPreviewOut,
    ARPreviewRow,
    ARSettingsIn,
    ARSettingsOut,
    ExtractedDetailRow,
)
from app.models.schemas.common import FieldMapping
from app.services.credit_card.accounting_config import get_accounting_config
from app.services.credit_card.jv import (
    build_jv_rows,
    group_key,
    is_balanced,
    resolve_jv_description,
)
from app.services.credit_card.jv import unmapped_payment_types as _unmapped

logger = logging.getLogger(__name__)


def mappings_dict(items: dict[str, FieldMapping]) -> dict[str, dict[str, str]]:
    """`{key: FieldMapping}` → the plain `{key: {dept, acc}}` shape `cc_jv` expects.

    A key with neither dept nor acc set contributes nothing usable but is not an error
    to drop silently either way — `cc_jv.unmapped_payment_types` will name it as
    missing on its own, same as a key absent from this dict entirely.
    """
    return {k: {"dept": v.dept or "", "acc": v.acc or ""} for k, v in items.items()}


async def get_settlement_grouping(db: AsyncSession, bank_code: str) -> str | None:
    """This bank's settlement-report fold rule, or `None` if it has no settlement
    layout at all — the single source of truth `PUT /settings` validates an `enabled`
    save against, and what the merged mapping page reads to decide whether its
    Settlement card even renders for the bank currently selected (decision #8,
    replacing the old SUPPORTED_BANKS / RECONCILABLE_BANKS constants)."""
    return (
        await db.execute(
            select(Bank.settlement_grouping).where(
                Bank.code == bank_code, Bank.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()


async def _get_setting(
    db: AsyncSession, tenant_id: str, bank_code: str
) -> ARReconcileSetting | None:
    res = await db.execute(
        select(ARReconcileSetting).where(
            ARReconcileSetting.tenant_id == tenant_id,
            ARReconcileSetting.bank_code == bank_code,
            ARReconcileSetting.deleted_at.is_(None),
        )
    )
    return res.scalars().first()


async def latest_real_sample(
    db: AsyncSession, tenant_id: str, bank_code: str
) -> tuple[list[tuple[str, str]], str, str, dict | None] | None:
    """This tenant's most recent still-parked settlement report for `bank_code`, as
    `(rows, doc_no, doc_date, total_row)` — or None if it has never had one. `total_row`
    is the raw dict `ExtractedCreditCardData.total_row` serialized to, or None.

    The worked example on the settings screen used to be one fixed KBANK report every
    tenant saw regardless of what their own documents actually print. `review_payload`
    holds the real thing for as long as a document sits at `pending_review`
    (`_park_for_review` in email_automation/ledger.py) — cleared only once it goes terminal
    (`_finish`) — so a tenant with one parked has real data sitting right here already.

    Returns `total_row=None` as readily as any other field: a document parked before
    decision #28 (2026-09-18) added that anchor, or one whose anchor genuinely failed to
    read, is still this tenant's own real payment types — exactly what
    `/sample-payment-types` wants regardless of whether the debit side can be shown.
    `/preview` is pickier (it needs a balanceable example), so it falls back to the
    hardcoded sample itself when this row's `total_row` is empty, rather than this
    function silently passing over real data another caller has a legitimate use for.
    """
    row = (
        (
            await db.execute(
                select(EmailDocument)
                .where(
                    EmailDocument.tenant_id == tenant_id,
                    EmailDocument.bank_code == bank_code,
                    EmailDocument.review_payload.isnot(None),
                    EmailDocument.review_payload["doc_type"].as_string() == "ar_reconcile",
                )
                .order_by(EmailDocument.created_at.desc())
                .limit(1)
            )
        )
        .scalars()
        .first()
    )
    if row is None:
        return None
    extracted = row.review_payload.get("extracted") or {}
    rows = [
        (d.get("transaction"), d.get("pay_amt"))
        for d in extracted.get("details") or []
        if d.get("transaction") and d.get("pay_amt")
    ]
    if not rows:
        return None
    return (
        rows,
        extracted.get("doc_no") or "",
        extracted.get("doc_date") or "",
        extracted.get("total_row"),
    )


async def get_settings(db: AsyncSession, tenant_id: str, bank_code: str) -> ARSettingsOut:
    row = await _get_setting(db, tenant_id, bank_code)
    has_layout = await get_settlement_grouping(db, bank_code) is not None
    if not row:
        return ARSettingsOut(
            bank_code=bank_code,
            enabled=False,
            post_type="Detail",
            has_settlement_layout=has_layout,
        )
    return ARSettingsOut(
        bank_code=row.bank_code,
        enabled=bool(row.enabled),
        post_type=row.post_type,
        has_settlement_layout=has_layout,
    )


async def save_settings(db: AsyncSession, tenant_id: str, req: ARSettingsIn) -> None:
    """Full replace of the posting profile. Its payment-type mapping is no longer part
    of this call — it lives in `bu_accounting_mapping_entries`, saved through
    `PUT /api/v1/config/accounting`, the merged mapping page's other write. Its JV
    description likewise (Ticket D) — that same call's `description` field."""
    row = await _get_setting(db, tenant_id, req.bank_code)
    if row:
        row.enabled = req.enabled
        row.post_type = req.post_type
    else:
        row = ARReconcileSetting(
            tenant_id=tenant_id,
            bank_code=req.bank_code,
            enabled=req.enabled,
            post_type=req.post_type,
        )
        db.add(row)

    await db.commit()
    logger.info(
        "Saved AR reconcile settings tenant=%s bank=%s enabled=%s post_type=%s",
        tenant_id,
        req.bank_code,
        req.enabled,
        req.post_type,
    )


async def jv_for_document(
    db: AsyncSession,
    tenant_id: str,
    bank_code: str | None,
    extracted: dict,
) -> ARPreviewOut | None:
    """The JV a parked settlement report would post, against the BU's *current*
    mapping.

    Computed on read, never stored beside the parked row, for the same reason the
    credit-card path derives its rows in the browser: the reviewer's whole job may be to
    go and map a payment type, and a copy saved at park time would still show the gap
    after they closed it.

    Server-side rather than in the browser because this feature has no client-side JV
    builder — one implementation of the arithmetic, and `approve_document` posts what this
    returns, so the screen and the post cannot disagree.
    """
    if not bank_code:
        return None
    setting = await _get_setting(db, tenant_id, bank_code)
    if setting is None:
        return None

    rows_in = [_detail_row(r) for r in (extracted.get("details") or [])]
    doc_no = extracted.get("doc_no") or ""
    doc_date = extracted.get("doc_date") or ""
    total_row_data = extracted.get("total_row")
    total_row = _detail_row(total_row_data) if total_row_data else None
    # One config now (decision #3, and Ticket D for its `description`): commission/tax/
    # net, this bank's settlement credit-side keys, and its JV wording all live in
    # bu_accounting_mapping_entries's config — the same one the fee invoice reads, scoped
    # to this bank like every reader since 20260924000000_bank_scoped_mapping_entries.
    config = await get_accounting_config(db, tenant_id, bank_code)
    mappings = config.mappings or {}

    def grouping(label: str) -> str:
        return group_key(label, setting.post_type)

    rows = build_jv_rows(
        rows_in, mappings, total_row=total_row, grouping=grouping, doc_no=doc_no or None
    )
    return ARPreviewOut(
        rows=[ARPreviewRow(**r) for r in rows],
        description=resolve_jv_description(
            config, bank_code, doc_date=doc_date or None, doc_no=doc_no or None
        ),
        doc_no=doc_no,
        doc_date=doc_date,
        total_debit=round(sum(r["debit"] for r in rows), 2),
        total_credit=round(sum(r["credit"] for r in rows), 2),
        balanced=is_balanced(rows),
        unmapped=_unmapped(rows_in, mappings, grouping=grouping),
        post_type=setting.post_type,
    )


def _detail_row(data: dict) -> ExtractedDetailRow:
    return ExtractedDetailRow(
        transaction=data.get("transaction"),
        pay_amt=data.get("pay_amt"),
        commis_amt=data.get("commis_amt"),
        tax_amt=data.get("tax_amt"),
        total=data.get("total"),
    )
