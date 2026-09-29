"""
Credit Card OCR Service — DB-write operations after LLM extraction.

Handles: duplicate check → CreditCard row creation → task status finalization.
"""

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select

from app.constants import DocType
from app.database import async_session
from app.models.orm import CreditCard, OCRTask, TaskStatus
from app.models.schemas import ExtractedCreditCardData
from app.services.credit_card.postprocess import (
    _BANK_STATEMENT_CODES,
    _clean_transaction_labels,
    _normalize_ar_settlement,
    _normalize_bay_statement,
    _normalize_fee_invoice,
    _strip_noncard_rows,
)
from app.utils.bank_detect import FEE_INVOICE_CODES, detect_bank_code
from app.utils.date_parsing import format_doc_date, parse_doc_date
from app.utils.db_helpers import has_submitted_doc

logger = logging.getLogger(__name__)


async def finalize_extraction(
    extracted: ExtractedCreditCardData,
    task_id: str,
    tenant_id: str,
    bank_code: str | None,
    carmen_user_id: str | None,
    doc_type: str = DocType.FEE_INVOICE,
    original_filename: str | None = None,
) -> ExtractedCreditCardData:
    """Duplicate check, persist CreditCard row, mark task COMPLETED. Returns updated extracted."""
    # Resolve bank_code from the extracted fields when the caller passed none — the same
    # detection the frontend uses — so the stored draft and the submit step agree. It is
    # stored and it drives the normalizer below, but it is deliberately NOT part of the
    # duplicate key: see the `has_submitted_doc` call.
    #
    # The caller's bank stays authoritative, deliberately. Letting detection outrank it
    # was tried and reverted: the wizard's "Re-extract with <bank>" passes the user's
    # explicit choice here, and a merchant name the model leaks into the issuer field
    # ("บริษัท โรงแรมกรุงเทพ จำกัด" → BBL, tier 1a) would then send a KTC fee invoice down
    # the statement branch, where the non-zero-pay_amt filter drops every one of its rows
    # (a fee line carries pay_amt=null by design). It also bought nothing on the email
    # path it was aimed at: `_resolve_bank` there already returns `detected or rule_bank`,
    # so detection has won before this function is reached.
    resolved_bank_code = bank_code or detect_bank_code(
        model_bank_code=extracted.bank_code,
        bank_company_name=extracted.bank_company_name,
        bank_name=extracted.bank_name,
        company_name=extracted.company_name,
        doc_name=extracted.doc_name,
    )

    if doc_type == DocType.AR_RECONCILE:
        # Branches on the document, not the bank: KBANK issues both this and the fee
        # invoice above, and only the caller's rule knows which one arrived.
        _normalize_ar_settlement(extracted, original_filename)
    elif resolved_bank_code and resolved_bank_code in FEE_INVOICE_CODES:
        _normalize_fee_invoice(extracted, resolved_bank_code)
    elif resolved_bank_code in _BANK_STATEMENT_CODES:
        _normalize_bay_statement(extracted)
    else:
        # Plain statement banks (BBL/KBANK/SCB) + undetected: no normalizer of
        # their own, so drop any summary / WHT row the LLM leaked into details —
        # and check the rows against the TOTAL that row carried.
        _strip_noncard_rows(extracted, resolved_bank_code)

    # After the normalizers, because they match on the raw label (`_is_summary_row`
    # reads "TOTAL", `_normalize_fee_invoice` finds its summary row by it) and would
    # answer differently on a trimmed one. Both entry paths — the wizard and email
    # ingest — come through here, so the mapping key the browser shows and the one
    # the pipeline looks up are the same string by construction.
    _clean_transaction_labels(extracted)

    parsed_date = parse_doc_date(extracted.doc_date)

    async with async_session() as db:
        if extracted.doc_no:
            # **bank_code is not in this key.** The two entry paths fill it from different
            # authorities — the wizard from the user's dropdown, the email job from the
            # document itself (`email_automation.pipeline._run_document`) — so one disagreement
            # over the same document produced two rows and both posted to Carmen.
            # doc_date keeps the key specific enough that two banks reusing a doc_no do
            # not collide: a false positive here refuses a real document as "already
            # posted", which is worse than the duplicate draft this guard exists to stop.
            #
            # **doc_type IS in this key**, for the same reason bank_code is not. KBANK
            # prints one tax invoice number across two documents — the commission tax
            # invoice and the settlement report that reclassifies the same day's takings —
            # and both legitimately post their own JV. Without this the second to arrive is
            # refused as a copy of the first.
            extracted.is_duplicate = await has_submitted_doc(
                db,
                CreditCard,
                tenant_id=tenant_id,
                doc_no=extracted.doc_no,
                doc_date=parsed_date,
                doc_type=doc_type,
            )

        if not extracted.is_duplicate:
            card_id = uuid.uuid4()
            card = CreditCard(
                id=card_id,
                task_id=uuid.UUID(task_id),
                tenant_id=tenant_id,
                bank_code=resolved_bank_code or None,
                company_name=extracted.company_name,
                bank_company_name=extracted.bank_company_name,
                doc_date=parsed_date,
                doc_no=extracted.doc_no,
                branch_no=extracted.branch_no,
                submitted_at=None,
                carmen_user_id=carmen_user_id or None,
                doc_type=doc_type,
            )
            db.add(card)
            extracted.id = str(card_id)
            if parsed_date:
                extracted.doc_date = format_doc_date(parsed_date)
        else:
            extracted.id = None

        task_res = await db.execute(select(OCRTask).where(OCRTask.id == uuid.UUID(task_id)))
        task = task_res.scalar_one_or_none()
        if task:
            task.status = TaskStatus.COMPLETED  # type: ignore
            task.completed_at = datetime.now(UTC)  # type: ignore

        await db.commit()
    return extracted


async def mark_task_failed(task_id: str, exc: Exception) -> None:
    """Mark a task FAILED and record the error message."""
    logger.error("Failed to process OCR task %s: %s", task_id, exc)
    async with async_session() as db:
        task_res = await db.execute(select(OCRTask).where(OCRTask.id == uuid.UUID(task_id)))
        task = task_res.scalar_one_or_none()
        if task:
            task.status = TaskStatus.FAILED  # type: ignore
            task.error_message = str(exc)  # type: ignore
            await db.commit()
