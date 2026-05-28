"""
Credit Card OCR Service — DB-write operations after LLM extraction.

Handles: duplicate check → CreditCard row creation → task status finalization.
"""

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select

from app.database import async_session
from app.models.orm import CreditCard, OCRTask, TaskStatus
from app.models.schemas import ExtractedCreditCardData
from app.utils.date_parsing import parse_doc_date
from app.utils.db_helpers import has_submitted_doc

logger = logging.getLogger(__name__)


async def finalize_extraction(
    extracted: ExtractedCreditCardData,
    task_id: str,
    tenant_id: str,
    bank_code: str | None,
    carmen_user_id: str | None,
) -> ExtractedCreditCardData:
    """Duplicate check, persist CreditCard row, mark task COMPLETED. Returns updated extracted."""
    async with async_session() as db:
        if extracted.doc_no:
            extracted.is_duplicate = await has_submitted_doc(
                db,
                CreditCard,
                tenant_id=tenant_id,
                bank_code=bank_code,
                doc_no=extracted.doc_no,
            )

        if not extracted.is_duplicate:
            card_id = uuid.uuid4()
            card = CreditCard(
                id=card_id,
                task_id=uuid.UUID(task_id),
                tenant_id=tenant_id,
                bank_code=bank_code or None,
                company_name=extracted.company_name,
                bank_company_name=extracted.bank_companyname,
                doc_date=parse_doc_date(extracted.doc_date),
                doc_no=extracted.doc_no,
                branch_no=extracted.branch_no,
                submitted_at=None,
                carmen_user_id=carmen_user_id or None,
            )
            db.add(card)
            extracted.id = str(card_id)
        else:
            extracted.id = None

        task_res = await db.execute(select(OCRTask).where(OCRTask.id == uuid.UUID(task_id)))
        task = task_res.scalar_one_or_none()
        if task:
            task.status = TaskStatus.COMPLETED  # type: ignore
            task.completed_at = datetime.now(UTC).replace(tzinfo=None)  # type: ignore

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
