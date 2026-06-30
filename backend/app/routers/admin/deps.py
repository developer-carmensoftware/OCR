"""Shared dependencies for all admin endpoints."""

import hmac

from fastapi import Depends, Header, HTTPException

from app.auth.admin_session import AdminPrincipal, decode_admin_jwt
from app.config import settings
from app.services.admin_auth_service import get_admin_jwt_secret

# ── Legacy master-key guard (backward-compat during migration, remove in Phase 2) ──


def require_admin_key(x_admin_key: str = Header(..., alias="X-Admin-Key")) -> None:
    """Header-based master key check — kept as escape hatch; prefer JWT auth."""
    if not settings.master_api_key:
        raise HTTPException(status_code=503, detail="Admin access not configured")
    if x_admin_key != settings.master_api_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")


# ── JWT-based admin auth ──────────────────────────────────────────────────────


def get_current_admin(
    authorization: str = Header(..., description="Bearer <admin_jwt>"),
) -> AdminPrincipal:
    """
    Decode and validate an admin JWT.  Returns AdminPrincipal with roles and perms.
    Does NOT touch the database — all claims are embedded in the signed token.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header must be 'Bearer <token>'")
    token = authorization[7:]
    try:
        payload = decode_admin_jwt(token, get_admin_jwt_secret())
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid or expired admin token")

    aid = payload.get("aid", "")
    if not aid:
        raise HTTPException(status_code=401, detail="Malformed admin token")

    return AdminPrincipal(
        admin_id=str(aid),
        email=str(payload.get("email", "")),
        roles=list(payload.get("roles") or []),
        perms=set(payload.get("perms") or []),
        tenant_scope=str(payload.get("tenant_scope", "")),
        mfa_passed=bool(payload.get("mfa_passed", True)),
    )


def require_permission(resource: str, action: str):
    """
    FastAPI dependency factory — checks that the resolved admin has a specific
    permission. Usage:

        _: AdminPrincipal = Depends(require_permission("banks", "write"))
    """
    perm_id = f"{resource}:{action}"

    def _check(admin: AdminPrincipal = Depends(get_current_admin)) -> AdminPrincipal:
        if not admin.has_perm(perm_id):
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied: {perm_id}",
            )
        return admin

    return _check


# ── Machine-auth dependency (maintenance endpoints callable by pg_net) ────────


def require_maintenance_auth(
    authorization: str | None = Header(None, alias="Authorization"),
) -> AdminPrincipal | None:
    """
    Accept either an admin JWT (configs:write) or the internal job token.
    Used by maintenance POST endpoints that pg_net cron jobs need to call.
    Constant-time compare on the token prevents timing-based token oracle.
    Returns None for machine-auth callers (no AdminPrincipal needed).
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization must be 'Bearer <token>'")

    token = authorization[7:]

    # Internal job token path (pg_net machine auth)
    if settings.internal_job_token and hmac.compare_digest(
        token.encode(), settings.internal_job_token.encode()
    ):
        return None

    # Admin JWT path
    try:
        payload = decode_admin_jwt(token, get_admin_jwt_secret())
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    aid = payload.get("aid", "")
    if not aid:
        raise HTTPException(status_code=401, detail="Malformed token")

    admin = AdminPrincipal(
        admin_id=str(aid),
        email=str(payload.get("email", "")),
        roles=list(payload.get("roles") or []),
        perms=set(payload.get("perms") or []),
        tenant_scope=str(payload.get("tenant_scope", "")),
        mfa_passed=bool(payload.get("mfa_passed", True)),
    )
    if not admin.has_perm("configs:write"):
        raise HTTPException(status_code=403, detail="Permission denied: configs:write")
    return admin


# ── Backward-compat alias (used by maintenance.py which has no session dep) ──


def require_admin(
    x_admin_key: str | None = Header(None, alias="X-Admin-Key"),
) -> AdminPrincipal | None:
    """
    Accept EITHER a master API key (X-Admin-Key header) OR nothing — returns None
    for the master-key path.  New code should use get_current_admin() or
    require_permission() instead.
    """
    if x_admin_key:
        if not settings.master_api_key or x_admin_key != settings.master_api_key:
            raise HTTPException(status_code=403, detail="Invalid admin key")
        return None
    raise HTTPException(status_code=401, detail="Authentication required")
