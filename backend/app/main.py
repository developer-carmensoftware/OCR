import asyncio
import io
import json as _json
import logging
import sys
import traceback
from contextlib import asynccontextmanager

# ── Force UTF-8 on Windows (prevents 'charmap' codec errors with Thai text) ──
if sys.platform == "win32":
    # Reconfigure stdout/stderr to UTF-8
    for _stream_name in ("stdout", "stderr"):
        _stream = getattr(sys, _stream_name)
        if hasattr(_stream, "buffer"):
            setattr(
                sys,
                _stream_name,
                io.TextIOWrapper(
                    _stream.buffer, encoding="utf-8", errors="replace", line_buffering=True
                ),
            )

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.config import settings as _cfg_early  # noqa: E402

# ── Logging Setup (uses the reconfigured UTF-8 stderr) ──
from app.context import RequestIdFilter as _RIF  # noqa: E402
from app.database import ensure_db
from app.exceptions import (
    CarmenServiceError,
    DuplicateDocumentError,
    ExtractionError,
    LLMParseError,
    LLMServiceError,
    RateLimitExceeded,
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
from app.routers.feedback import router as feedback_router
from app.routers.mapping import router as mapping_router
from app.routers.ocr import router as ocr_router
from app.routers.tool_registry import router as tools_router


class _JsonLogFormatter(logging.Formatter):
    """Structured JSON formatter for cloud log aggregation (ELK / Datadog / GCP)."""

    def format(self, record: logging.LogRecord) -> str:
        entry: dict = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        rid = getattr(record, "request_id", "").strip()
        if rid:
            entry["request_id"] = rid
        if record.exc_info:
            entry["exc"] = self.formatException(record.exc_info)
        return _json.dumps(entry, ensure_ascii=False)


def _build_handler() -> logging.Handler:
    handler = logging.StreamHandler()
    if _cfg_early.log_json:
        handler.setFormatter(_JsonLogFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s | %(levelname)-7s | %(name)s | %(request_id)s| %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
        )
    return handler


logging.basicConfig(level=logging.INFO, handlers=[_build_handler()], force=True)

# Suppress SQLAlchemy SQL statement logs (too verbose at INFO level)
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)

# Install request_id filter so every propagated child-logger record gets it injected.
_rif = _RIF()
for _h in logging.getLogger().handlers:
    _h.addFilter(_rif)

logger = logging.getLogger(__name__)

# ── Sentry (initialise before app creation so all errors are captured) ──────
if settings.sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        send_default_pii=False,  # no personal data in error reports
    )
    logger.info("Sentry initialised (env=%s)", settings.sentry_environment)


def _capture(exc: Exception) -> None:
    """Send exception to Sentry if configured, otherwise no-op."""
    if settings.sentry_dsn:
        import sentry_sdk

        sentry_sdk.capture_exception(exc)


# ── Background Tasks ─────────────────────────────────────────────────────────


async def _perf_flush_loop():
    """Flush buffered performance / outbound / audit log rows every 10 seconds.

    Combined into one loop because they all share the same cadence — keeps the
    background task count down and ensures all three drain together on shutdown.
    """
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
            await _drain_all()  # drain on shutdown
            break
        except Exception as exc:
            logger.error("[perf_flush] Error: %s", exc)
            _capture(exc)


