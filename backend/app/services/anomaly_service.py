"""
Anomaly Detection Service — runs nightly via the scheduler.

Checks three categories against 7-day rolling baselines from daily_usage_summary:
  1. cost_spike   — tenant's daily LLM cost > COST_SPIKE_MULTIPLIER × 7-day avg
  2. error_spike  — API error rate > ERROR_SPIKE_MULTIPLIER × 7-day avg
  3. quota_burn   — monthly_calls ≥ 80% (warn) or 100% (critical) of quota limit

Detected anomalies → anomaly_alerts. Duplicate open alerts are skipped.
"""

import logging
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import text

from app.database import async_session
from app.models.enums import AlertSeverity

logger = logging.getLogger(__name__)

COST_SPIKE_MULTIPLIER = 3.0
ERROR_SPIKE_MULTIPLIER = 3.0
ERROR_MIN_COUNT = 10
QUOTA_WARN_PCT = 0.80
QUOTA_CRITICAL_PCT = 1.00
BASELINE_DAYS = 7


async def detect_anomalies(target_date: date | None = None) -> dict:
    """Run all anomaly checks. Returns {check_name: alerts_created}."""
    if target_date is None:
        target_date = (datetime.utcnow() - timedelta(days=1)).date()
    logger.info("[anomaly] Checking anomalies for %s", target_date)
    results = {}
    try:
        results["cost_spike"] = await _check_cost_spike(target_date)
        results["error_spike"] = await _check_error_spike(target_date)
        results["quota_burn"] = await _check_quota_burn()
        logger.info("[anomaly] Done: %s", results)
    except Exception as exc:
        logger.error("[anomaly] Detection failed: %s", exc)
    return results


