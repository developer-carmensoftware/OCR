"""Admin usage & analytics endpoints."""

import logging
from datetime import UTC, date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.config import settings
from app.database import get_db
from app.exceptions import ValidationError
from app.models.observability import OutboundCallLog
from app.services import usage_analytics_service as svc
from app.services.tenant_lookup import username_map

from ._query import ListQuery, list_query
from .deps import require_permission

logger = logging.getLogger(__name__)
router = APIRouter()

# Row-bounded endpoints (extraction-failures, quotas/overview) carry their own `limit`,
# so the date range only has to stay inside what the partitions actually hold —
# llm_usage_logs is retained 12 months via pg_partman.
_MAX_DATE_RANGE_DAYS = 366

# /usage-summary at daily granularity returns one row per date×tenant×module with no row
# limit at all, so the range is the only lever that bounds it. Ask for longer and you get
# `granularity=month`, which reads the monthly rollup instead.
_MAX_DAILY_RANGE_DAYS = 92

# The monthly rollup is tiny (one row per month×tenant×module, kept indefinitely), so this
# guard is about typos — ?from=1970-01-01 — not about cost.
_MAX_MONTHLY_RANGE_DAYS = 366 * 5

# The two endpoints that still window by hours instead of dates. Derived from the day
# ceiling rather than written as 8760: a UI range of "365 days ago 00:00 → today 23:59"
# is 366 days of hours, so a bare year here made the picker's own 12-month preset 422.
_MAX_PERIOD_HOURS = _MAX_DATE_RANGE_DAYS * 24


def _resolve_tenant(admin: AdminPrincipal, tenant_id: str | None) -> str | None:
    if not admin.is_global:
        return admin.tenant_scope
    return tenant_id or None


def _assert_date_range(
    from_date: date, to_date: date, max_days: int = _MAX_DATE_RANGE_DAYS
) -> None:
    if to_date < from_date:
        raise ValidationError("'to' must not be before 'from'")
    if (to_date - from_date).days > max_days:
        raise ValidationError(f"Date range too wide — max {max_days} days")


def _assert_usage_range(from_date: date, to_date: date, granularity: str) -> None:
    """Daily rows are unbounded per day×tenant×module; monthly rows are a tiny rollup."""
    _assert_date_range(
        from_date,
        to_date,
        _MAX_MONTHLY_RANGE_DAYS if granularity == "month" else _MAX_DAILY_RANGE_DAYS,
    )


