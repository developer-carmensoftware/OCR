"""
Request-scoped context variables.

Set by auth/dependencies.py at the start of each authenticated request.
Read by middleware and services to enrich logs without threading data through every call.

Identity:
  tenant_id      — UUID from tenants table; one row per (carmen host, bu) pair,
                   so this is the single FK used for all data isolation.
  carmen_user_id — Carmen ERP user UUID (from JWT, external — no FK in our DB)
"""

import logging
from contextvars import ContextVar

# ── Tenant identity (FK-based, resolved from JWT) ─────────────────────────────
current_tenant_id: ContextVar[str] = ContextVar("current_tenant_id", default="")

# ── Carmen ERP user (external, no FK) ────────────────────────────────────────
current_carmen_user_id: ContextVar[str] = ContextVar("current_carmen_user_id", default="")
current_username: ContextVar[str] = ContextVar("current_username", default="")

# ── Session ───────────────────────────────────────────────────────────────────
current_ocr_session_id: ContextVar[str] = ContextVar("current_ocr_session_id", default="")
current_carmen_token: ContextVar[str] = ContextVar("current_carmen_token", default="")
current_carmen_uri: ContextVar[str] = ContextVar("current_carmen_uri", default="")

# ── Routing helpers ───────────────────────────────────────────────────────────
# Set by route handlers after the target document is known.
current_document_ref: ContextVar[str] = ContextVar("current_document_ref", default="")

# ── Scheduler context (set by _run_for_all_tenants in main.py) ───────────────
current_scheduler_tenant: ContextVar[str] = ContextVar("current_scheduler_tenant", default="")

# ── Request correlation ID (set by PerformanceMiddleware per request) ─────────
current_request_id: ContextVar[str] = ContextVar("current_request_id", default="")

# ── Deferred LLM usage (email ingest reads the document before it knows whose) ─
# When this holds a list, `log_llm_usage` parks a tenant-less call in it instead
# of inserting a row that `llm_usage_logs.tenant_id NOT NULL` would reject. The
# caller flushes it once routing has named the tenant.
pending_llm_usage: ContextVar[list | None] = ContextVar("pending_llm_usage", default=None)


def require_tenant() -> str:
    """Return the current tenant_id or raise TenantContextMissing.

    Use this at the entry of every service function that touches tenant-scoped data,
    so a missing/empty context becomes a loud 500 (wiring bug) instead of a silent
    cross-tenant query with tenant_id=''.
    """
    tid = current_tenant_id.get("")
    if not tid:
        from app.exceptions import TenantContextMissing

        raise TenantContextMissing("tenant_id not set in request context")
    return tid


class RequestIdFilter(logging.Filter):
    """Injects current_request_id into every log record — attach once to root logger."""

    def filter(self, record: logging.LogRecord) -> bool:
        rid = current_request_id.get("")
        record.request_id = f"{rid} " if rid else ""
        return True
