"""
Database migrations — append-only list of schema changes (PostgreSQL).

Naming convention: _m<number>_<description>

History (MariaDB era, 100-111) was squashed into a single PostgreSQL marker
when the project moved to Neon. Their effects are now baked into either:
  - the ORM models (picked up by Base.metadata.create_all in ensure_db), or
  - the _m200_pg_seed_control_plane seed migration below.

Rules:
  - Never reorder entries in _MIGRATIONS.
  - Never rename an already-applied entry.
  - Add new migrations at the bottom only.
  - Write PostgreSQL-only SQL — no MariaDB dialect.
"""

import logging
from collections.abc import Awaitable, Callable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# Migration functions
# ══════════════════════════════════════════════════════════════════════════════


async def _m200_pg_seed_control_plane(conn: AsyncConnection) -> None:
    """
    Seed minimal control-plane data required for the Hub to function:
      - 3 system roles + permission matrix + role_permission assignments
      - 2 modules (credit_card_ocr, ap_invoice)
      - 3 banks (BBL, KBANK, SCB)
      - 3 plans (free, pro, enterprise)

    All INSERTs use ON CONFLICT DO NOTHING — idempotent, never overwrites
    manual edits. No admin user is seeded; use the bootstrap CLI for first
    super_admin.
    """
    # ── Plans (referenced by tenants.plan FK) ──────────────────────────────
    plans = [
        ("free", "Free", 100),
        ("pro", "Pro", 2000),
        ("enterprise", "Enterprise", 50000),
    ]
    for code, name, limit in plans:
        await conn.execute(
            text("""
                INSERT INTO plans (code, display_name, monthly_call_limit, is_active, created_at)
                VALUES (:code, :name, :limit, true, NOW())
                ON CONFLICT (code) DO NOTHING
            """),
            {"code": code, "name": name, "limit": limit},
        )

    # ── Roles ──────────────────────────────────────────────────────────────
    roles = [
        ("super_admin", "Super Admin", "Full access including IAM. Cannot be deleted.", True),
        ("admin", "Admin", "Day-to-day operations. No role/permission management.", True),
        ("viewer", "Viewer", "Read-only access to dashboards and config.", True),
    ]
    for rid, name, desc, is_sys in roles:
        await conn.execute(
            text("""
                INSERT INTO roles (id, name, description, is_system, created_at)
                VALUES (:id, :name, :desc, :sys, NOW())
                ON CONFLICT (id) DO NOTHING
            """),
            {"id": rid, "name": name, "desc": desc, "sys": is_sys},
        )

    # ── Permissions ─────────────────────────────────────────────────────────
    resources_actions = [
        ("tenants", ["read", "write", "delete"]),
        ("banks", ["read", "write", "delete"]),
        ("prompts", ["read", "write", "publish", "delete"]),
        ("api_keys", ["read", "write", "revoke"]),
        ("admin_users", ["read", "write", "delete"]),
        ("roles", ["read", "write", "delete"]),
        ("configs", ["read", "write"]),
        ("flags", ["read", "write"]),
        ("quotas", ["read", "write"]),
        ("modules", ["read", "write"]),
        ("alerts", ["read", "acknowledge"]),
        ("audit", ["read"]),
    ]
    all_perms: list[str] = []
    for resource, actions in resources_actions:
        for action in actions:
            pid = f"{resource}:{action}"
            all_perms.append(pid)
            await conn.execute(
                text("""
                    INSERT INTO permissions (id, name, resource, action, created_at)
                    VALUES (:id, :name, :res, :act, NOW())
                    ON CONFLICT (id) DO NOTHING
                """),
                {
                    "id": pid,
                    "name": f"{action.title()} {resource}",
                    "res": resource,
                    "act": action,
                },
            )

    # ── Role → Permission assignments ───────────────────────────────────────
    iam_resources = {"roles", "admin_users"}
    for pid in all_perms:
        resource = pid.split(":")[0]
        # super_admin: all
        await conn.execute(
            text("""
                INSERT INTO role_permissions (role_id, permission_id)
                VALUES ('super_admin', :pid)
                ON CONFLICT DO NOTHING
            """),
            {"pid": pid},
        )
        # admin: all except IAM
        if resource not in iam_resources:
            await conn.execute(
                text("""
                    INSERT INTO role_permissions (role_id, permission_id)
                    VALUES ('admin', :pid)
                    ON CONFLICT DO NOTHING
                """),
                {"pid": pid},
            )
        # viewer: read-only
        if pid.endswith(":read"):
            await conn.execute(
                text("""
                    INSERT INTO role_permissions (role_id, permission_id)
                    VALUES ('viewer', :pid)
                    ON CONFLICT DO NOTHING
                """),
                {"pid": pid},
            )

    # ── Modules ─────────────────────────────────────────────────────────────
    modules = [
        ("credit_card_ocr", "Credit Card OCR", "Bank receipt OCR + GL mapping wizard", True, 1),
        ("ap_invoice", "AP Invoice", "Vendor invoice OCR + line-item review", True, 2),
    ]
    for mid, name, desc, active, order in modules:
        await conn.execute(
            text("""
                INSERT INTO modules
                    (id, display_name, description, is_active, sort_order, created_at)
                VALUES (:id, :name, :desc, :active, :order, NOW())
                ON CONFLICT (id) DO NOTHING
            """),
            {"id": mid, "name": name, "desc": desc, "active": active, "order": order},
        )

    # ── Banks ────────────────────────────────────────────────────────────────
    banks = [
        ("BBL", "Bangkok Bank", "ธนาคารกรุงเทพ", True, 1),
        ("KBANK", "Kasikorn Bank", "ธนาคารกสิกรไทย", True, 2),
        ("SCB", "Siam Commercial Bank", "ธนาคารไทยพาณิชย์", True, 3),
    ]
    for code, name, name_th, active, order in banks:
        await conn.execute(
            text("""
                INSERT INTO banks
                    (code, name, display_name_th, is_active, sort_order, created_at)
                VALUES (:code, :name, :name_th, :active, :order, NOW())
                ON CONFLICT (code) DO NOTHING
            """),
            {"code": code, "name": name, "name_th": name_th, "active": active, "order": order},
        )

    logger.info("  ~ control-plane seed data applied")


# ── Migration Registry ────────────────────────────────────────────────────────
# Append-only. Never reorder. Each entry runs exactly once per database.
#
# Markers (function == None):
#   001_squashed_initial_schema  — legacy MariaDB squash; kept for back-compat
#                                   with any DBs that already recorded it.
#   199_pg_baseline              — fresh Postgres install marker. Indicates the
#                                   full ORM schema was built by create_all().
#                                   Old MariaDB migrations 100-111 are NOT run
#                                   on Postgres — their effects are baked in.

_MIGRATIONS: list[tuple[str, Callable[[AsyncConnection], Awaitable[None]] | None]] = [
    # ── Squashed history markers ──────────────────────────────────────────────
    ("001_squashed_initial_schema", None),
    ("199_pg_baseline", None),
    # ── Live migrations (200+) ────────────────────────────────────────────────
    ("200_pg_seed_control_plane", _m200_pg_seed_control_plane),
]
