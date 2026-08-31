"""
User config router — persists per-BU settings that previously lived in localStorage.

  GET  /api/v1/config/accounting                    → load accounting config for current BU
  PUT  /api/v1/config/accounting                    → upsert accounting config
  GET  /api/v1/config/ap-mapping/{tax_id}           → load AP column mapping for a vendor
  PUT  /api/v1/config/ap-mapping/{tax_id}           → upsert AP column mapping for a vendor
  GET  /api/v1/config/analytics/account-usage       → which BUs use a given acc/dept code
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import SessionInfo, get_current_session
from app.database import get_db
from app.exceptions import ValidationError
from app.models.schemas import (
    AccountingConfigRequest,
    AccountingConfigResponse,
    MappingPatchRequest,
)
from app.services import accounting_config_service as svc
from app.services.carmen_service import CarmenAPIError, get_departments
from app.utils.gl_filter import parse_default_account

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/config", tags=["Config"])


@router.get("/accounting", response_model=AccountingConfigResponse)
async def get_accounting_config(
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    return await svc.get_accounting_config(db, session.tenant_id)


@router.put("/accounting")
async def save_accounting_config(
    req: AccountingConfigRequest,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    await svc.save_accounting_config(db, session.tenant_id, req)
    return {"ok": True}


@router.put("/accounting/mappings")
async def patch_accounting_mappings(
    req: MappingPatchRequest,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """Correct named GL rules without touching the rest of the config.

    The review screen's write. `PUT /accounting` cannot be used for it: that one replaces
    every column and every mapping entry, so a partial body wipes the BU's prefix,
    description and the mappings it did not mention — and two people reviewing the same
    BU's queue at once is the expected case.

    The dept/account pair is re-checked against Carmen's own `DefaultAccount` list here.
    The browser filters the dropdown to the allowed set, but a filtered dropdown is a
    convenience, not a control, and this endpoint is the thing that decides what posts.
    """
    pairs = {k: v for k, v in req.mappings.items() if v.dept and v.acc}
    if pairs:
        try:
            depts_raw = await get_departments(session.carmen_token)
        except CarmenAPIError as exc:
            # Carmen unreachable is not a reason to refuse a correction the reviewer can
            # see is right — the JV itself is about to be posted through Carmen anyway,
            # which is where a genuinely bad pair will be caught.
            logger.warning("Could not verify dept/account pairs against Carmen: %s", exc)
        else:
            allowed = {
                d["DeptCode"]: parse_default_account(d.get("DefaultAccount"))
                for d in (depts_raw.get("Data") or [])
                if d.get("DeptCode")
            }
            for field_type, m in pairs.items():
                permitted = allowed.get(m.dept or "")
                # An empty set means the dept restricts nothing, not that it allows nothing.
                if permitted and m.acc not in permitted:
                    raise ValidationError(
                        f"Account {m.acc} is not allowed for department {m.dept}"
                        f" (field: {field_type})"
                    )

    await svc.set_mappings(
        db,
        session.tenant_id,
        {k: {"dept": v.dept or "", "acc": v.acc or ""} for k, v in req.mappings.items()},
    )
    return {"ok": True}


@router.get("/ap-mapping/{vendor_tax_id}")
async def get_ap_vendor_mapping(
    vendor_tax_id: str,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    mapping = await svc.get_ap_vendor_mapping(db, session.tenant_id, vendor_tax_id)
    return {"vendor_tax_id": vendor_tax_id, "mapping": mapping}


@router.put("/ap-mapping/{vendor_tax_id}")
async def save_ap_vendor_mapping(
    vendor_tax_id: str,
    payload: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    await svc.save_ap_vendor_mapping(db, session.tenant_id, vendor_tax_id, payload)
    return {"ok": True}


@router.get("/analytics/account-usage")
async def get_account_usage(
    acc_code: str | None = Query(None, description="Filter by GL account code"),
    dept_code: str | None = Query(None, description="Filter by department code"),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    if not acc_code and not dept_code:
        return {"error": "Provide acc_code or dept_code query param", "results": []}

    results = await svc.get_account_usage(db, session.tenant_id, acc_code, dept_code)
    return {"acc_code": acc_code, "dept_code": dept_code, "count": len(results), "results": results}
