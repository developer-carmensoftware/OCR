"""
Carmen Proxy Router — thin HTTP layer for Carmen Cloud API calls.

All business logic and HTTP construction lives in `services/carmen_service.py`.
Session injection (get_current_session) supplies the per-user Carmen token.
"""

import logging
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import SessionInfo, get_current_session
from app.constants import Module
from app.database import get_db
from app.exceptions import DuplicateDocumentError
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
from app.utils.client_ip import get_client_ip
from app.utils.db_helpers import has_submitted_doc

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/carmen", tags=["Carmen"])


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

    # ── Duplicate-submit guard (BEFORE posting to Carmen) ──────────────────────
    # The card row is locked FOR UPDATE and held through the Carmen post + stamp
    # below, so two concurrent submits of the same document serialize: the second
    # blocks until the first commits (stamping submitted_at) and is then rejected.
    # A malformed / cross-tenant / absent card_id degrades to the legacy no-guard
    # path (posts, skips bookkeeping) — the real wizard always sends a valid id.
    card: CreditCard | None = None
    tenant_uuid: uuid.UUID | None = None
    if credit_card_id:
        try:
            card_uuid = uuid.UUID(credit_card_id)
            tenant_uuid = uuid.UUID(session.tenant_id)
        except (ValueError, AttributeError):
            # Deliberately does not echo the caller-supplied value: it is unbounded
            # request input, this path is a known-benign flow (the wizard sends doc_no
            # here on a duplicate re-submit — see test_gljv_non_uuid_credit_card_id…),
            # and interpolating anything named credit_card_* trips CodeQL's
            # py/clear-text-logging-sensitive-data name heuristic (a false positive —
            # this is our own credit_cards.id row UUID, never card data; the schema has
            # no PAN column at all).
            logger.warning("Skipping duplicate guard / bookkeeping: credit_card_id is not a UUID")
            card_uuid = None
        if card_uuid and tenant_uuid:
            card = (
                await db.execute(
                    select(CreditCard)
                    .where(
                        CreditCard.id == card_uuid,
                        CreditCard.tenant_id == tenant_uuid,
                        CreditCard.deleted_at.is_(None),
                    )
                    .with_for_update()
                )
            ).scalar_one_or_none()
        if card is not None:
            eff_doc = doc_no or card.doc_no
            # (a) this exact card already went to Carmen (double-click / retry after success)
            if card.submitted_at is not None:
                raise DuplicateDocumentError(
                    f"Document number {eff_doc or ''} has already been submitted to Carmen."
                )
            # (b) a different card with the same (tenant, bank, doc_no) already submitted
            eff_bank = bank_code or card.bank_code
            if (
                eff_bank
                and eff_doc
                and await has_submitted_doc(
                    db,
                    CreditCard,
                    tenant_id=tenant_uuid,
                    bank_code=eff_bank,
                    doc_no=eff_doc,
                )
            ):
                raise DuplicateDocumentError(
                    f"Document number {eff_doc} has already been submitted to Carmen."
                )

    async with _carmen_errors("Carmen Cloud JV ล้มเหลว"):
        res = await post_gljv(body, session.carmen_token)
        # Carmen has already accepted the JV; the bookkeeping below must never turn a
        # successful submit into an HTTP 500 (the lock releases on session close).
        if res and res.get("Code", -1) >= 0 and card is not None:
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

            card_doc_no: str | None = card.doc_no  # type: ignore[assignment]

            # The durable record of this exact event — a redundant logger.info of the
            # same id used to sit above and is dropped: audit_logs is queryable, keyed
            # by the doc_no a human would actually search on, and doesn't trip CodeQL.
            await audit_service.log_action(
                session,
                AuditAction.SUBMIT,
                resource="credit_card",
                resource_id=card_doc_no or str(card.id),
                ip_address=get_client_ip(request),
            )
        return res


@router.put("/gljv/{jvh_seq}")
async def proxy_update_gljv(
    jvh_seq: int, request: Request, session: SessionInfo = Depends(get_current_session)
):
    body = await request.json()
    async with _carmen_errors("Carmen Cloud JV update ล้มเหลว"):
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
            await mark_invoice_submitted(db, ap_invoice_id, session.tenant_id)
            await audit_service.log_action(
                session,
                AuditAction.SUBMIT,
                resource=Module.AP_INVOICE,
                resource_id=ap_invoice_id,
                ip_address=get_client_ip(request),
            )
        return res
