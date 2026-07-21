"""Admin user CRUD + role assignment (super_admin-only IAM surface)."""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.database import get_db
from app.models.schemas import (
    AdminUserCreateRequest,
    AdminUserUpdateRequest,
    PasswordResetRequest,
    RoleAssignmentRequest,
)
from app.services import admin_user_service as svc

from .deps import require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/admin-users")
async def list_admin_users(
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("admin_users", "read")),
):
    return {"data": await svc.list_admin_users(db)}


@router.get("/admin-users/{user_id}")
async def get_admin_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("admin_users", "read")),
):
    return await svc.get_admin_user(db, user_id)


@router.post("/admin-users")
async def create_admin_user(
    body: AdminUserCreateRequest,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("admin_users", "write")),
):
    return await svc.create_admin_user(
        db, body.username, body.password, body.full_name, body.role_ids, admin
    )


@router.put("/admin-users/{user_id}")
async def update_admin_user(
    user_id: str,
    body: AdminUserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("admin_users", "write")),
):
    return await svc.update_admin_user(db, user_id, body.full_name, body.is_active, admin)


@router.post("/admin-users/{user_id}/password-reset")
async def reset_admin_user_password(
    user_id: str,
    body: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("admin_users", "write")),
):
    await svc.reset_admin_password(db, user_id, body.new_password, admin)
    return {"ok": True}


@router.put("/admin-users/{user_id}/roles")
async def replace_admin_user_roles(
    user_id: str,
    body: RoleAssignmentRequest,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("admin_users", "write")),
):
    role_ids = await svc.replace_admin_user_roles(db, user_id, body.role_ids, admin)
    return {"id": user_id, "role_ids": role_ids}


@router.get("/roles")
async def list_roles(
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("roles", "read")),
):
    return {"data": await svc.list_roles(db)}
