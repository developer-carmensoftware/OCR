"""
Correction Service — compute per-field error rates to tune OCR prompts.

Logic:
    error_rate = corrections(field, 90d) / submitted_receipts(bank, 90d)
    inject hint into prompt if error_rate > ERROR_RATE_THRESHOLD
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.context import current_business_unit_id, current_tenant_id
from app.models.orm import CorrectionFeedback, CreditCard

logger = logging.getLogger(__name__)

ERROR_RATE_THRESHOLD = 0.10  # 10% — only hint if error rate exceeds this
TTL_DAYS = 90
MIN_CARDS = 10  # need at least this many submitted docs for meaningful ratio


async def get_correction_hints(
    bank_code: str,
    db: AsyncSession,
) -> dict[str, str]:
    """
    Return {field_name: hint_text} for fields where error rate > 10%.
    Scoped to the current tenant + business_unit from context vars.
    """
    tenant_id = current_tenant_id.get()
    business_unit_id = current_business_unit_id.get()
    cutoff = datetime.utcnow() - timedelta(days=TTL_DAYS)

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

    if tenant_id:
        card_filters.append(CreditCard.tenant_id == tenant_id)
        corr_filters.append(CorrectionFeedback.tenant_id == tenant_id)
    if business_unit_id:
        card_filters.append(CreditCard.business_unit_id == business_unit_id)
        corr_filters.append(CorrectionFeedback.business_unit_id == business_unit_id)

    # Count submitted documents for this bank (denominator)
    total_result = await db.execute(
        select(func.count()).select_from(CreditCard).where(*card_filters)
    )
    total_cards = total_result.scalar() or 0

    if total_cards < MIN_CARDS:
        logger.debug(
            "[hints] %s: only %d docs (need %d) — skipping", bank_code, total_cards, MIN_CARDS
        )
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
    return hints
