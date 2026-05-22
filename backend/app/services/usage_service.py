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
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import cast

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.exceptions import RateLimitExceeded
from app.models.enums import QuotaMetric, QuotaPeriod
from app.models.orm import LLMModelPricing, LLMUsageLog, Plan, Quota, QuotaUsage

logger = logging.getLogger(__name__)

# model_name → rates  OR  None for "known missing — don't requery"
# Invalidated when fetch_openrouter_pricing() runs (every 8h).
_PRICING_CACHE: dict[str, tuple[Decimal, Decimal] | None] = {}

# ── Quota rules cache ─────────────────────────────────────────────────────────
# Quota rules (limit, period, thresholds) change only when an admin edits them
# or a tenant changes plan — cache for 5 minutes to avoid 2 DB hits per extract.
# QuotaUsage (the counter) is never cached — it must always be read from DB.

_QUOTA_TTL = 300.0  # seconds


@dataclass(frozen=True)
class _CachedQuota:
    id: str
    period: QuotaPeriod
    limit_value: float
    soft_warn_pct: float
    is_hard: bool


_QUOTA_RULES_CACHE: dict[str, tuple[list[_CachedQuota], float]] = {}


# ── Context helpers ───────────────────────────────────────────────────────────


def _ctx() -> tuple[str, str]:
    """Return (tenant_id, business_unit_id) from the current request context."""
    from app.context import current_business_unit_id, current_tenant_id

    return current_tenant_id.get() or "", current_business_unit_id.get() or ""


def _utcnow() -> datetime:
    """Naive UTC datetime — matches the DB's naive DateTime columns."""
    return datetime.now(UTC).replace(tzinfo=None)


def _period_key(period: QuotaPeriod) -> str:
    now = _utcnow()
    if period == QuotaPeriod.DAILY:
        return now.strftime("%Y-%m-%d")
    if period == QuotaPeriod.MONTHLY:
        return now.strftime("%Y-%m")
    return str(now.year)


# ── Pricing cache ─────────────────────────────────────────────────────────────


async def _get_pricing(model_name: str) -> tuple[Decimal, Decimal] | None:
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


def _estimate_cost(prompt_tokens: int, completion_tokens: int, rates: tuple) -> Decimal:
    input_rate, output_rate = rates
    return Decimal(
        str(round((prompt_tokens * input_rate + completion_tokens * output_rate) / 1_000_000, 6))
    )


# ── Quota enforcement ─────────────────────────────────────────────────────────


async def _get_active_quotas(db: AsyncSession, tenant_id: str, metric: QuotaMetric) -> list[Quota]:
    """Return quota rules for this tenant+metric (shared pool, not per-module)."""
    result = await db.execute(
        select(Quota).where(
            Quota.tenant_id == tenant_id,
            Quota.metric == metric,
            Quota.deleted_at.is_(None),
        )
    )
    return list(result.scalars().all())


