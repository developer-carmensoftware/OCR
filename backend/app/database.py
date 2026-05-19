"""
Database setup — single shared MariaDB database: carmen_ai

Architecture: Single Database, Multi-Tenant via Foreign Keys
  All tenants share one database.
  Data plane tables reference tenants.id + business_units.id (FK).
  Control plane tables are global.

Fresh start requirement:
  Migrations 001-033 have been squashed into 001_squashed_initial_schema (None marker).
  On a fresh install: DROP the carmen_ai database, then start the app.
  create_all() will recreate all tables; migrations 100+ handle post-schema setup.
    mysql -e "DROP DATABASE IF EXISTS carmen_ai"
    uvicorn app.main:app --reload

Engine:
  Single AsyncEngine with connection pool, created lazily on first use.

Session:
  async_session()  — returns a session; use as `async with async_session() as db:`
  get_db()         — FastAPI dependency yielding a committed session.
"""

import logging
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncConnection,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

logger = logging.getLogger(__name__)


# ── URL helpers ───────────────────────────────────────────────────────────────


def _db_root_url() -> str:
    url = settings.database_url.rstrip("/")
    if url.count("/") > 2:
        return url.rsplit("/", 1)[0]
    return url


def _carmen_ai_url() -> str:
    return f"{_db_root_url()}/carmen_ai"


# ── Single Engine ─────────────────────────────────────────────────────────────

_ENGINE = None
_SESSION_FACTORY = None


