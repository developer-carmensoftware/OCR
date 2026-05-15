"""
Summary Service — build nightly daily_usage_summary aggregates.

Aggregates ALL tenants × BUs × modules in one pass.
Unique key: (tenant_id, business_unit_id, module_id, summary_date).
UPSERT on duplicate — safe to re-run for the same date.
"""

import logging
from datetime import date, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.dialects.mysql import insert as mysql_insert

from app.database import async_session
from app.models.orm import DailyUsageSummary

logger = logging.getLogger(__name__)


async def build_daily_summary(target_date: date | None = None) -> dict:
    """
    Aggregate one day's data across all tenants/BUs/modules.
    Returns a summary dict for scheduler observability.
    """
    if target_date is None:
        target_date = (datetime.utcnow() - timedelta(days=1)).date()

    day_start = datetime.combine(target_date, datetime.min.time())
    day_end = day_start + timedelta(days=1)

    logger.info("[summary] Building daily summary for %s", target_date)

    try:
        async with async_session() as db:
            params = {"start": day_start, "end": day_end}
            rows = await _aggregate_all(db, params)

            if not rows:
                logger.info("[summary] No activity on %s — skipping", target_date)
                return {}

            for row in rows:
                row["summary_date"] = target_date
                stmt = (
                    mysql_insert(DailyUsageSummary)
                    .values(**row)
                    .on_duplicate_key_update(
                        **{
                            k: v
                            for k, v in row.items()
                            if k
                            not in ("tenant_id", "business_unit_id", "module_id", "summary_date")
                        }
                    )
                )
                await db.execute(stmt)
            await db.commit()
            logger.info("[summary] %d rows upserted for %s", len(rows), target_date)
            return {"rows_upserted": len(rows), "date": str(target_date)}

    except Exception as exc:
        logger.error("[summary] Failed for %s: %s", target_date, exc)
        raise


