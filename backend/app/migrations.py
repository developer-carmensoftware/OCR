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


async def _m206_collapse_tenant_bu(conn: AsyncConnection) -> None:
    """
    Collapse two-level (tenant + business_unit) hierarchy into one composite
    tenant row keyed by (host, bu_code).

    - Adds `bu_code` to `tenants`, swaps the unique key from (host) to (host, bu_code).
    - Drops `business_unit_id` from every table that has it (data plane + observability).
    - Drops the `business_units` table.

    Idempotent. On a fresh DB built post-migration via Base.metadata.create_all(),
    the new schema is already correct and this is effectively a no-op (no legacy
    columns to drop, no legacy table to remove).
    """
    # 1. bu_code on tenants
    await conn.execute(text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS bu_code VARCHAR(100)"))
    await conn.execute(
        text("UPDATE tenants SET bu_code = COALESCE(bu_code, 'DEFAULT') WHERE bu_code IS NULL")
    )
    await conn.execute(text("ALTER TABLE tenants ALTER COLUMN bu_code SET NOT NULL"))

    # 2. Swap unique key on (host) → partial unique on (host, bu_code)
    await conn.execute(text("ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_host_key"))
    await conn.execute(text("DROP INDEX IF EXISTS ix_tenants_host"))
    await conn.execute(
        text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_host_bu_active "
            "ON tenants (host, bu_code) WHERE deleted_at IS NULL"
        )
    )
    await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_tenants_host ON tenants (host)"))

    # 3. Drop business_unit_id from every table that has it
    await conn.execute(
        text("""
        DO $$
        DECLARE r record;
        BEGIN
          FOR r IN
            SELECT table_name FROM information_schema.columns
            WHERE column_name = 'business_unit_id'
              AND table_schema = current_schema()
          LOOP
            EXECUTE format('ALTER TABLE %I DROP COLUMN business_unit_id', r.table_name);
          END LOOP;
        END$$;
        """)
    )

    # 4. Drop the business_units table itself
    await conn.execute(text("DROP TABLE IF EXISTS business_units CASCADE"))

    logger.info("  ~ tenant + business_unit collapsed into single composite tenant")


async def _m207_drop_mapping_history(conn: AsyncConnection) -> None:
    """Drop the legacy mapping_history table.

    Credit-card GL mapping history is now derived live from Carmen
    (/spGetListJvBySource), mirroring AP invoice vendor history — so the local
    table is redundant (data minimization: Carmen is the source of truth).
    """
    await conn.execute(text("DROP TABLE IF EXISTS mapping_history CASCADE"))
    logger.info("  ~ dropped mapping_history (now derived from Carmen JV history)")


async def _m208_credit_topup_billing(conn: AsyncConnection) -> None:
    """
    Switch billing from plan tiers to "free 30 docs/month + top-up credits".

    - Free tier: everyone on `free` with a 30/month quota (auto-resets via
      period_key). pro/enterprise tenants are downgraded to free.
    - Top-up credits: a persistent balance (tables created by create_all) that
      kicks in once the monthly free quota is spent; never expires.

    New tables (tenant_credits, credit_ledger, credit_packs, credit_orders) are
    built by Base.metadata.create_all(); this migration only adjusts data + seeds
    the pack catalog. Idempotent.
    """
    # 1. Free plan limit → 30 docs/month
    await conn.execute(text("UPDATE plans SET monthly_call_limit = 30 WHERE code = 'free'"))

    # 2. Everyone on free; retire the old paid tiers
    await conn.execute(
        text(
            "UPDATE tenants SET plan = 'free' "
            "WHERE plan IN ('pro', 'enterprise') AND deleted_at IS NULL"
        )
    )
    await conn.execute(
        text("UPDATE plans SET is_active = false WHERE code IN ('pro', 'enterprise')")
    )

    # 3. Sync existing non-custom monthly call quotas to 30 immediately
    #    (login also syncs, but make the change take effect without a re-login)
    await conn.execute(
        text(
            "UPDATE quotas SET limit_value = 30 "
            "WHERE metric = 'calls' AND period = 'monthly' "
            "AND is_custom = false AND deleted_at IS NULL"
        )
    )

    # 4. Seed the top-up pack catalog (30 = the free tier, so NOT a pack)
    packs = [
        ("p100", 100, 290.00, 1),
        ("p500", 500, 1250.00, 2),
        ("p1000", 1000, 2000.00, 3),
        ("p5000", 5000, 7500.00, 4),
    ]
    for code, credits, price, order in packs:
        await conn.execute(
            text("""
                INSERT INTO credit_packs
                    (code, credits, price_thb, is_active, sort_order, created_at)
                VALUES (:code, :credits, :price, true, :order, NOW())
                ON CONFLICT (code) DO NOTHING
            """),
            {"code": code, "credits": credits, "price": price, "order": order},
        )

    logger.info("  ~ billing switched to free 30/month + top-up credits; pack catalog seeded")


