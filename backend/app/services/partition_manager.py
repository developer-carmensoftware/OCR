"""
Partition Manager — auto-create quarterly partitions for hot log tables.

Runs monthly via the scheduler in main.py (once per tenant).
Ensures partitions exist for the current quarter and the next one.
"""

import logging
from datetime import datetime

from sqlalchemy import text

from app.database import async_session

logger = logging.getLogger(__name__)

_PARTITIONED_TABLES = ["performance_logs", "outbound_call_logs"]


def _quarter_boundaries(dt: datetime) -> list[tuple[str, str]]:
    year = dt.year
    quarter = (dt.month - 1) // 3 + 1
    partitions = []
    for i in range(3):
        q, y = quarter + i, year
        while q > 4:
            q -= 4
            y += 1
        next_q, next_y = q + 1, y
        if next_q > 4:
            next_q, next_y = 1, y + 1
        boundary = f"{next_y}-{next_q * 3 - 2:02d}-01"
        partitions.append((f"p{y}q{q}", boundary))
    return partitions


async def ensure_partitions() -> dict:
    """
    Check each partitioned table and create missing quarterly partitions.
    Operates on the current tenant's DB via context-aware async_session().
    """
    now = datetime.utcnow()
    needed = _quarter_boundaries(now)
    results: dict[str, list] = {}

    async with async_session() as db:
        for table in _PARTITIONED_TABLES:
            created: list[str] = []
            try:
                part_result = await db.execute(
                    text("""
                    SELECT PARTITION_NAME
                    FROM INFORMATION_SCHEMA.PARTITIONS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = :table
                      AND PARTITION_NAME IS NOT NULL
                """),
                    {"table": table},
                )
                existing = {row[0] for row in part_result.fetchall()}

                if not existing:
                    logger.debug("[partition] %s not partitioned — skipping", table)
                    results[table] = []
                    continue

                for part_name, boundary in needed:
                    if part_name in existing:
                        continue
                    if "p_future" not in existing:
                        logger.warning(
                            "[partition] %s: p_future missing — cannot reorganize", table
                        )
                        break
                    await db.execute(
                        text(f"""
                        ALTER TABLE {table}
                        REORGANIZE PARTITION p_future INTO (
                            PARTITION {part_name} VALUES LESS THAN (TO_DAYS('{boundary}')),
                            PARTITION p_future VALUES LESS THAN MAXVALUE
                        )
                    """)
                    )
                    created.append(part_name)
                    existing.add(part_name)
                    logger.info(
                        "[partition] %s: created %s (boundary=%s)", table, part_name, boundary
                    )

            except Exception as exc:
                logger.error("[partition] %s failed: %s", table, exc)

            results[table] = created

    return results
