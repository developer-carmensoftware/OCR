"""
Quota Service — call quota enforcement for tenant request contexts.

  check_quota()        — read-only pre-check; raises RateLimitExceeded on hard limit
  consume_quota()      — atomic check-and-increment (preferred for extract endpoints)
  increment_quota()    — increment-only (no enforcement; for backfill scripts)
  upsert_tenant_quota()— sync quota rule from plan on login
  get_quota_summary()  — current usage/limit for a tenant (for /auth/usage)
"""

import logging
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import cast

from sqlalchemy import select, tuple_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.exceptions import RateLimitExceeded
from app.models.enums import QuotaMetric, QuotaPeriod
from app.models.orm import Plan, Quota, QuotaUsage

logger = logging.getLogger(__name__)

_QUOTA_TTL = 300.0  # seconds


@dataclass(frozen=True)
class _CachedQuota:
    id: str
    period: QuotaPeriod
    limit_value: float
    soft_warn_pct: float
    is_hard: bool


_QUOTA_RULES_CACHE: dict[str, tuple[list[_CachedQuota], float]] = {}


def _ctx() -> str:
    from app.context import current_tenant_id

    return current_tenant_id.get() or ""


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _period_key(period: QuotaPeriod) -> str:
    now = _utcnow()
    if period == QuotaPeriod.DAILY:
        return now.strftime("%Y-%m-%d")
    if period == QuotaPeriod.MONTHLY:
        return now.strftime("%Y-%m")
    return str(now.year)


async def _get_active_quotas(db: AsyncSession, tenant_id: str, metric: QuotaMetric) -> list[Quota]:
    result = await db.execute(
        select(Quota).where(
            Quota.tenant_id == tenant_id,
            Quota.metric == metric,
            Quota.deleted_at.is_(None),
        )
    )
    return list(result.scalars().all())


async def _get_cached_quota_rules(tenant_id: str) -> list[_CachedQuota]:
    """Return quota rules from cache (TTL=5 min); falls back to DB on miss/expiry."""
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


def _evaluate_quotas(
    tenant_id: str,
    quotas: list[_CachedQuota],
    usage_map: dict[str, float],
    *,
    post_increment: bool,
) -> None:
    """Raise RateLimitExceeded if any hard quota is exceeded."""
    for quota in quotas:
        used = usage_map.get(quota.id, 0.0)
        limit = quota.limit_value
        warn_at = limit * quota.soft_warn_pct

        exceeded = (used > limit) if post_increment else (used >= limit)
        if quota.is_hard and exceeded:
            logger.warning("Hard quota hit: tenant=%s used=%s limit=%s", tenant_id, used, limit)
            raise RateLimitExceeded(tenant_id, int(limit))

        if used >= warn_at:
            logger.warning(
                "Soft quota warning: tenant=%s used=%s/%s (%.0f%%)",
                tenant_id,
                used,
                limit,
                (used / limit * 100),
            )


async def check_quota() -> None:
    """
    Read-only quota pre-check for current request context.
    Raises RateLimitExceeded on hard limit; no-ops if no quota exists.
    Prefer consume_quota() for atomic check-and-increment.
    """
    tenant_id = _ctx()
    if not tenant_id:
        return
    try:
        quotas = await _get_cached_quota_rules(tenant_id)
        if not quotas:
            return

        pairs = [(q.id, _period_key(q.period)) for q in quotas]
        async with async_session() as db:
            result = await db.execute(
                select(QuotaUsage.quota_id, QuotaUsage.used).where(
                    tuple_(QuotaUsage.quota_id, QuotaUsage.period_key).in_(pairs)
                )
            )
            usage_map = {str(qid): float(cast(Decimal, u)) for qid, u in result.all()}

        _evaluate_quotas(tenant_id, quotas, usage_map, post_increment=False)
    except RateLimitExceeded:
        raise
    except Exception as exc:
        logger.error("check_quota failed: %s", exc)


async def increment_quota(increment: float = 1.0) -> None:
    """Increment calls counter without enforcement (for backfill scripts)."""
    tenant_id = _ctx()
    if not tenant_id:
        return
    try:
        quotas = await _get_cached_quota_rules(tenant_id)
        if not quotas:
            return
        values = [
            {"quota_id": q.id, "period_key": _period_key(q.period), "used": increment}
            for q in quotas
        ]
        async with async_session() as db:
            stmt = (
                pg_insert(QuotaUsage)
                .values(values)
                .on_conflict_do_update(
                    index_elements=["quota_id", "period_key"],
                    set_={
                        "used": QuotaUsage.used + increment,
                        "last_updated_at": _utcnow(),
                    },
                )
            )
            await db.execute(stmt)
            await db.commit()
    except Exception as exc:
        logger.error("increment_quota failed: %s", exc)


async def consume_quota(increment: float = 1.0) -> None:
    """
    Atomic check-and-increment. Upserts usage then verifies hard limits;
    rolls back transaction on violation before raising RateLimitExceeded.
    """
    tenant_id = _ctx()
    if not tenant_id:
        return
    quotas = await _get_cached_quota_rules(tenant_id)
    if not quotas:
        return

    values = [
        {"quota_id": q.id, "period_key": _period_key(q.period), "used": increment} for q in quotas
    ]
    try:
        async with async_session() as db:
            async with db.begin():
                stmt = (
                    pg_insert(QuotaUsage)
                    .values(values)
                    .on_conflict_do_update(
                        index_elements=["quota_id", "period_key"],
                        set_={
                            "used": QuotaUsage.used + increment,
                            "last_updated_at": _utcnow(),
                        },
                    )
                    .returning(QuotaUsage.quota_id, QuotaUsage.used)
                )
                result = await db.execute(stmt)
                usage_map = {str(qid): float(cast(Decimal, u)) for qid, u in result.all()}
                _evaluate_quotas(tenant_id, quotas, usage_map, post_increment=True)
    except RateLimitExceeded:
        raise
    except Exception as exc:
        logger.error("consume_quota failed: %s", exc)


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