async def _m209_tenant_credits_lifetime_cols(conn: AsyncConnection) -> None:
    """
    Add credits_purchased / credits_consumed to tenant_credits.

    These lifetime-counter columns were added to the ORM model after the table
    was first created by create_all(); existing rows default to 0.
    """
    await conn.execute(
        text(
            "ALTER TABLE tenant_credits "
            "ADD COLUMN IF NOT EXISTS credits_purchased INTEGER NOT NULL DEFAULT 0"
        )
    )
    await conn.execute(
        text(
            "ALTER TABLE tenant_credits "
            "ADD COLUMN IF NOT EXISTS credits_consumed INTEGER NOT NULL DEFAULT 0"
        )
    )
    logger.info("  ~ tenant_credits: added credits_purchased + credits_consumed")


async def _m210_credit_ledger_ref_text(conn: AsyncConnection) -> None:
    """
    Widen credit_ledger.ref from VARCHAR(64) to TEXT.

    The ref column was used for UUIDs (≤36 chars) in TOPUP/ADMIN_ADJUST records,
    but for CONSUMPTION records it stores filenames which can exceed 64 chars,
    causing silent transaction rollback and preventing credit deduction.
    """
    await conn.execute(text("ALTER TABLE credit_ledger ALTER COLUMN ref TYPE TEXT"))
    logger.info("  ~ credit_ledger.ref widened to TEXT")


async def _m214_drop_ap_vendor_field_config(conn: AsyncConnection) -> None:
    """Drop tables created by the reverted field-mapping engine (migrations 211-213)."""
    await conn.execute(text("DROP TABLE IF EXISTS ap_vendor_field_config CASCADE"))
    logger.info("  ~ dropped ap_vendor_field_config (engine reverted)")


