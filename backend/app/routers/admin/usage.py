"""Admin usage & analytics endpoints."""

import logging
from datetime import UTC, date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.database import get_db
from app.services import usage_analytics_service as svc

from .deps import require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


def _resolve_tenant(admin: AdminPrincipal, tenant_id: str | None) -> str | None:
    if not admin.is_global:
        return admin.tenant_scope
    return tenant_id or None


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


@router.get("/tenant-ranking")
async def tenant_ranking(
    metric: Literal["error_rate", "latency", "cost", "volume"] = Query("error_rate"),
    period_hours: int = Query(24, ge=1, le=720),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    _admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    data = await svc.get_tenant_ranking(db, metric, period_hours, limit)
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
