import logging
import httpx
from decimal import Decimal
from datetime import datetime
from typing import Optional, Dict

from sqlalchemy import select
from sqlalchemy.dialects.mysql import insert

from app.database import async_session
from app.models.orm import LLMUsageLog, LLMModelPricing, BUUsage
from app.exceptions import RateLimitExceeded

logger = logging.getLogger(__name__)

# In-memory cache to avoid DB lookups for every LLM log call
# Key = model_name, Value = (input_price_per_1m, output_price_per_1m)
_PRICING_CACHE: Dict[str, tuple[Decimal, Decimal]] = {}


async def _get_pricing(model_name: str) -> Optional[tuple[Decimal, Decimal]]:
    """Get pricing from cache or DB."""
    if model_name in _PRICING_CACHE:
        return _PRICING_CACHE[model_name]

    try:
        async with async_session() as db:
            result = await db.execute(
                select(LLMModelPricing).where(LLMModelPricing.model_name == model_name)
            )
            pricing = result.scalar_one_or_none()
            if pricing:
                rates = (pricing.input_price_per_1m, pricing.output_price_per_1m)
                _PRICING_CACHE[model_name] = rates
                return rates
    except Exception as e:
        logger.error("Failed to fetch pricing for %s: %s", model_name, e)
    
    return None


def _estimate_cost(_model: str, prompt_tokens: int, completion_tokens: int, rates: tuple[Decimal, Decimal]) -> Decimal:
    """Calculate cost in USD."""
    input_rate, output_rate = rates
    cost = (prompt_tokens * input_rate + completion_tokens * output_rate) / 1_000_000
    return Decimal(str(round(cost, 6)))



async def check_bu_rate_limit(bu_name: Optional[str] = None) -> None:
    """
    Check if the BU has exceeded its monthly LLM call limit.
    Raises RateLimitExceeded if limit is reached.
    """
    if not bu_name:
        from app.context import current_bu
        bu_name = current_bu.get()
    
    if not bu_name:
        return # Skip if no BU context

    current_month = datetime.utcnow().strftime("%Y-%m")
    
    try:
        async with async_session() as db:
            result = await db.execute(
                select(BUUsage).where(BUUsage.bu_name == bu_name)
            )
            usage = result.scalar_one_or_none()

            if not usage:
                # First time this BU is seen, create a record with default 50 limit
                usage = BUUsage(
                    bu_name=bu_name,
                    monthly_calls=0,
                    total_calls=0,
                    max_monthly_calls=50,
                    last_reset_month=current_month
                )
                db.add(usage)
                await db.commit()
                return

            # Monthly reset check
            if usage.last_reset_month != current_month:
                usage.monthly_calls = 0
                usage.last_reset_month = current_month
                await db.commit()

            # Enforce limit (max_monthly_calls <= 0 means unlimited)
            if 0 < usage.max_monthly_calls <= usage.monthly_calls:
                logger.warning("Rate limit exceeded for BU: %s (%d/%d)", 
                               bu_name, usage.monthly_calls, usage.max_monthly_calls)
                raise RateLimitExceeded(bu_name, usage.max_monthly_calls)

    except RateLimitExceeded:
        raise
    except Exception as e:
        logger.error("Failed to check rate limit for %s: %s", bu_name, e)


async def get_bu_usage(bu_name: Optional[str] = None) -> Dict:
    """
    Get current usage and limit for a BU.
    """
    if not bu_name:
        from app.context import current_bu
        bu_name = current_bu.get()
    
    if not bu_name:
        return {"monthly_calls": 0, "max_monthly_calls": 0, "remaining_calls": 0}

    current_month = datetime.utcnow().strftime("%Y-%m")
    
    try:
        async with async_session() as db:
            result = await db.execute(
                select(BUUsage).where(BUUsage.bu_name == bu_name)
            )
            usage = result.scalar_one_or_none()

            if not usage:
                return {
                    "monthly_calls": 0,
                    "max_monthly_calls": 50, # Default
                    "remaining_calls": 50
                }

            # Monthly reset check (logical only, don't commit here to avoid side effects in GET)
            monthly_calls = usage.monthly_calls
            if usage.last_reset_month != current_month:
                monthly_calls = 0

            max_calls = usage.max_monthly_calls
            remaining = max(0, max_calls - monthly_calls) if max_calls > 0 else 999999
            
            return {
                "monthly_calls": monthly_calls,
                "max_monthly_calls": max_calls,
                "remaining_calls": remaining
            }
    except Exception as e:
        logger.error("Failed to get BU usage for %s: %s", bu_name, e)
        return {"monthly_calls": 0, "max_monthly_calls": 0, "remaining_calls": 0}


async def increment_bu_usage(bu_name: Optional[str] = None) -> None:
    """Increment the call counters for a BU."""
    if not bu_name:
        from app.context import current_bu
        bu_name = current_bu.get()
    
    if not bu_name:
        return

    try:
        async with async_session() as db:
            result = await db.execute(
                select(BUUsage).where(BUUsage.bu_name == bu_name)
            )
            usage = result.scalar_one_or_none()
            if usage:
                usage.monthly_calls += 1
                usage.total_calls += 1
                await db.commit()
    except Exception as e:
        logger.error("Failed to increment BU usage for %s: %s", bu_name, e)


async def log_llm_usage(
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    task_id: Optional[str] = None,
    usage_type: Optional[str] = None,
    bu_name: Optional[str] = None,
    duration_ms: Optional[float] = None,
) -> None:
    from app.context import current_session_id, current_user_id, current_bu
    
    target_bu = current_bu.get() or bu_name or None
    
    # Increment BU-level counters
    if target_bu:
        await increment_bu_usage(target_bu)

    try:
        rates = await _get_pricing(model)
        cost_usd = _estimate_cost(model, prompt_tokens, completion_tokens, rates) if rates else None

        async with async_session() as db:
            db.add(LLMUsageLog(
                task_id=task_id,
                usage_type=usage_type,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                duration_ms=duration_ms,
                cost_usd=cost_usd,
                session_id=current_session_id.get() or None,
                user_id=current_user_id.get() or None,
                bu_name=target_bu,
            ))
            await db.commit()
    except Exception as e:
        logger.error("Failed to log LLM usage: %s", e)


async def fetch_openrouter_pricing() -> None:
    """Sync model pricing from OpenRouter API to DB."""
    logger.info("Syncing OpenRouter pricing...")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get("https://openrouter.ai/api/v1/models")
            resp.raise_for_status()
            data = resp.json().get("data", [])

        async with async_session() as db:
            for m in data:
                model_id = m.get("id")
                pricing = m.get("pricing", {})
                
                # OpenRouter returns pricing in USD per token
                # We store as USD per 1M tokens
                input_p = Decimal(str(pricing.get("prompt", 0))) * 1_000_000
                output_p = Decimal(str(pricing.get("completion", 0))) * 1_000_000
                
                stmt = insert(LLMModelPricing).values(
                    model_name=model_id,
                    input_price_per_1m=input_p,
                    output_price_per_1m=output_p,
                    source="openrouter_api",
                    price_verified_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                ).on_duplicate_key_update(
                    input_price_per_1m=input_p,
                    output_price_per_1m=output_p,
                    source="openrouter_api",
                    price_verified_at=datetime.utcnow(),
                )
                await db.execute(stmt)
            
            await db.commit()
            
            # Clear cache to ensure new prices are used
            _PRICING_CACHE.clear()
            logger.info("OpenRouter pricing sync complete. %d models updated.", len(data))
            
    except Exception as e:
        logger.error("OpenRouter pricing sync failed: %s", e)