async def _m216_postgres_best_practices(conn: AsyncConnection) -> None:
    """
    Apply Postgres best-practice fixes in one shot:

    1. Convert every timestamp column to timestamptz (USING ... AT TIME ZONE 'UTC').
    2. Fix DailyUsageSummary.summary_date and APIKeyUsage.usage_date to DATE.
    3. Add composite indexes on llm_usage_logs / performance_logs / audit_logs.
    4. Add missing FK indexes on role_permissions.permission_id and
       admin_user_roles.role_id.
    5. Add partial unique index for credit-card duplicate check.
    6. Add partial composite index for active session lookups.

    All DDL statements are idempotent (IF NOT EXISTS / IF EXISTS where applicable).
    """

    # ── 1. timestamp → timestamptz ────────────────────────────────────────────
    # Each USING clause re-interprets the stored value as UTC so no wall-clock
    # data is lost (Supabase/Postgres always runs in UTC).
    timestamp_columns: list[tuple[str, str]] = [
        # mixins → every table via inheritance
        ("ocr_sessions", "created_at"),
        ("ocr_sessions", "updated_at"),
        ("ocr_sessions", "deleted_at"),
        ("ocr_sessions", "last_used_at"),
        ("ocr_tasks", "created_at"),
        ("ocr_tasks", "updated_at"),
        ("ocr_tasks", "deleted_at"),
        ("ocr_tasks", "completed_at"),
        ("credit_cards", "created_at"),
        ("credit_cards", "updated_at"),
        ("credit_cards", "deleted_at"),
        ("credit_cards", "submitted_at"),
        ("ap_invoices", "created_at"),
        ("ap_invoices", "updated_at"),
        ("ap_invoices", "deleted_at"),
        ("ap_invoices", "submitted_at"),
        ("correction_feedback", "created_at"),
        ("correction_feedback", "updated_at"),
        ("correction_feedback", "deleted_at"),
        ("bu_accounting_configs", "created_at"),
        ("bu_accounting_configs", "updated_at"),
        ("bu_accounting_configs", "deleted_at"),
        ("bu_accounting_mapping_entries", "created_at"),
        ("bu_accounting_mapping_entries", "updated_at"),
        ("bu_accounting_mapping_entries", "deleted_at"),
        ("ap_vendor_column_mappings", "created_at"),
        ("ap_vendor_column_mappings", "updated_at"),
        ("ap_vendor_column_mappings", "deleted_at"),
        ("ap_vendor_field_mapping_entries", "created_at"),
        ("ap_vendor_field_mapping_entries", "updated_at"),
        ("ap_vendor_field_mapping_entries", "deleted_at"),
        ("bug_reports", "created_at"),
        ("bug_reports", "updated_at"),
        ("bug_reports", "deleted_at"),
        ("tenants", "created_at"),
        ("tenants", "updated_at"),
        ("tenants", "deleted_at"),
        ("plans", "created_at"),
        ("plans", "updated_at"),
        ("admin_users", "created_at"),
        ("admin_users", "updated_at"),
        ("admin_users", "deleted_at"),
        ("admin_users", "last_login_at"),
        ("admin_users", "locked_until"),
        ("admin_user_roles", "created_at"),
        ("admin_user_roles", "updated_at"),
        ("admin_user_roles", "expires_at"),
        ("api_keys", "created_at"),
        ("api_keys", "updated_at"),
        ("api_keys", "expires_at"),
        ("api_keys", "last_used_at"),
        ("api_keys", "revoked_at"),
        ("api_key_usage", "created_at"),
        ("api_key_usage", "updated_at"),
        ("modules", "created_at"),
        ("modules", "updated_at"),
        ("tenant_modules", "created_at"),
        ("tenant_modules", "updated_at"),
        ("tenant_modules", "enabled_at"),
        ("tenant_modules", "disabled_at"),
        ("banks", "created_at"),
        ("banks", "updated_at"),
        ("banks", "deleted_at"),
        ("prompt_templates", "created_at"),
        ("prompt_templates", "updated_at"),
        ("prompt_templates", "deleted_at"),
        ("prompt_templates", "published_at"),
        ("system_configs", "created_at"),
        ("system_configs", "updated_at"),
        ("tenant_config_overrides", "created_at"),
        ("tenant_config_overrides", "updated_at"),
        ("feature_flags", "created_at"),
        ("feature_flags", "updated_at"),
        ("quotas", "created_at"),
        ("quotas", "updated_at"),
        ("quotas", "deleted_at"),
        ("quota_usage", "created_at"),
        ("quota_usage", "updated_at"),
        ("quota_usage", "last_updated_at"),
        ("model_pricing", "created_at"),
        ("model_pricing", "updated_at"),
        ("model_pricing", "price_verified_at"),
        ("credit_packs", "created_at"),
        ("credit_packs", "updated_at"),
        ("tenant_credits", "created_at"),
        ("tenant_credits", "updated_at"),
        ("credit_ledger", "created_at"),
        ("credit_ledger", "updated_at"),
        ("credit_orders", "created_at"),
        ("credit_orders", "updated_at"),
        ("credit_orders", "deleted_at"),
        ("credit_orders", "paid_at"),
        ("credit_orders", "approved_at"),
        ("llm_usage_logs", "created_at"),
        ("llm_usage_logs", "updated_at"),
        ("audit_logs", "created_at"),
        ("audit_logs", "updated_at"),
        ("performance_logs", "created_at"),
        ("performance_logs", "updated_at"),
        ("outbound_call_logs", "created_at"),
        ("outbound_call_logs", "updated_at"),
        ("daily_usage_summary", "created_at"),
        ("daily_usage_summary", "updated_at"),
        ("daily_model_cost", "created_at"),
        ("daily_model_cost", "updated_at"),
        ("monthly_usage_summary", "created_at"),
        ("monthly_usage_summary", "updated_at"),
        ("anomaly_alerts", "created_at"),
        ("anomaly_alerts", "updated_at"),
        ("anomaly_alerts", "resolved_at"),
        ("job_runs", "created_at"),
        ("job_runs", "updated_at"),
        ("job_runs", "started_at"),
        ("job_runs", "completed_at"),
        ("schema_migrations", "applied_at"),
        ("permissions", "created_at"),
        ("permissions", "updated_at"),
        ("roles", "created_at"),
        ("roles", "updated_at"),
        ("roles", "deleted_at"),
    ]

    for table, col in timestamp_columns:
        await conn.execute(
            text(f"""
                DO $$
                BEGIN
                  IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = '{table}'
                      AND column_name = '{col}'
                      AND table_schema = current_schema()
                      AND data_type = 'timestamp without time zone'
                  ) THEN
                    ALTER TABLE {table}
                      ALTER COLUMN {col} TYPE TIMESTAMPTZ
                      USING {col} AT TIME ZONE 'UTC';
                  END IF;
                END$$;
            """)
        )

    # ── 2. Fix date-only columns stored as TIMESTAMP ──────────────────────────
    for table, col in [
        ("daily_usage_summary", "summary_date"),
        ("api_key_usage", "usage_date"),
    ]:
        await conn.execute(
            text(f"""
                DO $$
                BEGIN
                  IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = '{table}'
                      AND column_name = '{col}'
                      AND table_schema = current_schema()
                      AND data_type IN ('timestamp without time zone',
                                        'timestamp with time zone')
                  ) THEN
                    ALTER TABLE {table}
                      ALTER COLUMN {col} TYPE DATE
                      USING {col}::DATE;
                  END IF;
                END$$;
            """)
        )

    # ── 3. Composite indexes on high-traffic log tables ───────────────────────
    await conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_llm_usage_tenant_created "
            "ON llm_usage_logs (tenant_id, created_at)"
        )
    )
    await conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_llm_usage_tenant_module_created "
            "ON llm_usage_logs (tenant_id, module_id, created_at)"
        )
    )
    await conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_perf_logs_tenant_created "
            "ON performance_logs (tenant_id, created_at)"
        )
    )
    await conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_audit_logs_tenant_created "
            "ON audit_logs (tenant_id, created_at)"
        )
    )

    # ── 4. Missing FK indexes on RBAC junction tables ─────────────────────────
    await conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_role_permissions_permission_id "
            "ON role_permissions (permission_id)"
        )
    )
    await conn.execute(
        text("CREATE INDEX IF NOT EXISTS ix_admin_user_roles_role_id ON admin_user_roles (role_id)")
    )

    # ── 5. DB-level unique constraint for credit-card duplicate check ─────────
    await conn.execute(
        text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_card_no_dup "
            "ON credit_cards (tenant_id, bank_code, doc_no) "
            "WHERE submitted_at IS NOT NULL AND deleted_at IS NULL"
        )
    )

    # ── 6. Partial composite index for active session hot path ────────────────
    await conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_ocr_sessions_active "
            "ON ocr_sessions (tenant_id, carmen_user_id) "
            "WHERE is_active = true AND deleted_at IS NULL"
        )
    )

    logger.info("  ~ migration 216: timestamptz, date fixes, composite/FK/partial indexes applied")


