"""
Carmen Proxy Router — thin HTTP layer for Carmen Cloud API calls.

All business logic and HTTP construction lives in `services/carmen_service.py`.
Session injection (get_current_session) supplies the per-user Carmen token.
"""

import logging
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import SessionInfo, get_current_session
from app.constants import Module
from app.database import get_db
from app.exceptions import DuplicateDocumentError
from app.models.orm import CreditCard
from app.services.ap_invoice.service import mark_invoice_submitted
from app.services.shared import audit as audit_service
from app.services.shared.audit import AuditAction
from app.services.shared.carmen import (
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


async def _lock_card(
    db: AsyncSession, session: SessionInfo, credit_card_id: str | None
) -> CreditCard | None:
    """This session's tenant's card, locked FOR UPDATE until the request's session closes.

    None for an absent, malformed or cross-tenant id — the caller then posts without a
    guard or bookkeeping, which is the legacy path; the real wizard always sends a valid id.
    """
    if not credit_card_id:
        return None
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
        return None
    return (
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


@router.post("/gljv")
async def proxy_gljv(
    request: Request,
    credit_card_id: str | None = None,
    doc_no: str | None = None,
    company_name: str | None = None,
    bank_code: str | None = None,
    branch_no: str | None = None,
    commis_amt: Decimal | None = None,
    tax_amt: Decimal | None = None,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    body = await request.json()

    # ── Duplicate-submit guard (BEFORE posting to Carmen) ──────────────────────
    # The card row is locked FOR UPDATE and held through the Carmen post + stamp
    # below, so two concurrent submits of the same document serialize: the second
    # blocks until the first commits (stamping submitted_at) and is then rejected.
    card = await _lock_card(db, session, credit_card_id)
    if card is not None:
        eff_doc = doc_no or card.doc_no
        # (a) this exact card already went to Carmen (double-click / retry after success)
        if card.submitted_at is not None:
            raise DuplicateDocumentError(
                f"Document number {eff_doc or ''} has already been submitted to Carmen."
            )
        # (b) a different card with the same (tenant, doc_no, doc_date) already
        # submitted. bank_code used to be in this key and in this guard's condition,
        # which meant a card with no detected bank skipped the check entirely and a
        # document the email job filed under a different bank was never seen as the
        # same document — see finalize_extraction for the whole story.
        if eff_doc and await has_submitted_doc(
            db,
            CreditCard,
            tenant_id=card.tenant_id,
            doc_no=eff_doc,
            doc_date=card.doc_date,
        ):
            raise DuplicateDocumentError(
                f"Document number {eff_doc} has already been submitted to Carmen."
            )

    async with _carmen_errors("Carmen Cloud JV ล้มเหลว"):
        res = await post_gljv(body, session.carmen_token)
        # Carmen has already accepted the JV; the bookkeeping below must never turn a
        # successful submit into an HTTP 500 (the lock releases on session close).
        #
        # `Code == 0` is Carmen's success contract and nothing weaker will do: this used
        # to stamp on `Code >= 0`, so a *rejected* JV was marked submitted and the user's
        # retry was met with "already submitted to Carmen" instead of whatever Carmen had
        # actually complained about. A document Carmen refused must stay re-submittable.
        if res and res.get("Code") == 0 and card is not None:
            card.submitted_at = datetime.now(UTC)  # type: ignore[assignment]
            # Carmen returns the JV number in InternalMessage — same field
            # email_ingest_service reads when it stamps a posted email document. Kept so
            # the activity table can link a manual scan into Carmen.
            card.jv_no = str(res.get("InternalMessage") or "") or None  # type: ignore[assignment]
            if doc_no:
                card.doc_no = doc_no  # type: ignore[assignment]
            if company_name:
                card.company_name = company_name  # type: ignore[assignment]
            if bank_code:
                card.bank_code = bank_code  # type: ignore[assignment]
            if branch_no:
                card.branch_no = branch_no  # type: ignore[assignment]
            # What the input-tax record will claim — kept so a JV whose ACTX never followed
            # (the session died on step 4) can be seen and filed from the activity table.
            if commis_amt is not None:
                card.commis_amt = commis_amt  # type: ignore[assignment]
            if tax_amt is not None:
                card.tax_amt = tax_amt  # type: ignore[assignment]
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
    request: Request,
    credit_card_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    body = await request.json()
    # Same lock and same degrade-to-no-guard rule as the JV. Without a card this is the
    # plain proxy it always was; with one, a second filing is refused before it reaches
    # Carmen — a restored draft and the activity table's button can both reach this record.
    card = await _lock_card(db, session, credit_card_id)
    if card is not None and card.input_tax_at is not None:
        raise DuplicateDocumentError(
            f"The input tax for document {card.doc_no or ''} has already been recorded in Carmen."
        )
    async with _carmen_errors("Carmen Input Tax ล้มเหลว"):
        res = await post_input_tax(body, session.carmen_token)
    if res and res.get("Code") == 0 and card is not None:
        # Carmen has the record now. A failed stamp must not turn that into an error the
        # user retries — that retry is a second ACTX.
        try:
            card.input_tax_at = datetime.now(UTC)  # type: ignore[assignment]
            await db.commit()
        except Exception:
            logger.exception("[carmen_proxy] Input tax posted but input_tax_at not stamped")
    return res


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
