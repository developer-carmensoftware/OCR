"""Feedback router — log user corrections for OCR learning."""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
from sqlalchemy.dialects.mysql import insert as mysql_insert

from app.database import get_db
from app.models import (
    CorrectionFeedback,
    CorrectionFeedbackRequest,
    CorrectionFeedbackResponse,
    CorrectionFeedbackBatchRequest,
    CorrectionFeedbackBatchResponse,
)
from app.auth.dependencies import get_current_session, SessionInfo

router = APIRouter(prefix="/api/v1/feedback", tags=["feedback"])
logger = logging.getLogger(__name__)


def _build_upsert(feedback: CorrectionFeedbackRequest, session: SessionInfo):
    """Return a mysql INSERT … ON DUPLICATE KEY UPDATE statement.

    The LAST_INSERT_ID(id) trick makes result.lastrowid reliable for both
    the insert case (new auto-increment) and the update case (existing id).
    """
    return (
        mysql_insert(CorrectionFeedback)
        .values(
            tenant_id=session.tenant_id,
            business_unit_id=session.business_unit_id,
            doc_no=feedback.doc_no,
            bank_code=feedback.bank_code,
            field_name=feedback.field_name,
            original_value=feedback.original_value,
            corrected_value=feedback.corrected_value,
            carmen_user_id=session.carmen_user_id or None,
        )
        .on_duplicate_key_update(
            bank_code=feedback.bank_code,
            original_value=feedback.original_value,
            corrected_value=feedback.corrected_value,
            carmen_user_id=session.carmen_user_id or None,
            updated_at=func.now(),
            id=func.last_insert_id(CorrectionFeedback.id),
        )
    )


@router.post("/correction", response_model=CorrectionFeedbackResponse)
async def log_correction(
    feedback: CorrectionFeedbackRequest,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """Log a user correction. Atomic UPSERT — unique per (tenant, bu, doc_no, field_name)."""
    if feedback.original_value == feedback.corrected_value:
        return CorrectionFeedbackResponse(
            id=-1,
            skipped=True,
            **feedback.model_dump(),
        )

    result = await db.execute(_build_upsert(feedback, session))
    await db.commit()

    record = await db.get(CorrectionFeedback, result.lastrowid)
    logger.info("Upserted correction: %s (%s)", feedback.field_name, feedback.bank_code)
    return CorrectionFeedbackResponse.model_validate(record)


@router.post("/corrections", response_model=CorrectionFeedbackBatchResponse)
async def log_corrections_batch(
    payload: CorrectionFeedbackBatchRequest,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """Batch-upsert multiple corrections in a single transaction."""
    saved = skipped = 0
    for feedback in payload.corrections:
        if feedback.original_value == feedback.corrected_value:
            skipped += 1
            continue
        await db.execute(_build_upsert(feedback, session))
        saved += 1

    if saved:
        await db.commit()

    logger.info("Batch corrections: saved=%d skipped=%d", saved, skipped)
    return CorrectionFeedbackBatchResponse(saved=saved, skipped=skipped)
