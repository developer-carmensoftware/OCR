"""DB layer for Detailed Credit Card AR Reconciliation settings and mappings.

Two responsibilities: read/write one (tenant, bank) configuration with both of its
mapping sets, and answer whether that configuration would actually do anything if a
settlement report arrived right now.

That second one exists because the feature has four independent switches — the module
gate, this row's `enabled`, an email rule tagged with the right document type, and a
complete mapping — and all four fail *silently*. A BU with three of them right sees the
same thing as a BU with none: nothing happens. `readiness()` is what lets the settings
screen say which link is open instead of leaving them to send themselves test mail.
"""

from __future__ import annotations

import logging

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import DocType, PostType
from app.models.email_automation import EmailIngestSettings
from app.models.orm import (
    ARReconcileMapping,
    ARReconcileSetting,
    BUAccountingConfig,
    BUAccountingMappingEntry,
)
from app.models.schemas import (
    ARBlocker,
    ARMappingItem,
    ARPreviewOut,
    ARPreviewRow,
    ARSettingsIn,
    ARSettingsOut,
    ExtractedDetailRow,
)
from app.services.ar_reconcile_jv import (
    build_ar_jv_rows,
    is_balanced,
    render_jv_description,
    unmapped_ar_types,
)

logger = logging.getLogger(__name__)

DEFAULT_TEMPLATE = "Credit Card AR Reconcile {Settlement_Date}"

# Banks whose settlement report this release can read. The selector shows the others so
# the roadmap is visible, but saving one would configure a document nothing can parse.
SUPPORTED_BANKS = ("KBANK",)


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


async def _get_mappings(db: AsyncSession, setting_id: int) -> list[ARReconcileMapping]:
    res = await db.execute(
        select(ARReconcileMapping).where(
            ARReconcileMapping.setting_id == setting_id,
            ARReconcileMapping.deleted_at.is_(None),
        )
    )
    return list(res.scalars().all())


def _to_items(rows: list[ARReconcileMapping]) -> dict[str, list[ARMappingItem]]:
    out: dict[str, list[ARMappingItem]] = {pt: [] for pt in PostType.ALL}
    for r in rows:
        out.setdefault(r.post_type, []).append(
            ARMappingItem(
                payment_type_code=r.payment_type_code,
                payment_type_desc=r.payment_type_desc,
                credit_dept_code=r.credit_dept_code,
                credit_account_code=r.credit_account_code,
                is_active=bool(r.is_active),
            )
        )
    return out


def mappings_dict(items: list[ARMappingItem]) -> dict[str, dict[str, str]]:
    """Mapping rows → the `{key: {dept, acc}}` shape ar_reconcile_jv expects.

    Inactive rows are dropped rather than passed through empty: an inactive mapping means
    "this payment type is not ours to post", and leaving it in would read as unmapped.
    """
    return {
        i.payment_type_code: {
            "dept": i.credit_dept_code or "",
            "acc": i.credit_account_code or "",
        }
        for i in items
        if i.is_active
    }


async def default_clearing_account(db: AsyncSession, tenant_id: str) -> tuple[str, str] | None:
    """The BU's existing credit-card 'net' mapping — the account this JV has to clear.

    The lump the settlement JV debits is the one the fee-invoice JV credited, and that
    account is already configured for the credit-card wizard. Prefilling from it is not a
    convenience: a BU that types a different account here gets a JV that balances and
    still never zeroes the control account, which is invisible until someone reconciles
    by hand.
    """
    cfg = (
        (
            await db.execute(
                select(BUAccountingConfig).where(
                    BUAccountingConfig.tenant_id == tenant_id,
                    BUAccountingConfig.deleted_at.is_(None),
                )
            )
        )
        .scalars()
        .first()
    )
    if not cfg:
        return None
    entry = (
        (
            await db.execute(
                select(BUAccountingMappingEntry).where(
                    BUAccountingMappingEntry.config_id == cfg.id,
                    BUAccountingMappingEntry.field_type == "net",
                    BUAccountingMappingEntry.deleted_at.is_(None),
                )
            )
        )
        .scalars()
        .first()
    )
    if not entry or not (entry.dept_code and entry.acc_code):
        return None
    return str(entry.dept_code), str(entry.acc_code)


async def get_settings(db: AsyncSession, tenant_id: str, bank_code: str) -> ARSettingsOut:
    row = await _get_setting(db, tenant_id, bank_code)
    if not row:
        prefill = await default_clearing_account(db, tenant_id)
        return ARSettingsOut(
            bank_code=bank_code,
            enabled=False,
            post_type=PostType.DETAIL,
            jv_description_template=DEFAULT_TEMPLATE,
            debit_dept_code=prefill[0] if prefill else None,
            debit_account_code=prefill[1] if prefill else None,
            mappings={pt: [] for pt in PostType.ALL},
            blockers=await readiness(db, tenant_id, bank_code, setting=None),
        )

    items = _to_items(await _get_mappings(db, row.id))
    return ARSettingsOut(
        bank_code=row.bank_code,
        enabled=bool(row.enabled),
        post_type=row.post_type,
        jv_description_template=row.jv_description_template or DEFAULT_TEMPLATE,
        debit_dept_code=row.debit_dept_code,
        debit_account_code=row.debit_account_code,
        mappings=items,
        blockers=await readiness(db, tenant_id, bank_code, setting=row, mappings=items),
    )


