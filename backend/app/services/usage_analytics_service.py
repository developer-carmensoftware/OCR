"""
Usage analytics service — aggregation queries for admin dashboard.

Encapsulates all ORM queries that were previously inline in routers/admin/usage.py.
"""

from datetime import UTC, date, datetime, timedelta
from datetime import time as time_type
from typing import Any, Literal

from sqlalchemy import Date as SADate
from sqlalchemy import case, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.business import APInvoice, CreditCard, OCRTask
from app.models.enums import TaskStatus
from app.models.identity import Tenant
from app.models.observability import LLMUsageLog, PerformanceLog


async def get_usage_summary(
    db: AsyncSession,
    from_date: date,
    to_date: date,
    tenant_id: str | None,
    module_id: str | None,
) -> dict[str, Any]:
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
    if tenant_id:
        q = q.where(LLMUsageLog.tenant_id == tenant_id)
    if module_id:
        q = q.where(LLMUsageLog.module_id == module_id)
    rows = (await db.execute(q)).mappings().all()

    task_count_q = (
        select(
            cast(OCRTask.created_at, SADate).label("task_date"),
            OCRTask.module_id.label("task_module"),
            OCRTask.tenant_id.label("task_tenant"),
            func.count(OCRTask.id).label("doc_count"),
            func.sum(case((OCRTask.status == TaskStatus.FAILED, 1), else_=0)).label("error_count"),
        )
        .where(
            OCRTask.created_at >= from_dt, OCRTask.created_at <= to_dt, OCRTask.deleted_at.is_(None)
        )
        .group_by(cast(OCRTask.created_at, SADate), OCRTask.module_id, OCRTask.tenant_id)
    )
    if tenant_id:
        task_count_q = task_count_q.where(OCRTask.tenant_id == tenant_id)
    if module_id:
        task_count_q = task_count_q.where(OCRTask.module_id == module_id)
    task_stats_map: dict[tuple, tuple[int, int]] = {
        (str(r["task_date"]), r["task_module"], str(r["task_tenant"])): (
            int(r["doc_count"]),
            int(r["error_count"] or 0),
        )
        for r in (await db.execute(task_count_q)).mappings().all()
    }

    cc_sub_q = (
        select(
            cast(CreditCard.submitted_at, SADate).label("sub_date"),
            OCRTask.module_id.label("sub_module"),
            CreditCard.tenant_id.label("sub_tenant"),
            func.count(CreditCard.id).label("sub_count"),
        )
        .join(OCRTask, CreditCard.task_id == OCRTask.id)
        .where(
            CreditCard.submitted_at >= from_dt,
            CreditCard.submitted_at <= to_dt,
            CreditCard.deleted_at.is_(None),
        )
        .group_by(cast(CreditCard.submitted_at, SADate), OCRTask.module_id, CreditCard.tenant_id)
    )
    ap_sub_q = (
        select(
            cast(APInvoice.submitted_at, SADate).label("sub_date"),
            OCRTask.module_id.label("sub_module"),
            APInvoice.tenant_id.label("sub_tenant"),
            func.count(APInvoice.id).label("sub_count"),
        )
        .join(OCRTask, APInvoice.task_id == OCRTask.id)
        .where(
            APInvoice.submitted_at >= from_dt,
            APInvoice.submitted_at <= to_dt,
            APInvoice.deleted_at.is_(None),
        )
        .group_by(cast(APInvoice.submitted_at, SADate), OCRTask.module_id, APInvoice.tenant_id)
    )
    if tenant_id:
        cc_sub_q = cc_sub_q.where(CreditCard.tenant_id == tenant_id)
        ap_sub_q = ap_sub_q.where(APInvoice.tenant_id == tenant_id)
    if module_id:
        cc_sub_q = cc_sub_q.where(OCRTask.module_id == module_id)
        ap_sub_q = ap_sub_q.where(OCRTask.module_id == module_id)

    sub_stats_map: dict[tuple, int] = {}
    for r in (await db.execute(cc_sub_q)).mappings().all():
        key = (str(r["sub_date"]), r["sub_module"], str(r["sub_tenant"]))
        sub_stats_map[key] = sub_stats_map.get(key, 0) + int(r["sub_count"])
    for r in (await db.execute(ap_sub_q)).mappings().all():
        key = (str(r["sub_date"]), r["sub_module"], str(r["sub_tenant"]))
        sub_stats_map[key] = sub_stats_map.get(key, 0) + int(r["sub_count"])

    return {
        "days": len(rows),
        "data": [
            {
                "date": str(r["summary_date"]),
                "module_id": r["module_id"],
                "tenant_id": r["tenant_id"],
                "documents": task_stats_map.get(
                    (str(r["summary_date"]), r["module_id"], str(r["tenant_id"])), (0, 0)
                )[0],
                "submissions": sub_stats_map.get(
                    (str(r["summary_date"]), r["module_id"], str(r["tenant_id"])), 0
                ),
                "llm_calls": int(r["llm_calls"] or 0),
                "tokens": int(r["tokens"] or 0),
                "cost_usd": float(str(r["cost_usd"] or 0)),
                "errors": task_stats_map.get(
                    (str(r["summary_date"]), r["module_id"], str(r["tenant_id"])), (0, 0)
                )[1],
                "avg_llm_latency_ms": round(float(r["avg_llm_latency_ms"] or 0), 2),
            }
            for r in rows
        ],
    }


