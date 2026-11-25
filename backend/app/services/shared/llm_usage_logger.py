"""
LLM Usage Logger — inserts LLMUsageLog rows for cost tracking.

Silent on failure — never disrupts the main OCR flow.
"""

import logging
from decimal import Decimal, InvalidOperation

from app.database import async_session
from app.models.orm import LLMUsageLog
from app.services.shared.pricing_cache import estimate_cost, get_pricing

logger = logging.getLogger(__name__)


def _ctx() -> str:
    from app.context import current_tenant_id

    return current_tenant_id.get() or ""


async def log_llm_usage(
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    task_id: str | None = None,
    module_id: str | None = None,
    duration_ms: float | None = None,
    count_quota: bool = False,
    call_type: str | None = None,
    cost_usd: Decimal | float | None = None,
) -> None:
    """Insert one LLMUsageLog row for cost tracking.

    `cost_usd` is what OpenRouter billed for the call (`usage.cost`) and is recorded as
    given. A missing, zero-with-tokens (BYOK/free route reports 0) or malformed value
    falls back to estimating from the `model_pricing` catalog, which is no longer
    refreshed by cron — so every fallback is logged.
    """
    from app.context import current_carmen_user_id, current_ocr_session_id

    tenant_id = _ctx()

    try:
        final_cost: Decimal | None = None
        if cost_usd is not None:
            try:
                final_cost = Decimal(str(cost_usd))
            except InvalidOperation:
                final_cost = None
            if final_cost is not None and (
                not final_cost.is_finite() or final_cost < 0 or (final_cost == 0 and total_tokens)
            ):
                final_cost = None
        if final_cost is None:
            logger.warning("log_llm_usage: no usable provider cost for %s — using catalog", model)
            rates = await get_pricing(model)
            final_cost = estimate_cost(prompt_tokens, completion_tokens, rates) if rates else None

        async with async_session() as db:
            db.add(
                LLMUsageLog(
                    tenant_id=tenant_id or None,
                    task_id=task_id,
                    module_id=module_id,
                    carmen_session_id=current_ocr_session_id.get() or None,
                    carmen_user_id=current_carmen_user_id.get() or None,
                    model=model,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    duration_ms=duration_ms,
                    cost_usd=final_cost,
                    call_type=call_type,
                )
            )
            await db.commit()
    except Exception as exc:
        # Never disrupt the OCR flow, but surface as ERROR (not warning): silent loss
        # here means cost/quota tracking drifts and we lose per-module accounting.
        logger.error("log_llm_usage failed — usage/cost not recorded: %s", exc, exc_info=True)
