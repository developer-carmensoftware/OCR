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
    call_type: str | None = None,
) -> None:
    """
    Insert one LLMUsageLog row for cost tracking.

    `call_type` is 'extract' or 'suggest'. Both kinds carry the same module_id, so
    without it every per-module count blends one-call-per-document extracts with the
    GL-mapping suggestions nobody explicitly asked for.

    Note: `count_quota` is retained for API compatibility but is a no-op —
    quota consumption is performed atomically at the start of each extract
    endpoint via `consume_quota()`.
    """
    from app.context import current_carmen_user_id, current_ocr_session_id, pending_llm_usage

    tenant_id = _ctx()

    # `tenant_id` is NOT NULL, so a call made before anyone is identified cannot be
    # inserted — it would raise here and be swallowed, losing the cost silently.
    # Email ingest reads a document to find out whose it is, so it parks the call
    # and flushes it after routing (`flush_pending_usage`).
    pending = pending_llm_usage.get()
    if not tenant_id and pending is not None:
        pending.append(
            {
                "model": model,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
                "module_id": module_id,
                "duration_ms": duration_ms,
                "call_type": call_type,
            }
        )
        return

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
                    call_type=call_type,
                )
            )
            await db.commit()
    except Exception as exc:
        # Never disrupt the OCR flow, but surface as ERROR (not warning): silent loss
        # here means cost/quota tracking drifts and we lose per-module accounting.
        logger.error("log_llm_usage failed — usage/cost not recorded: %s", exc, exc_info=True)


async def flush_pending_usage(task_id: str | None = None) -> int:
    """Write the calls that were parked before the tenant was known. Returns how many.

    Must run with `current_tenant_id` already set — that is the whole point. The
    buffer is emptied either way, so a caller that gives up on a document cannot
    leak its cost onto the next one.
    """
    from app.context import pending_llm_usage

    parked = pending_llm_usage.get()
    if not parked:
        return 0
    calls, parked[:] = list(parked), []
    for call in calls:
        await log_llm_usage(task_id=task_id, **call)
    return len(calls)