async def _aggregate_all(db, params: dict) -> list[dict]:
    """Return one dict per (tenant_id, business_unit_id, module_id) with all metrics."""

    # Documents per tenant × bu × module
    doc_result = await db.execute(
        text("""
        SELECT tenant_id, business_unit_id, module_id, COUNT(*) AS cnt
        FROM ocr_tasks
        WHERE created_at >= :start AND created_at < :end
          AND deleted_at IS NULL
        GROUP BY tenant_id, business_unit_id, module_id
    """),
        params,
    )
    doc_rows = {
        (r.tenant_id, r.business_unit_id, r.module_id): r.cnt
        for r in doc_result.mappings().fetchall()
    }

    # Submissions — credit cards
    cc_result = await db.execute(
        text("""
        SELECT t.tenant_id, t.business_unit_id, 'credit_card_ocr' AS module_id, COUNT(*) AS cnt
        FROM credit_cards c
        JOIN ocr_tasks t ON t.id = c.task_id
        WHERE c.submitted_at >= :start AND c.submitted_at < :end
          AND c.deleted_at IS NULL
        GROUP BY t.tenant_id, t.business_unit_id
    """),
        params,
    )
    # Submissions — AP invoices
    ap_result = await db.execute(
        text("""
        SELECT t.tenant_id, t.business_unit_id, 'ap_invoice' AS module_id, COUNT(*) AS cnt
        FROM ap_invoices a
        JOIN ocr_tasks t ON t.id = a.task_id
        WHERE a.submitted_at >= :start AND a.submitted_at < :end
          AND a.deleted_at IS NULL
        GROUP BY t.tenant_id, t.business_unit_id
    """),
        params,
    )
    sub_map: dict = {}
    for r in list(cc_result.mappings()) + list(ap_result.mappings()):
        sub_map[(r["tenant_id"], r["business_unit_id"], r["module_id"])] = r["cnt"]

    # LLM usage per tenant × bu × module
    llm_result = await db.execute(
        text("""
        SELECT
            tenant_id, business_unit_id, module_id,
            COUNT(*)                       AS total_llm_calls,
            COALESCE(SUM(total_tokens), 0) AS total_tokens,
            COALESCE(SUM(cost_usd), 0)     AS total_cost_usd,
            COALESCE(AVG(duration_ms), 0)  AS avg_llm_latency_ms
        FROM llm_usage_logs
        WHERE created_at >= :start AND created_at < :end
        GROUP BY tenant_id, business_unit_id, module_id
    """),
        params,
    )
    llm_map = {
        (r["tenant_id"], r["business_unit_id"], r["module_id"]): r
        for r in llm_result.mappings().fetchall()
    }

    # API performance per tenant × bu (no module dimension)
    perf_result = await db.execute(
        text("""
        SELECT
            tenant_id, business_unit_id,
            COUNT(*) AS total_api_calls,
            COALESCE(AVG(duration_ms), 0) AS avg_api_latency_ms,
            COALESCE(SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END), 0) AS total_errors
        FROM performance_logs
        WHERE created_at >= :start AND created_at < :end
        GROUP BY tenant_id, business_unit_id
    """),
        params,
    )
    perf_map = {
        (r["tenant_id"], r["business_unit_id"]): r for r in perf_result.mappings().fetchall()
    }

    # P95 latency per tenant × bu — single CTE replaces per-BU queries (N+1 fix)
    p95_result = await db.execute(
        text("""
        WITH ranked AS (
            SELECT tenant_id, business_unit_id, duration_ms,
                   PERCENT_RANK() OVER (
                       PARTITION BY tenant_id, business_unit_id
                       ORDER BY duration_ms
                   ) AS pct_rank
            FROM performance_logs
            WHERE created_at >= :start AND created_at < :end
        )
        SELECT tenant_id, business_unit_id, MIN(duration_ms) AS p95_ms
        FROM ranked
        WHERE pct_rank >= 0.95
        GROUP BY tenant_id, business_unit_id
    """),
        params,
    )
    p95_map = {
        (r["tenant_id"], r["business_unit_id"]): round(float(r["p95_ms"]), 2)
        for r in p95_result.mappings().fetchall()
    }

    # Corrections per tenant × bu
    corr_result = await db.execute(
        text("""
        SELECT tenant_id, business_unit_id, COUNT(*) AS cnt
        FROM correction_feedback
        WHERE created_at >= :start AND created_at < :end
          AND deleted_at IS NULL
        GROUP BY tenant_id, business_unit_id
    """),
        params,
    )
    corr_map = {
        (r["tenant_id"], r["business_unit_id"]): r["cnt"] for r in corr_result.mappings().fetchall()
    }

    # Outbound calls per tenant × bu
    out_result = await db.execute(
        text("""
        SELECT tenant_id, business_unit_id, COUNT(*) AS cnt
        FROM outbound_call_logs
        WHERE created_at >= :start AND created_at < :end
        GROUP BY tenant_id, business_unit_id
    """),
        params,
    )
    out_map = {
        (r["tenant_id"], r["business_unit_id"]): r["cnt"] for r in out_result.mappings().fetchall()
    }

    # Merge all dimensions into result rows
    all_keys: set = set(doc_rows.keys()) | set(llm_map.keys())
    results = []
    for tid, bid, mid in all_keys:
        if not tid:
            continue
        llm = llm_map.get((tid, bid, mid), {})
        perf = perf_map.get((tid, bid), {})
        results.append(
            {
                "tenant_id": tid,
                "business_unit_id": bid,
                "module_id": mid,
                "total_documents": doc_rows.get((tid, bid, mid), 0),
                "total_submissions": sub_map.get((tid, bid, mid), 0),
                "total_llm_calls": int(llm.get("total_llm_calls", 0)),
                "total_tokens": int(llm.get("total_tokens", 0)),
                "total_cost_usd": round(float(llm.get("total_cost_usd", 0)), 4),
                "avg_llm_latency_ms": round(float(llm.get("avg_llm_latency_ms", 0)), 2),
                "total_api_calls": int(perf.get("total_api_calls", 0)),
                "avg_api_latency_ms": round(float(perf.get("avg_api_latency_ms", 0)), 2),
                "p95_api_latency_ms": p95_map.get((tid, bid), 0.0),
                "total_errors": int(perf.get("total_errors", 0)),
                "total_corrections": corr_map.get((tid, bid), 0),
                "total_outbound_calls": out_map.get((tid, bid), 0),
            }
        )
    return results


async def backfill_summaries(from_date: date, to_date: date) -> int:
    """Rebuild summaries for a date range (inclusive). Returns days processed."""
    count = 0
    current = from_date
    while current <= to_date:
        await build_daily_summary(current)
        current += timedelta(days=1)
        count += 1
    return count
