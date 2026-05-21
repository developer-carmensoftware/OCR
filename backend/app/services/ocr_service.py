"""
OCR Service — stateless extraction + task listing/export helpers.
"""

import asyncio
import functools
import logging
import os
import uuid

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.context import current_business_unit_id, current_tenant_id
from app.models.orm import OCRTask, TaskStatus
from app.models.schemas import ExtractedCreditCardData
from app.services.llm_service import extract_from_image
from app.utils.image_processing import resize_if_needed

logger = logging.getLogger(__name__)


async def create_task(
    db: AsyncSession,
    *,
    tenant_id: str,
    business_unit_id: str,
    module_id: str,
    original_filename: str,
    carmen_user_id: str | None = None,
) -> OCRTask:
    """Create, persist, and return a completed OCRTask. Shared by OCR and AP invoice routers."""
    task = OCRTask(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        business_unit_id=business_unit_id,
        module_id=module_id,
        original_filename=original_filename,
        status=TaskStatus.COMPLETED,
        ocr_engine=settings.ocr_engine,
        carmen_user_id=carmen_user_id or None,
    )
    db.add(task)
    await db.commit()
    return task


async def extract_stateless(
    file_bytes: bytes,
    original_filename: str,
    bank_code: str | None = None,
    hints: dict | None = None,
    task_id: str | None = None,
) -> ExtractedCreditCardData:
    """
    Stateless OCR extraction: resize → Vision LLM → return structured data.
    Does NOT write to DB.
    bank_code: 'BBL' | 'KBANK' | 'SCB' — selects bank-specific prompt.
    hints: correction hints from correction_service (injected into prompt).
    """
    ext = os.path.splitext(original_filename)[1].lower()
    if ext == ".pdf":
        processed_bytes = file_bytes
    else:
        processed_bytes = await asyncio.get_running_loop().run_in_executor(
            None, functools.partial(resize_if_needed, file_bytes)
        )

    logger.info(
        "Extracting: %s (bank=%s hints=%d)",
        original_filename,
        bank_code,
        len(hints) if hints else 0,
    )
    _, extracted = await extract_from_image(
        processed_bytes, original_filename, bank_code, hints=hints, task_id=task_id
    )
    return extracted


async def get_all_tasks(
    db: AsyncSession,
    status: TaskStatus | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[OCRTask], int]:
    tenant_id = current_tenant_id.get()
    business_unit_id = current_business_unit_id.get()

    query = select(OCRTask).where(OCRTask.deleted_at.is_(None))
    count_q = select(func.count()).select_from(OCRTask).where(OCRTask.deleted_at.is_(None))

    if tenant_id:
        query = query.where(OCRTask.tenant_id == tenant_id)
        count_q = count_q.where(OCRTask.tenant_id == tenant_id)
    if business_unit_id:
        query = query.where(OCRTask.business_unit_id == business_unit_id)
        count_q = count_q.where(OCRTask.business_unit_id == business_unit_id)
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
