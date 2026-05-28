"""
Task Service — shared OCRTask creation used by all extraction modules.
"""

import uuid

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
