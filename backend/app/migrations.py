"""
Database migrations — append-only list of schema changes.

Naming convention: _m<number>_<description>
Numbers 001-099 are reserved for legacy/squashed history.
New migrations start at 100.

Rules:
  - Never reorder entries in _MIGRATIONS.
  - Never rename an already-applied entry.
  - Add new migrations at the bottom only.
"""

import logging
from collections.abc import Awaitable, Callable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# Migration functions
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


async def _m102_quota_drop_module(conn: AsyncConnection) -> None:
    """Quota is a tenant-level shared pool — drop the per-module column if it exists."""
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


async def _m103_plans_table(conn: AsyncConnection) -> None:
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


async def _m104_quota_is_custom(conn: AsyncConnection) -> None:
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

    # Idempotency guard: a prior partial run may have already dropped the JSON
    # columns (MySQL DDL implicit-commits even when the surrounding transaction
    # rolls back, so schema_migrations can lag behind real schema state).
    col_check = await conn.execute(
        text("""
            SELECT COLUMN_NAME FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'bu_accounting_configs'
              AND COLUMN_NAME IN ('mappings_json', 'custom_types_json')
        """)
    )
    present_cols = {row[0] for row in col_check.fetchall()}
    has_mappings = "mappings_json" in present_cols
    has_custom_types = "custom_types_json" in present_cols

    if has_mappings:
        select_sql = (
            "SELECT id, mappings_json, custom_types_json FROM bu_accounting_configs"
            " WHERE deleted_at IS NULL"
            if has_custom_types
            else "SELECT id, mappings_json, NULL FROM bu_accounting_configs WHERE deleted_at IS NULL"
        )
        existing = await conn.execute(text(select_sql))
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
    else:
        logger.info("  ~ m106: JSON columns already absent — skipping data migration")

    await conn.execute(
        text("ALTER TABLE bu_accounting_configs DROP COLUMN IF EXISTS mappings_json")
    )
    await conn.execute(
        text("ALTER TABLE bu_accounting_configs DROP COLUMN IF EXISTS custom_types_json")
    )
    logger.info("  ~ bu_accounting_mapping_entries created; JSON columns dropped")


async def _m107_bu_config_add_branch(conn: AsyncConnection) -> None:
    """Add branch column to bu_accounting_configs."""
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
      1. Stale session cleanup: WHERE tenant_id=? AND (is_active=0 OR created_at<?)
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
    Mirrors m106 for bu_accounting_configs.
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

    await conn.execute(
        text("CREATE INDEX IF NOT EXISTS ix_credit_cards_doc_date ON credit_cards(doc_date)")
    )
    await conn.execute(
        text("CREATE INDEX IF NOT EXISTS ix_ap_invoices_doc_date ON ap_invoices(doc_date)")
    )


# ── Migration Registry ────────────────────────────────────────────────────────
# Append-only. Never reorder. Each entry runs exactly once per database.
#
# 001_squashed_initial_schema: covers all legacy migrations 001-033.
#   Requires a fresh carmen_ai database (drop + recreate before first run).
#   create_all() in ensure_db() builds the full schema from ORM models.

_MIGRATIONS: list[tuple[str, Callable[[AsyncConnection], Awaitable[None]] | None]] = [
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
