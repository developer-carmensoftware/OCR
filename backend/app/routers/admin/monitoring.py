"""Admin monitoring endpoints — alerts, jobs, performance logs, DB pool."""

import logging
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.database import get_db
from app.models.observability import AnomalyAlert, JobRun, PerformanceLog
from app.services.tenant_lookup import tenant_name_map
from app.utils.pagination import paginate

from ._query import ListQuery, apply_list_query, list_query
from .deps import require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


def _maybe_filter_tenant(q, col, admin: AdminPrincipal, tenant_id: str | None):
    tid = tenant_id if admin.is_global else admin.tenant_scope
    if tid:
        return q.where(col == tid)
    return q


@router.get("/alerts")
async def list_alerts(
    status: Literal["open", "resolved", "all"] = Query("open"),
    severity: str | None = Query(None),
    tenant_id: str | None = Query(None),
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
    lq: ListQuery = Depends(list_query),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("alerts", "read")),
):
    q = _maybe_filter_tenant(select(AnomalyAlert), AnomalyAlert.tenant_id, admin, tenant_id)
    if status == "open":
        q = q.where(AnomalyAlert.resolved_at.is_(None))
    elif status == "resolved":
        q = q.where(AnomalyAlert.resolved_at.isnot(None))
    if severity:
        q = q.where(AnomalyAlert.severity == severity)
    if from_date:
        q = q.where(AnomalyAlert.created_at >= from_date)
    if to_date:
        q = q.where(AnomalyAlert.created_at <= to_date)

    q = apply_list_query(
        q,
        lq,
        sortable={
            "created_at": AnomalyAlert.created_at,
            "severity": AnomalyAlert.severity,
            "metric": AnomalyAlert.metric,
            "resolved_at": AnomalyAlert.resolved_at,
        },
        tiebreak=AnomalyAlert.id,
        default_sort="created_at",
        searchable=(AnomalyAlert.metric, AnomalyAlert.description, AnomalyAlert.module_id),
    )
    # `total` comes off the unlimited statement — Overview's KPI card calls this with
    # limit=1, and counting the returned rows could only ever have answered 0 or 1.
    rows, total = await paginate(db, q, lq.limit, lq.offset)
    names = await tenant_name_map(db, [r.tenant_id for r in rows])
    return {
        "total": total,
        "limit": lq.limit,
        "offset": lq.offset,
        "data": [
            {
                "id": r.id,
                "tenant_id": r.tenant_id,
                "tenant_name": names.get(r.tenant_id),
                "module_id": r.module_id,
                "metric": r.metric,
                "severity": r.severity.value if r.severity else None,
                "threshold": float(str(r.threshold)) if r.threshold is not None else None,
                "actual": float(str(r.actual)) if r.actual is not None else None,
                "description": r.description,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
            }
            for r in rows
        ],
    }


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("alerts", "acknowledge")),
):
    q = select(AnomalyAlert).where(AnomalyAlert.id == alert_id)
    if not admin.is_global:
        q = q.where(AnomalyAlert.tenant_id == admin.tenant_scope)

    result = await db.execute(q)
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if alert.resolved_at:
        return {
            "id": alert_id,
            "already_resolved": True,
            "resolved_at": alert.resolved_at.isoformat(),
        }

    now = datetime.now(UTC)
    await db.execute(
        text("UPDATE anomaly_alerts SET resolved_at=:now WHERE id=:id"),
        {"now": now, "id": alert_id},
    )
    await db.commit()
    return {"id": alert_id, "resolved": True, "resolved_at": now.isoformat()}


@router.get("/jobs")
async def list_jobs(
    status: str | None = Query(None, description="running|success|failed"),
    job_name: str | None = Query(None),
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
    lq: ListQuery = Depends(list_query),
    db: AsyncSession = Depends(get_db),
    _admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    q = select(JobRun)
    if status:
        q = q.where(JobRun.status == status)
    if job_name:
        q = q.where(JobRun.job_name == job_name)
    if from_date:
        q = q.where(JobRun.started_at >= from_date)
    if to_date:
        q = q.where(JobRun.started_at <= to_date)

    q = apply_list_query(
        q,
        lq,
        sortable={
            "started_at": JobRun.started_at,
            "job_name": JobRun.job_name,
            "status": JobRun.status,
            "rows_affected": JobRun.rows_affected,
        },
        tiebreak=JobRun.id,
        default_sort="started_at",
        searchable=(JobRun.job_name, JobRun.error_message),
    )
    rows, total = await paginate(db, q, lq.limit, lq.offset)
    return {
        "total": total,
        "limit": lq.limit,
        "offset": lq.offset,
        "data": [
            {
                "id": r.id,
                "job_name": r.job_name,
                "status": r.status.value if r.status else None,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                "duration_s": round((r.completed_at - r.started_at).total_seconds(), 2)
                if r.completed_at and r.started_at
                else None,
                "rows_affected": r.rows_affected,
                "error_message": r.error_message,
            }
            for r in rows
        ],
    }


@router.get("/performance-logs")
async def get_performance_logs(
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
    endpoint: str | None = Query(None),
    status_code: int | None = Query(None),
    min_duration_ms: float | None = Query(None),
    tenant_id: str | None = Query(None),
    lq: ListQuery = Depends(list_query),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    q = select(PerformanceLog)
    q = _maybe_filter_tenant(q, PerformanceLog.tenant_id, admin, tenant_id)
    if from_date:
        q = q.where(PerformanceLog.created_at >= from_date)
    if to_date:
        q = q.where(PerformanceLog.created_at <= to_date)
    if endpoint:
        q = q.where(PerformanceLog.endpoint.contains(endpoint))
    if status_code:
        q = q.where(PerformanceLog.status_code == status_code)
    if min_duration_ms is not None:
        q = q.where(PerformanceLog.duration_ms >= min_duration_ms)

    q = apply_list_query(
        q,
        lq,
        sortable={
            "created_at": PerformanceLog.created_at,
            "endpoint": PerformanceLog.endpoint,
            "method": PerformanceLog.method,
            "status_code": PerformanceLog.status_code,
            "duration_ms": PerformanceLog.duration_ms,
        },
        tiebreak=PerformanceLog.id,
        default_sort="created_at",
        searchable=(PerformanceLog.endpoint, PerformanceLog.carmen_user_id),
    )
    rows, total = await paginate(db, q, lq.limit, lq.offset)
    names = await tenant_name_map(db, [r.tenant_id for r in rows])
    return {
        "total": total,
        "limit": lq.limit,
        "offset": lq.offset,
        "data": [
            {
                "id": r.id,
                "tenant_id": r.tenant_id,
                "tenant_name": names.get(r.tenant_id),
                "endpoint": r.endpoint,
                "method": r.method,
                "duration_ms": round(float(r.duration_ms or 0), 1),
                "status_code": r.status_code,
                "carmen_user_id": r.carmen_user_id,
                "resource_id": r.resource_id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.get("/db-pool-status")
async def get_db_pool_status(
    _admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    from app.database import _get_engine

    engine = _get_engine()
    pool = engine.sync_engine.pool
    return {
        "pool_size": pool.size(),
        "checked_in": pool.checkedin(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
        "invalid": pool.invalid(),
        "max_connections": pool.size() + pool._max_overflow,
    }