async def save_settings(db: AsyncSession, tenant_id: str, req: ARSettingsIn) -> None:
    """Full replace of the row and both mapping sets.

    Both sets are rewritten together because the screen always holds both: saving from
    the Detail view with only Detail rows in hand would delete the Summary work, which is
    the failure `PUT /carmen/settings` had to grow a merge rule for. Sending everything
    back is simpler than a per-set merge and leaves no field with two writers.
    """
    row = await _get_setting(db, tenant_id, req.bank_code)
    if row:
        row.enabled = req.enabled
        row.post_type = req.post_type
        row.jv_description_template = req.jv_description_template or DEFAULT_TEMPLATE
        row.debit_dept_code = req.debit_dept_code or None
        row.debit_account_code = req.debit_account_code or None
        await db.flush()
    else:
        row = ARReconcileSetting(
            tenant_id=tenant_id,
            bank_code=req.bank_code,
            enabled=req.enabled,
            post_type=req.post_type,
            jv_description_template=req.jv_description_template or DEFAULT_TEMPLATE,
            debit_dept_code=req.debit_dept_code or None,
            debit_account_code=req.debit_account_code or None,
        )
        db.add(row)
        await db.flush()

    await db.execute(delete(ARReconcileMapping).where(ARReconcileMapping.setting_id == row.id))
    for post_type, items in (req.mappings or {}).items():
        for item in items:
            if not item.payment_type_code.strip():
                continue
            db.add(
                ARReconcileMapping(
                    setting_id=row.id,
                    post_type=post_type,
                    payment_type_code=item.payment_type_code.strip(),
                    payment_type_desc=item.payment_type_desc or None,
                    credit_dept_code=item.credit_dept_code or None,
                    credit_account_code=item.credit_account_code or None,
                    is_active=item.is_active,
                )
            )

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
    """The JV a parked settlement report would post, against the BU's *current* mapping.

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

    rows_in = [
        ExtractedDetailRow(
            transaction=r.get("transaction"),
            pay_amt=r.get("pay_amt"),
            commis_amt=r.get("commis_amt"),
            tax_amt=r.get("tax_amt"),
            total=r.get("total"),
        )
        for r in (extracted.get("details") or [])
    ]
    items = _to_items(await _get_mappings(db, setting.id)).get(setting.post_type, [])
    maps = mappings_dict(items)
    doc_no = extracted.get("doc_no") or ""
    doc_date = extracted.get("doc_date") or ""

    rows = build_ar_jv_rows(
        rows_in,
        post_type=setting.post_type,
        debit_dept=setting.debit_dept_code,
        debit_acc=setting.debit_account_code,
        mappings=maps,
        doc_no=doc_no or None,
    )
    return ARPreviewOut(
        rows=[ARPreviewRow(**r) for r in rows],
        description=render_jv_description(
            setting.jv_description_template,
            settlement_date=doc_date or None,
            tax_invoice_no=doc_no or None,
            bank_name=bank_code,
        ),
        doc_no=doc_no,
        doc_date=doc_date,
        total_debit=round(sum(r["debit"] for r in rows), 2),
        total_credit=round(sum(r["credit"] for r in rows), 2),
        balanced=is_balanced(rows),
        unmapped=unmapped_ar_types(rows_in, maps, setting.post_type),
    )


async def readiness(
    db: AsyncSession,
    tenant_id: str,
    bank_code: str,
    *,
    setting: ARReconcileSetting | None,
    mappings: dict[str, list[ARMappingItem]] | None = None,
) -> list[ARBlocker]:
    """The chain between an arriving email and a posted JV, link by link.

    Deliberately does NOT include the module gate: `assert_module_enabled` fails open on
    infra errors and is an operator concern, not something the BU can act on from this
    screen. Everything listed here is something the person reading it can fix.
    """
    out: list[ARBlocker] = []

    out.append(
        ARBlocker(
            key="bank_supported",
            ok=bank_code in SUPPORTED_BANKS,
            detail=None if bank_code in SUPPORTED_BANKS else "Phase 1 reads KBANK only",
        )
    )
    out.append(ARBlocker(key="feature_enabled", ok=bool(setting and setting.enabled)))

    rule = await _matching_rule(db, tenant_id, bank_code)
    out.append(
        ARBlocker(
            key="email_rule",
            ok=rule is not None,
            detail=None if rule else "No email rule forwards settlement reports for this bank",
        )
    )

    post_type = setting.post_type if setting else PostType.DETAIL
    items = (mappings or {}).get(post_type, [])
    complete = [i for i in items if i.is_active and i.credit_dept_code and i.credit_account_code]
    out.append(
        ARBlocker(
            key="mapping_complete",
            ok=bool(complete) and len(complete) == len([i for i in items if i.is_active]),
            detail=f"{len(complete)} of {len([i for i in items if i.is_active])} mapped",
        )
    )
    out.append(
        ARBlocker(
            key="clearing_account",
            ok=bool(setting and setting.debit_dept_code and setting.debit_account_code),
        )
    )

    auto_post = await _auto_post(db, tenant_id)
    out.append(
        ARBlocker(
            key="auto_post",
            ok=auto_post,
            detail="Documents wait for review" if not auto_post else None,
        )
    )
    return out


async def _email_settings(db: AsyncSession, tenant_id: str) -> EmailIngestSettings | None:
    res = await db.execute(
        select(EmailIngestSettings).where(EmailIngestSettings.tenant_id == tenant_id)
    )
    return res.scalars().first()


async def _matching_rule(db: AsyncSession, tenant_id: str, bank_code: str) -> dict | None:
    """An active ingest rule that would route this bank's settlement report here."""
    row = await _email_settings(db, tenant_id)
    for rule in (row.rules if row else None) or []:
        if not isinstance(rule, dict) or not rule.get("is_active", True):
            continue
        if rule.get("doc_type") != DocType.AR_RECONCILE:
            continue
        if (rule.get("bank_code") or "").upper() == bank_code.upper():
            return rule
    return None


async def _auto_post(db: AsyncSession, tenant_id: str) -> bool:
    row = await _email_settings(db, tenant_id)
    return bool(row and row.auto_post)
