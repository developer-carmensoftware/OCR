"""
Scheduled background jobs — started once at application lifespan.

Each job is a long-running coroutine that loops indefinitely until cancelled.
Pattern: run immediately on first iteration, then sleep until next cycle.
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, or_

logger = logging.getLogger(__name__)


async def pricing_sync_loop() -> None:
    """Sync OpenRouter model pricing every 8 hours."""
    from app.services.usage_service import fetch_openrouter_pricing

    while True:
        try:
            await fetch_openrouter_pricing()
            await asyncio.sleep(8 * 3600)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("[pricing_sync] %s", exc)
            await asyncio.sleep(3600)  # retry in 1h on failure


async def session_cleanup_loop() -> None:
    """Hard-delete expired OCR sessions across all tenants every hour.

    Replaces the per-tenant cleanup that previously ran inside `/auth/exchange`
    so login is not blocked by a growing per-tenant scan.
    """
    from app.config import settings
    from app.database import async_session
    from app.models.orm import OcrSession

    while True:
        try:
            cutoff = datetime.now(UTC).replace(tzinfo=None) - timedelta(
                hours=settings.session_ttl_hours
            )
            async with async_session() as db:
                result = await db.execute(
                    delete(OcrSession).where(
                        or_(OcrSession.created_at < cutoff, OcrSession.is_active.is_(False))
                    )
                )
                await db.commit()
                if result.rowcount:
                    logger.info("[session_cleanup] removed %d stale sessions", result.rowcount)
            await asyncio.sleep(3600)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("[session_cleanup] %s", exc)
            await asyncio.sleep(600)