async def _m215_quota_monthly_to_free_trial(conn: AsyncConnection) -> None:
    """
    Switch from monthly-reset quota to a one-time lifetime free trial (30 calls).

    The monthly quota auto-reset by returning a new period_key each month.
    The new LIFETIME quota uses fixed period_key "free_trial" — it never resets.
    Existing monthly usage is NOT carried over; every tenant starts with a fresh
    30-call free trial.

    Monthly quota rows are soft-deleted (not dropped) so historical data is preserved.
    """
    # Step 1: soft-delete all active monthly/calls quotas
    await conn.execute(
        text(
            "UPDATE quotas SET deleted_at = NOW() "
            "WHERE period = 'monthly' AND metric = 'calls' "
            "AND is_custom = false AND deleted_at IS NULL"
        )
    )

    # Step 2: insert a lifetime/calls quota for each tenant that had a monthly one
    await conn.execute(
        text(
            "INSERT INTO quotas (id, tenant_id, period, metric, limit_value, "
            "soft_warn_pct, is_hard, is_custom, created_at) "
            "SELECT gen_random_uuid(), tenant_id, 'lifetime', 'calls', 30, 0.80, true, false, NOW() "
            "FROM quotas "
            "WHERE period = 'monthly' AND metric = 'calls' AND deleted_at IS NOT NULL "
            "ON CONFLICT DO NOTHING"
        )
    )
    logger.info("  ~ quota migrated: monthly → lifetime free trial (30 calls, no reset)")


