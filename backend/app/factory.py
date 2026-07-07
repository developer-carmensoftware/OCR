"""App factory — assembles FastAPI with middleware, exception handlers, and routers."""

import logging
import traceback
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import is_wildcard_origin_regex, settings
from app.exceptions import (
    CarmenServiceError,
    ConflictError,
    DuplicateDocumentError,
    ExtractionError,
    FileTooLargeError,
    InsufficientCredits,
    LLMCapacityError,
    LLMParseError,
    LLMServiceError,
    NotFoundError,
    RateLimitExceeded,
    RequestRateLimitExceeded,
    TenantContextMissing,
    ValidationError,
)
from app.middleware.cors_log import CORSLogMiddleware
from app.middleware.performance import PerformanceMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.routers.admin import router as admin_router
from app.routers.ap_invoice import router as ap_invoice_router
from app.routers.auth import router as auth_router
from app.routers.carmen import router as carmen_router
from app.routers.config import router as config_router
from app.routers.credits import router as credits_router
from app.routers.feedback import router as feedback_router
from app.routers.files import router as files_router
from app.routers.mapping import router as mapping_router
from app.routers.notifications import router as notifications_router
from app.routers.ocr import router as ocr_router
from app.sentry import capture

logger = logging.getLogger(__name__)

_EXCEPTION_STATUS: list[tuple] = [
    (HTTPException, None),
    (DuplicateDocumentError, 409),
    (ConflictError, 409),
    (InsufficientCredits, 402),
    (FileTooLargeError, 413),
    (ValidationError, 400),
    (NotFoundError, 404),
    (LLMParseError, 422),
    (ExtractionError, 422),
    (LLMServiceError, 503),
    (CarmenServiceError, 503),
    (RateLimitExceeded, 429),
    (RequestRateLimitExceeded, 429),
    (LLMCapacityError, 429),
    (TenantContextMissing, 500),
]


def create_app(lifespan=None) -> FastAPI:
    app = FastAPI(
        title="AI Bank Receipt Backend",
        description=(
            "ระบบ AI สำหรับอ่านใบเสร็จรับเงิน/ใบกำกับภาษีจากธนาคาร "
            "แล้วดึงข้อมูลออกมาเป็น Structured Data อัตโนมัติ\n\n"
            "**Features:**\n"
            "- อัปโหลดรูปใบเสร็จ (JPG/PNG/PDF)\n"
            "- AI ดึงข้อความจากรูป\n"
            "- AI Extraction แยกข้อมูลเป็น Structured Fields\n"
            "- Export เป็น CSV\n"
        ),
        version=settings.app_version,
        lifespan=lifespan,
    )

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(PerformanceMiddleware)

    origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
    # Never reflect credentials when the origin set is effectively open ("*" in the
    # list, or a wildcard regex) — that combination lets any site make credentialed calls.
    _allow_credentials = "*" not in origins and not is_wildcard_origin_regex(
        settings.allowed_origin_regex
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=settings.allowed_origin_regex or None,
        allow_credentials=_allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(CORSLogMiddleware)

    def _error_response(exc: Exception, status: int) -> JSONResponse:
        content: dict[str, Any] = {"detail": str(exc)}
        error_code = getattr(exc, "code", None)
        if error_code:
            content["code"] = error_code
        if settings.app_debug:
            content["traceback"] = traceback.format_exc()
        headers: dict[str, str] | None = None
        if isinstance(exc, (RequestRateLimitExceeded, LLMCapacityError)):
            headers = {"Retry-After": str(exc.retry_after)}
        return JSONResponse(status_code=status, content=content, headers=headers)

    def _make_handler(status: int | None):
        async def handler(request: Request, exc: Exception):
            # HTTPException carries its own status; typed exceptions use the map.
            code = getattr(exc, "status_code", None) if status is None else status
            code = code or 500
            # Expected client errors (4xx) are routine — log quietly, no stack trace.
            # Server-side faults (5xx) keep full traceback + Sentry capture.
            if code >= 500:
                logger.error(
                    "Handled %s: %s %s\n%s",
                    type(exc).__name__,
                    request.method,
                    request.url,
                    traceback.format_exc(),
                )
                capture(exc)
            else:
                logger.info(
                    "Client error %s (%s): %s %s",
                    code,
                    type(exc).__name__,
                    request.method,
                    request.url,
                )
            return _error_response(exc, code)

        return handler

    # Register a specific handler per typed exception so it is resolved by the
    # inner ExceptionMiddleware (matched by MRO — subclasses fall through to the
    # nearest registered ancestor, e.g. PdfPasswordRequired → ValidationError).
    # This keeps the exception from propagating through the BaseHTTPMiddleware
    # stack and being re-raised/duplicated in the server log.
    for exc_type, status in _EXCEPTION_STATUS:
        if exc_type is HTTPException:
            # Let FastAPI's built-in handler format HTTPException (bare detail +
            # its own headers); str(HTTPException) would leak "<code>: <detail>".
            continue
        app.add_exception_handler(exc_type, _make_handler(status))

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        tb = traceback.format_exc()
        try:
            logger.error("Unhandled exception: %s %s\n%s", request.method, request.url, tb)
        except Exception:
            pass
        capture(exc)
        content: dict[str, Any] = {"detail": "Internal server error"}
        if settings.app_debug:
            content["traceback"] = tb
        return JSONResponse(status_code=500, content=content)

    app.include_router(auth_router)
    app.include_router(ocr_router)
    app.include_router(mapping_router)
    app.include_router(carmen_router)
    app.include_router(feedback_router)
    app.include_router(ap_invoice_router)
    app.include_router(files_router)
    app.include_router(admin_router)
    app.include_router(config_router)
    app.include_router(credits_router)
    app.include_router(notifications_router)

    return app