async def get_usage_totals(
    db: AsyncSession,
    from_date: date,
    to_date: date,
    tenant_id: str | None,
) -> dict[str, Any]:
    from_dt = datetime.combine(from_date, time_type.min)
    to_dt = datetime.combine(to_date, time_type.max)

    llm_q = select(
        func.count(LLMUsageLog.id).label("total_llm_calls"),
        func.sum(LLMUsageLog.total_tokens).label("total_tokens"),
        func.sum(LLMUsageLog.cost_usd).label("total_cost_usd"),
        func.avg(LLMUsageLog.duration_ms).label("avg_llm_latency_ms"),
    ).where(LLMUsageLog.created_at >= from_dt, LLMUsageLog.created_at <= to_dt)
    if tenant_id:
        llm_q = llm_q.where(LLMUsageLog.tenant_id == tenant_id)
    llm_row = (await db.execute(llm_q)).mappings().fetchone() or {}

    task_q = select(
        func.count(OCRTask.id).label("total_documents"),
        func.sum(case((OCRTask.status == TaskStatus.FAILED, 1), else_=0)).label("total_errors"),
    ).where(
        OCRTask.created_at >= from_dt, OCRTask.created_at <= to_dt, OCRTask.deleted_at.is_(None)
    )
    if tenant_id:
        task_q = task_q.where(OCRTask.tenant_id == tenant_id)
    task_row = (await db.execute(task_q)).mappings().fetchone() or {}

    cc_sub_q = select(func.count(CreditCard.id)).where(
        CreditCard.submitted_at >= from_dt,
        CreditCard.submitted_at <= to_dt,
        CreditCard.deleted_at.is_(None),
    )
    ap_sub_q = select(func.count(APInvoice.id)).where(
        APInvoice.submitted_at >= from_dt,
        APInvoice.submitted_at <= to_dt,
        APInvoice.deleted_at.is_(None),
    )
    if tenant_id:
        cc_sub_q = cc_sub_q.where(CreditCard.tenant_id == tenant_id)
        ap_sub_q = ap_sub_q.where(APInvoice.tenant_id == tenant_id)

    cc_count = (await db.execute(cc_sub_q)).scalar() or 0
    ap_count = (await db.execute(ap_sub_q)).scalar() or 0

    return {
        "documents": int(task_row.get("total_documents") or 0),
        "submissions": cc_count + ap_count,
        "llm_calls": int(llm_row.get("total_llm_calls") or 0),
        "tokens": int(llm_row.get("total_tokens") or 0),
        "cost_usd": float(llm_row.get("total_cost_usd") or 0),
        "avg_llm_latency_ms": round(float(llm_row.get("avg_llm_latency_ms") or 0), 2),
        "errors": int(task_row.get("total_errors") or 0),
    }


async def get_llm_usage(
    db: AsyncSession,
    tenant_id: str | None,
    from_date: datetime | None,
    to_date: datetime | None,
    module_id: str | None,
    order_by: Literal["cost_usd", "duration_ms", "total_tokens", "created_at"],
    limit: int,
) -> list[dict[str, Any]]:
    q = select(LLMUsageLog)
    if tenant_id:
        q = q.where(LLMUsageLog.tenant_id == tenant_id)
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
    rows = (await db.execute(q.order_by(order_col.desc()).limit(limit))).scalars().all()

    return [
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
    ]