# ── Lifespan (startup / shutdown) ──
@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialize database on startup, start background scheduler."""
    logger.info("🚀 Starting AI OCR Bank Receipt Backend...")
    logger.info(f"   OCR Model  : {settings.openrouter_ocr_model}")
    logger.info(f"   Sugg Model : {settings.openrouter_suggestion_model}")
    logger.info(
        f"   OpenRouter : {'✅ Configured' if settings.openrouter_api_key else '❌ Not set'}"
    )
    from app.database import _db_root_url

    logger.info(f"   Database   : {_db_root_url()}")

    await ensure_db()
    logger.info("✅ Database initialized")

    perf_flush_task = asyncio.create_task(_perf_flush_loop())

    yield

    # Grace period: give in-flight LLM / Carmen calls time to finish
    # before background tasks are cancelled.
    grace = settings.shutdown_grace_seconds
    if grace > 0:
        logger.info("⏳ Graceful shutdown — waiting %ds for in-flight requests...", grace)
        await asyncio.sleep(grace)

    perf_flush_task.cancel()
    try:
        await asyncio.gather(perf_flush_task)
    except asyncio.CancelledError:
        pass

    # Close the shared Carmen httpx client (releases pooled keep-alive sockets).
    from app.services.carmen_service import close_client as _close_carmen

    try:
        await _close_carmen()
    except Exception as exc:
        logger.warning("Carmen client close failed: %s", exc)

    logger.info("👋 Shutting down AI OCR Backend")


# ── FastAPI App ──
# Backend Version: 1.0.4 - Mapping Fix Debug V4
app = FastAPI(
    title="AI OCR Bank Receipt Backend",
    description=(
        "ระบบ AI OCR สำหรับอ่านใบเสร็จรับเงิน/ใบกำกับภาษีจากธนาคาร "
        "แล้วดึงข้อมูลออกมาเป็น Structured Data อัตโนมัติ\n\n"
        "**Features:**\n"
        "- 📄 อัปโหลดรูปใบเสร็จ (JPG/PNG/PDF)\n"
        "- 🤖 AI OCR ดึงข้อความจากรูป (Google Vision / PaddleOCR)\n"
        "- 🧠 AI Extraction แยกข้อมูลเป็น Structured Fields\n"
        "- 📊 Export เป็น CSV (ฟอร์แมต Bank Tax Automation)\n"
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── Security Headers Middleware ──
app.add_middleware(SecurityHeadersMiddleware)

# ── Rate Limiting Middleware ──
app.add_middleware(RateLimitMiddleware)

# ── Performance Middleware ──
app.add_middleware(PerformanceMiddleware)

# ── CORS Middleware ──
origins = [origin.strip() for origin in settings.allowed_origins.split(",") if origin.strip()]
# When origins=["*"], allow_credentials must be False (browser rejects the combination).
# Auth is done via Carmen SSO + Authorization: Bearer header, not cookies, so this is safe.
_allow_credentials = "*" not in origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=settings.allowed_origin_regex or None,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── CORS Logging Middleware (outermost, runs first/last to log CORS blocks) ──
app.add_middleware(CORSLogMiddleware)

# ── Global error handler ──
_EXCEPTION_STATUS: list[tuple] = [
    (HTTPException, None),  # passthrough — use exc.status_code
    (DuplicateDocumentError, 409),
    (ValidationError, 400),
    (LLMParseError, 422),
    (ExtractionError, 422),
    (LLMServiceError, 503),
    (CarmenServiceError, 503),
    (RateLimitExceeded, 429),
]


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    try:
        logger.error("Unhandled exception: %s %s\n%s", request.method, request.url, tb)
    except Exception:
        pass

    for exc_type, status in _EXCEPTION_STATUS:
        if isinstance(exc, exc_type):
            code = exc.status_code if status is None else status
            content = {"detail": str(exc)}
            if settings.app_debug:
                content["traceback"] = tb
            return JSONResponse(status_code=code, content=content)

    content = {"detail": "Internal server error"}
    if settings.app_debug:
        content["traceback"] = tb
    return JSONResponse(status_code=500, content=content)


# ── Register Routers ──
app.include_router(auth_router)
app.include_router(ocr_router)
app.include_router(mapping_router)
app.include_router(carmen_router)
app.include_router(tools_router)
app.include_router(feedback_router)
app.include_router(ap_invoice_router)
app.include_router(admin_router)
app.include_router(config_router)


# ── Health (k8s-style) ───────────────────────────────────────────────────────


@app.get("/livez", tags=["Health"], include_in_schema=False)
@app.get("/api/v1/health", tags=["Health"], include_in_schema=False)
async def liveness():
    """Liveness probe — app process is alive. No dependency checks.

    Exposed both at `/livez` (k8s convention) and `/api/v1/health` so that
    UptimeRobot pings + reverse-proxy keep-alive checks (Render/Vercel) hit
    a path the proxy normally forwards to the backend.
    """
    return {"status": "ok"}


@app.get("/readyz", tags=["Health"], include_in_schema=False)
async def readiness():
    """Readiness probe — app can serve requests (DB reachable)."""
    from sqlalchemy import text

    from app.database import async_session

    try:
        async with async_session() as db:
            await db.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as exc:
        logger.warning("Readiness check failed: %s", exc)
        return JSONResponse(status_code=503, content={"status": "unavailable", "detail": str(exc)})


# ── Root ──
@app.get("/", tags=["Root"])
async def root():
    return {
        "app": "AI OCR Credit Card Statement Backend",
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/api/v1/ocr/health",
    }


# ── Version ──
@app.get("/api/version", tags=["Root"])
async def version():
    """Returns app version and registered prompt versions for audit/traceability."""
    from app.llm.prompts import _PROMPT_VERSIONS

    return {
        "app_version": settings.app_version,
        "prompt_versions": _PROMPT_VERSIONS,
        "allowed_origins": settings.allowed_origins,
        "allowed_origin_regex": settings.allowed_origin_regex,
    }
