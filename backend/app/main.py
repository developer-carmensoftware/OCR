import asyncio
import io
import logging
import sys
import traceback
from contextlib import asynccontextmanager
from datetime import datetime

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
from app.database import ensure_db, get_all_tenants
from app.exceptions import (
    CarmenServiceError,
    DuplicateDocumentError,
    ExtractionError,
    LLMParseError,
    LLMServiceError,
    RateLimitExceeded,
    ValidationError,
)
from app.middleware.performance import PerformanceMiddleware
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

# ── Logging Setup (uses the reconfigured UTF-8 stderr) ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    force=True,  # override any handlers uvicorn may have set up
)
logger = logging.getLogger(__name__)


# ── Background Scheduler ─────────────────────────────────────────────────────


async def _run_for_all_tenants(coro_factory, label: str) -> None:
    """
    Run coro_factory() once per active tenant, setting current_tenant_id context.
    Jobs that aggregate across all tenants (summary, anomaly) don't need this —
    they query the full table with GROUP BY tenant_id internally.
    """
    from app.context import current_scheduler_tenant as _ct

    tenants = await get_all_tenants()
    for tenant_id in tenants:
        token = _ct.set(tenant_id)
        try:
            await coro_factory()
        except Exception as exc:
            logger.error("[scheduler] %s failed for tenant %s: %s", label, tenant_id, exc)
        finally:
            _ct.reset(token)


async def _run_job(job_name: str, coro_factory) -> None:
    """Run a scheduler job and record its execution in job_runs for drift detection."""
    from sqlalchemy import insert, text

    from app.database import async_session
    from app.models.enums import JobStatus
    from app.models.orm import JobRun

    started = datetime.utcnow()
    rows_affected = None
    error_msg = None
    status = JobStatus.SUCCESS

    async with async_session() as db:
        result = await db.execute(
            insert(JobRun).values(job_name=job_name, status=JobStatus.RUNNING, started_at=started)
        )
        run_id = result.lastrowid
        await db.commit()

        try:
            ret = await coro_factory()
            if isinstance(ret, dict):
                rows_affected = sum(v if isinstance(v, int) else 0 for v in ret.values())
            elif isinstance(ret, int):
                rows_affected = ret
        except Exception as exc:
            status = JobStatus.FAILED
            error_msg = str(exc)
            logger.error("[scheduler] job %s failed: %s", job_name, exc)

        await db.execute(
            text(
                "UPDATE job_runs SET status=:status, completed_at=:done, "
                "rows_affected=:rows, error_message=:err WHERE id=:id"
            ),
            {
                "status": status.value,
                "done": datetime.utcnow(),
                "rows": rows_affected,
                "err": error_msg,
                "id": run_id,
            },
        )
        await db.commit()


async def _scheduler_loop():
    """
    Lightweight background scheduler — runs inside the FastAPI event loop.

    Schedule:
      - Every 24h: retention cleanup, daily summary, anomaly detection
      - Every 30d: partition check
    All jobs are recorded in job_runs for drift detection and incident review.
    """
    logger.info("📅 Background scheduler started")
    await asyncio.sleep(60)  # wait for app to fully start

    day_counter = 0
    while True:
        try:
            # ── Daily: retention cleanup ──
            if settings.retention_enabled:
                from app.services.retention_service import (
                    archive_and_cleanup,
                    purge_inactive_sessions,
                )

                logger.info("[scheduler] Running retention archive + cleanup...")
                await _run_job(
                    "retention", lambda: _run_for_all_tenants(archive_and_cleanup, "retention")
                )
                await _run_job(
                    "session-purge",
                    lambda: _run_for_all_tenants(purge_inactive_sessions, "session-purge"),
                )

            # ── Daily: build yesterday's summary (aggregates all tenants in one pass) ──
            from app.services.summary_service import build_daily_summary

            logger.info("[scheduler] Building daily summary...")
            await _run_job("summary", build_daily_summary)

            # ── Daily: anomaly detection (runs after summary so data is ready) ──
            from app.services.anomaly_service import detect_anomalies

            logger.info("[scheduler] Running anomaly detection...")
            await _run_job("anomaly-detection", detect_anomalies)

            # ── Monthly: check partitions ──
            day_counter += 1
            if day_counter % 30 == 1:
                from app.services.partition_manager import ensure_partitions

                logger.info("[scheduler] Checking partitions...")
                await _run_job("partitions", ensure_partitions)

        except Exception as exc:
            logger.error("[scheduler] Error: %s", exc)

        await asyncio.sleep(86400)


async def _pricing_sync_loop():
    """Sync OpenRouter model pricing every 8 hours (cluster-wide, no tenant scope)."""
    while True:
        try:
            from app.services.usage_service import fetch_openrouter_pricing

            await fetch_openrouter_pricing()
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("[pricing_scheduler] Error: %s", exc)

        await asyncio.sleep(8 * 3600)


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
    logger.info(f"   Upload Dir : {settings.upload_dir}")
    from app.database import _db_root_url

    logger.info(f"   Database   : {_db_root_url()}/carmen_ai")

    await ensure_db()
    logger.info("✅ Database initialized")

    # Start background schedulers
    scheduler_task = asyncio.create_task(_scheduler_loop())
    pricing_task = asyncio.create_task(_pricing_sync_loop())

    yield

    # Cancel schedulers on shutdown
    scheduler_task.cancel()
    pricing_task.cancel()
    try:
        await asyncio.gather(scheduler_task, pricing_task)
    except asyncio.CancelledError:
        pass
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

# ── Performance Middleware ──
app.add_middleware(PerformanceMiddleware)

# ── CORS Middleware ──
origins = [origin.strip() for origin in settings.allowed_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=settings.allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    }
