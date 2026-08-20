import logging
import re
import time
import uuid

from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.context import (
    current_carmen_uri,
    current_carmen_user_id,
    current_document_ref,
    current_request_id,
    current_tenant_id,
)
from app.database import async_session
from app.models.orm import PerformanceLog

logger = logging.getLogger(__name__)

_SKIP_PATHS = {"/", "/docs", "/openapi.json", "/redoc", "/api/v1/health", "/api/version"}
_REF_PATTERN = re.compile(
    r"/(?:task|credit-card|correction|feedback|ap-invoice|tasks|credit-cards)/([a-zA-Z0-9_\-]+)"
)

# ── Performance log buffer ────────────────────────────────────────────────────
# Requests append here; a background task (main.py) flushes every 10 seconds.
# Reduces per-request DB writes from O(n requests) → O(1 batch per 10s).
_PERF_BUFFER: list[dict] = []
_FLUSH_SIZE = 500  # also flush immediately when buffer reaches this size
# Hard cap — if flushes keep failing (e.g. DB down), drop the oldest rows
# rather than letting the buffer grow until the worker OOMs.
_BUFFER_HARD_CAP = 5000


async def flush_perf_buffer() -> None:
    """Batch-insert buffered performance log rows. Called by the background flush task."""
    if not _PERF_BUFFER:
        return
    # Snapshot and clear atomically (safe in single-threaded asyncio — no await between the two)
    batch, _PERF_BUFFER[:] = _PERF_BUFFER[:], []
    try:
        async with async_session() as db:
            db.add_all([PerformanceLog(**row) for row in batch])
            await db.commit()
    except Exception as exc:
        logger.error("flush_perf_buffer failed (dropped %d rows): %s", len(batch), exc)


def _decode_jwt_claims(request: Request) -> dict:
    """Decode JWT payload without DB — never raises. Returns {} on failure."""
    try:
        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer "):
            return {}
        from app.config import settings

        claims = jwt.decode(auth[7:], settings.ocr_jwt_secret, algorithms=["HS256"])
        return claims if isinstance(claims, dict) else {}
    except (JWTError, Exception):
        return {}


class PerformanceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        current_request_id.set(request_id)

        if request.url.path in _SKIP_PATHS:
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response

        claims = _decode_jwt_claims(request)
        tenant_id = claims.get("tid", "")
        carmen_user_id = claims.get("cuid", "")
        carmen_uri_val = claims.get("carmen_uri", "")

        current_tenant_id.set(tenant_id)
        current_carmen_user_id.set(carmen_user_id)
        current_carmen_uri.set(carmen_uri_val)

        match = _REF_PATTERN.search(request.url.path)
        doc_ref = match.group(1) if match else None
        if doc_ref:
            current_document_ref.set(doc_ref)
            request.state.document_ref = doc_ref

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        final_doc_ref = getattr(request.state, "document_ref", doc_ref)

        _PERF_BUFFER.append(
            {
                "tenant_id": tenant_id or None,
                "endpoint": request.url.path,
                "method": request.method,
                "duration_ms": duration_ms,
                "status_code": response.status_code,
                "carmen_user_id": carmen_user_id or None,
                "resource_id": final_doc_ref,
            }
        )
        # If flushes have been failing (DB outage etc.), trim oldest rows so we
        # never grow past _BUFFER_HARD_CAP. Losing the oldest perf data beats
        # OOM-ing the worker.
        overflow = len(_PERF_BUFFER) - _BUFFER_HARD_CAP
        if overflow > 0:
            del _PERF_BUFFER[:overflow]
            logger.warning("perf buffer over cap — dropped %d oldest rows", overflow)
        if len(_PERF_BUFFER) >= _FLUSH_SIZE:
            import asyncio

            asyncio.ensure_future(flush_perf_buffer())

        response.headers["X-Response-Time-Ms"] = f"{duration_ms:.1f}"
        response.headers["X-Request-ID"] = request_id
        return response
