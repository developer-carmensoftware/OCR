"""
Carmen Proxy Router — thin HTTP layer for Carmen Cloud API calls.

All business logic and HTTP construction lives in `services/carmen_service.py`.
Session injection (get_current_session) supplies the per-user Carmen token.
"""

import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import SessionInfo, get_current_session
from app.database import get_db
from app.models.orm import APInvoice
from app.services.carmen_service import (
    CarmenAPIError,
    get_account_codes,
    get_departments,
    get_gl_prefix,
    get_period_list,
    get_tax_profiles,
    get_vendors,
    post_gljv,
    post_input_tax,
    post_invoice,
    put_gljv,
    put_input_tax,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ocr/carmen", tags=["Carmen"])


@asynccontextmanager
async def _carmen_errors(detail_prefix: str = ""):
    """Translate CarmenAPIError → HTTPException."""
    try:
        yield
    except CarmenAPIError as e:
        detail = f"{detail_prefix}: {e.detail}" if detail_prefix else e.detail
        raise HTTPException(status_code=e.status_code, detail=detail)


@router.get("/account-codes")
async def proxy_account_codes(session: SessionInfo = Depends(get_current_session)):
    async with _carmen_errors():
        return await get_account_codes(session.carmen_token)


@router.get("/departments")
async def proxy_departments(session: SessionInfo = Depends(get_current_session)):
    async with _carmen_errors():
        return await get_departments(session.carmen_token)


@router.get("/gl-prefix")
async def proxy_gl_prefix(session: SessionInfo = Depends(get_current_session)):
    try:
        return await get_gl_prefix(session.carmen_token)
    except CarmenAPIError as e:
        return {"Data": [], "Status": f"upstream_{e.status_code}"}


@router.post("/gljv")
async def proxy_gljv(request: Request, session: SessionInfo = Depends(get_current_session)):
    body = await request.json()
    async with _carmen_errors("Carmen GL JV ล้มเหลว"):
        return await post_gljv(body, session.carmen_token)


@router.put("/gljv/{jvh_seq}")
async def proxy_update_gljv(
    jvh_seq: int, request: Request, session: SessionInfo = Depends(get_current_session)
):
    body = await request.json()
    async with _carmen_errors("Carmen GL JV update ล้มเหลว"):
        return await put_gljv(jvh_seq, body, session.carmen_token)


@router.get("/vendors")
async def proxy_vendors(session: SessionInfo = Depends(get_current_session)):
    async with _carmen_errors():
        return await get_vendors(session.carmen_token)


@router.get("/tax-profiles")
async def proxy_tax_profiles(session: SessionInfo = Depends(get_current_session)):
    async with _carmen_errors():
        return await get_tax_profiles(session.carmen_token)


@router.get("/period-list")
async def proxy_period_list(session: SessionInfo = Depends(get_current_session)):
    async with _carmen_errors():
        return await get_period_list(session.carmen_token)


@router.post("/input-tax")
async def proxy_create_input_tax(
    request: Request, session: SessionInfo = Depends(get_current_session)
):
    body = await request.json()
    async with _carmen_errors("Carmen Input Tax ล้มเหลว"):
        return await post_input_tax(body, session.carmen_token)


@router.put("/input-tax/{rec_seq}")
async def proxy_update_input_tax(
    rec_seq: int, request: Request, session: SessionInfo = Depends(get_current_session)
):
    body = await request.json()
    async with _carmen_errors("Carmen Input Tax update ล้มเหลว"):
        return await put_input_tax(rec_seq, body, session.carmen_token)


@router.post("/invoice")
async def proxy_create_invoice(
    request: Request,
    ap_invoice_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    body = await request.json()
    async with _carmen_errors("Carmen Invoice ล้มเหลว"):
        res = await post_invoice(body, session.carmen_token)
        if res and res.get("Code", 0) >= 0 and ap_invoice_id:
            result = await db.execute(select(APInvoice).where(APInvoice.id == ap_invoice_id))
            inv = result.scalar_one_or_none()
            if inv:
                inv.submitted_at = datetime.now(UTC).replace(tzinfo=None)  # type: ignore[assignment]
                await db.commit()
                logger.info(
                    "Marked AP Invoice %s as submitted at %s", ap_invoice_id, inv.submitted_at
                )
        return res
