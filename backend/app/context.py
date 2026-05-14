"""
Request-scoped context variables.

Set by auth/dependencies.py at the start of each authenticated request.
Read by middleware and services to enrich logs without threading data through every call.

Identity hierarchy:
  tenant_id        — UUID from tenants table (resolved from carmen_uri hostname)
  business_unit_id — UUID from business_units table (resolved from JWT `bu` claim)
  carmen_user_id   — Carmen ERP user UUID (from JWT, external — no FK in our DB)
"""

from contextvars import ContextVar

# ── Tenant identity (FK-based, resolved from JWT) ─────────────────────────────
current_tenant_id:        ContextVar[str] = ContextVar("current_tenant_id",        default="")
current_business_unit_id: ContextVar[str] = ContextVar("current_business_unit_id", default="")

# ── Carmen ERP user (external, no FK) ────────────────────────────────────────
current_carmen_user_id: ContextVar[str] = ContextVar("current_carmen_user_id", default="")
current_username:       ContextVar[str] = ContextVar("current_username",       default="")

# ── Session ───────────────────────────────────────────────────────────────────
current_ocr_session_id: ContextVar[str] = ContextVar("current_ocr_session_id", default="")
current_carmen_token:   ContextVar[str] = ContextVar("current_carmen_token",   default="")
current_carmen_uri:     ContextVar[str] = ContextVar("current_carmen_uri",     default="")

# ── Routing helpers ───────────────────────────────────────────────────────────
# Set by route handlers after the target document is known.
current_document_ref: ContextVar[str] = ContextVar("current_document_ref", default="")

# ── Scheduler context (set by _run_for_all_tenants in main.py) ───────────────
current_scheduler_tenant: ContextVar[str] = ContextVar("current_scheduler_tenant", default="")