async def _check_cost_spike(target_date: date) -> int:
    baseline_start = target_date - timedelta(days=BASELINE_DAYS + 1)
    baseline_end = target_date - timedelta(days=1)
    alerts = 0

    async with async_session() as db:
        rows = await db.execute(
            text("""
            SELECT
                today.tenant_id, today.business_unit_id, today.module_id,
                today.total_cost_usd                        AS today_cost,
                AVG(base.total_cost_usd)                    AS avg_cost
            FROM daily_usage_summary today
            JOIN daily_usage_summary base
              ON  base.tenant_id        = today.tenant_id
              AND base.business_unit_id = today.business_unit_id
              AND base.module_id        = today.module_id
              AND DATE(base.summary_date) BETWEEN :base_start AND :base_end
            WHERE DATE(today.summary_date) = :target
              AND today.total_cost_usd > 0
            GROUP BY today.tenant_id, today.business_unit_id, today.module_id, today.total_cost_usd
            HAVING today.total_cost_usd > AVG(base.total_cost_usd) * :mult
        """),
            {
                "target": target_date,
                "base_start": baseline_start,
                "base_end": baseline_end,
                "mult": COST_SPIKE_MULTIPLIER,
            },
        )

        for r in rows.mappings().fetchall():
            tid, bid, mid = r["tenant_id"], r["business_unit_id"], r["module_id"]
            actual = Decimal(str(r["today_cost"]))
            threshold = Decimal(str(r["avg_cost"])) * Decimal(str(COST_SPIKE_MULTIPLIER))
            if await _alert_exists(db, tid, bid, "cost_spike"):
                continue
            await _insert_alert(
                db,
                tenant_id=tid,
                business_unit_id=bid,
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
        rows = await db.execute(
            text("""
            SELECT
                today.tenant_id, today.business_unit_id,
                today.total_errors     AS today_errors,
                today.total_api_calls  AS today_calls,
                AVG(base.total_errors)    AS avg_errors,
                AVG(base.total_api_calls) AS avg_calls
            FROM daily_usage_summary today
            JOIN daily_usage_summary base
              ON  base.tenant_id        = today.tenant_id
              AND base.business_unit_id = today.business_unit_id
              AND DATE(base.summary_date) BETWEEN :base_start AND :base_end
            WHERE DATE(today.summary_date) = :target
              AND today.total_errors >= :min_count
            GROUP BY today.tenant_id, today.business_unit_id,
                     today.total_errors, today.total_api_calls
        """),
            {
                "target": target_date,
                "base_start": baseline_start,
                "base_end": baseline_end,
                "min_count": ERROR_MIN_COUNT,
            },
        )

        for r in rows.mappings().fetchall():
            tid, bid = r["tenant_id"], r["business_unit_id"]
            today_rate = Decimal(str(r["today_errors"])) / Decimal(str(max(r["today_calls"], 1)))
            avg_rate = Decimal(str(r["avg_errors"])) / Decimal(str(max(r["avg_calls"], 1)))
            threshold = avg_rate * Decimal(str(ERROR_SPIKE_MULTIPLIER))
            if today_rate <= threshold:
                continue
            if await _alert_exists(db, tid, bid, "error_spike"):
                continue
            await _insert_alert(
                db,
                tenant_id=tid,
                business_unit_id=bid,
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


async def _check_quota_burn() -> int:
    alerts = 0
    async with async_session() as db:
        rows = await db.execute(
            text("""
            SELECT q.id, q.tenant_id, q.limit_value, q.soft_warn_pct,
                   COALESCE(qu.used, 0) AS used
            FROM quotas q
            LEFT JOIN quota_usage qu
              ON qu.quota_id = q.id
              AND qu.period_key = DATE_FORMAT(NOW(), '%Y-%m')
            WHERE q.period = 'monthly' AND q.metric = 'calls'
              AND q.deleted_at IS NULL
        """)
        )

        for r in rows.mappings().fetchall():
            tid = r["tenant_id"]
            used = float(r["used"])
            limit = float(r["limit_value"])
            if limit <= 0 or used < limit * QUOTA_WARN_PCT:
                continue
            pct = used / limit
            severity = AlertSeverity.CRITICAL if pct >= QUOTA_CRITICAL_PCT else AlertSeverity.WARN
            metric = "quota_exhausted" if pct >= QUOTA_CRITICAL_PCT else "quota_warning"
            if await _alert_exists(db, tid, None, metric):
                continue
            await _insert_alert(
                db,
                tenant_id=tid,
                business_unit_id=None,
                module_id=None,
                metric=metric,
                severity=severity,
                threshold=Decimal(str(limit * QUOTA_WARN_PCT)),
                actual=Decimal(str(used)),
                description=f"Monthly calls {used:.0f}/{limit:.0f} ({pct:.0%})",
            )
            alerts += 1
        await db.commit()
    return alerts


async def _alert_exists(db, tenant_id: str, _business_unit_id: str | None, metric: str) -> bool:
    result = await db.execute(
        text("""
        SELECT 1 FROM anomaly_alerts
        WHERE tenant_id = :tid AND metric = :metric AND resolved_at IS NULL
        LIMIT 1
    """),
        {"tid": tenant_id, "metric": metric},
    )
    return result.fetchone() is not None


async def _insert_alert(
    db,
    *,
    tenant_id,
    business_unit_id,
    module_id,
    metric,
    severity: AlertSeverity,
    threshold,
    actual,
    description,
) -> None:
    await db.execute(
        text("""
        INSERT INTO anomaly_alerts
            (tenant_id, business_unit_id, module_id, metric, severity,
             threshold, actual, description, created_at)
        VALUES
            (:tid, :bid, :mid, :metric, :severity, :threshold, :actual, :desc, NOW())
    """),
        {
            "tid": tenant_id,
            "bid": business_unit_id,
            "mid": module_id,
            "metric": metric,
            "severity": severity.value,
            "threshold": float(threshold),
            "actual": float(actual),
            "desc": description,
        },
    )
    logger.info(
        "[anomaly] Alert: tenant=%s metric=%s severity=%s actual=%s",
        tenant_id,
        metric,
        severity.value,
        actual,
    )