async def get_tenant_ranking(
    db: AsyncSession,
    metric: Literal["error_rate", "latency", "cost", "volume"],
    period_hours: int,
    limit: int,
) -> list[dict[str, Any]]:
    since = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=period_hours)

    if metric == "cost":
        q = (
            select(
                LLMUsageLog.tenant_id.label("tid"),
                func.count(LLMUsageLog.id).label("total_calls"),
                func.sum(LLMUsageLog.total_tokens).label("total_tokens"),
                func.sum(LLMUsageLog.cost_usd).label("total_cost"),
            )
            .where(LLMUsageLog.created_at >= since, LLMUsageLog.tenant_id.isnot(None))
            .group_by(LLMUsageLog.tenant_id)
            .order_by(func.sum(LLMUsageLog.cost_usd).desc())
            .limit(limit)
        )
        rows = (await db.execute(q)).mappings().all()
        names = await _tenant_name_map(db, [r["tid"] for r in rows if r["tid"]])
        return [
            {
                "tenant_id": r["tid"],
                "tenant_name": names.get(r["tid"], r["tid"]),
                "total_calls": int(r["total_calls"] or 0),
                "total_tokens": int(r["total_tokens"] or 0),
                "total_cost_usd": float(str(r["total_cost"] or 0)),
            }
            for r in rows
        ]

    error_count = func.sum(case((PerformanceLog.status_code >= 500, 1), else_=0))
    q = (
        select(
            PerformanceLog.tenant_id.label("tid"),
            func.count(PerformanceLog.id).label("total_requests"),
            error_count.label("errors"),
            func.avg(PerformanceLog.duration_ms).label("avg_latency"),
            func.max(PerformanceLog.duration_ms).label("max_latency"),
        )
        .where(PerformanceLog.created_at >= since, PerformanceLog.tenant_id.isnot(None))
        .group_by(PerformanceLog.tenant_id)
    )
    if metric == "error_rate":
        q = q.order_by((error_count / func.count(PerformanceLog.id)).desc())
    elif metric == "latency":
        q = q.order_by(func.avg(PerformanceLog.duration_ms).desc())
    else:
        q = q.order_by(func.count(PerformanceLog.id).desc())
    rows = (await db.execute(q.limit(limit))).mappings().all()
    names = await _tenant_name_map(db, [r["tid"] for r in rows if r["tid"]])
    return [
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
    ]


async def get_user_usage(
    db: AsyncSession,
    tenant_id: str | None,
    from_date: datetime,
    to_date: datetime,
    order_by: Literal["calls", "tokens", "cost"],
    limit: int,
) -> list[dict[str, Any]]:
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
    if tenant_id:
        q = q.where(LLMUsageLog.tenant_id == tenant_id)

    q = q.group_by(LLMUsageLog.carmen_user_id)
    order_map = {
        "calls": func.count(LLMUsageLog.id).desc(),
        "tokens": func.sum(LLMUsageLog.total_tokens).desc(),
        "cost": func.sum(LLMUsageLog.cost_usd).desc(),
    }
    rows = (await db.execute(q.order_by(order_map[order_by]).limit(limit))).mappings().all()
    return [
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
    ]


async def get_error_breakdown(
    db: AsyncSession,
    group_by: Literal["module", "tenant", "endpoint"],
    period_hours: int,
    tenant_id: str | None,
    limit: int,
) -> list[dict[str, Any]]:
    since = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=period_hours)

    if group_by == "module":
        failed_count = func.sum(case((OCRTask.status == TaskStatus.FAILED, 1), else_=0))
        q = select(
            OCRTask.module_id.label("group"),
            func.count(OCRTask.id).label("total"),
            failed_count.label("errors"),
        ).where(OCRTask.created_at >= since)
        if tenant_id:
            q = q.where(OCRTask.tenant_id == tenant_id)
        rows = (
            (
                await db.execute(
                    q.group_by(OCRTask.module_id).order_by(failed_count.desc()).limit(limit)
                )
            )
            .mappings()
            .all()
        )
        return [
            {
                "group": r["group"],
                "total_tasks": int(r["total"] or 0),
                "errors": int(r["errors"] or 0),
                "error_rate_pct": round((r["errors"] or 0) / r["total"] * 100, 2)
                if r["total"]
                else 0,
            }
            for r in rows
        ]

    error_count = func.sum(case((PerformanceLog.status_code >= 500, 1), else_=0))
    group_col = PerformanceLog.tenant_id if group_by == "tenant" else PerformanceLog.endpoint
    q = select(
        group_col.label("group"),
        func.count(PerformanceLog.id).label("total"),
        error_count.label("errors"),
        func.avg(PerformanceLog.duration_ms).label("avg_latency"),
    ).where(PerformanceLog.created_at >= since)
    if tenant_id:
        q = q.where(PerformanceLog.tenant_id == tenant_id)
    if group_by == "tenant":
        q = q.where(PerformanceLog.tenant_id.isnot(None))
    rows = (
        (await db.execute(q.group_by(group_col).order_by(error_count.desc()).limit(limit)))
        .mappings()
        .all()
    )
    return [
        {
            "group": r["group"],
            "total_requests": int(r["total"] or 0),
            "errors": int(r["errors"] or 0),
            "error_rate_pct": round((r["errors"] or 0) / r["total"] * 100, 2) if r["total"] else 0,
            "avg_latency_ms": round(float(r["avg_latency"] or 0), 1),
        }
        for r in rows
    ]


async def _tenant_name_map(db: AsyncSession, tids: list[str]) -> dict[str, str]:
    if not tids:
        return {}
    result = await db.execute(
        select(Tenant.id, Tenant.name, Tenant.bu_code).where(
            Tenant.id.in_(tids), Tenant.deleted_at.is_(None)
        )
    )
    return {str(r.id): f"{r.name} ({r.bu_code})" for r in result.mappings().all()}
