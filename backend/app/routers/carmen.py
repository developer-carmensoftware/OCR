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
from app.constants import Module
from app.database import get_db
from app.models.orm import CreditCard
from app.services import audit_service
from app.services.ap_invoice_service import mark_invoice_submitted
from app.services.audit_service import AuditAction
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
        msg = f"{detail_prefix}: {e.detail}" if detail_prefix else e.detail
        logger.error("[carmen_proxy] Upstream HTTP %d: %s", e.status_code, e.detail)
        raise HTTPException(status_code=e.status_code, detail=msg) from e


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
async def proxy_gljv(
    request: Request,
    credit_card_id: str | None = None,
    doc_no: str | None = None,
    company_name: str | None = None,
    bank_code: str | None = None,
    branch_no: str | None = None,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    body = await request.json()
    async with _carmen_errors("Carmen GL JV ล้มเหลว"):
        res = await post_gljv(body, session.carmen_token)
        if res and res.get("Code", -1) >= 0 and credit_card_id:
            import uuid

            # Carmen has already accepted the JV; the bookkeeping below must
            # never turn a successful submit into an HTTP 500. Guard the UUID
            # parse defensively — `credit_card_id` must be a UUID, but a
            # malformed value should degrade gracefully rather than raise.
            try:
                card_uuid = uuid.UUID(credit_card_id)
            except (ValueError, AttributeError):
                logger.warning(
                    "Skipping post-submit bookkeeping: credit_card_id %r is not a UUID",
                    credit_card_id,
                )
                return res

            result = await db.execute(
                select(CreditCard).where(
                    CreditCard.id == card_uuid, CreditCard.deleted_at.is_(None)
                )
            )
            card = result.scalar_one_or_none()
            if card:
                card.submitted_at = datetime.now(UTC)  # type: ignore[assignment]
                if doc_no:
                    card.doc_no = doc_no  # type: ignore[assignment]
                if company_name:
                    card.company_name = company_name  # type: ignore[assignment]
                if bank_code:
                    card.bank_code = bank_code  # type: ignore[assignment]
                if branch_no:
                    card.branch_no = branch_no  # type: ignore[assignment]
                await db.commit()
                logger.info("Marked Credit Card %s as submitted", credit_card_id)

                card_doc_no: str | None = card.doc_no  # type: ignore[assignment]

                # Write audit log
                await audit_service.log_action(
                    session,
                    AuditAction.SUBMIT,
                    resource="credit_card",
                    resource_id=card_doc_no or str(card.id),
                    ip_address=request.client.host if request.client else None,
                )
        return res


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
            await mark_invoice_submitted(db, ap_invoice_id)
            await audit_service.log_action(
                session,
                AuditAction.SUBMIT,
                resource=Module.AP_INVOICE,
                resource_id=ap_invoice_id,
                ip_address=request.client.host if request.client else None,
            )
        return res
