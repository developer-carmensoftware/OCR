"""
Usage Service — LLM cost logging + quota enforcement.

  check_quota()      — raises RateLimitExceeded if hard limit hit; warns at soft_warn_pct
  increment_quota()  — increments QuotaUsage counter for the current period
  log_llm_usage()    — inserts LLMUsageLog and increments calls quota
  get_quota_summary()— returns current usage/limit for a tenant

Quota is a shared pool across ALL modules. If no quota row exists for a tenant,
requests pass through without limit.
"""

import logging
import httpx
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.orm import LLMUsageLog, LLMModelPricing, Plan, Quota, QuotaUsage
from app.models.enums import QuotaMetric, QuotaPeriod
from app.exceptions import RateLimitExceeded

logger = logging.getLogger(__name__)

_PRICING_CACHE: Dict[str, tuple[Decimal, Decimal]] = {}


# ── Context helpers ───────────────────────────────────────────────────────────

def _ctx() -> tuple[str, str]:
    """Return (tenant_id, business_unit_id) from the current request context."""
    from app.context import current_tenant_id, current_business_unit_id
    return current_tenant_id.get() or "", current_business_unit_id.get() or ""


def _period_key(period: QuotaPeriod) -> str:
    now = datetime.utcnow()
    if period == QuotaPeriod.DAILY:
        return now.strftime("%Y-%m-%d")
    if period == QuotaPeriod.MONTHLY:
        return now.strftime("%Y-%m")
    return str(now.year)


# ── Pricing cache ─────────────────────────────────────────────────────────────

async def _get_pricing(model_name: str) -> Optional[tuple[Decimal, Decimal]]:
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
    except Exception as exc:
        logger.error("Failed to fetch pricing for %s: %s", model_name, exc)
    return None


def _estimate_cost(prompt_tokens: int, completion_tokens: int, rates: tuple) -> Decimal:
    input_rate, output_rate = rates
    return Decimal(str(round(
        (prompt_tokens * input_rate + completion_tokens * output_rate) / 1_000_000, 6
    )))


# ── Quota enforcement ─────────────────────────────────────────────────────────

async def _get_active_quotas(db: AsyncSession, tenant_id: str, metric: QuotaMetric) -> List[Quota]:
    """Return quota rules for this tenant+metric (shared pool, not per-module)."""
    result = await db.execute(
        select(Quota).where(
            Quota.tenant_id == tenant_id,
            Quota.metric == metric,
            Quota.deleted_at.is_(None),
        )
    )
    return list(result.scalars().all())


async def upsert_tenant_quota(db: AsyncSession, tenant_id: str, plan_code: str) -> None:
    """
    Ensure the tenant has a monthly calls quota matching their plan.
    Reads limit from the plans table — no hardcoded values.
    Called on every login so plan changes take effect automatically.
    """
    import uuid as _uuid
    plan_row = (await db.execute(select(Plan).where(Plan.code == plan_code))).scalar_one_or_none()
    if plan_row is None:
        logger.warning("Plan '%s' not found in plans table — quota not set", plan_code)
        return
    limit = plan_row.monthly_call_limit

    quota = (await db.execute(
        select(Quota).where(
            Quota.tenant_id == tenant_id,
            Quota.period == QuotaPeriod.MONTHLY,
            Quota.metric == QuotaMetric.CALLS,
            Quota.deleted_at.is_(None),
        )
    )).scalar_one_or_none()

    if quota is None:
        db.add(Quota(
            id=str(_uuid.uuid4()),
            tenant_id=tenant_id,
            period=QuotaPeriod.MONTHLY,
            metric=QuotaMetric.CALLS,
            limit_value=limit,
            soft_warn_pct=0.80,
            is_hard=True,
            is_custom=False,
        ))
        logger.info("Created quota: tenant=%s plan=%s limit=%d/month", tenant_id, plan_code, limit)
    elif not quota.is_custom and float(quota.limit_value) != limit:
        quota.limit_value = limit
        logger.info("Updated quota: tenant=%s plan=%s → limit=%d/month", tenant_id, plan_code, limit)
    elif quota.is_custom:
        logger.debug("Skipped quota sync: tenant=%s has custom limit=%s", tenant_id, quota.limit_value)


