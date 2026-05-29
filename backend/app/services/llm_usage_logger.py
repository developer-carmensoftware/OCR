"""
LLM Usage Logger — inserts LLMUsageLog rows for cost tracking.

Silent on failure — never disrupts the main OCR flow.
"""

import logging

from app.database import async_session
from app.models.orm import LLMUsageLog
from app.services.pricing_cache_service import _estimate_cost, _get_pricing

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
) -> None:
    """
    Insert one LLMUsageLog row for cost tracking.

    Note: `count_quota` is retained for API compatibility but is a no-op —
    quota consumption is performed atomically at the start of each extract
    endpoint via `consume_quota()`.
    """
    from app.context import current_carmen_user_id, current_ocr_session_id

    tenant_id = _ctx()

    try:
        rates = await _get_pricing(model)
        cost_usd = _estimate_cost(prompt_tokens, completion_tokens, rates) if rates else None

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
                    cost_usd=cost_usd,
                )
            )
            await db.commit()
    except Exception as exc:
        logger.warning("log_llm_usage failed: %s", exc, exc_info=True)
