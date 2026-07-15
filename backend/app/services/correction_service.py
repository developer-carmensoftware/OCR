"""
Correction Service — compute per-field error rates to tune OCR prompts.

Logic:
    error_rate = corrections(field, 90d) / submitted_receipts(bank, 90d)
    inject hint into prompt if error_rate > ERROR_RATE_THRESHOLD
"""

import logging
import time
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import SessionInfo
from app.context import current_tenant_id
from app.models.orm import CorrectionFeedback, CreditCard
from app.models.schemas import CorrectionFeedbackRequest

logger = logging.getLogger(__name__)

ERROR_RATE_THRESHOLD = 0.10  # 10% — only hint if error rate exceeds this
TTL_DAYS = 90
MIN_CARDS = 10  # need at least this many submitted docs for meaningful ratio

# Hints are derived from 90-day aggregates — they change very slowly. The two
# COUNT queries used to run on every /extract; cache per (tenant, bank) so
# we hit the DB at most once per _HINTS_CACHE_TTL seconds.
_HINTS_CACHE_TTL = 600.0  # 10 minutes
_HINTS_CACHE: dict[tuple[str, str], tuple[dict[str, str], float]] = {}


async def get_correction_hints(
    bank_code: str,
    db: AsyncSession,
) -> dict[str, str]:
    """
    Return {field_name: hint_text} for fields where error rate > 10%.
    Scoped to the current tenant from context vars.
    Result cached per (tenant, bank_code) for _HINTS_CACHE_TTL seconds.
    """
    tenant_id = current_tenant_id.get() or ""
    if not tenant_id:
        # Fail closed: without a tenant context the aggregate below would pool every
        # tenant's correction stats together — a cross-tenant leak. Return no hints.
        return {}
    cache_key = (tenant_id, bank_code)

    now = time.monotonic()
    cached = _HINTS_CACHE.get(cache_key)
    if cached and now - cached[1] < _HINTS_CACHE_TTL:
        return cached[0]

    cutoff = datetime.now(UTC) - timedelta(days=TTL_DAYS)

    # Base filters for tenant scope
    card_filters = [
        CreditCard.bank_code == bank_code,
        CreditCard.submitted_at.isnot(None),
        CreditCard.submitted_at >= cutoff,
        CreditCard.deleted_at.is_(None),
    ]
    corr_filters = [
        CorrectionFeedback.bank_code == bank_code,
        CorrectionFeedback.created_at >= cutoff,
        CorrectionFeedback.deleted_at.is_(None),
    ]

    card_filters.append(CreditCard.tenant_id == tenant_id)
    corr_filters.append(CorrectionFeedback.tenant_id == tenant_id)

    # Count submitted documents for this bank (denominator)
    total_result = await db.execute(
        select(func.count()).select_from(CreditCard).where(*card_filters)
    )
    total_cards = total_result.scalar() or 0

    if total_cards < MIN_CARDS:
        logger.debug(
            "[hints] %s: only %d docs (need %d) — skipping", bank_code, total_cards, MIN_CARDS
        )
        _HINTS_CACHE[cache_key] = ({}, now)
        return {}

    # Count corrections per field (numerator)
    result = await db.execute(
        select(CorrectionFeedback.field_name, func.count().label("cnt"))
        .where(*corr_filters)
        .group_by(CorrectionFeedback.field_name)
    )

    hints: dict[str, str] = {}
    for field_name, correction_count in result.all():
        error_rate = correction_count / total_cards
        if error_rate >= ERROR_RATE_THRESHOLD:
            hints[field_name] = f"{correction_count}/{total_cards} ({error_rate:.0%})"

    if hints:
        logger.info(
            "[hints] %s: %d field(s) above %d%% threshold: %s",
            bank_code,
            len(hints),
            int(ERROR_RATE_THRESHOLD * 100),
            list(hints.keys()),
        )

    _HINTS_CACHE[cache_key] = (hints, now)
    return hints


def build_correction_upsert(feedback: CorrectionFeedbackRequest, session: SessionInfo):
    """Return a Postgres INSERT … ON CONFLICT DO UPDATE statement for a single correction.

    Conflict target: partial unique index uq_correction_scope_active
    (tenant_id, bank_code, doc_no, field_name) WHERE deleted_at IS NULL. A partial
    unique index can only be matched via index inference, not ON CONSTRAINT.
    Returns CorrectionFeedback.id via RETURNING so the caller can re-fetch the row.
    """
    stmt = pg_insert(CorrectionFeedback).values(
        tenant_id=session.tenant_id,
        doc_no=feedback.doc_no,
        bank_code=feedback.bank_code,
        field_name=feedback.field_name,
        original_value=feedback.original_value,
        corrected_value=feedback.corrected_value,
        carmen_user_id=session.carmen_user_id or None,
    )
    return stmt.on_conflict_do_update(
        index_elements=["tenant_id", "bank_code", "doc_no", "field_name"],
        index_where=text("deleted_at IS NULL"),
        set_={
            "bank_code": feedback.bank_code,
            "original_value": feedback.original_value,
            "corrected_value": feedback.corrected_value,
            "carmen_user_id": session.carmen_user_id or None,
            "updated_at": func.now(),
        },
    ).returning(CorrectionFeedback.id)


def invalidate_hints_cache(tenant_id: str | None = None) -> None:
    """Drop cached hints — call when CorrectionFeedback rows are added so the next
    /extract reflects new corrections. If tenant_id is None, clears the whole cache."""
    if tenant_id is None:
        _HINTS_CACHE.clear()
        return
    tid = tenant_id or ""
    dead = [k for k in _HINTS_CACHE if k[0] == tid]
    for k in dead:
        _HINTS_CACHE.pop(k, None)