def _get_engine():
    global _ENGINE, _SESSION_FACTORY
    if _ENGINE is None:
        _ENGINE = create_async_engine(
            _carmen_ai_url(),
            echo=False,
            pool_pre_ping=True,
            pool_size=20,
            max_overflow=40,
        )
        _SESSION_FACTORY = async_sessionmaker(
            _ENGINE,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        logger.debug("Engine created for carmen_ai")
    return _ENGINE


# ── Public Session Factories ──────────────────────────────────────────────────


def async_session() -> AsyncSession:
    _get_engine()
    return _SESSION_FACTORY()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    _get_engine()
    async with _SESSION_FACTORY() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ── ORM Base ─────────────────────────────────────────────────────────────────


class Base(DeclarativeBase):
    pass


# ── DB Provisioning ───────────────────────────────────────────────────────────


async def ensure_db() -> None:
    """
    Create carmen_ai database if missing, create/verify all tables, run migrations.
    Safe to call multiple times (idempotent).
    """
    # Force all ORM models to register with Base before create_all().
    # Without this import, standalone scripts that only import ensure_db() would
    # call create_all() against an empty Base.metadata and create zero tables.
    import app.models.orm  # noqa: F401

    root_url = _db_root_url()
    admin_engine = create_async_engine(root_url, echo=False)
    try:
        async with admin_engine.begin() as conn:
            await conn.execute(
                text(
                    "CREATE DATABASE IF NOT EXISTS carmen_ai "
                    "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                )
            )
        logger.info("Ensured database: carmen_ai")
    finally:
        await admin_engine.dispose()

    engine = _get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    await migrate_db()

    from app.services.usage_service import fetch_openrouter_pricing

    try:
        await fetch_openrouter_pricing()
    except Exception as exc:
        logger.warning("Initial pricing sync failed: %s", exc)


async def init_db() -> None:
    await ensure_db()


# ── Backward-compat aliases ───────────────────────────────────────────────────


async def provision_tenant(_tenant: str = "") -> None:
    await ensure_db()


async def get_all_tenants() -> list[str]:
    """Return all active tenant IDs from the tenants table."""
    try:
        engine = _get_engine()
        async with engine.begin() as conn:
            rows = await conn.execute(
                text("SELECT id FROM tenants WHERE is_active = 1 AND deleted_at IS NULL")
            )
            ids = [row[0] for row in rows.fetchall()]
            return ids if ids else []
    except Exception:
        return []


async def migrate_all_tenants() -> None:
    await migrate_db()


# ══════════════════════════════════════════════════════════════════════════════
# MIGRATION FUNCTIONS
# Naming convention: _m<number>_<description>
# Numbers 001-099 are reserved for legacy/squashed history.
# New migrations start at 100.
# ══════════════════════════════════════════════════════════════════════════════


async def _m100_partition_log_tables(conn: AsyncConnection) -> None:
    """
    Convert the four high-volume log tables to quarterly RANGE partitions.

    MariaDB rule: the partition column (created_at) MUST be part of the PRIMARY KEY.
    We combine PK change + partitioning into ONE ALTER TABLE to avoid the implicit
    commit problem that occurs when DDL is split across two statements inside a
    shared transaction.

    partition_manager.py auto-creates future quarters via REORGANIZE PARTITION p_future.
    """
    from datetime import datetime

    now = datetime.utcnow()
    year = now.year

    partitions_sql = (
        f"PARTITION p_before_{year}  VALUES LESS THAN (TO_DAYS('{year}-01-01')), "
        f"PARTITION p{year}q1        VALUES LESS THAN (TO_DAYS('{year}-04-01')), "
        f"PARTITION p{year}q2        VALUES LESS THAN (TO_DAYS('{year}-07-01')), "
        f"PARTITION p{year}q3        VALUES LESS THAN (TO_DAYS('{year}-10-01')), "
        f"PARTITION p{year}q4        VALUES LESS THAN (TO_DAYS('{year + 1}-01-01')), "
        f"PARTITION p{year + 1}q1    VALUES LESS THAN (TO_DAYS('{year + 1}-04-01')), "
        f"PARTITION p_future         VALUES LESS THAN MAXVALUE"
    )

    tables = ["llm_usage_logs", "audit_logs", "performance_logs", "outbound_call_logs"]
    for table in tables:
        try:
            # MariaDB requires the partition column in the PK; DDL auto-commits.
            await conn.execute(
                text(f"ALTER TABLE {table} DROP PRIMARY KEY, ADD PRIMARY KEY (id, created_at)")
            )
            await conn.execute(
                text(
                    f"ALTER TABLE {table} "
                    f"PARTITION BY RANGE (TO_DAYS(created_at)) ({partitions_sql})"
                )
            )
            logger.info("  ~ %s: quarterly partitions applied", table)
        except Exception as exc:
            logger.warning("Partition skipped for %s: %s", table, str(exc)[:200])


async def _m101_seed_control_plane(conn: AsyncConnection) -> None:
    """
    Seed minimal control-plane data required for the Hub to function:
      - 3 system roles + permission matrix + role_permission assignments
      - 2 modules (credit_card_ocr, ap_invoice)
      - 3 banks (BBL, KBANK, SCB)

    All INSERTs use INSERT IGNORE — idempotent, never overwrites manual edits.
    No admin user is seeded; use the bootstrap CLI for first super_admin.
    """
    # ── Roles ──────────────────────────────────────────────────────────────
    roles = [
        ("super_admin", "Super Admin", "Full access including IAM. Cannot be deleted.", True),
        ("admin", "Admin", "Day-to-day operations. No role/permission management.", True),
        ("viewer", "Viewer", "Read-only access to dashboards and config.", True),
    ]
    for rid, name, desc, is_sys in roles:
        await conn.execute(
            text("""
            INSERT IGNORE INTO roles (id, name, description, is_system, created_at)
            VALUES (:id, :name, :desc, :sys, NOW())
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
                INSERT IGNORE INTO permissions (id, name, resource, action, created_at)
                VALUES (:id, :name, :res, :act, NOW())
            """),
                {"id": pid, "name": f"{action.title()} {resource}", "res": resource, "act": action},
            )

    # ── Role → Permission assignments ───────────────────────────────────────
    iam_resources = {"roles", "admin_users"}
    for pid in all_perms:
        resource = pid.split(":")[0]
        # super_admin: all
        await conn.execute(
            text("""
            INSERT IGNORE INTO role_permissions (role_id, permission_id)
            VALUES ('super_admin', :pid)
        """),
            {"pid": pid},
        )
        # admin: all except IAM
        if resource not in iam_resources:
            await conn.execute(
                text("""
                INSERT IGNORE INTO role_permissions (role_id, permission_id)
                VALUES ('admin', :pid)
            """),
                {"pid": pid},
            )
        # viewer: read-only
        if pid.endswith(":read"):
            await conn.execute(
                text("""
                INSERT IGNORE INTO role_permissions (role_id, permission_id)
                VALUES ('viewer', :pid)
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
            INSERT IGNORE INTO modules
                (id, display_name, description, is_active, sort_order, created_at)
            VALUES (:id, :name, :desc, :active, :order, NOW())
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
            INSERT IGNORE INTO banks
                (code, name, display_name_th, is_active, sort_order, created_at)
            VALUES (:code, :name, :name_th, :active, :order, NOW())
        """),
            {"code": code, "name": name, "name_th": name_th, "active": active, "order": order},
        )

    logger.info("  ~ control-plane seed data applied")


# ── Migration Registry ────────────────────────────────────────────────────────
# Append-only. Never reorder. Each entry runs exactly once per database.
#
# 001_squashed_initial_schema: covers all legacy migrations 001-033.
#   Requires a fresh carmen_ai database (drop + recreate before first run).
#   create_all() in ensure_db() builds the full schema from ORM models.


async def _m102_quota_drop_module(conn) -> None:
    """Quota is a tenant-level shared pool — drop the per-module column if it exists."""
    # All three statements are no-ops when the schema is already clean (fresh DB).
    await conn.execute(text("ALTER TABLE quotas DROP INDEX IF EXISTS ix_quotas_module"))
    await conn.execute(
        text("ALTER TABLE quotas DROP INDEX IF EXISTS uq_quota_tenant_module_period_metric")
    )
    await conn.execute(text("ALTER TABLE quotas DROP COLUMN IF EXISTS module"))
    await conn.execute(
        text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_quota_tenant_period_metric"
            " ON quotas (tenant_id, period, metric)"
        )
    )
    logger.info("  ~ quotas.module column removed; unique constraint updated")


async def _m103_plans_table(conn) -> None:
    """Add plans table as source of truth for quota limits; migrate tenants.plan to FK."""
    await conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS plans (
            code               VARCHAR(20)  NOT NULL,
            display_name       VARCHAR(100) NOT NULL,
            monthly_call_limit INT          NOT NULL,
            is_active          TINYINT(1)   NOT NULL DEFAULT 1,
            created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_by         VARCHAR(100) NULL,
            updated_by         VARCHAR(100) NULL,
            PRIMARY KEY (code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    )
    await conn.execute(
        text("""
        INSERT IGNORE INTO plans (code, display_name, monthly_call_limit) VALUES
            ('free',       'Free',       100),
            ('pro',        'Pro',        2000),
            ('enterprise', 'Enterprise', 50000)
    """)
    )
    # Migrate tenants.plan from ENUM → VARCHAR FK
    await conn.execute(
        text("ALTER TABLE tenants MODIFY COLUMN plan VARCHAR(20) NOT NULL DEFAULT 'free'")
    )
    fk_exists = (
        await conn.execute(
            text("""
        SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants'
        AND CONSTRAINT_NAME = 'fk_tenants_plan'
    """)
        )
    ).scalar()
    if not fk_exists:
        await conn.execute(
            text(
                "ALTER TABLE tenants ADD CONSTRAINT fk_tenants_plan"
                " FOREIGN KEY (plan) REFERENCES plans(code)"
            )
        )
    logger.info("  ~ plans table created and seeded; tenants.plan migrated to FK")


async def _m104_quota_is_custom(conn) -> None:
    """Add is_custom flag to quotas — prevents plan-sync from overwriting manual overrides."""
    await conn.execute(
        text("ALTER TABLE quotas ADD COLUMN IF NOT EXISTS is_custom TINYINT(1) NOT NULL DEFAULT 0")
    )
    logger.info("  ~ quotas.is_custom column added")


async def _m105_bu_config_tables(conn: AsyncConnection) -> None:
    """
    Create bu_accounting_configs and ap_vendor_column_mappings tables.
    These replace localStorage for user-facing config so settings survive cache clears.
    """
    await conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS bu_accounting_configs (
            id                INT          NOT NULL AUTO_INCREMENT,
            tenant_id         VARCHAR(36)  NOT NULL,
            business_unit_id  VARCHAR(36)  NOT NULL,
            bank_code         VARCHAR(20)  NULL,
            file_prefix       VARCHAR(20)  NULL,
            file_source       VARCHAR(20)  NULL,
            description       VARCHAR(255) NULL,
            mappings_json     TEXT         NULL,
            custom_types_json TEXT         NULL,
            created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at        DATETIME     NULL     ON UPDATE CURRENT_TIMESTAMP,
            deleted_at        DATETIME     NULL,
            deleted_by        VARCHAR(100) NULL,
            created_by        VARCHAR(100) NULL,
            updated_by        VARCHAR(100) NULL,
            PRIMARY KEY (id),
            CONSTRAINT fk_bu_acc_cfg_tenant
                FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            CONSTRAINT fk_bu_acc_cfg_bu
                FOREIGN KEY (business_unit_id) REFERENCES business_units(id),
            CONSTRAINT fk_bu_acc_cfg_bank
                FOREIGN KEY (bank_code) REFERENCES banks(code),
            CONSTRAINT uq_bu_accounting_config_scope
                UNIQUE (tenant_id, business_unit_id),
            INDEX ix_bu_acc_cfg_tenant (tenant_id),
            INDEX ix_bu_acc_cfg_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    )

    await conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS ap_vendor_column_mappings (
            id                  INT         NOT NULL AUTO_INCREMENT,
            tenant_id           VARCHAR(36) NOT NULL,
            business_unit_id    VARCHAR(36) NOT NULL,
            vendor_tax_id       VARCHAR(30) NOT NULL,
            field_mappings_json TEXT        NOT NULL,
            created_at          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at          DATETIME    NULL     ON UPDATE CURRENT_TIMESTAMP,
            deleted_at          DATETIME    NULL,
            deleted_by          VARCHAR(100) NULL,
            created_by          VARCHAR(100) NULL,
            updated_by          VARCHAR(100) NULL,
            PRIMARY KEY (id),
            CONSTRAINT fk_ap_vendor_map_tenant
                FOREIGN KEY (tenant_id) REFERENCES tenants(id),
            CONSTRAINT fk_ap_vendor_map_bu
                FOREIGN KEY (business_unit_id) REFERENCES business_units(id),
            CONSTRAINT uq_ap_vendor_mapping_scope
                UNIQUE (tenant_id, business_unit_id, vendor_tax_id),
            INDEX ix_ap_vendor_map_tenant (tenant_id),
            INDEX ix_ap_vendor_map_vendor (vendor_tax_id),
            INDEX ix_ap_vendor_map_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    )
    logger.info("  ~ bu_accounting_configs and ap_vendor_column_mappings tables created")


async def _m106_normalize_bu_mapping_entries(conn: AsyncConnection) -> None:
    """
    Replace mappings_json + custom_types_json TEXT blobs in bu_accounting_configs
    with a normalized bu_accounting_mapping_entries table.

    Each row = one field_type → (dept_code, acc_code) mapping for a BU config.
    is_custom=1 means the user manually added this payment type.
    Indexed on acc_code + dept_code so analytics queries are fast:
      SELECT business_unit_id WHERE acc_code = '5100-00'
    """
    import json as _json

    await conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS bu_accounting_mapping_entries (
            id          INT          NOT NULL AUTO_INCREMENT,
            config_id   INT          NOT NULL,
            field_type  VARCHAR(100) NOT NULL,
            dept_code   VARCHAR(100) NULL,
            acc_code    VARCHAR(100) NULL,
            is_custom   TINYINT(1)   NOT NULL DEFAULT 0,
            created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME     NULL     ON UPDATE CURRENT_TIMESTAMP,
            deleted_at  DATETIME     NULL,
            deleted_by  VARCHAR(100) NULL,
            PRIMARY KEY (id),
            CONSTRAINT fk_bu_map_entry_config
                FOREIGN KEY (config_id) REFERENCES bu_accounting_configs(id),
            CONSTRAINT uq_bu_mapping_entry_config_field
                UNIQUE (config_id, field_type),
            INDEX ix_bu_map_entry_acc  (acc_code),
            INDEX ix_bu_map_entry_dept (dept_code),
            INDEX ix_bu_map_entry_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    )

    # Migrate existing JSON data (if any rows were written between m105 and m106)
    existing = await conn.execute(
        text(
            "SELECT id, mappings_json, custom_types_json FROM bu_accounting_configs WHERE deleted_at IS NULL"
        )
    )
    rows = existing.fetchall()
    for cfg_id, mappings_json, custom_types_json in rows:
        if not mappings_json:
            continue
        try:
            mappings = _json.loads(mappings_json)
            custom_types = set(_json.loads(custom_types_json or "[]"))
            for field_type, m in mappings.items():
                dept = (m.get("dept") or "") or None
                acc = (m.get("acc") or "") or None
                is_c = 1 if field_type in custom_types else 0
                await conn.execute(
                    text("""
                    INSERT IGNORE INTO bu_accounting_mapping_entries
                        (config_id, field_type, dept_code, acc_code, is_custom)
                    VALUES (:cfg, :ft, :dept, :acc, :is_c)
                """),
                    {"cfg": cfg_id, "ft": field_type, "dept": dept, "acc": acc, "is_c": is_c},
                )
            # Custom types that have no mapping entry yet
            for ct in custom_types:
                if ct not in mappings:
                    await conn.execute(
                        text("""
                        INSERT IGNORE INTO bu_accounting_mapping_entries
                            (config_id, field_type, dept_code, acc_code, is_custom)
                        VALUES (:cfg, :ft, NULL, NULL, 1)
                    """),
                        {"cfg": cfg_id, "ft": ct},
                    )
        except Exception as exc:
            logger.warning("m106: could not migrate config_id=%s: %s", cfg_id, exc)

    # Drop the now-redundant JSON columns
    await conn.execute(
        text("ALTER TABLE bu_accounting_configs DROP COLUMN IF EXISTS mappings_json")
    )
    await conn.execute(
        text("ALTER TABLE bu_accounting_configs DROP COLUMN IF EXISTS custom_types_json")
    )
    logger.info("  ~ bu_accounting_mapping_entries created; JSON columns dropped")


async def _m107_bu_config_add_branch(conn: AsyncConnection) -> None:
    """Add branch column to bu_accounting_configs — branch is user-editable unlike
    name/taxId/address which are derived from the bank master data."""
    await conn.execute(
        text(
            "ALTER TABLE bu_accounting_configs ADD COLUMN IF NOT EXISTS"
            " branch VARCHAR(50) NULL AFTER description"
        )
    )
    logger.info("  ~ bu_accounting_configs.branch column added")


async def _m108_ocr_session_indexes(conn: AsyncConnection) -> None:
    """
    Add composite indexes to speed up two hot queries:
      1. Stale session cleanup in auth.py: WHERE tenant_id=? AND (is_active=0 OR created_at<?)
      2. quota_usage lookup: WHERE quota_id=? AND period_key=?
    """
    await conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_ocr_session_tenant_active"
            " ON ocr_sessions(tenant_id, is_active)"
        )
    )
    await conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_quota_usage_quota_period"
            " ON quota_usage(quota_id, period_key)"
        )
    )
    logger.info("  ~ ocr_sessions and quota_usage indexes added")


