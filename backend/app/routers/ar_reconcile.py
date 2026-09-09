"""Detailed Credit Card AR Reconciliation — settings API.

  GET  /api/v1/ar-reconcile/settings?bank_code=  → config, both mapping sets, readiness
  PUT  /api/v1/ar-reconcile/settings             → upsert (FULL replace of both sets)
  POST /api/v1/ar-reconcile/preview              → the JV this configuration would build

There is deliberately no `/suggest` here. AI Auto-Map on this screen calls the existing
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
from app.services.ar_reconcile_jv import (
    build_ar_jv_rows,
    is_balanced,
    render_jv_description,
    unmapped_ar_types,
)
from app.services.module_gate import assert_module_enabled

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ar-reconcile", tags=["AR Reconcile"])

# The payment-type vocabulary and figures KBANK actually prints, taken from a real
# KB1P554V2 report (settlement 21/07/2026, Σ THB AMT 25,091.00). Real labels matter: the
# preview's job is to show what THIS bank's schemes will look like once grouped, and
# invented ones would group differently.
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
    session: SessionInfo = Depends(get_current_session),
):
    """The JV the current (unsaved) screen state would build, over the worked example.

    Takes the screen's state rather than reading the saved row so the panel tracks edits
    as they are made — seeing Detail collapse into three lines while flipping the toggle
    is the reason this is a panel and not a modal behind a button.
    """
    await assert_module_enabled(Module.CC_AR_RECONCILE)

    details = [ExtractedDetailRow(transaction=t, pay_amt=a) for t, a in _SAMPLE_ROWS]
    mappings = svc.mappings_dict(req.mappings)

    rows = build_ar_jv_rows(
        details,
        post_type=req.post_type,
        debit_dept=req.debit_dept_code,
        debit_acc=req.debit_account_code,
        mappings=mappings,
        doc_no=_SAMPLE_DOC_NO,
    )
    return ARPreviewOut(
        rows=[ARPreviewRow(**r) for r in rows],
        description=render_jv_description(
            req.jv_description_template,
            settlement_date=_SAMPLE_DOC_DATE,
            tax_invoice_no=_SAMPLE_DOC_NO,
            bank_name=req.bank_code,
        ),
        doc_no=_SAMPLE_DOC_NO,
        doc_date=_SAMPLE_DOC_DATE,
        total_debit=round(sum(r["debit"] for r in rows), 2),
        total_credit=round(sum(r["credit"] for r in rows), 2),
        balanced=is_balanced(rows),
        unmapped=unmapped_ar_types(details, mappings, req.post_type),
    )


@router.get("/sample-payment-types", response_model=list[ARMappingItem])
async def sample_payment_types(
    session: SessionInfo = Depends(get_current_session),
):
    """The rows a BU starts from before their first document arrives.

    Without this the mapping table opens empty and the only way to populate it is to
    receive a settlement report, be charged for it, and have it park unmapped. These are
    the payment types KBANK prints; the BU maps them once and the first real document
    posts unattended.
    """
    return [
        ARMappingItem(payment_type_code=code, payment_type_desc=None) for code, _ in _SAMPLE_ROWS
    ]