async def _m217_soft_delete_stray_monthly_quota(conn: AsyncConnection) -> None:
    """
    Retire any remaining ACTIVE monthly/calls quota rows.

    Migration 215 switched quotas from monthly-reset to a lifetime free trial, and the
    login path (upsert_tenant_quota) no longer creates — nor soft-deletes — monthly rows.
    This one-time sweep soft-deletes any stray active monthly/calls quota left over from
    the rolling deploy, so a tenant can never end up with both an active monthly and an
    active lifetime CALLS quota (which would double-count usage).
    """
    await conn.execute(
        text(
            "UPDATE quotas SET deleted_at = NOW() "
            "WHERE period = 'monthly' AND metric = 'calls' AND deleted_at IS NULL"
        )
    )
    logger.info("  ~ stray active monthly/calls quotas soft-deleted")


_MIGRATIONS: list[tuple[str, Callable[[AsyncConnection], Awaitable[None]] | None]] = [
    # ── Squashed history markers ──────────────────────────────────────────────
    ("001_squashed_initial_schema", None),
    ("199_pg_baseline", None),
    # ── Live migrations (200+) ────────────────────────────────────────────────
    ("200_pg_seed_control_plane", _m200_pg_seed_control_plane),
    # Markers: DDL handled by create_all()
    ("201_uuid_native_type", None),
    ("202_partial_unique_indexes", None),
    ("203_partition_log_tables", None),
    ("204_analytics_tables", None),
    ("205_bug_reports_table", None),
    ("206_collapse_tenant_bu", _m206_collapse_tenant_bu),
    ("207_drop_mapping_history", _m207_drop_mapping_history),
    ("208_credit_topup_billing", _m208_credit_topup_billing),
    ("209_tenant_credits_lifetime_cols", _m209_tenant_credits_lifetime_cols),
    ("210_credit_ledger_ref_text", _m210_credit_ledger_ref_text),
    # Markers: 211-213 were applied to prod DB then the engine was reverted from code
    ("211_ap_vendor_field_config_table", None),
    ("212_ap_vendor_field_config_indexes", None),
    ("213_widen_vendor_tax_id", None),
    ("214_drop_ap_vendor_field_config", _m214_drop_ap_vendor_field_config),
    ("215_quota_monthly_to_free_trial", _m215_quota_monthly_to_free_trial),
    ("216_postgres_best_practices", _m216_postgres_best_practices),
    ("217_soft_delete_stray_monthly_quota", _m217_soft_delete_stray_monthly_quota),
]