async def _m109_admin_user_role_drop_tenant_fk(conn: AsyncConnection) -> None:
    """
    Drop the FK on admin_user_roles.tenant_id.

    The column carries '' as a sentinel for "global scope" — that empty string
    has no corresponding tenants row, so the FK was unenforceable for global
    assignments. App layer must validate the UUID case.
    """
    row = (
        await conn.execute(
            text("""
        SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'admin_user_roles'
          AND COLUMN_NAME = 'tenant_id'
          AND REFERENCED_TABLE_NAME = 'tenants'
        LIMIT 1
    """)
        )
    ).fetchone()
    if row:
        fk_name = row[0]
        await conn.execute(text(f"ALTER TABLE admin_user_roles DROP FOREIGN KEY {fk_name}"))
        logger.info("  ~ admin_user_roles: dropped FK %s on tenant_id", fk_name)
    else:
        logger.info("  ~ admin_user_roles: no FK on tenant_id found, skipping")


async def _m110_normalize_ap_vendor_mapping(conn: AsyncConnection) -> None:
    """
    Normalize ap_vendor_column_mappings.field_mappings_json into rows.

    Mirrors m106 which did the same for bu_accounting_configs. Each row of the
    new ap_vendor_field_mapping_entries represents one (column_name → field_name)
    pair, indexed on field_name for analytics queries like 'which vendors map
    column X to field Y'.
    """
    import json as _json

    await conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS ap_vendor_field_mapping_entries (
            id          INT          NOT NULL AUTO_INCREMENT,
            mapping_id  INT          NOT NULL,
            column_name VARCHAR(255) NOT NULL,
            field_name  VARCHAR(100) NOT NULL,
            created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME     NULL     ON UPDATE CURRENT_TIMESTAMP,
            deleted_at  DATETIME     NULL,
            deleted_by  VARCHAR(100) NULL,
            PRIMARY KEY (id),
            CONSTRAINT fk_ap_vendor_entry_mapping
                FOREIGN KEY (mapping_id) REFERENCES ap_vendor_column_mappings(id),
            CONSTRAINT uq_ap_vendor_entry_mapping_col
                UNIQUE (mapping_id, column_name),
            INDEX ix_ap_vendor_entry_field_name (field_name),
            INDEX ix_ap_vendor_entry_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    )

    # Best-effort migrate existing JSON rows (column may already be gone on fresh installs)
    try:
        existing = await conn.execute(
            text(
                "SELECT id, field_mappings_json FROM ap_vendor_column_mappings"
                " WHERE deleted_at IS NULL"
            )
        )
        for mapping_id, json_str in existing.fetchall():
            if not json_str:
                continue
            try:
                mapping = _json.loads(json_str)
            except Exception as exc:
                logger.warning("m110: bad JSON for mapping_id=%s: %s", mapping_id, exc)
                continue
            for column_name, field_name in mapping.items():
                if not column_name or not field_name:
                    continue
                await conn.execute(
                    text("""
                    INSERT IGNORE INTO ap_vendor_field_mapping_entries
                        (mapping_id, column_name, field_name)
                    VALUES (:m, :c, :f)
                """),
                    {"m": mapping_id, "c": column_name, "f": str(field_name)},
                )
    except Exception as exc:
        logger.info("m110: skip JSON migration (%s)", str(exc)[:100])

    await conn.execute(
        text("ALTER TABLE ap_vendor_column_mappings DROP COLUMN IF EXISTS field_mappings_json")
    )
    logger.info("  ~ ap_vendor_field_mapping_entries created; JSON column dropped")


