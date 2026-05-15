import logging
import re
import time

from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.context import (
    current_business_unit_id,
    current_carmen_uri,
    current_carmen_user_id,
    current_document_ref,
    current_tenant_id,
)
from app.database import async_session
from app.models.orm import PerformanceLog

logger = logging.getLogger(__name__)

_SKIP_PATHS = {"/", "/docs", "/openapi.json", "/redoc", "/api/v1/ocr/health", "/api/version"}
_REF_PATTERN = re.compile(
    r"/(?:task|credit-card|correction|feedback|ap-invoice|tasks|credit-cards)/([a-zA-Z0-9_\-]+)"
)


def _decode_jwt_claims(request: Request) -> dict:
    """Decode JWT payload without DB — never raises. Returns {} on failure."""
    try:
        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer "):
            return {}
        from app.config import settings

        return jwt.decode(auth[7:], settings.ocr_jwt_secret, algorithms=["HS256"])
    except (JWTError, Exception):
        return {}


class PerformanceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in _SKIP_PATHS:
            return await call_next(request)

        claims = _decode_jwt_claims(request)
        tenant_id = claims.get("tid", "")
        business_unit_id = claims.get("bid", "")
        carmen_user_id = claims.get("cuid", "")
        carmen_uri_val = claims.get("carmen_uri", "")

        current_tenant_id.set(tenant_id)
        current_business_unit_id.set(business_unit_id)
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

        import asyncio

        asyncio.ensure_future(
            _persist(
                tenant_id=tenant_id,
                business_unit_id=business_unit_id,
                endpoint=request.url.path,
                method=request.method,
                duration_ms=duration_ms,
                status_code=response.status_code,
                carmen_user_id=carmen_user_id or None,
                resource_id=final_doc_ref,
            )
        )

        response.headers["X-Response-Time-Ms"] = f"{duration_ms:.1f}"
        return response


async def _persist(
    tenant_id: str,
    business_unit_id: str,
    endpoint: str,
    method: str,
    duration_ms: float,
    status_code: int,
    carmen_user_id: str | None,
    resource_id: str | None,
) -> None:
    try:
        async with async_session() as db:
            db.add(
                PerformanceLog(
                    tenant_id=tenant_id or None,
                    business_unit_id=business_unit_id or None,
                    endpoint=endpoint,
                    method=method,
                    duration_ms=duration_ms,
                    status_code=status_code,
                    carmen_user_id=carmen_user_id,
                    resource_id=resource_id,
                )
            )
            await db.commit()
    except Exception as exc:
        logger.error("PerformanceMiddleware._persist failed: %s", exc)
