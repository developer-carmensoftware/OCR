"""
Carmen Proxy Router — thin HTTP layer for Carmen Cloud API calls.

All business logic and HTTP construction lives in `services/carmen_service.py`.
Session injection (get_current_session) supplies the per-user Carmen token.
"""

import logging
from datetime import datetime

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


@router.get("/account-codes")
async def proxy_account_codes(session: SessionInfo = Depends(get_current_session)):
    try:
        return await get_account_codes(session.carmen_token)
    except CarmenAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.get("/departments")
async def proxy_departments(session: SessionInfo = Depends(get_current_session)):
    try:
        return await get_departments(session.carmen_token)
    except CarmenAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.get("/gl-prefix")
async def proxy_gl_prefix(session: SessionInfo = Depends(get_current_session)):
    try:
        return await get_gl_prefix(session.carmen_token)
    except CarmenAPIError as e:
        return {"Data": [], "Status": f"upstream_{e.status_code}"}


@router.post("/gljv")
async def proxy_gljv(request: Request, session: SessionInfo = Depends(get_current_session)):
    body = await request.json()
    try:
        return await post_gljv(body, session.carmen_token)
    except CarmenAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=f"Carmen GL JV ล้มเหลว: {e.detail}")


@router.put("/gljv/{jvh_seq}")
async def proxy_update_gljv(
    jvh_seq: int, request: Request, session: SessionInfo = Depends(get_current_session)
):
    body = await request.json()
    try:
        return await put_gljv(jvh_seq, body, session.carmen_token)
    except CarmenAPIError as e:
        raise HTTPException(
            status_code=e.status_code, detail=f"Carmen GL JV update ล้มเหลว: {e.detail}"
        )


@router.get("/vendors")
async def proxy_vendors(session: SessionInfo = Depends(get_current_session)):
    try:
        return await get_vendors(session.carmen_token)
    except CarmenAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.get("/tax-profiles")
async def proxy_tax_profiles(session: SessionInfo = Depends(get_current_session)):
    try:
        return await get_tax_profiles(session.carmen_token)
    except CarmenAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.get("/period-list")
async def proxy_period_list(session: SessionInfo = Depends(get_current_session)):
    try:
        return await get_period_list(session.carmen_token)
    except CarmenAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/input-tax")
async def proxy_create_input_tax(
    request: Request, session: SessionInfo = Depends(get_current_session)
):
    body = await request.json()
    try:
        return await post_input_tax(body, session.carmen_token)
    except CarmenAPIError as e:
        raise HTTPException(
            status_code=e.status_code, detail=f"Carmen Input Tax ล้มเหลว: {e.detail}"
        )


@router.put("/input-tax/{rec_seq}")
async def proxy_update_input_tax(
    rec_seq: int, request: Request, session: SessionInfo = Depends(get_current_session)
):
    body = await request.json()
    try:
        return await put_input_tax(rec_seq, body, session.carmen_token)
    except CarmenAPIError as e:
        raise HTTPException(
            status_code=e.status_code, detail=f"Carmen Input Tax update ล้มเหลว: {e.detail}"
        )


@router.post("/invoice")
async def proxy_create_invoice(
    request: Request,
    ap_invoice_id: str = None,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    body = await request.json()
    try:
        res = await post_invoice(body, session.carmen_token)
        # If Carmen submission is successful, mark the internal APInvoice as submitted
        if res and res.get("Code", 0) >= 0 and ap_invoice_id:
            stmt = select(APInvoice).where(APInvoice.id == ap_invoice_id)
            result = await db.execute(stmt)
            inv = result.scalar_one_or_none()
            if inv:
                inv.submitted_at = datetime.utcnow()
                await db.commit()
                logger.info(f"Marked AP Invoice {ap_invoice_id} as submitted at {inv.submitted_at}")
        return res
    except CarmenAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=f"Carmen Invoice ล้มเหลว: {e.detail}")
