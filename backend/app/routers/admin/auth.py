"""Admin Dashboard authentication endpoints."""

import logging

from fastapi import APIRouter, Depends, Request

from app.auth.admin_session import AdminPrincipal
from app.database import get_db
from app.models.schemas import LoginRequest, LoginResponse, MFAVerifyRequest
from app.routers.admin.deps import get_current_admin
from app.services import admin_auth_service as svc
from app.utils.client_ip import get_client_ip

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Admin Auth"])


@router.post("/login", response_model=LoginResponse)
async def admin_login(
    body: LoginRequest,
    request: Request,
    db=Depends(get_db),
):
    ip = get_client_ip(request)
    try:
        admin, token, roles, _perms, tenant_scope = await svc.login(
            db=db,
            username=body.username,
            password=body.password,
            ip_address=ip,
        )
    except svc.AdminAuthError as exc:
        from fastapi import HTTPException

        raise HTTPException(status_code=exc.status_code, detail=str(exc))

    from app.services.audit_service import AuditAction, log_admin_action

    await log_admin_action(
        admin_user_id=str(admin.id),
        action=AuditAction.LOGIN,
        ip_address=ip,
    )

    return LoginResponse(
        access_token=token,
        admin_id=str(admin.id),
        username=str(admin.username),
        roles=roles,
        tenant_scope=tenant_scope,
        mfa_required=bool(admin.mfa_secret) and not False,  # noqa: SIM210 — Phase 1.5 placeholder
    )


@router.get("/me")
async def admin_me(admin: AdminPrincipal = Depends(get_current_admin)):
    return {
        "admin_id": admin.admin_id,
        "username": admin.username,
        "roles": admin.roles,
        "permissions": sorted(admin.perms),
        "tenant_scope": admin.tenant_scope,
        "is_global": admin.is_global,
        "mfa_passed": admin.mfa_passed,
    }


@router.post("/logout")
async def admin_logout(admin: AdminPrincipal = Depends(get_current_admin)):
    from app.services.audit_service import AuditAction, log_admin_action

    await log_admin_action(
        admin_user_id=admin.admin_id,
        action=AuditAction.LOGOUT,
    )
    # JWT is stateless — client discards the token.
    return {"detail": "Logged out"}


# ── MFA (Phase 1.5 stub) ─────────────────────────────────────────────────────


@router.post("/mfa/verify")
async def admin_mfa_verify(
    body: MFAVerifyRequest,
    _admin: AdminPrincipal = Depends(get_current_admin),
):
    """TOTP verification stub — MFA enforcement is deferred to Phase 1.5."""
    if not body.totp_code:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail="TOTP code required")
    # Actual TOTP check + re-issue token with mfa_passed=True implemented in Phase 1.5
    return {"detail": "MFA verification not yet enforced", "mfa_passed": True}
