"""
Summary Service — build nightly daily_usage_summary aggregates.

Aggregates ALL tenants × modules in one pass.
Unique key: (tenant_id, module_id, summary_date).
UPSERT on duplicate — safe to re-run for the same date.
"""

import logging
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database import async_session
from app.models.orm import DailyModelCost, DailyUsageSummary, MonthlyUsageSummary

logger = logging.getLogger(__name__)


async def build_daily_summary(target_date: date | None = None) -> dict:
    """
    Aggregate one day's data across all tenants/modules.
    Returns a summary dict for scheduler observability.
    """
    if target_date is None:
        target_date = (datetime.now(UTC) - timedelta(days=1)).date()

    day_start = datetime.combine(target_date, datetime.min.time(), tzinfo=UTC)
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
                update_cols = {
                    k: v
                    for k, v in row.items()
                    if k not in ("tenant_id", "module_id", "summary_date")
                }
                stmt = (
                    pg_insert(DailyUsageSummary)
                    .values(**row)
                    .on_conflict_do_update(
                        constraint="uq_summary_scope_module_date",
                        set_=update_cols,
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
    """Return one dict per (tenant_id, module_id) with all metrics."""

    # Documents per tenant × module
    doc_result = await db.execute(
        text("""
        SELECT tenant_id, module_id, COUNT(*) AS cnt
        FROM ocr_tasks
        WHERE created_at >= :start AND created_at < :end
          AND deleted_at IS NULL
        GROUP BY tenant_id, module_id
    """),
        params,
    )
    doc_rows = {(r.tenant_id, r.module_id): r.cnt for r in doc_result.mappings().fetchall()}

    # Submissions — credit cards
    cc_result = await db.execute(
        text("""
        SELECT t.tenant_id, 'credit_card_ocr' AS module_id, COUNT(*) AS cnt
        FROM credit_cards c
        JOIN ocr_tasks t ON t.id = c.task_id
        WHERE c.submitted_at >= :start AND c.submitted_at < :end
          AND c.deleted_at IS NULL
        GROUP BY t.tenant_id
    """),
        params,
    )
    # Submissions — AP invoices
    ap_result = await db.execute(
        text("""
        SELECT t.tenant_id, 'ap_invoice' AS module_id, COUNT(*) AS cnt
        FROM ap_invoices a
        JOIN ocr_tasks t ON t.id = a.task_id
        WHERE a.submitted_at >= :start AND a.submitted_at < :end
          AND a.deleted_at IS NULL
        GROUP BY t.tenant_id
    """),
        params,
    )
    sub_map: dict = {}
    for r in list(cc_result.mappings()) + list(ap_result.mappings()):
        sub_map[(r["tenant_id"], r["module_id"])] = r["cnt"]

    # LLM usage per tenant × module
    llm_result = await db.execute(
        text("""
        SELECT
            tenant_id, module_id,
            COUNT(*)                       AS total_llm_calls,
            COALESCE(SUM(total_tokens), 0) AS total_tokens,
            COALESCE(SUM(cost_usd), 0)     AS total_cost_usd,
            COALESCE(AVG(duration_ms), 0)  AS avg_llm_latency_ms
        FROM llm_usage_logs
        WHERE created_at >= :start AND created_at < :end
        GROUP BY tenant_id, module_id
    """),
        params,
    )
    llm_map = {(r["tenant_id"], r["module_id"]): r for r in llm_result.mappings().fetchall()}

    # API performance per tenant (no module dimension)
    perf_result = await db.execute(
        text("""
        SELECT
            tenant_id,
            COUNT(*) AS total_api_calls,
            COALESCE(AVG(duration_ms), 0) AS avg_api_latency_ms,
            COALESCE(SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END), 0) AS total_errors
        FROM performance_logs
        WHERE created_at >= :start AND created_at < :end
        GROUP BY tenant_id
    """),
        params,
    )
    perf_map = {r["tenant_id"]: r for r in perf_result.mappings().fetchall()}

    # P95 latency per tenant — single CTE replaces per-tenant queries (N+1 fix)
    p95_result = await db.execute(
        text("""
        WITH ranked AS (
            SELECT tenant_id, duration_ms,
                   PERCENT_RANK() OVER (
                       PARTITION BY tenant_id
                       ORDER BY duration_ms
                   ) AS pct_rank
            FROM performance_logs
            WHERE created_at >= :start AND created_at < :end
        )
        SELECT tenant_id, MIN(duration_ms) AS p95_ms
        FROM ranked
        WHERE pct_rank >= 0.95
        GROUP BY tenant_id
    """),
        params,
    )
    p95_map = {
        r["tenant_id"]: round(float(r["p95_ms"]), 2) for r in p95_result.mappings().fetchall()
    }

    # Corrections per tenant
    corr_result = await db.execute(
        text("""
        SELECT tenant_id, COUNT(*) AS cnt
        FROM correction_feedback
        WHERE created_at >= :start AND created_at < :end
          AND deleted_at IS NULL
        GROUP BY tenant_id
    """),
        params,
    )
    corr_map = {r["tenant_id"]: r["cnt"] for r in corr_result.mappings().fetchall()}

    # Outbound calls per tenant
    out_result = await db.execute(
        text("""
        SELECT tenant_id, COUNT(*) AS cnt
        FROM outbound_call_logs
        WHERE created_at >= :start AND created_at < :end
        GROUP BY tenant_id
    """),
        params,
    )
    out_map = {r["tenant_id"]: r["cnt"] for r in out_result.mappings().fetchall()}

    # Merge all dimensions into result rows
    all_keys: set = set(doc_rows.keys()) | set(llm_map.keys())
    results = []
    for tid, mid in all_keys:
        if not tid:
            continue
        llm = llm_map.get((tid, mid), {})
        perf = perf_map.get(tid, {})
        results.append(
            {
                "tenant_id": tid,
                "module_id": mid,
                "total_documents": doc_rows.get((tid, mid), 0),
                "total_submissions": sub_map.get((tid, mid), 0),
                "total_llm_calls": int(llm.get("total_llm_calls", 0)),
                "total_tokens": int(llm.get("total_tokens", 0)),
                "total_cost_usd": round(float(llm.get("total_cost_usd", 0)), 4),
                "avg_llm_latency_ms": round(float(llm.get("avg_llm_latency_ms", 0)), 2),
                "total_api_calls": int(perf.get("total_api_calls", 0)),
                "avg_api_latency_ms": round(float(perf.get("avg_api_latency_ms", 0)), 2),
                "p95_api_latency_ms": p95_map.get(tid, 0.0),
                "total_errors": int(perf.get("total_errors", 0)),
                "total_corrections": corr_map.get(tid, 0),
                "total_outbound_calls": out_map.get(tid, 0),
            }
        )
    return results


async def build_daily_model_cost(target_date: date | None = None) -> dict:
    """
    Aggregate llm_usage_logs by (tenant, module, model) for one day and
    UPSERT into daily_model_cost. Used for per-model cost analytics — kept
    indefinitely, while raw llm_usage_logs partitions are dropped after 12 months.
    """
    if target_date is None:
        target_date = (datetime.now(UTC) - timedelta(days=1)).date()

    day_start = datetime.combine(target_date, datetime.min.time(), tzinfo=UTC)
    day_end = day_start + timedelta(days=1)

    logger.info("[model_cost] Building model-cost breakdown for %s", target_date)

    async with async_session() as db:
        result = await db.execute(
            text("""
                SELECT
                    tenant_id,
                    module_id,
                    model AS model_name,
                    COUNT(*)                            AS call_count,
                    COALESCE(SUM(prompt_tokens), 0)     AS input_tokens,
                    COALESCE(SUM(completion_tokens), 0) AS output_tokens,
                    COALESCE(SUM(cost_usd), 0)          AS cost_usd
                FROM llm_usage_logs
                WHERE created_at >= :start AND created_at < :end
                  AND tenant_id IS NOT NULL
                GROUP BY tenant_id, module_id, model
            """),
            {"start": day_start, "end": day_end},
        )
        rows = result.mappings().fetchall()

        if not rows:
            logger.info("[model_cost] No LLM activity on %s — skipping", target_date)
            return {}

        for row in rows:
            values: dict[str, object] = {
                "tenant_id": row["tenant_id"],
                "module_id": row["module_id"],
                "model_name": row["model_name"],
                "summary_date": target_date,
                "call_count": int(row["call_count"] or 0),
                "input_tokens": int(row["input_tokens"] or 0),
                "output_tokens": int(row["output_tokens"] or 0),
                "cost_usd": float(row["cost_usd"] or 0),
            }
            update_cols = {
                "call_count": values["call_count"],
                "input_tokens": values["input_tokens"],
                "output_tokens": values["output_tokens"],
                "cost_usd": values["cost_usd"],
            }
            stmt = (
                pg_insert(DailyModelCost)
                .values(**values)
                .on_conflict_do_update(
                    constraint="uq_daily_model_cost",
                    set_=update_cols,
                )
            )
            await db.execute(stmt)
        await db.commit()
        logger.info("[model_cost] %d rows upserted for %s", len(rows), target_date)
        return {"rows_upserted": len(rows), "date": str(target_date)}


async def build_monthly_summary(target_date: date | None = None) -> dict:
    """
    Roll up daily_usage_summary rows into monthly_usage_summary.

    Defaults to the month of `target_date` (or yesterday's month). Always
    re-aggregates the entire month so partial days that arrived late are
    captured. Idempotent: ON CONFLICT UPDATE replaces the existing row.
    """
    if target_date is None:
        target_date = (datetime.now(UTC) - timedelta(days=1)).date()

    month_start = target_date.replace(day=1)
    next_month_year = month_start.year + (1 if month_start.month == 12 else 0)
    next_month = (month_start.month % 12) + 1
    next_month_start = date(next_month_year, next_month, 1)

    logger.info("[monthly_summary] Rolling up %s", month_start.strftime("%Y-%m"))

    async with async_session() as db:
        result = await db.execute(
            text("""
                SELECT
                    tenant_id,
                    module_id,
                    COALESCE(SUM(total_documents), 0)      AS total_documents,
                    COALESCE(SUM(total_submissions), 0)    AS total_submissions,
                    COALESCE(SUM(total_llm_calls), 0)      AS total_llm_calls,
                    COALESCE(SUM(total_tokens), 0)         AS total_tokens,
                    COALESCE(SUM(total_cost_usd), 0)       AS total_cost_usd,
                    COALESCE(AVG(avg_llm_latency_ms), 0)   AS avg_llm_latency_ms,
                    COALESCE(SUM(total_api_calls), 0)      AS total_api_calls,
                    COALESCE(AVG(avg_api_latency_ms), 0)   AS avg_api_latency_ms,
                    COALESCE(MAX(p95_api_latency_ms), 0)   AS p95_api_latency_ms,
                    COALESCE(SUM(total_errors), 0)         AS total_errors,
                    COALESCE(SUM(total_corrections), 0)    AS total_corrections,
                    COALESCE(SUM(total_outbound_calls), 0) AS total_outbound_calls
                FROM daily_usage_summary
                WHERE summary_date >= :start AND summary_date < :end
                GROUP BY tenant_id, module_id
            """),
            {"start": month_start, "end": next_month_start},
        )
        rows = result.mappings().fetchall()

        if not rows:
            logger.info("[monthly_summary] No daily rows in %s — skipping", month_start)
            return {}

        metric_cols = (
            "total_documents",
            "total_submissions",
            "total_llm_calls",
            "total_tokens",
            "total_cost_usd",
            "avg_llm_latency_ms",
            "total_api_calls",
            "avg_api_latency_ms",
            "p95_api_latency_ms",
            "total_errors",
            "total_corrections",
            "total_outbound_calls",
        )
        for row in rows:
            values: dict[str, object] = {
                "tenant_id": row["tenant_id"],
                "module_id": row["module_id"],
                "summary_date": month_start,
            }
            for col in metric_cols:
                values[col] = row[col]
            update_cols = {col: values[col] for col in metric_cols}
            stmt = (
                pg_insert(MonthlyUsageSummary)
                .values(**values)
                .on_conflict_do_update(
                    constraint="uq_monthly_summary_scope",
                    set_=update_cols,
                )
            )
            await db.execute(stmt)
        await db.commit()
        logger.info("[monthly_summary] %d rows upserted for %s", len(rows), month_start)
        return {"rows_upserted": len(rows), "month": month_start.strftime("%Y-%m")}


async def backfill_summaries(from_date: date, to_date: date) -> int:
    """Rebuild summaries for a date range (inclusive). Returns days processed."""
    count = 0
    current = from_date
    while current <= to_date:
        await build_daily_summary(current)
        current += timedelta(days=1)
        count += 1
    return count
