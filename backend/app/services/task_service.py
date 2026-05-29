"""
Task Service — shared OCRTask lifecycle used by all extraction modules.
"""

import uuid
from datetime import UTC, datetime

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
) -> OCRTask:
    """Create, persist, and return an OCRTask in PROCESSING state."""
    task = OCRTask(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        module_id=module_id,
        original_filename=original_filename,
        status=TaskStatus.PROCESSING,
        ocr_engine=settings.ocr_engine,
        carmen_user_id=carmen_user_id or None,
    )
    db.add(task)
    await db.commit()
    return task


async def mark_completed(db: AsyncSession, task_id: str | uuid.UUID) -> None:
    result = await db.execute(select(OCRTask).where(OCRTask.id == uuid.UUID(str(task_id))))
    task = result.scalar_one_or_none()
    if task:
        task.status = TaskStatus.COMPLETED  # type: ignore[assignment]
        task.completed_at = datetime.now(UTC).replace(tzinfo=None)  # type: ignore[assignment]
        await db.commit()


async def mark_failed(db: AsyncSession, task_id: str | uuid.UUID, error: str) -> None:
    result = await db.execute(select(OCRTask).where(OCRTask.id == uuid.UUID(str(task_id))))
    task = result.scalar_one_or_none()
    if task:
        task.status = TaskStatus.FAILED  # type: ignore[assignment]
        task.error_message = error  # type: ignore[assignment]
        await db.commit()