async def _m111_convert_doc_dates(conn: AsyncConnection) -> None:
    """
    Convert doc_date / tx_date from VARCHAR to DATE.

    Strategy:
      1. Add temp column doc_date_new DATE.
      2. Populate via STR_TO_DATE for DD/MM/YYYY strings; everything else → NULL.
      3. Drop old VARCHAR column, rename new column.

    On fresh installs the column is already DATE (from create_all) so we skip.
    """
    targets = [
        ("credit_cards", "doc_date"),
        ("credit_card_transactions", "tx_date"),
        ("ap_invoices", "doc_date"),
    ]
    for table, col in targets:
        col_type = (
            await conn.execute(
                text("""
            SELECT DATA_TYPE FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME   = :t
              AND COLUMN_NAME  = :c
        """),
                {"t": table, "c": col},
            )
        ).scalar()

        if col_type is None:
            logger.info("  ~ %s.%s: column missing, skipping", table, col)
            continue
        if col_type.lower() == "date":
            logger.info("  ~ %s.%s: already DATE, skipping", table, col)
            continue

        await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col}_new DATE NULL"))
        # Try multiple input formats; first match wins, the rest stay NULL.
        await conn.execute(
            text(f"""
            UPDATE {table} SET {col}_new = CASE
                WHEN {col} REGEXP '^[0-9]{{1,2}}/[0-9]{{1,2}}/[0-9]{{4}}$'
                    THEN STR_TO_DATE({col}, '%d/%m/%Y')
                WHEN {col} REGEXP '^[0-9]{{4}}-[0-9]{{2}}-[0-9]{{2}}$'
                    THEN STR_TO_DATE({col}, '%Y-%m-%d')
                ELSE NULL
            END
            WHERE {col} IS NOT NULL
        """)
        )
        await conn.execute(text(f"ALTER TABLE {table} DROP COLUMN {col}"))
        await conn.execute(text(f"ALTER TABLE {table} CHANGE {col}_new {col} DATE NULL"))
        logger.info("  ~ %s.%s: VARCHAR → DATE conversion complete", table, col)

    # Indexes referenced by ORM (Column(Date, index=True))
    await conn.execute(
        text("CREATE INDEX IF NOT EXISTS ix_credit_cards_doc_date ON credit_cards(doc_date)")
    )
    await conn.execute(
        text("CREATE INDEX IF NOT EXISTS ix_ap_invoices_doc_date ON ap_invoices(doc_date)")
    )


