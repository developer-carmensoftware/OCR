"""Feedback router — log user corrections for OCR learning."""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.mysql import insert as mysql_insert

from app.database import get_db
from app.models import CorrectionFeedback, CorrectionFeedbackRequest, CorrectionFeedbackResponse
from app.auth.dependencies import get_current_session, SessionInfo

router = APIRouter(prefix="/api/v1/feedback", tags=["feedback"])
logger = logging.getLogger(__name__)


@router.post("/correction", response_model=CorrectionFeedbackResponse)
async def log_correction(
    feedback: CorrectionFeedbackRequest,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """
    Log a user correction at submit time.
    Atomic UPSERT — unique per (tenant, bu, doc_no, field_name).
    """
    if feedback.original_value == feedback.corrected_value:
        return CorrectionFeedbackResponse(
            id=-1,
            doc_no=feedback.doc_no,
            bank_code=feedback.bank_code,
            field_name=feedback.field_name,
            original_value=feedback.original_value,
            corrected_value=feedback.corrected_value,
            created_at=None,  # type: ignore
        )

    stmt = (
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
        )
    )
    await db.execute(stmt)
    await db.commit()

    result = await db.execute(
        select(CorrectionFeedback).where(
            CorrectionFeedback.tenant_id == session.tenant_id,
            CorrectionFeedback.business_unit_id == session.business_unit_id,
            CorrectionFeedback.doc_no == feedback.doc_no,
            CorrectionFeedback.field_name == feedback.field_name,
            CorrectionFeedback.deleted_at.is_(None),
        )
    )
    record = result.scalar_one()

    logger.info("Upserted correction: %s (%s)", feedback.field_name, feedback.bank_code)
    return CorrectionFeedbackResponse.model_validate(record)
