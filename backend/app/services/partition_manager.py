"""
Partition Manager — quarterly partition maintenance for hot log tables.

PostgreSQL note:
  In the MariaDB era this module managed RANGE-by-TO_DAYS partitions via
  REORGANIZE PARTITION p_future. On Neon/Postgres we ship with flat (non-
  partitioned) tables to keep the schema simple and free-tier friendly.

  When traffic grows enough that the four log tables need to be partitioned,
  convert them to PostgreSQL native partitioning:
    CREATE TABLE llm_usage_logs_y2026q1 PARTITION OF llm_usage_logs
      FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
  and replace ensure_partitions() below with logic that introspects
  pg_inherits + pg_class to create the next quarter's partition.

Until then this is a no-op so the nightly scheduler can still call it safely.
"""

import logging

logger = logging.getLogger(__name__)


async def ensure_partitions() -> dict:
    """No-op on PostgreSQL — see module docstring for the upgrade path."""
    logger.debug("[partition] PostgreSQL flat tables — ensure_partitions is a no-op")
    return {}
