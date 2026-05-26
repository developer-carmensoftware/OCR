"""
Admin authentication service — password hashing, login, lockout, JWT issuance.

Uses bcrypt for password storage. Lockout follows the rules encoded in the
AdminUser model: 5 failed attempts → lock for 15 minutes.
"""

import logging
from datetime import UTC, datetime, timedelta

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import create_admin_jwt
from app.config import settings
from app.models.admin import AdminUser, AdminUserRole, Permission, RolePermission

logger = logging.getLogger(__name__)

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
DEFAULT_TTL_HOURS = 8


class AdminAuthError(Exception):
    """Generic admin auth failure — message is safe to expose."""

    def __init__(self, message: str, status_code: int = 401):
        super().__init__(message)
        self.status_code = status_code


# ── Password hashing ─────────────────────────────────────────────────────────


def hash_password(plaintext: str) -> str:
    if not plaintext or len(plaintext) < 8:
        raise ValueError("Admin password must be at least 8 characters")
    return bcrypt.hashpw(plaintext.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plaintext: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plaintext.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ── Role/permission loading ──────────────────────────────────────────────────


async def load_admin_roles_and_perms(
    db: AsyncSession,
    admin_id: str,
) -> tuple[list[str], list[str], str]:
    """
    Return (roles, perms, tenant_scope).

    tenant_scope is the strictest scope across active role grants:
      - if any grant has tenant_id == "" (global), tenant_scope = ""
      - else the first non-empty tenant_id wins (admins are typically scoped to one)
    """
    now = datetime.now(UTC).replace(tzinfo=None)
    rows = await db.execute(
        select(AdminUserRole).where(AdminUserRole.user_id == admin_id)  # type: ignore[arg-type]
    )
    grants = [
        g
        for g in rows.scalars().all()
        if g.expires_at is None or g.expires_at > now  # type: ignore[operator]
    ]
    if not grants:
        return [], [], ""

    role_ids: list[str] = sorted({str(g.role_id) for g in grants})
    tenant_scopes: set[str] = {str(g.tenant_id) for g in grants}
    tenant_scope = "" if "" in tenant_scopes else next(iter(tenant_scopes), "")

    perms_q = await db.execute(
        select(Permission.id)
        .join(RolePermission, Permission.id == RolePermission.permission_id)
        .where(RolePermission.role_id.in_(role_ids))
    )
    perms: list[str] = sorted({str(row[0]) for row in perms_q.all()})

    return role_ids, perms, tenant_scope


# ── Login flow ───────────────────────────────────────────────────────────────


async def login(
    db: AsyncSession,
    email: str,
    password: str,
    ip_address: str | None = None,
) -> tuple[AdminUser, str, list[str], list[str], str]:
    """
    Verify credentials and issue an admin JWT.
    Returns (admin, jwt, roles, perms, tenant_scope).
    Raises AdminAuthError on any failure.
    """
    email_normalized = (email or "").strip().lower()
    if not email_normalized or not password:
        raise AdminAuthError("Email and password are required", status_code=400)

    res = await db.execute(
        select(AdminUser).where(
            AdminUser.email == email_normalized,
            AdminUser.deleted_at.is_(None),
        )
    )
    admin = res.scalar_one_or_none()

    # Generic error — never leak whether the email exists.
    invalid_credentials = AdminAuthError("Invalid email or password", status_code=401)

    if not admin:
        raise invalid_credentials
    if not admin.is_active:  # type: ignore[truthy-function]
        raise AdminAuthError("Account disabled", status_code=403)

    now = datetime.now(UTC).replace(tzinfo=None)
    locked_until: datetime | None = admin.locked_until  # type: ignore[assignment]
    if locked_until and locked_until > now:
        remaining = int((locked_until - now).total_seconds())
        raise AdminAuthError(
            f"Account locked. Try again in {remaining}s.",
            status_code=423,
        )

    password_hash: str = str(admin.password_hash)
    if not verify_password(password, password_hash):
        current_attempts: int = int(admin.failed_login_attempts or 0)  # type: ignore[arg-type]
        admin.failed_login_attempts = current_attempts + 1  # type: ignore[assignment]
        if current_attempts + 1 >= MAX_FAILED_ATTEMPTS:
            admin.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)  # type: ignore[assignment]
            logger.warning(
                "Admin %s locked for %d minutes after %d failed attempts",
                email_normalized,
                LOCKOUT_MINUTES,
                current_attempts + 1,
            )
        await db.commit()
        raise invalid_credentials

    # Success — clear lock counters.
    admin.failed_login_attempts = 0  # type: ignore[assignment]
    admin.locked_until = None  # type: ignore[assignment]
    admin.last_login_at = now  # type: ignore[assignment]
    admin.last_login_ip = ip_address  # type: ignore[assignment]
    await db.commit()
    await db.refresh(admin)

    roles, perms, tenant_scope = await load_admin_roles_and_perms(db, str(admin.id))
    if not roles:
        raise AdminAuthError("No active roles assigned", status_code=403)

    token = create_admin_jwt(
        admin_id=str(admin.id),
        email=str(admin.email),
        roles=roles,
        perms=perms,
        secret=get_admin_jwt_secret(),
        ttl_hours=DEFAULT_TTL_HOURS,
        tenant_scope=tenant_scope,
        mfa_passed=admin.mfa_secret is None,  # type: ignore[operator]
    )
    return admin, token, roles, perms, tenant_scope


def get_admin_jwt_secret() -> str:
    secret = settings.admin_jwt_secret or settings.ocr_jwt_secret
    if not secret:
        raise RuntimeError("ADMIN_JWT_SECRET is not configured")
    return secret


__all__ = [
    "AdminAuthError",
    "DEFAULT_TTL_HOURS",
    "hash_password",
    "verify_password",
    "load_admin_roles_and_perms",
    "login",
    "get_admin_jwt_secret",
]
