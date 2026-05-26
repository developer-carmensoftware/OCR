"""Admin usage & analytics endpoints."""

import logging
from datetime import UTC, date, datetime, timedelta
from datetime import time as time_type
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Date as SADate
from sqlalchemy import case, cast, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.database import get_db
from app.models.business import OCRTask
from app.models.enums import TaskStatus
from app.models.identity import Tenant
from app.models.observability import LLMUsageLog, PerformanceLog

from .deps import require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


def _resolve_tenant(admin: AdminPrincipal, tenant_id: str | None) -> str | None:
    """
    Return the tenant UUID to filter by, or None for cluster-wide.
    Scoped admins always see only their assigned tenant regardless of the query param.
    """
    if not admin.is_global:
        return admin.tenant_scope
    return tenant_id or None


@router.get("/usage-summary")
async def get_usage_summary(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    module_id: str | None = Query(None),
    tenant_id: str | None = Query(None, description="Filter by tenant UUID; omit for all tenants"),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    if not from_date:
        from_date = date.today().replace(day=1)
    if not to_date:
        to_date = date.today()

    tid = _resolve_tenant(admin, tenant_id)
    from_dt = datetime.combine(from_date, time_type.min)
    to_dt = datetime.combine(to_date, time_type.max)

    q = (
        select(
            cast(LLMUsageLog.created_at, SADate).label("summary_date"),
            LLMUsageLog.module_id,
            LLMUsageLog.tenant_id,
            func.count(LLMUsageLog.id).label("llm_calls"),
            func.sum(LLMUsageLog.total_tokens).label("tokens"),
            func.sum(LLMUsageLog.cost_usd).label("cost_usd"),
            func.avg(LLMUsageLog.duration_ms).label("avg_llm_latency_ms"),
        )
        .where(LLMUsageLog.created_at >= from_dt, LLMUsageLog.created_at <= to_dt)
        .group_by(
            cast(LLMUsageLog.created_at, SADate), LLMUsageLog.module_id, LLMUsageLog.tenant_id
        )
        .order_by(cast(LLMUsageLog.created_at, SADate).desc())
    )
    if tid:
        q = q.where(LLMUsageLog.tenant_id == tid)
    if module_id:
        q = q.where(LLMUsageLog.module_id == module_id)

    result = await db.execute(q)
    rows = result.mappings().all()

    return {
        "tenant_id": tid,
        "from": str(from_date),
        "to": str(to_date),
        "days": len(rows),
        "data": [
            {
                "date": str(r["summary_date"]),
                "module_id": r["module_id"],
                "tenant_id": r["tenant_id"],
                "documents": 0,
                "submissions": 0,
                "llm_calls": int(r["llm_calls"] or 0),
                "tokens": int(r["tokens"] or 0),
                "cost_usd": float(str(r["cost_usd"] or 0)),
                "errors": 0,
                "avg_llm_latency_ms": round(float(r["avg_llm_latency_ms"] or 0), 2),
            }
            for r in rows
        ],
    }


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
    from_dt = datetime.combine(from_date, time_type.min)
    to_dt = datetime.combine(to_date, time_type.max)

    # LLM metrics from llm_usage_logs (real-time, always populated)
    llm_q = select(
        func.count(LLMUsageLog.id).label("total_llm_calls"),
        func.sum(LLMUsageLog.total_tokens).label("total_tokens"),
        func.sum(LLMUsageLog.cost_usd).label("total_cost_usd"),
        func.avg(LLMUsageLog.duration_ms).label("avg_llm_latency_ms"),
    ).where(LLMUsageLog.created_at >= from_dt, LLMUsageLog.created_at <= to_dt)
    if tid:
        llm_q = llm_q.where(LLMUsageLog.tenant_id == tid)

    llm_result = await db.execute(llm_q)
    llm_row = llm_result.mappings().fetchone() or {}

    # Task/document metrics from ocr_tasks
    task_q = select(
        func.count(OCRTask.id).label("total_documents"),
        func.sum(case((OCRTask.status == TaskStatus.COMPLETED, 1), else_=0)).label(
            "total_submissions"
        ),
        func.sum(case((OCRTask.status == TaskStatus.FAILED, 1), else_=0)).label("total_errors"),
    ).where(
        OCRTask.created_at >= from_dt,
        OCRTask.created_at <= to_dt,
        OCRTask.deleted_at.is_(None),
    )
    if tid:
        task_q = task_q.where(OCRTask.tenant_id == tid)

    task_result = await db.execute(task_q)
    task_row = task_result.mappings().fetchone() or {}

    return {
        "tenant_id": tid,
        "from": str(from_date),
        "to": str(to_date),
        "totals": {
            "documents": int(task_row.get("total_documents") or 0),
            "submissions": int(task_row.get("total_submissions") or 0),
            "llm_calls": int(llm_row.get("total_llm_calls") or 0),
            "tokens": int(llm_row.get("total_tokens") or 0),
            "cost_usd": float(llm_row.get("total_cost_usd") or 0),
            "avg_llm_latency_ms": round(float(llm_row.get("avg_llm_latency_ms") or 0), 2),
            "errors": int(task_row.get("total_errors") or 0),
        },
    }


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
    q = select(LLMUsageLog)
    if tid:
        q = q.where(LLMUsageLog.tenant_id == tid)
    if from_date:
        q = q.where(LLMUsageLog.created_at >= from_date)
    if to_date:
        q = q.where(LLMUsageLog.created_at <= to_date)
    if module_id:
        q = q.where(LLMUsageLog.module_id == module_id)

    order_col = {
        "cost_usd": LLMUsageLog.cost_usd,
        "duration_ms": LLMUsageLog.duration_ms,
        "total_tokens": LLMUsageLog.total_tokens,
        "created_at": LLMUsageLog.created_at,
    }[order_by]
    q = q.order_by(order_col.desc()).limit(limit)

    result = await db.execute(q)
    rows = result.scalars().all()
    return {
        "total": len(rows),
        "data": [
            {
                "id": r.id,
                "tenant_id": r.tenant_id,
                "module_id": r.module_id,
                "model": r.model,
                "task_id": r.task_id,
                "carmen_user_id": r.carmen_user_id,
                "prompt_tokens": r.prompt_tokens,
                "completion_tokens": r.completion_tokens,
                "total_tokens": r.total_tokens,
                "duration_ms": round(float(str(r.duration_ms)), 1)
                if r.duration_ms is not None
                else None,
                "cost_usd": float(str(r.cost_usd)) if r.cost_usd is not None else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


async def _tenant_name_map(db: AsyncSession, tids: list[str]) -> dict[str, str]:
    """Return {tenant_id_str: 'name (bu_code)'} for the given UUIDs."""
    if not tids:
        return {}
    q = select(Tenant.id, Tenant.name, Tenant.bu_code).where(
        Tenant.id.in_(tids), Tenant.deleted_at.is_(None)
    )
    result = await db.execute(q)
    return {str(r.id): f"{r.name} ({r.bu_code})" for r in result.mappings().all()}


@router.get("/tenant-ranking")
async def tenant_ranking(
    metric: Literal["error_rate", "latency", "cost", "volume"] = Query("error_rate"),
    period_hours: int = Query(24, ge=1, le=720),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    _admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    """Rank tenants by a health metric across the cluster."""
    since = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=period_hours)

    if metric == "cost":
        q = (
            select(
                LLMUsageLog.tenant_id.label("tid"),
                func.count(LLMUsageLog.id).label("total_calls"),
                func.sum(LLMUsageLog.total_tokens).label("total_tokens"),
                func.sum(LLMUsageLog.cost_usd).label("total_cost"),
            )
            .where(
                LLMUsageLog.created_at >= since,
                LLMUsageLog.tenant_id.isnot(None),
            )
            .group_by(LLMUsageLog.tenant_id)
            .order_by(text("total_cost DESC"))
            .limit(limit)
        )
        result = await db.execute(q)
        rows = result.mappings().all()
        names = await _tenant_name_map(db, [r["tid"] for r in rows if r["tid"]])
        return {
            "metric": metric,
            "period_hours": period_hours,
            "data": [
                {
                    "tenant_id": r["tid"],
                    "tenant_name": names.get(r["tid"], r["tid"]),
                    "total_calls": int(r["total_calls"] or 0),
                    "total_tokens": int(r["total_tokens"] or 0),
                    "total_cost_usd": float(str(r["total_cost"] or 0)),
                }
                for r in rows
            ],
        }

    error_count = func.sum(case((PerformanceLog.status_code >= 500, 1), else_=0))
    q = (
        select(
            PerformanceLog.tenant_id.label("tid"),
            func.count(PerformanceLog.id).label("total_requests"),
            error_count.label("errors"),
            func.avg(PerformanceLog.duration_ms).label("avg_latency"),
            func.max(PerformanceLog.duration_ms).label("max_latency"),
        )
        .where(
            PerformanceLog.created_at >= since,
            PerformanceLog.tenant_id.isnot(None),
        )
        .group_by(PerformanceLog.tenant_id)
    )

    if metric == "error_rate":
        q = q.order_by(text("errors / total_requests DESC"))
    elif metric == "latency":
        q = q.order_by(text("avg_latency DESC"))
    else:
        q = q.order_by(text("total_requests DESC"))

    q = q.limit(limit)
    result = await db.execute(q)
    rows = result.mappings().all()
    names = await _tenant_name_map(db, [r["tid"] for r in rows if r["tid"]])
    return {
        "metric": metric,
        "period_hours": period_hours,
        "data": [
            {
                "tenant_id": r["tid"],
                "tenant_name": names.get(r["tid"], r["tid"]),
                "total_requests": int(r["total_requests"] or 0),
                "errors": int(r["errors"] or 0),
                "error_rate_pct": round((r["errors"] or 0) / r["total_requests"] * 100, 2)
                if r["total_requests"]
                else 0,
                "avg_latency_ms": round(float(r["avg_latency"] or 0), 1),
                "max_latency_ms": round(float(r["max_latency"] or 0), 1),
            }
            for r in rows
        ],
    }


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
        from_date = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=30)
    if not to_date:
        to_date = datetime.now(UTC).replace(tzinfo=None)

    tid = _resolve_tenant(admin, tenant_id)
    q = select(
        LLMUsageLog.carmen_user_id.label("uid"),
        func.count(LLMUsageLog.id).label("total_calls"),
        func.sum(LLMUsageLog.total_tokens).label("total_tokens"),
        func.sum(LLMUsageLog.cost_usd).label("total_cost"),
        func.avg(LLMUsageLog.duration_ms).label("avg_latency"),
    ).where(
        LLMUsageLog.created_at >= from_date,
        LLMUsageLog.created_at <= to_date,
        LLMUsageLog.carmen_user_id.isnot(None),
    )
    if tid:
        q = q.where(LLMUsageLog.tenant_id == tid)

    q = q.group_by(LLMUsageLog.carmen_user_id)
    order_map = {
        "calls": text("total_calls DESC"),
        "tokens": text("total_tokens DESC"),
        "cost": text("total_cost DESC"),
    }
    q = q.order_by(order_map[order_by]).limit(limit)

    result = await db.execute(q)
    rows = result.mappings().all()
    return {
        "from": from_date.isoformat(),
        "to": to_date.isoformat(),
        "total_users": len(rows),
        "data": [
            {
                "carmen_user_id": r["uid"],
                "total_calls": int(r["total_calls"] or 0),
                "total_tokens": int(r["total_tokens"] or 0),
                "total_cost_usd": float(str(r["total_cost"] or 0)),
                "avg_latency_ms": round(float(r["avg_latency"] or 0), 1)
                if r["avg_latency"] is not None
                else None,
            }
            for r in rows
        ],
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
    since = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=period_hours)
    tid = _resolve_tenant(admin, tenant_id)

    if group_by == "module":
        failed_count = func.sum(case((OCRTask.status == TaskStatus.FAILED, 1), else_=0))
        q = select(
            OCRTask.module_id.label("group"),
            func.count(OCRTask.id).label("total"),
            failed_count.label("errors"),
        ).where(OCRTask.created_at >= since)
        if tid:
            q = q.where(OCRTask.tenant_id == tid)
        q = q.group_by(OCRTask.module_id).order_by(text("errors DESC")).limit(limit)
        result = await db.execute(q)
        rows = result.mappings().all()
        return {
            "group_by": group_by,
            "period_hours": period_hours,
            "data": [
                {
                    "group": r["group"],
                    "total_tasks": int(r["total"] or 0),
                    "errors": int(r["errors"] or 0),
                    "error_rate_pct": round((r["errors"] or 0) / r["total"] * 100, 2)
                    if r["total"]
                    else 0,
                }
                for r in rows
            ],
        }

    error_count = func.sum(case((PerformanceLog.status_code >= 500, 1), else_=0))
    group_col = PerformanceLog.tenant_id if group_by == "tenant" else PerformanceLog.endpoint

    q = select(
        group_col.label("group"),
        func.count(PerformanceLog.id).label("total"),
        error_count.label("errors"),
        func.avg(PerformanceLog.duration_ms).label("avg_latency"),
    ).where(PerformanceLog.created_at >= since)
    if tid:
        q = q.where(PerformanceLog.tenant_id == tid)
    if group_by == "tenant":
        q = q.where(PerformanceLog.tenant_id.isnot(None))
    q = q.group_by(group_col).order_by(text("errors DESC")).limit(limit)

    result = await db.execute(q)
    rows = result.mappings().all()
    return {
        "group_by": group_by,
        "period_hours": period_hours,
        "data": [
            {
                "group": r["group"],
                "total_requests": int(r["total"] or 0),
                "errors": int(r["errors"] or 0),
                "error_rate_pct": round((r["errors"] or 0) / r["total"] * 100, 2)
                if r["total"]
                else 0,
                "avg_latency_ms": round(float(r["avg_latency"] or 0), 1),
            }
            for r in rows
        ],
    }
