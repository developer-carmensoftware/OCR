"""
Task Service — shared OCRTask lifecycle used by all extraction modules.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.orm import OCRTask, TaskStatus


async def create_task(
    db: AsyncSession,
    *,
    tenant_id: str,
    module_id: str,
    original_filename: str,
    carmen_user_id: str | None = None,
    charged_docs: int = 1,
) -> OCRTask:
    """Create, persist, and return an OCRTask in PROCESSING state.

    `charged_docs` is what the caller's consume_document() actually took for this task
    (AP invoice: one per page; credit card: one per file; 0 when the charge failed open).
    It is stored because nothing else can answer it — a subscription-funded scan writes
    no ledger row, and a credit-funded one refers to the file by name, not by task.
    """
    task = OCRTask(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        module_id=module_id,
        original_filename=original_filename,
        status=TaskStatus.PROCESSING,
        ocr_engine=settings.ocr_engine,
        carmen_user_id=carmen_user_id or None,
        charged_docs=charged_docs,
    )
    db.add(task)
    await db.commit()
    return task


async def mark_failed(db: AsyncSession, task_id: str | uuid.UUID, error: str) -> None:
    result = await db.execute(select(OCRTask).where(OCRTask.id == uuid.UUID(str(task_id))))
    task = result.scalar_one_or_none()
    if task:
        task.status = TaskStatus.FAILED  # type: ignore[assignment]
        task.error_message = error  # type: ignore[assignment]
        await db.commit()
