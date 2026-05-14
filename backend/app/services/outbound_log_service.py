"""
Outbound Call Log Service — records every HTTP call to external services.

Proves that data only leaves via approved destinations:
  openrouter.ai  — LLM vision + suggestion calls
  *.carmenwork.com — Carmen ERP proxy calls
"""

import logging
from typing import Optional

from app.database import async_session
from app.models.orm import OutboundCallLog
from app.context import current_ocr_session_id, current_carmen_user_id, current_tenant_id, current_business_unit_id

logger = logging.getLogger(__name__)


async def log_outbound(
    service: str,
    url: str,
    method: str = "POST",
    status_code: Optional[int] = None,
    duration_ms: Optional[float] = None,
    request_size_bytes: Optional[int] = None,
) -> None:
    """Persist one outbound-call record. Reads context vars — never raises."""
    try:
        async with async_session() as db:
            db.add(OutboundCallLog(
                tenant_id=current_tenant_id.get() or None,
                business_unit_id=current_business_unit_id.get() or None,
                service=service,
                url=url,
                method=method,
                status_code=status_code,
                duration_ms=duration_ms,
                request_size_bytes=request_size_bytes,
                session_id=current_ocr_session_id.get() or None,
                carmen_user_id=current_carmen_user_id.get() or None,
            ))
            await db.commit()
    except Exception as exc:
        logger.error("outbound_log_service.log_outbound failed: %s", exc)
