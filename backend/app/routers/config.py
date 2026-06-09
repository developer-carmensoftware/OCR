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
from app.models.schemas import AccountingConfigRequest, AccountingConfigResponse
from app.services import accounting_config_service as svc

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
