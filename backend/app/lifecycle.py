"""App lifespan — startup/shutdown and background tasks."""

import asyncio
import logging
from contextlib import asynccontextmanager

from app.config import settings
from app.database import ensure_db
from app.sentry import capture

logger = logging.getLogger(__name__)


async def _perf_flush_loop() -> None:
    """Flush buffered performance / outbound / audit log rows every 10 seconds."""
    from app.middleware.performance import flush_perf_buffer
    from app.services.audit_service import flush_audit_buffer
    from app.services.outbound_log_service import flush_outbound_buffer

    async def _drain_all() -> None:
        await flush_perf_buffer()
        await flush_outbound_buffer()
        await flush_audit_buffer()

    while True:
        try:
            await asyncio.sleep(10)
            await _drain_all()
        except asyncio.CancelledError:
            await _drain_all()
            break
        except Exception as exc:
            logger.error("[perf_flush] Error: %s", exc)
            capture(exc)


@asynccontextmanager
async def lifespan(_app):
    logger.info("Starting AI OCR Bank Receipt Backend...")
    logger.info("   OCR Model  : %s", settings.openrouter_ocr_model)
    logger.info("   Sugg Model : %s", settings.openrouter_suggestion_model)
    logger.info(
        "   OpenRouter : %s",
        "Configured" if settings.openrouter_api_key else "Not set",
    )
    from app.database import _db_root_url

    logger.info("   Database   : %s", _db_root_url())

    await ensure_db()
    logger.info("Database initialized")

    perf_flush_task = asyncio.create_task(_perf_flush_loop())

    yield

    grace = settings.shutdown_grace_seconds
    if grace > 0:
        logger.info("Graceful shutdown — waiting %ds for in-flight requests...", grace)
        await asyncio.sleep(grace)

    perf_flush_task.cancel()
    try:
        await asyncio.gather(perf_flush_task)
    except asyncio.CancelledError:
        pass

    from app.services.carmen_service import close_client as _close_carmen

    try:
        await _close_carmen()
    except Exception as exc:
        logger.warning("Carmen client close failed: %s", exc)

    logger.info("Shutting down AI OCR Backend")
