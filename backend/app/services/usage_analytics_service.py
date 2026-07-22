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
from app.models.observability import LLMUsageLog, PerformanceLog
from app.services.tenant_lookup import tenant_name_map


async def get_usage_summary(
    db: AsyncSession,
    from_date: date,
    to_date: date,
    tenant_id: str | None,
    module_id: str | None,
) -> dict[str, Any]:
    from_dt = datetime.combine(from_date, time_type.min, tzinfo=UTC)
    to_dt = datetime.combine(to_date, time_type.max, tzinfo=UTC)

    q = (
        select(
            cast(LLMUsageLog.created_at, SADate).label("summary_date"),
            LLMUsageLog.module_id,
            LLMUsageLog.tenant_id,
            func.count(LLMUsageLog.id).label("llm_calls"),
            # Extract and suggest both carry this module_id, so the total above answers
            # "what did we pay for" but not "how much did they actually use". Split it.
            func.sum(case((LLMUsageLog.call_type == "extract", 1), else_=0)).label("extract_calls"),
            func.sum(case((LLMUsageLog.call_type == "suggest", 1), else_=0)).label("suggest_calls"),
            func.sum(LLMUsageLog.total_tokens).label("tokens"),
            func.sum(LLMUsageLog.cost_usd).label("cost_usd"),
            # Extract only: averaging a 5-12s vision call with a fast text suggestion
            # produces a number that describes neither.
            func.avg(case((LLMUsageLog.call_type == "extract", LLMUsageLog.duration_ms))).label(
                "avg_llm_latency_ms"
            ),
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
    names = await tenant_name_map(db, [r["tenant_id"] for r in rows])

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
                "tenant_name": names.get(r["tenant_id"]) if r["tenant_id"] else None,
                "documents": task_stats_map.get(
                    (str(r["summary_date"]), r["module_id"], str(r["tenant_id"])), (0, 0)
                )[0],
                "submissions": sub_stats_map.get(
                    (str(r["summary_date"]), r["module_id"], str(r["tenant_id"])), 0
                ),
                "llm_calls": int(r["llm_calls"] or 0),
                "extract_calls": int(r["extract_calls"] or 0),
                "suggest_calls": int(r["suggest_calls"] or 0),
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
    from_dt = datetime.combine(from_date, time_type.min, tzinfo=UTC)
    to_dt = datetime.combine(to_date, time_type.max, tzinfo=UTC)

    llm_q = select(
        func.count(LLMUsageLog.id).label("total_llm_calls"),
        func.sum(case((LLMUsageLog.call_type == "extract", 1), else_=0)).label(
            "total_extract_calls"
        ),
        func.sum(case((LLMUsageLog.call_type == "suggest", 1), else_=0)).label(
            "total_suggest_calls"
        ),
        func.sum(LLMUsageLog.total_tokens).label("total_tokens"),
        func.sum(LLMUsageLog.cost_usd).label("total_cost_usd"),
        # Extract only — see get_usage_summary.
        func.avg(case((LLMUsageLog.call_type == "extract", LLMUsageLog.duration_ms))).label(
            "avg_llm_latency_ms"
        ),
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
        "extract_calls": int(llm_row.get("total_extract_calls") or 0),
        "suggest_calls": int(llm_row.get("total_suggest_calls") or 0),
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
    names = await tenant_name_map(db, [r.tenant_id for r in rows])

    return [
        {
            "id": r.id,
            "tenant_id": r.tenant_id,
            "tenant_name": names.get(r.tenant_id) if r.tenant_id else None,
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
    tenant_id: str | None = None,
) -> list[dict[str, Any]]:
    # `tenant_id` scopes the ranking to a single tenant. A non-global admin must pass
    # their own scope here so this cross-tenant comparison can't leak other tenants'
    # error rate / latency / cost / volume to them.
    since = datetime.now(UTC) - timedelta(hours=period_hours)

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
        if tenant_id:
            q = q.where(LLMUsageLog.tenant_id == tenant_id)
        rows = (await db.execute(q)).mappings().all()
        names = await tenant_name_map(db, [r["tid"] for r in rows if r["tid"]])
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
    if tenant_id:
        q = q.where(PerformanceLog.tenant_id == tenant_id)
    if metric == "error_rate":
        q = q.order_by((error_count / func.count(PerformanceLog.id)).desc())
    elif metric == "latency":
        q = q.order_by(func.avg(PerformanceLog.duration_ms).desc())
    else:
        q = q.order_by(func.count(PerformanceLog.id).desc())
    rows = (await db.execute(q.limit(limit))).mappings().all()
    names = await tenant_name_map(db, [r["tid"] for r in rows if r["tid"]])
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
    since = datetime.now(UTC) - timedelta(hours=period_hours)

    if group_by == "module":
        failed_count = func.sum(case((OCRTask.status == TaskStatus.FAILED, 1), else_=0))
        q = select(
            OCRTask.module_id.label("group"),
            func.count(OCRTask.id).label("total"),
            failed_count.label("errors"),
        ).where(OCRTask.created_at >= since, OCRTask.deleted_at.is_(None))
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
    names = await tenant_name_map(db, [r["group"] for r in rows]) if group_by == "tenant" else {}
    return [
        {
            "group": r["group"],
            "group_label": names.get(r["group"]) if group_by == "tenant" else None,
            "total_requests": int(r["total"] or 0),
            "errors": int(r["errors"] or 0),
            "error_rate_pct": round((r["errors"] or 0) / r["total"] * 100, 2) if r["total"] else 0,
            "avg_latency_ms": round(float(r["avg_latency"] or 0), 1),
        }
        for r in rows
    ]


async def get_extraction_failures(
    db: AsyncSession,
    from_date: date,
    to_date: date,
    tenant_id: str | None,
    module_id: str | None,
    limit: int,
) -> dict[str, Any]:
    """Failed OCRTask rows with their error_message, plus LLM stats when the call
    reached the model.

    get_error_breakdown answers "how many failed"; this answers "why, and whose".
    Scope: post-charge failures only. A PDF rejected by ensure_pdf_openable never
    gets an OCRTask row at all (routers/ocr.py Phase 1 runs before create_task) —
    those surface as 400s under Performance, not here.
    """
    from_dt = datetime.combine(from_date, time_type.min, tzinfo=UTC)
    to_dt = datetime.combine(to_date, time_type.max, tzinfo=UTC)

    q = (
        select(OCRTask)
        .where(
            OCRTask.status == TaskStatus.FAILED,
            OCRTask.deleted_at.is_(None),
            OCRTask.created_at >= from_dt,
            OCRTask.created_at <= to_dt,
        )
        .order_by(OCRTask.created_at.desc())
        .limit(limit)
    )
    if tenant_id:
        q = q.where(OCRTask.tenant_id == tenant_id)
    if module_id:
        q = q.where(OCRTask.module_id == module_id)
    tasks = (await db.execute(q)).scalars().all()
    if not tasks:
        return {"total": 0, "data": []}

    # LLM stats are fetched separately and merged in Python rather than joined:
    # llm_usage_logs.task_id is VARCHAR(36) against a PGUUID, is unindexed, and the
    # table is partitioned — a cast-join is a hash join across every partition in
    # range that cannot be pushed below the LIMIT. The IN list is bounded by `limit`.
    # (Same merge-in-Python shape as task_stats_map in get_usage_summary.)
    task_ids = [str(t.id) for t in tasks]
    llm_q = (
        select(
            LLMUsageLog.task_id.label("tid"),
            func.count(LLMUsageLog.id).label("llm_calls"),
            func.sum(LLMUsageLog.total_tokens).label("total_tokens"),
            func.sum(LLMUsageLog.duration_ms).label("duration_ms"),
            func.max(LLMUsageLog.model).label("model"),
        )
        .where(
            LLMUsageLog.task_id.in_(task_ids),
            # Prune partitions. Padded by a day because a task created at 23:59 logs
            # its usage after midnight.
            LLMUsageLog.created_at >= from_dt - timedelta(days=1),
            LLMUsageLog.created_at <= to_dt + timedelta(days=1),
        )
        .group_by(LLMUsageLog.task_id)
    )
    llm_map = {
        r["tid"]: (
            int(r["llm_calls"]),
            int(r["total_tokens"] or 0),
            float(r["duration_ms"] or 0),
            r["model"],
        )
        for r in (await db.execute(llm_q)).mappings().all()
    }

    names = await tenant_name_map(db, [str(t.tenant_id) for t in tasks])

    data = []
    for t in tasks:
        tid = str(t.id)
        # Absent from llm_map => the model was never called (e.g. the file blew up in
        # post-processing). That is NOT the same as a call returning 0 tokens, which
        # is the signature of a truncated response — keep them distinguishable.
        llm = llm_map.get(tid)
        data.append(
            {
                "id": tid,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "tenant_id": str(t.tenant_id),
                "tenant_name": names.get(str(t.tenant_id)),
                "module_id": t.module_id,
                "original_filename": t.original_filename,
                "error_message": t.error_message,
                "carmen_user_id": t.carmen_user_id,
                "llm_calls": llm[0] if llm else None,
                "total_tokens": llm[1] if llm else None,
                "duration_ms": round(llm[2], 1) if llm else None,
                "model": llm[3] if llm else None,
            }
        )
    return {"total": len(data), "data": data}


async def get_tenant_engagement_map(
    db: AsyncSession, tenant_uuids: list, today: date | None = None
) -> dict[str, dict[str, Any]]:
    """Per-tenant task aggregates + posted_to_carmen, in one bulk pass.

    Tenants with no tasks are absent from the map — callers default to zeros. That
    absence IS the "logged in but never extracted" signal.

    All week/day bucketing is pinned to UTC explicitly: the pool's checkout listener
    (database.py) sets statement_timeout but NOT timezone, so a bare
    date_trunc('week', <timestamptz>) resolves in whatever session TZ the pooler
    hands us and would not be reproducible against db/queries.sql.
    """
    if not tenant_uuids:
        return {}
    today = today or datetime.now(UTC).date()
    created_utc = OCRTask.created_at.op("AT TIME ZONE")("UTC")

    task_q = (
        select(
            OCRTask.tenant_id.label("tid"),
            func.count(OCRTask.id).label("tried"),
            func.sum(case((OCRTask.status == TaskStatus.COMPLETED, 1), else_=0)).label("ok"),
            func.sum(case((OCRTask.status == TaskStatus.FAILED, 1), else_=0)).label("failed"),
            func.count(func.distinct(OCRTask.carmen_user_id)).label("users"),
            func.count(func.distinct(cast(created_utc, SADate))).label("active_days"),
            func.count(func.distinct(func.date_trunc("week", created_utc))).label("active_weeks"),
            func.min(cast(created_utc, SADate)).label("first_use"),
            func.max(cast(created_utc, SADate)).label("last_use"),
            func.sum(case((OCRTask.module_id == "credit_card_ocr", 1), else_=0)).label("cc"),
            func.sum(case((OCRTask.module_id == "ap_invoice", 1), else_=0)).label("ap"),
        )
        .where(OCRTask.tenant_id.in_(tenant_uuids), OCRTask.deleted_at.is_(None))
        .group_by(OCRTask.tenant_id)
    )

    # posted_to_carmen: submissions live in two tables. Summed in Python rather than
    # UNION'd — same shape as sub_stats_map in get_usage_summary, minus its join to
    # OCRTask (that join only exists there to recover module_id, which a per-tenant
    # total does not need).
    posted: dict[str, int] = {}
    for model in (CreditCard, APInvoice):
        sub_q = (
            select(model.tenant_id.label("tid"), func.count(model.id).label("n"))
            .where(
                model.tenant_id.in_(tenant_uuids),
                model.submitted_at.isnot(None),
                model.deleted_at.is_(None),
            )
            .group_by(model.tenant_id)
        )
        for r in (await db.execute(sub_q)).mappings().all():
            key = str(r["tid"])
            posted[key] = posted.get(key, 0) + int(r["n"])

    out: dict[str, dict[str, Any]] = {}
    for r in (await db.execute(task_q)).mappings().all():
        key = str(r["tid"])
        last_use = r["last_use"]
        out[key] = {
            "tried": int(r["tried"]),
            "ok": int(r["ok"] or 0),
            "failed": int(r["failed"] or 0),
            "posted_to_carmen": posted.get(key, 0),
            "users": int(r["users"] or 0),
            "active_days": int(r["active_days"] or 0),
            "active_weeks": int(r["active_weeks"] or 0),
            "first_use": str(r["first_use"]) if r["first_use"] else None,
            "last_use": str(last_use) if last_use else None,
            "days_idle": (today - last_use).days if last_use else None,
            "credit_card": int(r["cc"] or 0),
            "ap_invoice": int(r["ap"] or 0),
        }
    return out
