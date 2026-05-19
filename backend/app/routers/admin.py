"""Admin Router — usage summary, observability, and operational endpoints."""

import logging
from datetime import UTC, date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import SessionInfo, get_current_session
from app.config import settings
from app.database import get_db
from app.models.enums import TaskStatus
from app.models.orm import (
    AnomalyAlert,
    DailyUsageSummary,
    JobRun,
    LLMUsageLog,
    OcrSession,
    OCRTask,
    PerformanceLog,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])


def require_admin(x_admin_key: str = Header(..., alias="X-Admin-Key")) -> None:
    """Require a valid master API key for all admin endpoints."""
    if not settings.master_api_key:
        raise HTTPException(status_code=503, detail="Admin access not configured")
    if x_admin_key != settings.master_api_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")


# ── Usage Summary ─────────────────────────────────────────────────────────────


@router.get("/usage-summary")
async def get_usage_summary(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    module_id: str | None = Query(None, description="Filter by module id"),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    if not from_date:
        from_date = date.today().replace(day=1)
    if not to_date:
        to_date = date.today()

    query = (
        select(DailyUsageSummary)
        .where(
            DailyUsageSummary.tenant_id == session.tenant_id,
            DailyUsageSummary.business_unit_id == session.business_unit_id,
            DailyUsageSummary.summary_date >= from_date,
            DailyUsageSummary.summary_date <= to_date,
        )
        .order_by(DailyUsageSummary.summary_date.desc())
    )
    if module_id:
        query = query.where(DailyUsageSummary.module_id == module_id)

    result = await db.execute(query)
    rows = result.scalars().all()

    return {
        "tenant_id": session.tenant_id,
        "business_unit_id": session.business_unit_id,
        "from": str(from_date),
        "to": str(to_date),
        "days": len(rows),
        "data": [
            {
                "date": str(
                    r.summary_date.date()
                    if isinstance(r.summary_date, datetime)
                    else r.summary_date
                ),
                "module_id": r.module_id,
                "documents": r.total_documents,
                "submissions": r.total_submissions,
                "llm_calls": r.total_llm_calls,
                "tokens": r.total_tokens,
                "cost_usd": float(str(r.total_cost_usd or 0)),
                "avg_llm_latency_ms": r.avg_llm_latency_ms,
                "api_calls": r.total_api_calls,
                "avg_api_latency_ms": r.avg_api_latency_ms,
                "p95_api_latency_ms": r.p95_api_latency_ms,
                "errors": r.total_errors,
                "corrections": r.total_corrections,
                "outbound_calls": r.total_outbound_calls,
            }
            for r in rows
        ],
    }


@router.get("/usage-summary/totals")
async def get_usage_totals(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    if not from_date:
        from_date = date.today().replace(day=1)
    if not to_date:
        to_date = date.today()

    result = await db.execute(
        select(
            func.sum(DailyUsageSummary.total_documents).label("total_documents"),
            func.sum(DailyUsageSummary.total_submissions).label("total_submissions"),
            func.sum(DailyUsageSummary.total_llm_calls).label("total_llm_calls"),
            func.sum(DailyUsageSummary.total_tokens).label("total_tokens"),
            func.sum(DailyUsageSummary.total_cost_usd).label("total_cost_usd"),
            func.avg(DailyUsageSummary.avg_llm_latency_ms).label("avg_llm_latency_ms"),
            func.sum(DailyUsageSummary.total_api_calls).label("total_api_calls"),
            func.avg(DailyUsageSummary.avg_api_latency_ms).label("avg_api_latency_ms"),
            func.sum(DailyUsageSummary.total_errors).label("total_errors"),
            func.sum(DailyUsageSummary.total_corrections).label("total_corrections"),
            func.sum(DailyUsageSummary.total_outbound_calls).label("total_outbound_calls"),
        ).where(
            DailyUsageSummary.tenant_id == session.tenant_id,
            DailyUsageSummary.business_unit_id == session.business_unit_id,
            DailyUsageSummary.summary_date >= from_date,
            DailyUsageSummary.summary_date <= to_date,
        )
    )
    row = result.mappings().fetchone() or {}

    return {
        "tenant_id": session.tenant_id,
        "business_unit_id": session.business_unit_id,
        "from": str(from_date),
        "to": str(to_date),
        "totals": {
            "documents": int(row.get("total_documents") or 0),
            "submissions": int(row.get("total_submissions") or 0),
            "llm_calls": int(row.get("total_llm_calls") or 0),
            "tokens": int(row.get("total_tokens") or 0),
            "cost_usd": float(row.get("total_cost_usd") or 0),
            "avg_llm_latency_ms": round(float(row.get("avg_llm_latency_ms") or 0), 2),
            "api_calls": int(row.get("total_api_calls") or 0),
            "avg_api_latency_ms": round(float(row.get("avg_api_latency_ms") or 0), 2),
            "errors": int(row.get("total_errors") or 0),
            "corrections": int(row.get("total_corrections") or 0),
            "outbound_calls": int(row.get("total_outbound_calls") or 0),
        },
    }


# ── Anomaly Alerts ────────────────────────────────────────────────────────────


@router.get("/alerts")
async def list_alerts(
    status: Literal["open", "resolved", "all"] = Query("open"),
    severity: str | None = Query(None, description="warn|critical"),
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
    limit: int = Query(50, le=500),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    q = select(AnomalyAlert).where(AnomalyAlert.tenant_id == session.tenant_id)
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
    q = q.order_by(AnomalyAlert.created_at.desc()).limit(limit)

    result = await db.execute(q)
    rows = result.scalars().all()
    return {
        "total": len(rows),
        "data": [
            {
                "id": r.id,
                "business_unit_id": r.business_unit_id,
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
    session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    result = await db.execute(
        select(AnomalyAlert).where(
            AnomalyAlert.id == alert_id,
            AnomalyAlert.tenant_id == session.tenant_id,
        )
    )
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


# ── Background Job Runs ───────────────────────────────────────────────────────


@router.get("/jobs")
async def list_jobs(
    status: str | None = Query(None, description="running|success|failed"),
    job_name: str | None = Query(None),
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
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
    q = q.order_by(JobRun.started_at.desc()).limit(limit)

    result = await db.execute(q)
    rows = result.scalars().all()
    return {
        "total": len(rows),
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


# ── Real-time Performance Logs ────────────────────────────────────────────────


@router.get("/performance-logs")
async def get_performance_logs(
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
    endpoint: str | None = Query(None, description="Partial match on endpoint path"),
    status_code: int | None = Query(None),
    min_duration_ms: float | None = Query(None, description="Filter slow requests"),
    limit: int = Query(100, le=1000),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    q = select(PerformanceLog).where(PerformanceLog.tenant_id == session.tenant_id)
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
    q = q.order_by(PerformanceLog.created_at.desc()).limit(limit)

    result = await db.execute(q)
    rows = result.scalars().all()
    return {
        "total": len(rows),
        "data": [
            {
                "id": r.id,
                "endpoint": r.endpoint,
                "method": r.method,
                "duration_ms": round(float(r.duration_ms or 0), 1),  # type: ignore[arg-type]
                "status_code": r.status_code,
                "business_unit_id": r.business_unit_id,
                "carmen_user_id": r.carmen_user_id,
                "resource_id": r.resource_id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


# ── LLM Usage Detail ─────────────────────────────────────────────────────────


@router.get("/llm-usage")
async def get_llm_usage(
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
    module_id: str | None = Query(None),
    order_by: Literal["cost_usd", "duration_ms", "total_tokens", "created_at"] = Query(
        "created_at"
    ),
    limit: int = Query(100, le=1000),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    q = select(LLMUsageLog).where(LLMUsageLog.tenant_id == session.tenant_id)
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
                "module_id": r.module_id,
                "model": r.model,
                "business_unit_id": r.business_unit_id,
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


# ── Quota Summary ─────────────────────────────────────────────────────────────


@router.get("/quotas")
async def get_quotas(
    session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    from app.services.usage_service import get_quota_summary

    return await get_quota_summary(session.tenant_id)


# ── Session Management ────────────────────────────────────────────────────────


@router.get("/sessions")
async def list_sessions(
    active_only: bool = Query(True),
    business_unit_id: str | None = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    q = select(OcrSession).where(
        OcrSession.tenant_id == session.tenant_id,
        OcrSession.deleted_at.is_(None),
    )
    if active_only:
        q = q.where(OcrSession.is_active == True)  # noqa: E712
    if business_unit_id:
        q = q.where(OcrSession.business_unit_id == business_unit_id)
    q = q.order_by(OcrSession.last_used_at.desc()).limit(limit)

    result = await db.execute(q)
    rows = result.scalars().all()
    return {
        "total": len(rows),
        "data": [
            {
                "id": r.id,
                "business_unit_id": r.business_unit_id,
                "carmen_user_id": r.carmen_user_id,
                "username": r.username,
                "is_active": r.is_active,
                "last_used_at": r.last_used_at.isoformat() if r.last_used_at else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    result = await db.execute(
        select(OcrSession).where(
            OcrSession.id == session_id,
            OcrSession.tenant_id == session.tenant_id,
            OcrSession.deleted_at.is_(None),
        )
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Session not found")

    await db.execute(
        text("UPDATE ocr_sessions SET is_active=0 WHERE id=:id"),
        {"id": session_id},
    )
    await db.commit()
    return {"session_id": session_id, "revoked": True}


# ── Infrastructure ────────────────────────────────────────────────────────────


@router.get("/db-pool-status")
async def get_db_pool_status(
    _session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
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


# ── Cross-BU Comparison & Aggregations ───────────────────────────────────────


@router.get("/bu-ranking")
async def bu_ranking(
    metric: Literal["error_rate", "latency", "cost", "volume"] = Query("error_rate"),
    period_hours: int = Query(24, ge=1, le=720),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    """Rank business units within the tenant by a health metric.

    - error_rate / latency / volume → derived from performance_logs (HTTP layer)
    - cost → derived from llm_usage_logs (OpenRouter spend)
    """
    since = datetime.now(UTC) - timedelta(hours=period_hours)

    if metric == "cost":
        q = (
            select(
                LLMUsageLog.business_unit_id.label("bu"),
                func.count(LLMUsageLog.id).label("total_calls"),
                func.sum(LLMUsageLog.total_tokens).label("total_tokens"),
                func.sum(LLMUsageLog.cost_usd).label("total_cost"),
            )
            .where(
                LLMUsageLog.tenant_id == session.tenant_id,
                LLMUsageLog.created_at >= since,
                LLMUsageLog.business_unit_id.isnot(None),
            )
            .group_by(LLMUsageLog.business_unit_id)
            .order_by(text("total_cost DESC"))
            .limit(limit)
        )
        result = await db.execute(q)
        rows = result.mappings().all()
        return {
            "metric": metric,
            "period_hours": period_hours,
            "data": [
                {
                    "business_unit_id": r["bu"],
                    "total_calls": int(r["total_calls"] or 0),
                    "total_tokens": int(r["total_tokens"] or 0),
                    "total_cost_usd": float(str(r["total_cost"] or 0)),
                }
                for r in rows
            ],
        }

    # HTTP-layer metrics from performance_logs
    error_count = func.sum(case((PerformanceLog.status_code >= 500, 1), else_=0))
    q = (
        select(
            PerformanceLog.business_unit_id.label("bu"),
            func.count(PerformanceLog.id).label("total_requests"),
            error_count.label("errors"),
            func.avg(PerformanceLog.duration_ms).label("avg_latency"),
            func.max(PerformanceLog.duration_ms).label("max_latency"),
        )
        .where(
            PerformanceLog.tenant_id == session.tenant_id,
            PerformanceLog.created_at >= since,
            PerformanceLog.business_unit_id.isnot(None),
        )
        .group_by(PerformanceLog.business_unit_id)
    )

    if metric == "error_rate":
        q = q.order_by(text("errors / total_requests DESC"))
    elif metric == "latency":
        q = q.order_by(text("avg_latency DESC"))
    else:  # volume
        q = q.order_by(text("total_requests DESC"))

    q = q.limit(limit)
    result = await db.execute(q)
    rows = result.mappings().all()
    return {
        "metric": metric,
        "period_hours": period_hours,
        "data": [
            {
                "business_unit_id": r["bu"],
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
    business_unit_id: str | None = Query(None),
    order_by: Literal["calls", "tokens", "cost"] = Query("calls"),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    """Per-Carmen-user usage breakdown (calls, tokens, cost, latency).

    Useful for: identifying heavy users, cost attribution, anomaly investigation.
    """
    if not from_date:
        from_date = datetime.now(UTC) - timedelta(days=30)
    if not to_date:
        to_date = datetime.now(UTC)

    q = select(
        LLMUsageLog.carmen_user_id.label("uid"),
        LLMUsageLog.business_unit_id.label("bu"),
        func.count(LLMUsageLog.id).label("total_calls"),
        func.sum(LLMUsageLog.total_tokens).label("total_tokens"),
        func.sum(LLMUsageLog.cost_usd).label("total_cost"),
        func.avg(LLMUsageLog.duration_ms).label("avg_latency"),
    ).where(
        LLMUsageLog.tenant_id == session.tenant_id,
        LLMUsageLog.created_at >= from_date,
        LLMUsageLog.created_at <= to_date,
        LLMUsageLog.carmen_user_id.isnot(None),
    )
    if business_unit_id:
        q = q.where(LLMUsageLog.business_unit_id == business_unit_id)

    q = q.group_by(LLMUsageLog.carmen_user_id, LLMUsageLog.business_unit_id)

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
                "business_unit_id": r["bu"],
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
    group_by: Literal["module", "bu", "endpoint"] = Query("module"),
    period_hours: int = Query(24, ge=1, le=720),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    """Error-rate breakdown by module, business unit, or endpoint.

    - module → derived from ocr_tasks (TaskStatus.FAILED rate)
    - bu / endpoint → derived from performance_logs (HTTP 5xx rate)
    """
    since = datetime.now(UTC) - timedelta(hours=period_hours)

    if group_by == "module":
        failed_count = func.sum(case((OCRTask.status == TaskStatus.FAILED, 1), else_=0))
        q = (
            select(
                OCRTask.module_id.label("group"),
                func.count(OCRTask.id).label("total"),
                failed_count.label("errors"),
            )
            .where(
                OCRTask.tenant_id == session.tenant_id,
                OCRTask.created_at >= since,
            )
            .group_by(OCRTask.module_id)
            .order_by(text("errors DESC"))
            .limit(limit)
        )
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
                    "success_rate_pct": round((1 - (r["errors"] or 0) / r["total"]) * 100, 2)
                    if r["total"]
                    else 0,
                }
                for r in rows
            ],
        }

    # group_by == "bu" or "endpoint" → performance_logs
    error_count = func.sum(case((PerformanceLog.status_code >= 500, 1), else_=0))
    group_col = PerformanceLog.business_unit_id if group_by == "bu" else PerformanceLog.endpoint

    q = (
        select(
            group_col.label("group"),
            func.count(PerformanceLog.id).label("total"),
            error_count.label("errors"),
            func.avg(PerformanceLog.duration_ms).label("avg_latency"),
        )
        .where(
            PerformanceLog.tenant_id == session.tenant_id,
            PerformanceLog.created_at >= since,
        )
        .group_by(group_col)
        .order_by(text("errors DESC"))
        .limit(limit)
    )
    if group_by == "bu":
        q = q.where(PerformanceLog.business_unit_id.isnot(None))

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
                "success_rate_pct": round((1 - (r["errors"] or 0) / r["total"]) * 100, 2)
                if r["total"]
                else 0,
                "avg_latency_ms": round(float(r["avg_latency"] or 0), 1),
            }
            for r in rows
        ],
    }


# ── Manual Trigger Endpoints ──────────────────────────────────────────────────


@router.post("/retention/run")
async def trigger_retention(
    _session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    from app.services.retention_service import archive_and_cleanup, purge_inactive_sessions

    result = await archive_and_cleanup()
    await purge_inactive_sessions()
    return {"status": "completed", "summary": result}


@router.post("/summary/rebuild")
async def trigger_summary_rebuild(
    target_date: date | None = Query(None, alias="date"),
    _session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    from app.services.summary_service import build_daily_summary

    result = await build_daily_summary(target_date)
    return {"status": "completed", "date": str(target_date), "metrics": result}


@router.post("/pricing/sync")
async def trigger_pricing_sync(
    _session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    from app.services.usage_service import fetch_openrouter_pricing

    await fetch_openrouter_pricing()
    return {"status": "sync_started"}


@router.get("/pricing/list")
async def get_pricing_list(
    db: AsyncSession = Depends(get_db),
    _session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    from app.models.orm import LLMModelPricing

    result = await db.execute(select(LLMModelPricing).order_by(LLMModelPricing.model_name))
    rows = result.scalars().all()
    return {
        "count": len(rows),
        "data": [
            {
                "model_name": r.model_name,
                "input_price_per_1m": float(str(r.input_price_per_1m)),
                "output_price_per_1m": float(str(r.output_price_per_1m)),
                "source": r.source,
                "price_verified_at": r.price_verified_at.isoformat()
                if r.price_verified_at
                else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ],
    }
