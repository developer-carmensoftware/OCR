"""
OCR Service — stateless extraction + task listing/export helpers.
"""

import asyncio
import functools
import logging
import os

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.context import current_tenant_id
from app.exceptions import ValidationError
from app.models.orm import OCRTask, TaskStatus
from app.models.schemas import ExtractedCreditCardData
from app.services.llm_service import extract_from_image
from app.utils.image_processing import resize_if_needed
from app.utils.pdf_utils import (
    PDF_RENDER_TIMEOUT_SECONDS,
    extract_pages_as_pdf,
)

logger = logging.getLogger(__name__)


async def extract_stateless(
    file_bytes: bytes,
    original_filename: str,
    bank_code: str | None = None,
    hints: dict | None = None,
    task_id: str | None = None,
    pdf_password: str | None = None,
) -> ExtractedCreditCardData:
    """
    Stateless OCR extraction: resize → Vision LLM → return structured data.
    Does NOT write to DB.
    bank_code: 'BBL' | 'KBANK' | 'SCB' | 'BAY' | 'KTC' | 'GHL' | 'PAYPAL' | 'SIAMPAY' — selects bank-specific prompt.
    hints: correction hints from correction_service (injected into prompt).
    pdf_password: password for an encrypted PDF (None = not encrypted).
    """
    ext = os.path.splitext(original_filename)[1].lower()
    image_mime_type: str | None = None  # PDF branch leaves this None → falls back to
    # get_mime_type(original_filename) inside extract_from_image, i.e. application/pdf.

    if ext == ".pdf":
        # Credit-card docs are single-page — always extract page 1 as a native PDF
        # subset (full vector/text fidelity; rasterising degraded dense tables),
        # decrypting first if encrypted so Gemini doesn't reject it as "no pages".
        try:
            processed_bytes = await asyncio.wait_for(
                asyncio.get_running_loop().run_in_executor(
                    None,
                    functools.partial(extract_pages_as_pdf, file_bytes, [0], pdf_password),
                ),
                timeout=PDF_RENDER_TIMEOUT_SECONDS,
            )
        except TimeoutError as exc:
            raise ValidationError("PDF processing timed out — the file may be malformed.") from exc
    else:
        processed_bytes, image_mime_type = await asyncio.get_running_loop().run_in_executor(
            None, functools.partial(resize_if_needed, file_bytes)
        )

    logger.info(
        "Extracting: %s (bank=%s hints=%d)",
        original_filename,
        bank_code,
        len(hints) if hints else 0,
    )
    _, extracted = await extract_from_image(
        processed_bytes,
        original_filename,
        bank_code,
        hints=hints,
        task_id=task_id,
        image_mime_type=image_mime_type,
    )
    return extracted


async def get_all_tasks(
    db: AsyncSession,
    status: TaskStatus | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[OCRTask], int]:
    tenant_id = current_tenant_id.get()
    if not tenant_id:
        # Fail closed: no tenant context must return nothing, never all tenants' tasks.
        return [], 0

    query = select(OCRTask).where(OCRTask.deleted_at.is_(None), OCRTask.tenant_id == tenant_id)
    count_q = (
        select(func.count())
        .select_from(OCRTask)
        .where(OCRTask.deleted_at.is_(None), OCRTask.tenant_id == tenant_id)
    )

    if status:
        query = query.where(OCRTask.status == status)
        count_q = count_q.where(OCRTask.status == status)

    total = (await db.execute(count_q)).scalar() or 0
    tasks = (
        (await db.execute(query.order_by(desc(OCRTask.created_at)).limit(limit).offset(offset)))
        .scalars()
        .all()
    )
    return list(tasks), total
