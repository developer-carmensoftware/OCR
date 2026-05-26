"""
Bootstrap CLI — create the first super_admin user.

Usage:
    cd backend
    ADMIN_BOOTSTRAP_EMAIL=me@company.com ADMIN_BOOTSTRAP_PASSWORD=StrongPass1! \\
        python -m app.bootstrap_admin

    # Reset password for an existing super_admin:
    python -m app.bootstrap_admin --reset-password

Environment variables:
    ADMIN_BOOTSTRAP_EMAIL     (required)
    ADMIN_BOOTSTRAP_PASSWORD  (required, ≥ 8 chars)
"""

import argparse
import asyncio
import sys


async def _bootstrap(reset_password: bool) -> None:
    from app.config import settings
    from app.database import async_session, ensure_db
    from app.models.admin import AdminUser, AdminUserRole
    from app.services.admin_auth_service import hash_password

    email = settings.admin_bootstrap_email.strip().lower()
    password = settings.admin_bootstrap_password

    if not email or not password:
        print(
            "ERROR: ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must be set.",
            file=sys.stderr,
        )
        sys.exit(1)

    if len(password) < 8:
        print("ERROR: Password must be at least 8 characters.", file=sys.stderr)
        sys.exit(1)

    await ensure_db()

    from sqlalchemy import select

    async with async_session() as db:
        res = await db.execute(
            select(AdminUser).where(
                AdminUser.email == email,
                AdminUser.deleted_at.is_(None),
            )
        )
        existing = res.scalar_one_or_none()

        if existing:
            if reset_password:
                existing.password_hash = hash_password(password)  # type: ignore[assignment]
                existing.failed_login_attempts = 0  # type: ignore[assignment]
                existing.locked_until = None  # type: ignore[assignment]
                await db.commit()
                print(f"✅ Password reset for {email}")
            else:
                print(f"ℹ️  Admin {email} already exists. Use --reset-password to update.")
            return

        import uuid

        admin = AdminUser(
            id=uuid.uuid4(),
            email=email,
            password_hash=hash_password(password),
            full_name="Super Admin",
            is_active=True,
            failed_login_attempts=0,
        )
        db.add(admin)
        await db.flush()

        # Assign global super_admin role (tenant_id="" means global).
        role_grant = AdminUserRole(
            user_id=admin.id,
            role_id="super_admin",
            tenant_id="",
            granted_by="bootstrap",
        )
        db.add(role_grant)
        await db.commit()

        print(f"✅ Created super_admin: {email}")
        print("   Log in at the admin dashboard and change the password after first use.")
        print("   Clear ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD from your env.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap the first admin user.")
    parser.add_argument(
        "--reset-password",
        action="store_true",
        help="Reset the password for an existing super_admin.",
    )
    args = parser.parse_args()
    asyncio.run(_bootstrap(args.reset_password))


if __name__ == "__main__":
    main()