async def check_quota() -> None:
    """
    Check call quota for current request context.
    Raises RateLimitExceeded if a hard limit is reached.
    Logs a warning if soft_warn_pct threshold is crossed.
    No-ops silently if no quota rule exists for this tenant.
    """
    tenant_id, _ = _ctx()
    if not tenant_id:
        return

    try:
        async with async_session() as db:
            quotas = await _get_active_quotas(db, tenant_id, QuotaMetric.CALLS)
            for quota in quotas:
                key = _period_key(quota.period)
                result = await db.execute(
                    select(QuotaUsage).where(
                        QuotaUsage.quota_id == quota.id,
                        QuotaUsage.period_key == key,
                    )
                )
                usage = result.scalar_one_or_none()
                used = float(usage.used) if usage else 0.0
                limit = float(quota.limit_value)
                warn_at = limit * float(quota.soft_warn_pct)

                if quota.is_hard and used >= limit:
                    logger.warning("Hard quota hit: tenant=%s used=%s limit=%s", tenant_id, used, limit)
                    raise RateLimitExceeded(tenant_id, int(limit))

                if used >= warn_at:
                    logger.warning(
                        "Soft quota warning: tenant=%s used=%s/%s (%.0f%%)",
                        tenant_id, used, limit, (used / limit * 100),
                    )
    except RateLimitExceeded:
        raise
    except Exception as exc:
        logger.error("check_quota failed: %s", exc)


async def increment_quota(increment: float = 1.0) -> None:
    """Increment the calls counter for all quota rules of this tenant."""
    tenant_id, _ = _ctx()
    if not tenant_id:
        return
    try:
        async with async_session() as db:
            quotas = await _get_active_quotas(db, tenant_id, QuotaMetric.CALLS)
            for quota in quotas:
                key = _period_key(quota.period)
                stmt = mysql_insert(QuotaUsage).values(
                    quota_id=quota.id,
                    period_key=key,
                    used=increment,
                ).on_duplicate_key_update(
                    used=QuotaUsage.used + increment,
                    last_updated_at=datetime.utcnow(),
                )
                await db.execute(stmt)
            await db.commit()
    except Exception as exc:
        logger.error("increment_quota failed: %s", exc)


# ── LLM usage logging ─────────────────────────────────────────────────────────

async def log_llm_usage(
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    task_id: Optional[str] = None,
    module_id: Optional[str] = None,
    duration_ms: Optional[float] = None,
) -> None:
    """
    Insert one LLMUsageLog row and increment the calls quota counter.
    Silent on failure — never disrupts the main OCR flow.
    """
    from app.context import current_ocr_session_id, current_carmen_user_id
    tenant_id, business_unit_id = _ctx()

    await increment_quota()

    try:
        rates    = await _get_pricing(model)
        cost_usd = _estimate_cost(prompt_tokens, completion_tokens, rates) if rates else None

        async with async_session() as db:
            db.add(LLMUsageLog(
                tenant_id=tenant_id or None,
                business_unit_id=business_unit_id or None,
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
            ))
            await db.commit()
    except Exception as exc:
        logger.error("log_llm_usage failed: %s", exc)


# ── Quota summary (for /auth/usage endpoint) ──────────────────────────────────

async def get_quota_summary(tenant_id: str) -> dict:
    """Return all active quotas and their current usage for a tenant."""
    if not tenant_id:
        return {"quotas": []}
    try:
        async with async_session() as db:
            result = await db.execute(
                select(Quota).where(
                    Quota.tenant_id == tenant_id,
                    Quota.deleted_at.is_(None),
                )
            )
            quotas = list(result.scalars().all())

            rows = []
            for quota in quotas:
                key = _period_key(quota.period)
                usage_result = await db.execute(
                    select(QuotaUsage).where(
                        QuotaUsage.quota_id == quota.id,
                        QuotaUsage.period_key == key,
                    )
                )
                usage = usage_result.scalar_one_or_none()
                used  = float(usage.used) if usage else 0.0
                limit = float(quota.limit_value)
                rows.append({
                    "period":     quota.period,
                    "metric":     quota.metric,
                    "used":       used,
                    "limit":      limit,
                    "pct":        round(used / limit * 100, 1) if limit else 0,
                    "is_hard":    quota.is_hard,
                    "period_key": key,
                })
            return {"tenant_id": tenant_id, "quotas": rows}
    except Exception as exc:
        logger.error("get_quota_summary failed: %s", exc)
        return {"quotas": []}


# ── Pricing sync ──────────────────────────────────────────────────────────────

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
                pricing  = m.get("pricing", {})
                input_p  = Decimal(str(pricing.get("prompt", 0)))     * 1_000_000
                output_p = Decimal(str(pricing.get("completion", 0))) * 1_000_000

                stmt = mysql_insert(LLMModelPricing).values(
                    model_name=model_id,
                    input_price_per_1m=input_p,
                    output_price_per_1m=output_p,
                    source="openrouter_api",
                    price_verified_at=datetime.utcnow(),
                ).on_duplicate_key_update(
                    input_price_per_1m=input_p,
                    output_price_per_1m=output_p,
                    source="openrouter_api",
                    price_verified_at=datetime.utcnow(),
                )
                await db.execute(stmt)
            await db.commit()

        _PRICING_CACHE.clear()
        logger.info("OpenRouter pricing sync complete: %d models", len(data))
    except Exception as exc:
        logger.error("OpenRouter pricing sync failed: %s", exc)
