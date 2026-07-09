"""Admin user CRUD + role assignment — the IAM half of the admin dashboard.

super_admin-only surface (see seed migration: 'admin' and 'viewer' roles are
deliberately excluded from admin_users/roles permissions). v1 only ever writes
global role grants (tenant_id=""); per-role tenant scoping is supported by the
schema but not exposed here.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.admin import AdminUser, AdminUserRole, Role
from app.services.admin_auth_service import hash_password
from app.services.audit_service import AuditAction, log_admin_action

SUPER_ADMIN_ROLE_ID = "super_admin"


async def _get_admin_user(db: AsyncSession, user_id: str) -> AdminUser:
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise NotFoundError("Admin user not found") from None

    user = (
        await db.execute(
            select(AdminUser).where(AdminUser.id == user_id, AdminUser.deleted_at.is_(None))
        )
    ).scalar_one_or_none()
    if not user:
        raise NotFoundError("Admin user not found")
    return user


async def _roles_by_user(db: AsyncSession, user_ids: list[str]) -> dict[str, list[str]]:
    if not user_ids:
        return {}
    rows = await db.execute(
        select(AdminUserRole.user_id, Role.id, Role.name)
        .join(Role, Role.id == AdminUserRole.role_id)
        .where(AdminUserRole.user_id.in_(user_ids), AdminUserRole.tenant_id == "")
    )
    by_user: dict[str, list[str]] = {}
    for uid, role_id, role_name in rows.all():
        by_user.setdefault(str(uid), []).append(role_name or role_id)
    return by_user


def _serialize(user: AdminUser, roles: list[str]) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "is_active": user.is_active,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "roles": roles,
    }


async def list_admin_users(db: AsyncSession) -> list[dict]:
    users = (
        (
            await db.execute(
                select(AdminUser)
                .where(AdminUser.deleted_at.is_(None))
                .order_by(AdminUser.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    roles_map = await _roles_by_user(db, [str(u.id) for u in users])
    return [_serialize(u, roles_map.get(str(u.id), [])) for u in users]


async def get_admin_user(db: AsyncSession, user_id: str) -> dict:
    user = await _get_admin_user(db, user_id)
    roles_map = await _roles_by_user(db, [str(user.id)])
    return _serialize(user, roles_map.get(str(user.id), []))


async def _validate_role_ids(db: AsyncSession, role_ids: list[str]) -> None:
    if not role_ids:
        return
    found = (
        (await db.execute(select(Role.id).where(Role.id.in_(role_ids), Role.deleted_at.is_(None))))
        .scalars()
        .all()
    )
    missing = set(role_ids) - {str(r) for r in found}
    if missing:
        raise ValidationError(f"Unknown role_id(s): {', '.join(sorted(missing))}")


async def create_admin_user(
    db: AsyncSession,
    email: str,
    password: str,
    full_name: str | None,
    role_ids: list[str],
    actor: AdminPrincipal,
) -> dict:
    email_normalized = (email or "").strip().lower()
    if not email_normalized:
        raise ValidationError("Email is required")

    existing = (
        await db.execute(
            select(AdminUser).where(
                AdminUser.email == email_normalized, AdminUser.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise ConflictError("An admin user with this email already exists")

    try:
        password_hash = hash_password(password)
    except ValueError as exc:
        raise ValidationError(str(exc)) from None

    await _validate_role_ids(db, role_ids)

    user = AdminUser(email=email_normalized, password_hash=password_hash, full_name=full_name)
    db.add(user)
    await db.flush()

    for role_id in role_ids:
        db.add(
            AdminUserRole(user_id=user.id, role_id=role_id, tenant_id="", granted_by=actor.admin_id)
        )

    await db.commit()

    await log_admin_action(
        admin_user_id=actor.admin_id,
        action=AuditAction.ADMIN_USER_CREATE,
        resource="admin_users",
        target_id=str(user.id),
        after_value={"email": email_normalized, "full_name": full_name, "role_ids": role_ids},
    )
    return _serialize(user, role_ids)


async def update_admin_user(
    db: AsyncSession,
    user_id: str,
    full_name: str | None,
    is_active: bool | None,
    actor: AdminPrincipal,
) -> dict:
    user = await _get_admin_user(db, user_id)

    if is_active is False and str(user.id) == str(actor.admin_id):
        raise ValidationError("Cannot deactivate your own account")

    before = {"full_name": user.full_name, "is_active": user.is_active}
    if full_name is not None:
        user.full_name = full_name
    if is_active is not None:
        user.is_active = is_active
    after = {"full_name": user.full_name, "is_active": user.is_active}
    await db.commit()

    await log_admin_action(
        admin_user_id=actor.admin_id,
        action=AuditAction.ADMIN_USER_UPDATE,
        resource="admin_users",
        target_id=str(user.id),
        before_value=before,
        after_value=after,
    )
    roles_map = await _roles_by_user(db, [str(user.id)])
    return _serialize(user, roles_map.get(str(user.id), []))


async def reset_admin_password(
    db: AsyncSession, user_id: str, new_password: str, actor: AdminPrincipal
) -> None:
    user = await _get_admin_user(db, user_id)
    try:
        user.password_hash = hash_password(new_password)
    except ValueError as exc:
        raise ValidationError(str(exc)) from None
    await db.commit()

    await log_admin_action(
        admin_user_id=actor.admin_id,
        action=AuditAction.ADMIN_USER_PASSWORD_RESET,
        resource="admin_users",
        target_id=str(user.id),
    )


async def replace_admin_user_roles(
    db: AsyncSession, user_id: str, role_ids: list[str], actor: AdminPrincipal
) -> list[str]:
    user = await _get_admin_user(db, user_id)
    await _validate_role_ids(db, role_ids)

    existing_rows = (
        (
            await db.execute(
                select(AdminUserRole.role_id).where(
                    AdminUserRole.user_id == user.id, AdminUserRole.tenant_id == ""
                )
            )
        )
        .scalars()
        .all()
    )
    old_role_ids = [str(r) for r in existing_rows]

    if SUPER_ADMIN_ROLE_ID in old_role_ids and SUPER_ADMIN_ROLE_ID not in role_ids:
        other_super_admins = await db.execute(
            select(AdminUserRole.user_id)
            .join(AdminUser, AdminUser.id == AdminUserRole.user_id)
            .where(
                AdminUserRole.role_id == SUPER_ADMIN_ROLE_ID,
                AdminUserRole.tenant_id == "",
                AdminUserRole.user_id != user.id,
                AdminUser.is_active.is_(True),
                AdminUser.deleted_at.is_(None),
            )
        )
        if not other_super_admins.first():
            raise ValidationError("Cannot remove the last super_admin")

    await db.execute(
        AdminUserRole.__table__.delete().where(
            AdminUserRole.user_id == user.id, AdminUserRole.tenant_id == ""
        )
    )
    for role_id in role_ids:
        db.add(
            AdminUserRole(user_id=user.id, role_id=role_id, tenant_id="", granted_by=actor.admin_id)
        )
    await db.commit()

    await log_admin_action(
        admin_user_id=actor.admin_id,
        action=AuditAction.ADMIN_USER_ROLES_REPLACE,
        resource="admin_users",
        target_id=str(user.id),
        before_value={"role_ids": old_role_ids},
        after_value={"role_ids": role_ids},
    )
    return role_ids


async def list_roles(db: AsyncSession) -> list[dict]:
    roles = (
        (await db.execute(select(Role).where(Role.deleted_at.is_(None)).order_by(Role.id)))
        .scalars()
        .all()
    )
    return [
        {"id": r.id, "name": r.name, "description": r.description, "is_system": r.is_system}
        for r in roles
    ]
