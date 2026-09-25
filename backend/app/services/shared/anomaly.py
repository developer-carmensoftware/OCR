"""
Anomaly Detection Service — runs nightly via the scheduler.

Checks two categories against 7-day rolling baselines from daily_usage_summary:
  1. cost_spike   — tenant's daily LLM cost > COST_SPIKE_MULTIPLIER × 7-day avg
  2. error_spike  — API error rate > ERROR_SPIKE_MULTIPLIER × 7-day avg

A third check, quota_burn, was removed with the free-trial quota it read
(migration 20260813000100); it had queried `period='monthly'` rules that stopped
existing at migration 215, so it had been silently returning zero long before.
"Who is near the wall" now reads `#/admin/quota-modules`.

Detected anomalies → anomaly_alerts. Duplicate open alerts are skipped.
"""

import logging
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import aliased

from app.database import async_session
from app.models.enums import AlertSeverity
from app.models.orm import AnomalyAlert, DailyUsageSummary

logger = logging.getLogger(__name__)

COST_SPIKE_MULTIPLIER = 3.0
ERROR_SPIKE_MULTIPLIER = 3.0
ERROR_MIN_COUNT = 10
BASELINE_DAYS = 7


async def detect_anomalies(target_date: date | None = None) -> dict:
    """Run all anomaly checks. Returns {check_name: alerts_created}."""
    if target_date is None:
        target_date = (datetime.now(UTC) - timedelta(days=1)).date()
    logger.info("[anomaly] Checking anomalies for %s", target_date)
    results = {}
    try:
        results["cost_spike"] = await _check_cost_spike(target_date)
        results["error_spike"] = await _check_error_spike(target_date)
        logger.info("[anomaly] Done: %s", results)
    except Exception as exc:
        logger.error("[anomaly] Detection failed: %s", exc)
    return results


async def _check_cost_spike(target_date: date) -> int:
    baseline_start = target_date - timedelta(days=BASELINE_DAYS + 1)
    baseline_end = target_date - timedelta(days=1)
    alerts = 0

    async with async_session() as db:
        base = aliased(DailyUsageSummary, name="base")
        today = aliased(DailyUsageSummary, name="today")

        stmt = (
            select(
                today.tenant_id,
                today.module_id,
                today.total_cost_usd.label("today_cost"),
                func.avg(base.total_cost_usd).label("avg_cost"),
            )
            .join(
                base,
                (base.tenant_id == today.tenant_id)
                & (base.module_id == today.module_id)
                & (func.date(base.summary_date).between(baseline_start, baseline_end)),
            )
            .where(func.date(today.summary_date) == target_date, today.total_cost_usd > 0)
            .group_by(today.tenant_id, today.module_id, today.total_cost_usd)
            .having(today.total_cost_usd > func.avg(base.total_cost_usd) * COST_SPIKE_MULTIPLIER)
        )

        rows = await db.execute(stmt)

        for r in rows.all():
            tid, mid = r.tenant_id, r.module_id
            actual = Decimal(str(r.today_cost))
            threshold = Decimal(str(r.avg_cost)) * Decimal(str(COST_SPIKE_MULTIPLIER))
            if await _alert_exists(db, tid, "cost_spike"):
                continue
            await _insert_alert(
                db,
                tenant_id=tid,
                module_id=mid,
                metric="cost_spike",
                severity=AlertSeverity.WARN,
                threshold=threshold,
                actual=actual,
                description=(
                    f"Daily LLM cost ${actual:.4f} exceeds "
                    f"{COST_SPIKE_MULTIPLIER}× 7-day avg ${threshold:.4f}"
                ),
            )
            alerts += 1
        await db.commit()
    return alerts


async def _check_error_spike(target_date: date) -> int:
    baseline_start = target_date - timedelta(days=BASELINE_DAYS + 1)
    baseline_end = target_date - timedelta(days=1)
    alerts = 0

    async with async_session() as db:
        base = aliased(DailyUsageSummary, name="base")
        today = aliased(DailyUsageSummary, name="today")

        stmt = (
            select(
                today.tenant_id,
                today.total_errors.label("today_errors"),
                today.total_api_calls.label("today_calls"),
                func.avg(base.total_errors).label("avg_errors"),
                func.avg(base.total_api_calls).label("avg_calls"),
            )
            .join(
                base,
                (base.tenant_id == today.tenant_id)
                & (func.date(base.summary_date).between(baseline_start, baseline_end)),
            )
            .where(
                func.date(today.summary_date) == target_date, today.total_errors >= ERROR_MIN_COUNT
            )
            .group_by(today.tenant_id, today.total_errors, today.total_api_calls)
        )

        rows = await db.execute(stmt)

        for r in rows.all():
            tid = r.tenant_id
            today_rate = Decimal(str(r.today_errors)) / Decimal(str(max(r.today_calls, 1)))
            avg_rate = Decimal(str(r.avg_errors)) / Decimal(str(max(r.avg_calls, 1)))
            threshold = avg_rate * Decimal(str(ERROR_SPIKE_MULTIPLIER))
            if today_rate <= threshold:
                continue
            if await _alert_exists(db, tid, "error_spike"):
                continue
            await _insert_alert(
                db,
                tenant_id=tid,
                module_id=None,
                metric="error_spike",
                severity=AlertSeverity.WARN,
                threshold=threshold,
                actual=today_rate,
                description=(
                    f"API error rate {today_rate:.1%} exceeds "
                    f"{ERROR_SPIKE_MULTIPLIER}× 7-day avg {avg_rate:.1%}"
                ),
            )
            alerts += 1
        await db.commit()
    return alerts


async def _alert_exists(db, tenant_id: str, metric: str) -> bool:
    stmt = (
        select(1)
        .select_from(AnomalyAlert)
        .where(
            AnomalyAlert.tenant_id == tenant_id,
            AnomalyAlert.metric == metric,
            AnomalyAlert.resolved_at.is_(None),
        )
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar() is not None


async def _insert_alert(
    db,
    *,
    tenant_id,
    module_id,
    metric,
    severity: AlertSeverity,
    threshold,
    actual,
    description,
) -> None:
    alert = AnomalyAlert(
        tenant_id=tenant_id,
        module_id=module_id,
        metric=metric,
        severity=severity,
        threshold=threshold,
        actual=actual,
        description=description,
    )
    db.add(alert)
    logger.info(
        "[anomaly] Alert: tenant=%s metric=%s severity=%s actual=%s",
        tenant_id,
        metric,
        severity.value,
        actual,
    )


async def open_alert_if_absent(
    *,
    tenant_id: str,
    module_id: str | None,
    metric: str,
    severity: AlertSeverity,
    description: str,
    actual=None,
) -> None:
    """Raise one anomaly alert if no open alert for (tenant_id, metric) already exists.

    For callers OUTSIDE the nightly job (e.g. the LLM routing guard) that need to open a
    deduped alert on the spot. Opens its own session, commits, and never raises —
    alerting must not break the caller.
    """
    try:
        async with async_session() as db:
            if await _alert_exists(db, tenant_id, metric):
                return
            await _insert_alert(
                db,
                tenant_id=tenant_id,
                module_id=module_id,
                metric=metric,
                severity=severity,
                threshold=None,
                actual=actual,
                description=description,
            )
            await db.commit()
    except Exception as exc:
        logger.error("open_alert_if_absent failed (metric=%s): %s", metric, exc)
