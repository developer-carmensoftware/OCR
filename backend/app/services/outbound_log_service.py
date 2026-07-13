"""
Outbound Call Log Service — records every HTTP call to external services.

Proves that data only leaves via approved destinations:
  openrouter.ai  — LLM vision + suggestion calls
  *.carmenwork.com — Carmen ERP proxy calls

Writes are buffered and flushed every 10s (via main.py background task) so a
burst of LLM/Carmen calls doesn't translate to a 1:1 burst of DB INSERTs.
"""

import logging

from app.context import (
    current_carmen_user_id,
    current_ocr_session_id,
    current_tenant_id,
)
from app.database import async_session
from app.models.orm import OutboundCallLog

logger = logging.getLogger(__name__)

# ── Buffered write queue ──────────────────────────────────────────────────────
# Under 16 concurrent LLM calls, every call wrote 1 row + commit. The buffer
# coalesces these into a single batch insert every 10s.
_OUTBOUND_BUFFER: list[dict] = []
_FLUSH_SIZE = 500  # also flush immediately when buffer reaches this size
# Hard cap so a DB outage doesn't OOM the worker — drop oldest rows instead.
_BUFFER_HARD_CAP = 5000


async def flush_outbound_buffer() -> None:
    """Batch-insert buffered outbound log rows. Called by the background flush task."""
    if not _OUTBOUND_BUFFER:
        return
    # Snapshot + clear atomically (safe in single-threaded asyncio — no await between)
    batch, _OUTBOUND_BUFFER[:] = _OUTBOUND_BUFFER[:], []
    try:
        async with async_session() as db:
            db.add_all([OutboundCallLog(**row) for row in batch])
            await db.commit()
    except Exception as exc:
        logger.error("flush_outbound_buffer failed (dropped %d rows): %s", len(batch), exc)


async def log_outbound(
    service: str,
    url: str,
    method: str = "POST",
    status_code: int | None = None,
    duration_ms: float | None = None,
    request_size_bytes: int | None = None,
    provider: str | None = None,
    data_policy: str | None = None,
) -> None:
    """Buffer one outbound-call record. Reads context vars — never raises.

    `provider`/`data_policy` carry LLM routing evidence (which provider OpenRouter
    routed to + the privacy directive we sent); null for non-LLM (Carmen) calls.
    """
    try:
        _OUTBOUND_BUFFER.append(
            {
                "tenant_id": current_tenant_id.get() or None,
                "service": service,
                "url": url,
                "method": method,
                "status_code": status_code,
                "duration_ms": duration_ms,
                "request_size_bytes": request_size_bytes,
                "session_id": current_ocr_session_id.get() or None,
                "carmen_user_id": current_carmen_user_id.get() or None,
                "provider": provider,
                "data_policy": data_policy,
            }
        )
        overflow = len(_OUTBOUND_BUFFER) - _BUFFER_HARD_CAP
        if overflow > 0:
            del _OUTBOUND_BUFFER[:overflow]
            logger.warning("outbound buffer over cap — dropped %d oldest rows", overflow)
        if len(_OUTBOUND_BUFFER) >= _FLUSH_SIZE:
            import asyncio

            asyncio.ensure_future(flush_outbound_buffer())
    except Exception as exc:
        logger.error("outbound_log_service.log_outbound failed: %s", exc)
