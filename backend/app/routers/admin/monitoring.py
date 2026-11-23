"""Admin monitoring endpoints — alerts, jobs, performance logs, DB pool."""

import logging
from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.database import get_db
from app.models.enums import JobStatus
from app.models.observability import AnomalyAlert, JobRun, PerformanceLog
from app.services.shared.tenant_lookup import tenant_name_map
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


@router.get("/jobs/overview")
async def jobs_overview(
    window: Literal["24h", "7d", "30d"] = Query("24h"),
    db: AsyncSession = Depends(get_db),
    _admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    """Catalog of scheduled jobs: schedule, type, run stats for given window (24h/7d/30d), and last execution details."""
    # 1. Known jobs metadata dictionary (Static catalog + types)
    catalog = {
        "pms-process": {
            "title": "PMS Processing Sweep",
            "category": "business",
            "type": "http",
            "description": "Picks up parked/received PMS hotel night audit days and posts to Carmen GL.",
            "default_schedule": "*/10 * * * *",
        },
        "email-ingest": {
            "title": "Email Mailbox Ingest",
            "category": "business",
            "type": "http",
            "description": "Polls configured mailboxes for AP invoices and hotel slips to OCR.",
            "default_schedule": "*/10 * * * *",
        },
        "email-confirm": {
            "title": "Email Confirmation Sweep",
            "category": "business",
            "type": "http",
            "description": "Confirms and cleans up processed email tags awaiting verification.",
            "default_schedule": "* * * * *",
        },
        "email-token-health": {
            "title": "Email Token Health Check",
            "category": "integration",
            "type": "http",
            "description": "Checks and refreshes tenant mailbox OAuth tokens.",
            "default_schedule": "15 2 * * *",
        },
        "email-mailbox-purge": {
            "title": "Email Mailbox Purge",
            "category": "maintenance",
            "type": "http",
            "description": "Purges expired raw email contents from storage.",
            "default_schedule": "0 4 * * *",
        },
        "daily-summary": {
            "title": "Daily Usage Summary",
            "category": "analytics",
            "type": "sql",
            "description": "Aggregates tenant OCR usage, document counts, and submission totals.",
            "default_schedule": "17 1 * * *",
        },
        "daily-model-cost": {
            "title": "Daily Model Cost",
            "category": "analytics",
            "type": "sql",
            "description": "Aggregates daily LLM token consumption and cost per model.",
            "default_schedule": "22 1 * * *",
        },
        "monthly-summary": {
            "title": "Monthly Usage Summary",
            "category": "analytics",
            "type": "sql",
            "description": "Aggregates monthly tenant usage breakdown.",
            "default_schedule": "32 1 1 * *",
        },
        "session-purge": {
            "title": "Session Purge",
            "category": "maintenance",
            "type": "sql",
            "description": "Scrubs inactive sessions and expired JWT tokens.",
            "default_schedule": "0 19 * * *",
        },
        "partman-maintain": {
            "title": "pg_partman Maintenance",
            "category": "maintenance",
            "type": "procedure",
            "description": "Maintains Postgres log partitions ahead of time.",
            "default_schedule": "23 2 * * *",
        },
        "hold-expired-orders": {
            "title": "Hold Expired Credit Orders",
            "category": "business",
            "type": "sql",
            "description": "Puts overdue credit top-up orders on hold.",
            "default_schedule": "7 * * * *",
        },
        "lapse-subscriptions": {
            "title": "Lapse Expired Subscriptions",
            "category": "business",
            "type": "sql",
            "description": "Lapses tenant subscriptions that exceeded grace periods.",
            "default_schedule": "12 0 * * *",
        },
        "anomaly-detection": {
            "title": "Anomaly Detection Sweep",
            "category": "analytics",
            "type": "http",
            "description": "Detects abnormal token spikes, cost jumps, and error rates.",
            "default_schedule": "40 1 * * *",
        },
        "pricing-sync": {
            "title": "LLM Pricing Sync",
            "category": "integration",
            "type": "http",
            "description": "Syncs latest model pricing from OpenRouter API.",
            "default_schedule": "0 */8 * * *",
        },
        "keep-warm": {
            "title": "Backend Keep-warm",
            "category": "maintenance",
            "type": "http",
            "description": "Sends health-check ping every 10 minutes to prevent cold starts.",
            "default_schedule": "*/10 * * * *",
        },
        "carmen-webhook-push": {
            "title": "Carmen Webhook Push",
            "category": "integration",
            "type": "http",
            "description": "Pushes queued document events to Carmen ERP webhooks.",
            "default_schedule": "* * * * *",
        },
        "cron-history-purge": {
            "title": "Cron History Purge",
            "category": "maintenance",
            "type": "sql",
            "description": "Prunes old pg_cron and pg_net job run details.",
            "default_schedule": "40 3 * * *",
        },
        "email-documents-purge": {
            "title": "Email Documents Retention Purge",
            "category": "maintenance",
            "type": "sql",
            "description": "Deletes old processed email documents per retention policy.",
            "default_schedule": "50 3 * * *",
        },
        "scrub-old-filenames": {
            "title": "Scrub Old Filenames",
            "category": "maintenance",
            "type": "sql",
            "description": "Blanks filenames older than 12 months for data privacy.",
            "default_schedule": "20 4 * * *",
        },
        "pms-events-scrub": {
            "title": "PMS Events Scrub",
            "category": "maintenance",
            "type": "sql",
            "description": "Scrubs reviewer and error text in PMS audit events older than 90 days.",
            "default_schedule": "55 3 * * *",
        },
    }

    # 2. Query pg_cron if available (with latest scheduler firing details)
    pg_cron_jobs = {}
    try:
        res = await db.execute(
            text(
                "select j.jobname, j.schedule, j.active, j.command,"
                " max(d.start_time) as last_fired_at,"
                " (array_agg(d.status order by d.start_time desc))[1] as last_fired_status"
                " from cron.job j"
                " left join cron.job_run_details d on d.jobid = j.jobid"
                " group by j.jobname, j.schedule, j.active, j.command"
            )
        )
        for r in res.mappings().all():
            pg_cron_jobs[r["jobname"]] = {
                "schedule": r["schedule"],
                "active": r["active"],
                "command": r["command"],
                "last_fired_at": r["last_fired_at"].isoformat() if r["last_fired_at"] else None,
                "last_fired_status": r["last_fired_status"],
            }
    except Exception as exc:  # noqa: BLE001
        logger.info("[admin] pg_cron not available: %s", exc)

    # 3. Aggregated window stats from job_runs
    delta = (
        timedelta(hours=24)
        if window == "24h"
        else timedelta(days=7)
        if window == "7d"
        else timedelta(days=30)
    )
    since = datetime.now(UTC) - delta
    stats_query = await db.execute(
        select(
            JobRun.job_name,
            func.count().label("total_runs"),
            func.count().filter(JobRun.status == JobStatus.SUCCESS).label("success_runs"),
            func.count().filter(JobRun.status == JobStatus.FAILED).label("failed_runs"),
            func.max(JobRun.started_at).label("last_started_at"),
        )
        .where(JobRun.started_at >= since)
        .group_by(JobRun.job_name)
    )
    stats_map = {r.job_name: r for r in stats_query.all()}

    # 4. Fetch the absolute last run per job (even if older than the window)
    latest_runs_subq = (
        select(
            JobRun.job_name,
            func.max(JobRun.started_at).label("max_started_at"),
        )
        .group_by(JobRun.job_name)
        .subquery()
    )
    latest_runs_query = await db.execute(
        select(JobRun).join(
            latest_runs_subq,
            (JobRun.job_name == latest_runs_subq.c.job_name)
            & (JobRun.started_at == latest_runs_subq.c.max_started_at),
        )
    )
    latest_run_map = {r.job_name: r for r in latest_runs_query.scalars().all()}

    # 5. Merge all unique job names
    all_job_names = sorted(
        set(catalog.keys()) | set(pg_cron_jobs.keys()) | set(latest_run_map.keys())
    )

    jobs = []
    total_runs = 0
    total_failed = 0

    for name in all_job_names:
        meta = catalog.get(
            name,
            {
                "title": name.replace("-", " ").title(),
                "category": "other",
                "type": "unknown",
                "description": "Background scheduled job",
                "default_schedule": "—",
            },
        )
        cron_info = pg_cron_jobs.get(name)
        stat = stats_map.get(name)
        last_run = latest_run_map.get(name)

        # Compute effective job health status
        # If the last recorded job_run was failed, but it occurred before the selected window
        # AND pg_cron scheduler has since been firing successfully (or job is idle),
        # don't flag the entire job as currently failing.
        is_currently_failing = False
        if last_run and last_run.status == JobStatus.FAILED:
            # Check if this failure happened within the current window
            if stat and stat.failed_runs > 0:
                is_currently_failing = True
            elif cron_info and cron_info.get("last_fired_status") == "failed":
                is_currently_failing = True
            elif not cron_info and last_run.started_at >= since:
                is_currently_failing = True

        runs_count = stat.total_runs if stat else 0
        success_count = stat.success_runs if stat else 0
        failed_count = stat.failed_runs if stat else 0

        total_runs += runs_count
        total_failed += failed_count

        # Check if last_run is stale (older than current window)
        is_stale_run = last_run and last_run.started_at < since

        jobs.append(
            {
                "job_name": name,
                "title": meta["title"],
                "category": meta["category"],
                "type": meta["type"],
                "description": meta["description"],
                "schedule": cron_info["schedule"] if cron_info else meta["default_schedule"],
                "active": cron_info["active"] if cron_info else True,
                "is_failing": is_currently_failing,
                "scheduler_heartbeat": {
                    "last_fired_at": cron_info.get("last_fired_at") if cron_info else None,
                    "status": cron_info.get("last_fired_status") if cron_info else None,
                },
                "stats": {
                    "total_runs": runs_count,
                    "success_runs": success_count,
                    "failed_runs": failed_count,
                },
                # Backward-compat alias:
                "stats_24h": {
                    "total_runs": runs_count,
                    "success_runs": success_count,
                    "failed_runs": failed_count,
                },
                "last_run": {
                    "id": last_run.id,
                    "status": last_run.status.value if last_run.status else None,
                    "started_at": last_run.started_at.isoformat() if last_run.started_at else None,
                    "completed_at": last_run.completed_at.isoformat()
                    if last_run.completed_at
                    else None,
                    "duration_s": round(
                        (last_run.completed_at - last_run.started_at).total_seconds(), 2
                    )
                    if last_run.completed_at and last_run.started_at
                    else None,
                    "rows_affected": last_run.rows_affected,
                    "error_message": last_run.error_message,
                    "is_stale": is_stale_run,
                }
                if last_run
                else None,
            }
        )

    return {
        "window": window,
        "summary": {
            "total_jobs": len(jobs),
            "healthy_jobs": sum(1 for j in jobs if not j["is_failing"]),
            "failing_jobs": sum(1 for j in jobs if j["is_failing"]),
            "total_runs": total_runs,
            "failed_runs": total_failed,
            # Backward-compat aliases:
            "total_runs_24h": total_runs,
            "failed_runs_24h": total_failed,
        },
        "jobs": jobs,
    }


@router.post("/jobs/{job_name}/run")
async def trigger_job_run(
    job_name: str,
    db: AsyncSession = Depends(get_db),
    _admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    """Manually trigger a background job execution."""
    if job_name == "pms-process":
        from app.services.pms import process

        result = await process.run_pms_processing()
        return {"job_name": job_name, "status": "executed", "result": result}

    if job_name == "email-ingest":
        from app.services.email_automation import ingest

        result = await ingest.poll_mailbox()
        return {"job_name": job_name, "status": "executed", "result": result}

    if job_name == "email-confirm":
        from app.services.email_automation import ingest

        result = await ingest.sweep_confirmations()
        return {"job_name": job_name, "status": "executed", "result": result}

    if job_name == "daily-summary":
        res = await db.execute(text("select fn_build_daily_summary()"))
        await db.commit()
        return {"job_name": job_name, "status": "executed", "rows": res.scalar()}

    if job_name == "daily-model-cost":
        res = await db.execute(text("select fn_build_daily_model_cost()"))
        await db.commit()
        return {"job_name": job_name, "status": "executed", "rows": res.scalar()}

    if job_name == "session-purge":
        res = await db.execute(text("select fn_purge_inactive_sessions()"))
        await db.commit()
        return {"job_name": job_name, "status": "executed", "rows": res.scalar()}

    if job_name == "partman-maintain":
        await db.execute(text("call partman.run_maintenance_proc()"))
        await db.commit()
        return {"job_name": job_name, "status": "executed"}

    if job_name == "hold-expired-orders":
        res = await db.execute(text("select fn_hold_expired_orders()"))
        await db.commit()
        return {"job_name": job_name, "status": "executed", "rows": res.scalar()}

    if job_name == "lapse-subscriptions":
        res = await db.execute(text("select fn_lapse_expired_subscriptions()"))
        await db.commit()
        return {"job_name": job_name, "status": "executed", "rows": res.scalar()}

    if job_name == "anomaly-alerts-purge":
        res = await db.execute(text("select fn_purge_resolved_alerts()"))
        await db.commit()
        return {"job_name": job_name, "status": "executed", "rows": res.scalar()}

    if job_name == "scrub-old-filenames":
        res = await db.execute(text("select fn_scrub_old_filenames()"))
        await db.commit()
        return {"job_name": job_name, "status": "executed", "rows": res.scalar()}

    if job_name == "pms-events-scrub":
        res = await db.execute(text("select fn_scrub_old_pms_events()"))
        await db.commit()
        return {"job_name": job_name, "status": "executed", "rows": res.scalar()}

    raise HTTPException(status_code=400, detail=f"Manual execution for {job_name} is not supported")


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
