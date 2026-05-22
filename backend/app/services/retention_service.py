"""
Retention Service — archive old log rows to CSV, then delete from DB.

Runs nightly via the scheduler in main.py.
Each table has a configured retention period; rows older than that are:
  1. Exported to CSV in {archive_dir}/{table}/YYYY-MM.csv (append-mode)
  2. Deleted in small batches to avoid long table locks.
"""

import csv
import io
import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path

import aiofiles
from sqlalchemy import text

from app.config import settings
from app.database import async_session

logger = logging.getLogger(__name__)

# (table_name, retention_days, columns_to_archive)
RETENTION_POLICY: list[tuple[str, int, list[str]]] = [
    (
        "performance_logs",
        90,
        [
            "id",
            "tenant_id",
            "business_unit_id",
            "endpoint",
            "method",
            "duration_ms",
            "status_code",
            "carmen_user_id",
            "resource_id",
            "created_at",
        ],
    ),
    (
        "outbound_call_logs",
        90,
        [
            "id",
            "tenant_id",
            "business_unit_id",
            "service",
            "url",
            "method",
            "status_code",
            "duration_ms",
            "request_size_bytes",
            "session_id",
            "carmen_user_id",
            "created_at",
        ],
    ),
    (
        "llm_usage_logs",
        365,
        [
            "id",
            "tenant_id",
            "business_unit_id",
            "task_id",
            "module_id",
            "carmen_session_id",
            "carmen_user_id",
            "model",
            "prompt_tokens",
            "completion_tokens",
            "total_tokens",
            "duration_ms",
            "cost_usd",
            "created_at",
        ],
    ),
    (
        "audit_logs",
        365,
        [
            "id",
            "tenant_id",
            "business_unit_id",
            "admin_user_id",
            "carmen_user_id",
            "username",
            "session_id",
            "ip_address",
            "action",
            "resource",
            "resource_id",
            "created_at",
        ],
    ),
]

SESSION_INACTIVE_PURGE_DAYS = 30
_BATCH_SIZE = 5000


async def archive_and_cleanup() -> dict:
    """Archive + delete old rows for all tables in RETENTION_POLICY."""
    if not settings.retention_enabled:
        logger.info("[retention] Disabled — skipping")
        return {}

    summary = {}
    archive_base = Path(settings.archive_dir)

    for table, retention_days, columns in RETENTION_POLICY:
        cutoff = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=retention_days)
        try:
            result = await _process_table(table, cutoff, columns, archive_base)
            summary[table] = result
            if result["archived"] > 0:
                logger.info(
                    "[retention] %s: archived=%d deleted=%d (cutoff=%s)",
                    table,
                    result["archived"],
                    result["deleted"],
                    cutoff.date(),
                )
        except Exception as exc:
            logger.error("[retention] %s FAILED: %s", table, exc)
            summary[table] = {"archived": 0, "deleted": 0, "error": str(exc)}

    return summary


async def _process_table(
    table: str,
    cutoff: datetime,
    columns: list[str],
    archive_base: Path,
) -> dict:
    col_list = ", ".join(columns)
    archived = 0
    deleted = 0

    async with async_session() as db:
        count_result = await db.execute(
            text(f"SELECT COUNT(*) FROM {table} WHERE created_at < :cutoff"),
            {"cutoff": cutoff},
        )
        total = count_result.scalar() or 0
        if total == 0:
            return {"archived": 0, "deleted": 0}

        logger.info("[retention] %s: %d rows older than %s", table, total, cutoff.date())

        result = await db.execute(
            text(f"SELECT {col_list} FROM {table} WHERE created_at < :cutoff ORDER BY id"),
            {"cutoff": cutoff},
        )
        rows = result.fetchall()
        if not rows:
            return {"archived": 0, "deleted": 0}

        # Group by month and write CSVs
        month_groups: dict[str, list] = {}
        for row in rows:
            row_dict = dict(zip(columns, row))
            created = row_dict.get("created_at")
            month_key = created.strftime("%Y-%m") if isinstance(created, datetime) else "unknown"
            month_groups.setdefault(month_key, []).append(row_dict)

        table_dir = archive_base / table
        table_dir.mkdir(parents=True, exist_ok=True)

        for month_key, month_rows in month_groups.items():
            csv_path = table_dir / f"{month_key}.csv"
            file_exists = csv_path.exists()
            # Build CSV content in memory, then write async to avoid blocking the event loop
            buf = io.StringIO()
            writer = csv.DictWriter(buf, fieldnames=columns)
            if not file_exists:
                writer.writeheader()
            for row_dict in month_rows:
                for k, v in row_dict.items():
                    if isinstance(v, datetime):
                        row_dict[k] = v.isoformat()
                writer.writerow(row_dict)
            async with aiofiles.open(csv_path, "a", encoding="utf-8") as f:
                await f.write(buf.getvalue())
            archived += len(month_rows)

        # Delete in batches
        min_id = rows[0][0]
        max_id = rows[-1][0]
        while True:
            del_result = await db.execute(
                text(
                    f"DELETE FROM {table} WHERE id IN ("
                    f"  SELECT id FROM {table}"
                    f"  WHERE id >= :min_id AND id <= :max_id AND created_at < :cutoff"
                    f"  LIMIT :batch"
                    f")"
                ),
                {"min_id": min_id, "max_id": max_id, "cutoff": cutoff, "batch": _BATCH_SIZE},
            )
            await db.commit()
            deleted += del_result.rowcount
            if del_result.rowcount < _BATCH_SIZE:
                break

    return {"archived": archived, "deleted": deleted}


async def purge_inactive_sessions() -> int:
    """Delete inactive ocr_sessions older than SESSION_INACTIVE_PURGE_DAYS days."""
    cutoff = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=SESSION_INACTIVE_PURGE_DAYS)
    deleted = 0
    async with async_session() as db:
        while True:
            result = await db.execute(
                text(
                    "DELETE FROM ocr_sessions WHERE id IN ("
                    "  SELECT id FROM ocr_sessions"
                    "  WHERE is_active = false AND last_used_at < :cutoff"
                    "  LIMIT :batch"
                    ")"
                ),
                {"cutoff": cutoff, "batch": _BATCH_SIZE},
            )
            await db.commit()
            deleted += result.rowcount
            if result.rowcount < _BATCH_SIZE:
                break
    if deleted:
        logger.info("[retention] ocr_sessions: purged %d inactive sessions", deleted)
    return deleted