@router.get("/usage-summary")
async def get_usage_summary(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    module_id: str | None = Query(None),
    tenant_id: str | None = Query(None),
    granularity: Literal["day", "month"] = Query(
        "day", description="'month' reads the monthly rollup, which has no 92-day ceiling"
    ),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    if not from_date:
        from_date = date.today().replace(day=1)
    if not to_date:
        to_date = date.today()
    _assert_usage_range(from_date, to_date, granularity)
    tid = _resolve_tenant(admin, tenant_id)
    if granularity == "month":
        result = await svc.get_monthly_usage_summary(db, from_date, to_date, tid, module_id)
    else:
        result = await svc.get_usage_summary(db, from_date, to_date, tid, module_id)
    return {
        "tenant_id": tid,
        "from": str(from_date),
        "to": str(to_date),
        "granularity": granularity,
        **result,
    }


@router.get("/usage-summary/totals")
async def get_usage_totals(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    tenant_id: str | None = Query(None),
    granularity: Literal["day", "month"] = Query("day"),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    if not from_date:
        from_date = date.today().replace(day=1)
    if not to_date:
        to_date = date.today()
    # Same cap as /usage-summary above — this endpoint aggregates the same partitioned
    # tables and had been accepting any range at all, so ?from=2020-01-01 pruned no
    # partition and summed the full retention window. `granularity=month` reads the
    # rollup instead, which is what makes a year-long range answerable at all.
    _assert_usage_range(from_date, to_date, granularity)
    tid = _resolve_tenant(admin, tenant_id)
    if granularity == "month":
        totals = await svc.get_monthly_usage_totals(db, from_date, to_date, tid)
    else:
        totals = await svc.get_usage_totals(db, from_date, to_date, tid)
    return {
        "tenant_id": tid,
        "from": str(from_date),
        "to": str(to_date),
        "granularity": granularity,
        "totals": totals,
    }


@router.get("/llm-usage")
async def get_llm_usage(
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
    module_id: str | None = Query(None),
    tenant_id: str | None = Query(None),
    lq: ListQuery = Depends(list_query),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    """Every LLM call, sorted and windowed by the database.

    The old `order_by` literal is gone: `?sort=&dir=` covers it and more, and the page
    that used to carry both a sort dropdown *and* clickable headers no longer disagrees
    with itself. `total` is the real count, so "highest cost" now means highest cost.
    """
    tid = _resolve_tenant(admin, tenant_id)
    data, total = await svc.get_llm_usage(db, tid, from_date, to_date, module_id, lq)
    return {"total": total, "limit": lq.limit, "offset": lq.offset, "data": data}


@router.get("/llm-routing")
async def get_llm_routing(
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
    tenant_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    """LLM routing-evidence report — the auditable proof behind the no-train claim.

    Aggregates outbound_call_logs (openrouter calls only): how many carried the
    no-train directive (data_policy ~ 'deny'), which providers actually served them,
    and how many routed outside the expected-provider set. Exportable to show customers.
    """
    if not from_date:
        from_date = datetime.now(UTC) - timedelta(days=30)
    if not to_date:
        to_date = datetime.now(UTC)
    tid = _resolve_tenant(admin, tenant_id)

    q = (
        select(
            OutboundCallLog.provider,
            func.count().label("calls"),
            func.count().filter(OutboundCallLog.data_policy.ilike("%deny%")).label("deny_calls"),
        )
        .where(
            OutboundCallLog.service == "openrouter",
            OutboundCallLog.created_at >= from_date,
            OutboundCallLog.created_at <= to_date,
        )
        .group_by(OutboundCallLog.provider)
    )
    if tid:
        q = q.where(OutboundCallLog.tenant_id == tid)
    rows = (await db.execute(q)).all()

    expected = [e.lower() for e in settings.llm_expected_providers_list]

    def _in_policy(provider: str | None) -> bool:
        if provider is None:
            return True  # errored before routing / SDK didn't surface it — not a breach
        return any(e in provider.lower() for e in expected)

    total = sum(r.calls for r in rows)
    deny_total = sum(r.deny_calls for r in rows)
    out_of_policy = sum(r.calls for r in rows if not _in_policy(r.provider))
    providers = [
        {
            "provider": r.provider or "(unknown)",
            "calls": r.calls,
            "in_policy": _in_policy(r.provider),
        }
        for r in sorted(rows, key=lambda r: r.calls, reverse=True)
    ]
    return {
        "from": from_date,
        "to": to_date,
        "total_calls": total,
        "deny_directive_sent": deny_total,
        "deny_pct": round(100.0 * deny_total / total, 2) if total else None,
        "out_of_policy_calls": out_of_policy,
        "expected_providers": settings.llm_expected_providers_list,
        "providers": providers,
    }


@router.get("/tenant-ranking")
async def tenant_ranking(
    metric: Literal["error_rate", "latency", "cost", "volume"] = Query("error_rate"),
    # ponytail: a full year scans llm_usage_logs / performance_logs unaggregated. Fine at
    # the measured 0.019% duty cycle (docs/SQL_PERFORMANCE_AUDIT.md); if it ever bites,
    # read daily_usage_summary for ranges past ~92 days rather than capping the UI again.
    period_hours: int = Query(24, ge=1, le=_MAX_PERIOD_HOURS),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    # Scope the ranking to a non-global admin's own tenant — this endpoint compares
    # tenants against each other and must not expose other tenants' metrics.
    tid = _resolve_tenant(admin, None)
    data = await svc.get_tenant_ranking(db, metric, period_hours, limit, tenant_id=tid)
    return {"metric": metric, "period_hours": period_hours, "data": data}


@router.get("/user-usage")
async def user_usage(
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
    tenant_id: str | None = Query(None),
    lq: ListQuery = Depends(list_query),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    if not from_date:
        from_date = datetime.now(UTC) - timedelta(days=30)
    if not to_date:
        to_date = datetime.now(UTC)
    tid = _resolve_tenant(admin, tenant_id)
    data, total = await svc.get_user_usage(db, tid, from_date, to_date, lq)
    # llm_usage_logs stores only the opaque carmen_user_id; the name lives in ocr_sessions.
    names = await username_map(db, [r["carmen_user_id"] for r in data])
    for row in data:
        row["username"] = names.get(row["carmen_user_id"])
    return {
        "from": from_date.isoformat(),
        "to": to_date.isoformat(),
        "total": total,
        "limit": lq.limit,
        "offset": lq.offset,
        "data": data,
    }


@router.get("/error-breakdown")
async def error_breakdown(
    group_by: Literal["module", "tenant", "endpoint"] = Query("module"),
    # See /tenant-ranking above for why a year is allowed here.
    period_hours: int = Query(24, ge=1, le=_MAX_PERIOD_HOURS),
    tenant_id: str | None = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    tid = _resolve_tenant(admin, tenant_id)
    data = await svc.get_error_breakdown(db, group_by, period_hours, tid, limit)
    return {"group_by": group_by, "period_hours": period_hours, "data": data}


@router.get("/extraction-failures")
async def extraction_failures(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    module_id: str | None = Query(None),
    tenant_id: str | None = Query(None),
    limit: int = Query(500, le=500),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    """Failed extractions with their error_message — the "why" behind the error
    counts on /error-breakdown, which only reports totals.

    Deliberately returns raw rows and no grouping: at pilot volume the caller groups
    them client-side, so filtering or regrouping costs no round-trip.
    """
    if not from_date:
        from_date = date.today().replace(day=1)
    if not to_date:
        to_date = date.today()
    _assert_date_range(from_date, to_date)
    tid = _resolve_tenant(admin, tenant_id)
    result = await svc.get_extraction_failures(db, from_date, to_date, tid, module_id, limit)
    return {"tenant_id": tid, "from": str(from_date), "to": str(to_date), **result}
