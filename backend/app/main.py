import io
import json as _json
import logging
import sys

# ── Force UTF-8 on Windows (prevents 'charmap' codec errors with Thai text) ──
if sys.platform == "win32":
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

from fastapi.responses import JSONResponse  # noqa: E402

from app.config import settings as _cfg_early  # noqa: E402
from app.context import RequestIdFilter as _RIF  # noqa: E402


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
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)

_rif = _RIF()
for _h in logging.getLogger().handlers:
    _h.addFilter(_rif)

logger = logging.getLogger(__name__)

from app.sentry import init_sentry  # noqa: E402

init_sentry()

from app.factory import create_app  # noqa: E402
from app.lifecycle import lifespan  # noqa: E402

app = create_app(lifespan=lifespan)


# ── Health (k8s-style) ───────────────────────────────────────────────────────


@app.get("/livez", tags=["Health"], include_in_schema=False)
@app.api_route("/api/v1/health", tags=["Health"], include_in_schema=False, methods=["GET", "HEAD"])
async def liveness():
    """Liveness probe — app process is alive. No dependency checks."""
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
        "app": "Carmen-AI Backend",
        "version": _cfg_early.app_version,
        "docs": "/docs",
        "health": "/api/v1/health",
    }


# ── Version ──
@app.get("/api/version", tags=["Root"])
async def version():
    """Returns app version and registered prompt versions for audit/traceability."""
    from app.llm.prompts import _PROMPT_VERSIONS

    # Note: CORS config (allowed_origins / regex) is intentionally NOT exposed here —
    # it is internal deployment detail and only aids reconnaissance for an attacker.
    return {
        "app_version": _cfg_early.app_version,
        "prompt_versions": _PROMPT_VERSIONS,
    }


# ── Debug ──
@app.get("/api/v1/debug-llm", tags=["Debug"], include_in_schema=False)
async def debug_last_llm_response():
    """Return the most recent raw LLM response (any module). Gated by APP_DEBUG."""
    from fastapi import HTTPException

    if not _cfg_early.app_debug:
        raise HTTPException(status_code=403, detail="Debug mode is disabled")
    from app.utils import debug_buffer

    entry = debug_buffer.latest()
    if entry is None:
        return {"raw": "(no response saved yet)", "source": None, "ts": None}
    return {"raw": entry["raw"], "source": entry["source"], "ts": entry["ts"]}
