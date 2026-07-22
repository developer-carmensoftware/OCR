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

from .deps import require_permission

logger = logging.getLogger(__name__)
router = APIRouter()

# This endpoint returns one row per date×tenant×module with no row limit at all —
# bounding the date range is the only lever that bounds it (llm_usage_logs is
# retained 12 months anyway via pg_partman, so nothing wider was fully meaningful).
_MAX_DATE_RANGE_DAYS = 92


def _resolve_tenant(admin: AdminPrincipal, tenant_id: str | None) -> str | None:
    if not admin.is_global:
        return admin.tenant_scope
    return tenant_id or None


def _assert_date_range(from_date: date, to_date: date) -> None:
    if to_date < from_date:
        raise ValidationError("'to' must not be before 'from'")
    if (to_date - from_date).days > _MAX_DATE_RANGE_DAYS:
        raise ValidationError(f"Date range too wide — max {_MAX_DATE_RANGE_DAYS} days")


@router.get("/usage-summary")
async def get_usage_summary(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    module_id: str | None = Query(None),
    tenant_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    if not from_date:
        from_date = date.today().replace(day=1)
    if not to_date:
        to_date = date.today()
    _assert_date_range(from_date, to_date)
    tid = _resolve_tenant(admin, tenant_id)
    result = await svc.get_usage_summary(db, from_date, to_date, tid, module_id)
    return {"tenant_id": tid, "from": str(from_date), "to": str(to_date), **result}


@router.get("/usage-summary/totals")
async def get_usage_totals(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    tenant_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    if not from_date:
        from_date = date.today().replace(day=1)
    if not to_date:
        to_date = date.today()
    tid = _resolve_tenant(admin, tenant_id)
    totals = await svc.get_usage_totals(db, from_date, to_date, tid)
    return {"tenant_id": tid, "from": str(from_date), "to": str(to_date), "totals": totals}


@router.get("/llm-usage")
async def get_llm_usage(
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
    module_id: str | None = Query(None),
    tenant_id: str | None = Query(None),
    order_by: Literal["cost_usd", "duration_ms", "total_tokens", "created_at"] = Query(
        "created_at"
    ),
    limit: int = Query(100, le=1000),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    tid = _resolve_tenant(admin, tenant_id)
    data = await svc.get_llm_usage(db, tid, from_date, to_date, module_id, order_by, limit)
    return {"count": len(data), "has_more": len(data) == limit, "data": data}


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
    period_hours: int = Query(24, ge=1, le=720),
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
    order_by: Literal["calls", "tokens", "cost"] = Query("calls"),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    if not from_date:
        from_date = datetime.now(UTC) - timedelta(days=30)
    if not to_date:
        to_date = datetime.now(UTC)
    tid = _resolve_tenant(admin, tenant_id)
    data = await svc.get_user_usage(db, tid, from_date, to_date, order_by, limit)
    # llm_usage_logs stores only the opaque carmen_user_id; the name lives in ocr_sessions.
    names = await username_map(db, [r["carmen_user_id"] for r in data])
    for row in data:
        row["username"] = names.get(row["carmen_user_id"])
    return {
        "from": from_date.isoformat(),
        "to": to_date.isoformat(),
        "total_users": len(data),
        "data": data,
    }


@router.get("/error-breakdown")
async def error_breakdown(
    group_by: Literal["module", "tenant", "endpoint"] = Query("module"),
    period_hours: int = Query(24, ge=1, le=720),
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
