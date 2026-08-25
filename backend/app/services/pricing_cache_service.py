"""
Pricing Cache Service — LLM model pricing lookup and OpenRouter sync.

  get_pricing()           — async lookup from DB (with in-memory cache)
  estimate_cost()         — token cost calc
  fetch_openrouter_pricing() — 8h sync cron
  list_model_pricing()     — admin listing
"""

import logging
from datetime import UTC, datetime
from decimal import Decimal
from typing import cast

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.orm import LLMModelPricing

logger = logging.getLogger(__name__)

# model_name → rates  OR  None for "known missing — don't requery"
# Invalidated when fetch_openrouter_pricing() runs (every 8h).
_PRICING_CACHE: dict[str, tuple[Decimal, Decimal] | None] = {}


def _utcnow() -> datetime:
    return datetime.now(UTC)


async def get_pricing(model_name: str) -> tuple[Decimal, Decimal] | None:
    if model_name in _PRICING_CACHE:
        return _PRICING_CACHE[model_name]
    try:
        async with async_session() as db:
            result = await db.execute(
                select(LLMModelPricing).where(LLMModelPricing.model_name == model_name)
            )
            pricing = result.scalar_one_or_none()
            if pricing:
                rates: tuple[Decimal, Decimal] = (
                    cast(Decimal, pricing.input_price_per_1m),
                    cast(Decimal, pricing.output_price_per_1m),
                )
                _PRICING_CACHE[model_name] = rates
                return rates
            # Cache the negative result so we don't re-query DB on every call
            # for an unknown model. Cleared on the next 8h pricing sync.
            _PRICING_CACHE[model_name] = None
    except Exception as exc:
        logger.error("Failed to fetch pricing for %s: %s", model_name, exc)
    return None


def estimate_cost(prompt_tokens: int, completion_tokens: int, rates: tuple) -> Decimal:
    input_rate, output_rate = rates
    return Decimal(
        str(round((prompt_tokens * input_rate + completion_tokens * output_rate) / 1_000_000, 6))
    )


async def fetch_openrouter_pricing() -> None:
    """Sync model pricing from OpenRouter API every 8h."""
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
                input_p = Decimal(str(pricing.get("prompt", 0))) * 1_000_000
                output_p = Decimal(str(pricing.get("completion", 0))) * 1_000_000

                ins = pg_insert(LLMModelPricing).values(
                    model_name=model_id,
                    input_price_per_1m=input_p,
                    output_price_per_1m=output_p,
                    source="openrouter_api",
                    price_verified_at=_utcnow(),
                )
                stmt = ins.on_conflict_do_update(
                    index_elements=["model_name"],
                    set_={
                        "input_price_per_1m": input_p,
                        "output_price_per_1m": output_p,
                        "source": "openrouter_api",
                        "price_verified_at": _utcnow(),
                    },
                )
                await db.execute(stmt)
            await db.commit()

        _PRICING_CACHE.clear()
        logger.info("OpenRouter pricing sync complete: %d models", len(data))
    except Exception as exc:
        logger.error("OpenRouter pricing sync failed: %s", exc)


async def list_model_pricing(db: AsyncSession) -> list[dict]:
    """Return all LLM model pricing rows ordered by model name."""
    result = await db.execute(select(LLMModelPricing).order_by(LLMModelPricing.model_name))
    return [
        {
            "model_name": r.model_name,
            "input_price_per_1m": float(str(r.input_price_per_1m)),
            "output_price_per_1m": float(str(r.output_price_per_1m)),
            "source": r.source,
            "price_verified_at": r.price_verified_at.isoformat() if r.price_verified_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in result.scalars().all()
    ]
