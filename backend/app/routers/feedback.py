"""Feedback router — log user corrections for OCR learning."""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import SessionInfo, get_current_session
from app.database import get_db
from app.models import (
    CorrectionFeedback,
    CorrectionFeedbackBatchRequest,
    CorrectionFeedbackBatchResponse,
    CorrectionFeedbackRequest,
    CorrectionFeedbackResponse,
)
from app.services.correction_service import invalidate_hints_cache

router = APIRouter(prefix="/api/v1/feedback", tags=["feedback"])
logger = logging.getLogger(__name__)


def _build_upsert(feedback: CorrectionFeedbackRequest, session: SessionInfo):
    """Return a Postgres INSERT … ON CONFLICT DO UPDATE statement.

    Returns CorrectionFeedback.id so the caller can fetch the row
    regardless of insert vs. update.
    """
    stmt = pg_insert(CorrectionFeedback).values(
        tenant_id=session.tenant_id,
        business_unit_id=session.business_unit_id,
        doc_no=feedback.doc_no,
        bank_code=feedback.bank_code,
        field_name=feedback.field_name,
        original_value=feedback.original_value,
        corrected_value=feedback.corrected_value,
        carmen_user_id=session.carmen_user_id or None,
    )
    return stmt.on_conflict_do_update(
        constraint="uq_correction_scope_doc_field",
        set_={
            "bank_code": feedback.bank_code,
            "original_value": feedback.original_value,
            "corrected_value": feedback.corrected_value,
            "carmen_user_id": session.carmen_user_id or None,
            "updated_at": func.now(),
        },
    ).returning(CorrectionFeedback.id)


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
    row_id = result.scalar_one()
    await db.commit()

    # Hints are cached per (tenant, bu, bank) for 10min — drop the entry so
    # the next /extract reflects this new correction.
    invalidate_hints_cache(session.tenant_id, session.business_unit_id)

    record = await db.get(CorrectionFeedback, row_id)
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
        invalidate_hints_cache(session.tenant_id, session.business_unit_id)

    logger.info("Batch corrections: saved=%d skipped=%d", saved, skipped)
    return CorrectionFeedbackBatchResponse(saved=saved, skipped=skipped)