async def _get_cached_quota_rules(tenant_id: str) -> list[_CachedQuota]:
    """
    Return quota rules for a tenant from cache (TTL=5 min).
    Falls back to DB on cache miss or expiry. On DB error, returns stale cache if available.
    """
    now = time.monotonic()
    cached = _QUOTA_RULES_CACHE.get(tenant_id)
    if cached and now - cached[1] < _QUOTA_TTL:
        return cached[0]
    try:
        async with async_session() as db:
            quotas = await _get_active_quotas(db, tenant_id, QuotaMetric.CALLS)
            rules = [
                _CachedQuota(
                    id=cast(str, q.id),
                    period=cast(QuotaPeriod, q.period),
                    limit_value=float(cast(Decimal, q.limit_value)),
                    soft_warn_pct=float(cast(Decimal, q.soft_warn_pct)),
                    is_hard=bool(q.is_hard),
                )
                for q in quotas
            ]
        _QUOTA_RULES_CACHE[tenant_id] = (rules, now)
        return rules
    except Exception as exc:
        logger.error("_get_cached_quota_rules failed: %s", exc)
        return cached[0] if cached else []


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

    quota = (
        await db.execute(
            select(Quota).where(
                Quota.tenant_id == tenant_id,
                Quota.period == QuotaPeriod.MONTHLY,
                Quota.metric == QuotaMetric.CALLS,
                Quota.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    if quota is None:
        db.add(
            Quota(
                id=str(_uuid.uuid4()),
                tenant_id=tenant_id,
                period=QuotaPeriod.MONTHLY,
                metric=QuotaMetric.CALLS,
                limit_value=limit,
                soft_warn_pct=0.80,
                is_hard=True,
                is_custom=False,
            )
        )
        _QUOTA_RULES_CACHE.pop(tenant_id, None)
        logger.info("Created quota: tenant=%s plan=%s limit=%d/month", tenant_id, plan_code, limit)
    elif not quota.is_custom and float(cast(Decimal, quota.limit_value)) != limit:
        quota.limit_value = Decimal(cast(int, limit))  # type: ignore[assignment]
        _QUOTA_RULES_CACHE.pop(tenant_id, None)
        logger.info(
            "Updated quota: tenant=%s plan=%s → limit=%d/month", tenant_id, plan_code, limit
        )
    elif quota.is_custom:
        logger.debug(
            "Skipped quota sync: tenant=%s has custom limit=%s", tenant_id, quota.limit_value
        )


async def check_quota() -> None:
    """
    Check call quota for current request context.
    Raises RateLimitExceeded if a hard limit is reached.
    Logs a warning if soft_warn_pct threshold is crossed.
    No-ops silently if no quota rule exists for this tenant.
    Quota rules are served from a 5-minute TTL cache; only QuotaUsage hits DB.
    """
    tenant_id, _ = _ctx()
    if not tenant_id:
        return

    try:
        quotas = await _get_cached_quota_rules(tenant_id)
        if not quotas:
            return

        async with async_session() as db:
            for quota in quotas:
                key = _period_key(quota.period)
                result = await db.execute(
                    select(QuotaUsage).where(
                        QuotaUsage.quota_id == quota.id,
                        QuotaUsage.period_key == key,
                    )
                )
                usage = result.scalar_one_or_none()
                used = float(cast(Decimal, usage.used)) if usage else 0.0
                limit = quota.limit_value
                warn_at = limit * quota.soft_warn_pct

                if quota.is_hard and used >= limit:
                    logger.warning(
                        "Hard quota hit: tenant=%s used=%s limit=%s", tenant_id, used, limit
                    )
                    raise RateLimitExceeded(tenant_id, int(limit))

                if used >= warn_at:
                    logger.warning(
                        "Soft quota warning: tenant=%s used=%s/%s (%.0f%%)",
                        tenant_id,
                        used,
                        limit,
                        (used / limit * 100),
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
        quotas = await _get_cached_quota_rules(tenant_id)
        if not quotas:
            return
        async with async_session() as db:
            for quota in quotas:
                key = _period_key(quota.period)
                ins = pg_insert(QuotaUsage).values(
                    quota_id=quota.id,
                    period_key=key,
                    used=increment,
                )
                stmt = ins.on_conflict_do_update(
                    index_elements=["quota_id", "period_key"],
                    set_={
                        "used": QuotaUsage.used + increment,
                        "last_updated_at": _utcnow(),
                    },
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
    task_id: str | None = None,
    module_id: str | None = None,
    duration_ms: float | None = None,
    count_quota: bool = False,
) -> None:
    """
    Insert one LLMUsageLog row for cost tracking.
    count_quota=True → also increment the quota counter (extract calls only).
    Silent on failure — never disrupts the main OCR flow.
    """
    from app.context import current_carmen_user_id, current_ocr_session_id

    tenant_id, business_unit_id = _ctx()

    if count_quota:
        await increment_quota()

    try:
        rates = await _get_pricing(model)
        cost_usd = _estimate_cost(prompt_tokens, completion_tokens, rates) if rates else None

        async with async_session() as db:
            db.add(
                LLMUsageLog(
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
                )
            )
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
                key = _period_key(cast(QuotaPeriod, quota.period))
                usage_result = await db.execute(
                    select(QuotaUsage).where(
                        QuotaUsage.quota_id == quota.id,
                        QuotaUsage.period_key == key,
                    )
                )
                usage = usage_result.scalar_one_or_none()
                used = float(cast(Decimal, usage.used)) if usage else 0.0
                limit = float(cast(Decimal, quota.limit_value))
                rows.append(
                    {
                        "period": quota.period,
                        "metric": quota.metric,
                        "used": used,
                        "limit": limit,
                        "pct": round(used / limit * 100, 1) if limit else 0,
                        "is_hard": quota.is_hard,
                        "period_key": key,
                    }
                )
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
