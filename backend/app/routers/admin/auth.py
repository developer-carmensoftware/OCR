"""Admin Dashboard authentication endpoints."""

import logging

from fastapi import APIRouter, Depends, Request

from app.auth.admin_session import AdminPrincipal
from app.database import get_db
from app.models.schemas import LoginRequest, LoginResponse
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
        # MFA is deferred: there is no enforced TOTP flow, so never signal that one is
        # required (a stub that always "passed" was worse than no MFA). The mfa_secret
        # column is kept for a future real implementation.
        mfa_required=False,
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
