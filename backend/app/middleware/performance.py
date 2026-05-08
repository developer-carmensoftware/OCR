import logging
import time
import re

from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.database import async_session
from app.models.orm import PerformanceLog
from app.context import current_tenant, current_user_id, current_document_ref, current_carmen_uri, current_bu, current_host


logger = logging.getLogger(__name__)

_SKIP_PATHS = {"/", "/docs", "/openapi.json", "/redoc", "/api/v1/ocr/health", "/api/version"}

# Regex to find task_id or doc_no in common API paths
_REF_PATTERN = re.compile(r"/(?:task|receipt|credit-card|correction|feedback|ap-invoice|tasks|receipts|credit-cards)/([a-zA-Z0-9_\-]+)")


def _user_id_from_request(request: Request) -> str | None:
    """Decode user_id from JWT without DB lookup — lightweight, never raises."""
    try:
        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer "):
            return None
        from app.config import settings
        payload = jwt.decode(auth[7:], settings.ocr_jwt_secret, algorithms=["HS256"])
        return payload.get("user_id")
    except (JWTError, Exception):
        return None


def _context_from_jwt(request: Request) -> tuple[str, str, str]:
    """
    Extract (bu, host, carmen_uri) from the JWT Bearer token.
    bu        = business unit (used as tenant identifier)
    host      = hostname of the Carmen instance (e.g. 'ostin.carmenwork.com')
    carmen_uri = full origin URI (e.g. 'https://ostin.carmenwork.com')
    """
    from app.config import settings
    from urllib.parse import urlparse
    try:
        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer "):
            return "", "", ""
        payload = jwt.decode(auth[7:], settings.ocr_jwt_secret, algorithms=["HS256"])
        bu = (payload.get("bu") or "").strip()
        carmen_uri = payload.get("carmen_uri") or ""
        host = urlparse(carmen_uri).hostname or "" if carmen_uri else ""
        return bu, host, carmen_uri
    except (JWTError, Exception):
        return "", "", ""


class PerformanceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in _SKIP_PATHS:
            return await call_next(request)

        # 1. Initialize context early
        bu, host, carmen_uri = _context_from_jwt(request)
        user_id = _user_id_from_request(request)

        current_bu.set(bu)
        current_host.set(host)
        current_carmen_uri.set(carmen_uri)
        current_tenant.set(bu)   # tenant = bu for backward compat with any remaining callers
        current_user_id.set(user_id or "")

        # 2. Try to guess document_ref from path
        match = _REF_PATTERN.search(request.url.path)
        doc_ref = match.group(1) if match else None
        if doc_ref:
            current_document_ref.set(doc_ref)
            request.state.document_ref = doc_ref

        start = time.perf_counter()
        
        # BaseHTTPMiddleware starts a new context for call_next, so ContextVar changes 
        # inside routes won't be seen here. We use request.state to pass data back.
        response = await call_next(request)
        
        duration_ms = (time.perf_counter() - start) * 1000

        # Read potentially updated doc_ref from request.state
        final_doc_ref = getattr(request.state, "document_ref", doc_ref)

        import asyncio
        asyncio.ensure_future(_persist(
            endpoint=request.url.path,
            method=request.method,
            duration_ms=duration_ms,
            status_code=response.status_code,
            user_id=user_id,
            document_ref=final_doc_ref,
        ))

        response.headers["X-Response-Time-Ms"] = f"{duration_ms:.1f}"
        return response


async def _persist(
    endpoint: str,
    method: str,
    duration_ms: float,
    status_code: int,
    user_id: str | None,
    document_ref: str | None,
) -> None:
    try:
        async with async_session() as db:
            db.add(PerformanceLog(
                endpoint=endpoint,
                method=method,
                duration_ms=duration_ms,
                status_code=status_code,
                user_id=user_id,
                document_ref=document_ref,
            ))
            await db.commit()
    except Exception as exc:
        logger.error("PerformanceMiddleware._persist failed: %s", exc)
