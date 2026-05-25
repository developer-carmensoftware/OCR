"""
Retention Service — session cleanup.

purge_inactive_sessions() hard-deletes ocr_sessions that have been inactive
for more than SESSION_INACTIVE_PURGE_DAYS days. Called nightly by the scheduler.

Log table retention (llm_usage_logs, audit_logs, etc.) is handled by a separate
export script when needed — no automatic deletion.
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import text

from app.database import async_session

logger = logging.getLogger(__name__)

SESSION_INACTIVE_PURGE_DAYS = 30
_BATCH_SIZE = 5000


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
