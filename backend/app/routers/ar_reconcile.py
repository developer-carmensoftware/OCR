"""Detailed Credit Card AR Reconciliation — settings API.

  GET   /api/v1/ar-reconcile/settings?bank_code=  → config, both mapping sets
  PUT   /api/v1/ar-reconcile/settings             → upsert (FULL replace of both sets)
  POST  /api/v1/ar-reconcile/preview              → the JV this configuration would build

There is deliberately no `/suggest` here. AI Auto-Map calls the existing
`POST /api/v1/credit-card/mapping/suggest-payment-types`, which takes the payment types
and Carmen's account/department lists in the body and knows nothing about which feature
asked — so it works unchanged, and brings its history-bypass with it.
"""

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import SessionInfo, get_current_session
from app.constants import Module
from app.database import get_db
from app.exceptions import ValidationError
from app.models.schemas import (
    ARMappingItem,
    ARPreviewIn,
    ARPreviewOut,
    ARPreviewRow,
    ARSettingsIn,
    ARSettingsOut,
    ExtractedDetailRow,
)
from app.services import ar_reconcile_service as svc
from app.services.accounting_config_service import get_accounting_config
from app.services.ar_reconcile_jv import (
    build_ar_jv_rows,
    is_balanced,
    render_jv_description,
    unmapped_ar_types,
)
from app.services.module_gate import assert_module_enabled

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ar-reconcile", tags=["AR Reconcile"])

# Fallback only, for a tenant that has never had a settlement report parked for review
# (`svc.latest_real_sample` returns None) — taken from a real KB1P554V2 report (settlement
# 21/07/2026, Σ THB AMT 25,091.00) rather than invented labels, since even the fallback's
# job is to show what a real bank's schemes look like once grouped.
_SAMPLE_DOC_NO = "210726E00035291"
_SAMPLE_DOC_DATE = "21/07/2026"
_SAMPLE_ROWS = (
    ("VS INTER NON-PREM", "2,200.00"),
    ("VS INTER PREM", "3,251.00"),
    ("VS INTER UP PREM", "10,020.00"),
    ("MC INTER NON-PREM", "1,000.00"),
    ("MC INTER PREM", "5,945.00"),
    ("MC INTER UP PREM", "2,375.00"),
    ("JCB PREM", "300.00"),
)
# The same report's own TOTAL BY MERCHANT ID row — Σ THB AMT above (25,091.00) =
# COMM AMT + VAT AMT + NET AMT here, same self-consistency a real document has to pass.
_SAMPLE_TOTAL_ROW = {
    "transaction": "TOTAL BY MERCHANT ID",
    "pay_amt": "25,091.00",
    "commis_amt": "582.99",
    "tax_amt": "40.81",
    "total": "24,467.20",
}


@router.get("/settings", response_model=ARSettingsOut)
async def get_settings(
    bank_code: str = Query(..., description="Bank profile, e.g. KBANK"),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    return await svc.get_settings(db, session.tenant_id, bank_code.upper())


@router.put("/settings")
async def save_settings(
    req: ARSettingsIn,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    if req.enabled and req.bank_code.upper() not in svc.SUPPORTED_BANKS:
        # Enabling an unreadable bank would arm a pipeline with no prompt behind it: the
        # document would be charged, fail at the prompt registry, and read to the BU as
        # the feature being broken. Saving it switched off is fine — that is a draft.
        raise ValidationError(
            f"{req.bank_code} settlement reports are not supported yet — "
            f"supported: {', '.join(svc.SUPPORTED_BANKS)}"
        )
    req.bank_code = req.bank_code.upper()
    await svc.save_settings(db, session.tenant_id, req)
    return {"ok": True}


@router.post("/preview", response_model=ARPreviewOut)
async def preview(
    req: ARPreviewIn,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """The JV the current (unsaved) screen state would build, over a worked example.

    Takes the screen's state rather than reading the saved row so the panel tracks edits
    as they are made — seeing Detail collapse into three lines while flipping the toggle
    is the reason this is a panel and not a modal behind a button.

    The example itself is this tenant's own most recently parked report for this bank
    when it has one (`svc.latest_real_sample`) — real labels, not invented ones, because
    the point is showing what THIS bank's schemes look like once grouped. Falls back to
    the built-in KBANK sample only for a tenant that has never had one parked.
    """
    await assert_module_enabled(Module.CC_AR_RECONCILE)

    real = await svc.latest_real_sample(db, session.tenant_id, req.bank_code)
    sample_rows, doc_no, doc_date, total_row_data = real or (
        _SAMPLE_ROWS,
        _SAMPLE_DOC_NO,
        _SAMPLE_DOC_DATE,
        _SAMPLE_TOTAL_ROW,
    )
    details = [ExtractedDetailRow(transaction=t, pay_amt=a) for t, a in sample_rows]
    total_row = ExtractedDetailRow(**total_row_data) if total_row_data else None
    mappings = svc.mappings_dict(req.mappings)
    cc_mappings = (await get_accounting_config(db, session.tenant_id)).mappings or {}

    rows = build_ar_jv_rows(
        details,
        post_type=req.post_type,
        total_row=total_row,
        cc_mappings=cc_mappings,
        mappings=mappings,
        doc_no=doc_no or None,
    )
    return ARPreviewOut(
        rows=[ARPreviewRow(**r) for r in rows],
        description=render_jv_description(
            req.jv_description_template,
            settlement_date=doc_date or None,
            tax_invoice_no=doc_no or None,
            bank_name=req.bank_code,
        ),
        doc_no=doc_no,
        doc_date=doc_date,
        total_debit=round(sum(r["debit"] for r in rows), 2),
        total_credit=round(sum(r["credit"] for r in rows), 2),
        balanced=is_balanced(rows),
        unmapped=unmapped_ar_types(details, mappings, req.post_type, cc_mappings),
        post_type=req.post_type,
    )


@router.get("/sample-payment-types", response_model=list[ARMappingItem])
async def sample_payment_types(
    bank_code: str = Query(..., description="Bank profile, e.g. KBANK"),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """The rows a BU starts from before it has mapped anything — its own, or none.

    Only this tenant's most recently parked report for this bank
    (`svc.latest_real_sample`): the real payment types their own documents print. A tenant
    that has never had one parked gets an empty list, and the table says so
    (`ar.mappingEmpty`: "Add the payment types this bank prints, or wait for the first
    report").

    It used to fall back to `_SAMPLE_ROWS` so the table never opened empty. That seeded
    editable rows the reviewer then *saved* — a mapping keyed to a vocabulary no document
    of theirs had printed, which is worse than an empty table honestly labelled. The
    fallback still serves `/preview`, where it is a worked example the panel marks as one.
    """
    real = await svc.latest_real_sample(db, session.tenant_id, bank_code.upper())
    rows = real[0] if real else ()
    return [ARMappingItem(payment_type_code=code, payment_type_desc=None) for code, _ in rows]
