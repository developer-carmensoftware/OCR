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
from app.models.orm import OCRTask, TaskStatus
from app.models.schemas import ExtractedCreditCardData
from app.services.llm_service import extract_from_image
from app.utils.image_processing import resize_if_needed
from app.utils.pdf_utils import MAX_PAGES_PER_CALL, get_pdf_page_count, render_pdf_pages

logger = logging.getLogger(__name__)


async def extract_stateless(
    file_bytes: bytes,
    original_filename: str,
    bank_code: str | None = None,
    hints: dict | None = None,
    task_id: str | None = None,
    selected_pages: list[int] | None = None,
) -> ExtractedCreditCardData:
    """
    Stateless OCR extraction: resize → Vision LLM → return structured data.
    Does NOT write to DB.
    bank_code: 'BBL' | 'KBANK' | 'SCB' — selects bank-specific prompt.
    hints: correction hints from correction_service (injected into prompt).
    selected_pages: 0-based page indices for PDF files (None = all pages).
    """
    ext = os.path.splitext(original_filename)[1].lower()

    page_images: list[bytes] | None = None
    if ext == ".pdf":
        page_count = await asyncio.get_running_loop().run_in_executor(
            None, get_pdf_page_count, file_bytes
        )
        pages = selected_pages if selected_pages is not None else list(range(page_count))
        # Cap to prevent token overflow
        if len(pages) > MAX_PAGES_PER_CALL:
            logger.warning(
                "PDF %s has %d selected pages; capping at %d",
                original_filename,
                len(pages),
                MAX_PAGES_PER_CALL,
            )
            pages = pages[:MAX_PAGES_PER_CALL]

        page_images = await asyncio.get_running_loop().run_in_executor(
            None, functools.partial(render_pdf_pages, file_bytes, pages)
        )
        # Use first page PNG as primary bytes (for MIME/size logging)
        processed_bytes = page_images[0] if page_images else file_bytes
    else:
        processed_bytes = await asyncio.get_running_loop().run_in_executor(
            None, functools.partial(resize_if_needed, file_bytes)
        )

    logger.info(
        "Extracting: %s (bank=%s hints=%d pages=%s)",
        original_filename,
        bank_code,
        len(hints) if hints else 0,
        len(page_images) if page_images else 1,
    )
    _, extracted = await extract_from_image(
        processed_bytes,
        original_filename,
        bank_code,
        hints=hints,
        task_id=task_id,
        page_images=page_images,
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