_MIGRATIONS: list[tuple[str, object]] = [
    # ── Squashed history (001–033) ────────────────────────────────────────────
    ("001_squashed_initial_schema", None),
    # ── Live migrations (100+) ────────────────────────────────────────────────
    ("100_partition_log_tables", _m100_partition_log_tables),
    ("101_seed_control_plane", _m101_seed_control_plane),
    ("102_quota_drop_module", _m102_quota_drop_module),
    ("103_plans_table", _m103_plans_table),
    ("104_quota_is_custom", _m104_quota_is_custom),
    ("105_bu_config_tables", _m105_bu_config_tables),
    ("106_normalize_bu_mapping_entries", _m106_normalize_bu_mapping_entries),
    ("107_bu_config_add_branch", _m107_bu_config_add_branch),
    ("108_ocr_session_indexes", _m108_ocr_session_indexes),
    ("109_admin_user_role_drop_tenant_fk", _m109_admin_user_role_drop_tenant_fk),
    ("110_normalize_ap_vendor_mapping", _m110_normalize_ap_vendor_mapping),
    ("111_convert_doc_dates", _m111_convert_doc_dates),
]


async def migrate_db(_tenant: str = "") -> None:
    """Run pending migrations on carmen_ai. _tenant param kept for backward compat."""
    engine = _get_engine()
    async with engine.begin() as conn:
        await conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name       VARCHAR(100) PRIMARY KEY,
                applied_at DATETIME     DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        )
        rows = await conn.execute(text("SELECT name FROM schema_migrations"))
        applied = {row[0] for row in rows.fetchall()}

        for name, fn in _MIGRATIONS:
            if name in applied:
                continue
            if fn is None:
                await conn.execute(
                    text("INSERT IGNORE INTO schema_migrations (name) VALUES (:name)"),
                    {"name": name},
                )
                continue
            logger.info("Applying migration: %s", name)
            try:
                await fn(conn)
                await conn.execute(
                    text("INSERT INTO schema_migrations (name) VALUES (:name)"),
                    {"name": name},
                )
                logger.info("Migration %s applied.", name)
            except Exception as exc:
                logger.error("Migration %s FAILED: %s", name, exc)
                raise
