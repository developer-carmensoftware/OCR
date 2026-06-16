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
    get_pdf_page_count,
    normalize_pdf_for_llm,
)

logger = logging.getLogger(__name__)


async def extract_stateless(
    file_bytes: bytes,
    original_filename: str,
    bank_code: str | None = None,
    hints: dict | None = None,
    task_id: str | None = None,
    selected_pages: list[int] | None = None,
    pdf_password: str | None = None,
) -> ExtractedCreditCardData:
    """
    Stateless OCR extraction: resize → Vision LLM → return structured data.
    Does NOT write to DB.
    bank_code: 'BBL' | 'KBANK' | 'SCB' — selects bank-specific prompt.
    hints: correction hints from correction_service (injected into prompt).
    selected_pages: 0-based page indices for PDF files (None = all pages).
    pdf_password: password for an encrypted PDF (None = not encrypted).
    """
    ext = os.path.splitext(original_filename)[1].lower()

    if ext == ".pdf":
        if selected_pages is not None:
            # Page selection: send a native PDF subset (full vector/text fidelity)
            # rather than a rasterised PNG — rasterising degraded dense tables and
            # broke extraction that worked when the whole PDF was sent natively.
            page_count = await asyncio.get_running_loop().run_in_executor(
                None, functools.partial(get_pdf_page_count, file_bytes, pdf_password)
            )
            valid_pages = [p for p in selected_pages if 0 <= p < page_count]
            if not valid_pages:
                raise ValidationError(
                    f"selected_pages {selected_pages} are out of range for a "
                    f"{page_count}-page document."
                )
            try:
                processed_bytes = await asyncio.wait_for(
                    asyncio.get_running_loop().run_in_executor(
                        None,
                        functools.partial(
                            extract_pages_as_pdf, file_bytes, valid_pages, pdf_password
                        ),
                    ),
                    timeout=PDF_RENDER_TIMEOUT_SECONDS,
                )
            except TimeoutError as exc:
                raise ValidationError(
                    "PDF processing timed out — the file may be malformed."
                ) from exc
        else:
            # No selection → send the whole PDF natively (proven high-quality path),
            # decrypting first if encrypted so Gemini doesn't reject it as "no pages".
            processed_bytes = await asyncio.get_running_loop().run_in_executor(
                None, functools.partial(normalize_pdf_for_llm, file_bytes, pdf_password)
            )
    else:
        processed_bytes = await asyncio.get_running_loop().run_in_executor(
            None, functools.partial(resize_if_needed, file_bytes)
        )

    logger.info(
        "Extracting: %s (bank=%s hints=%d selected_pages=%s)",
        original_filename,
        bank_code,
        len(hints) if hints else 0,
        selected_pages,
    )
    _, extracted = await extract_from_image(
        processed_bytes,
        original_filename,
        bank_code,
        hints=hints,
        task_id=task_id,
    )
    return extracted


async def get_all_tasks(
    db: AsyncSession,
    status: TaskStatus | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[OCRTask], int]:
    tenant_id = current_tenant_id.get()

    query = select(OCRTask).where(OCRTask.deleted_at.is_(None))
    count_q = select(func.count()).select_from(OCRTask).where(OCRTask.deleted_at.is_(None))

    if tenant_id:
        query = query.where(OCRTask.tenant_id == tenant_id)
        count_q = count_q.where(OCRTask.tenant_id == tenant_id)
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
