"""
One-time migration: ocr_db (shared schema) → carmen_ai_{tenant} (separate schema).

Run ONCE on the existing server before deploying the new application code.
The script is idempotent — safe to re-run if interrupted.

Usage:
    cd backend
    venv\\Scripts\activate
    python scripts/migrate_to_separate_schema.py [--dry-run]

Steps performed per tenant found in the old DB:
    1. CREATE DATABASE IF NOT EXISTS carmen_ai_{tenant}
    2. Create all tables via ORM (create_all)
    3. Copy rows from every table, stripping the tenant column
    4. Mark all legacy migrations as applied in schema_migrations
    5. Print row counts before / after for verification

After running:
    - Verify row counts match
    - Deploy new application code
    - The old ocr_db can be kept as a backup or dropped manually
"""

import asyncio
import sys
from pathlib import Path

# Allow importing from the backend app package
sys.path.insert(0, str(Path(__file__).parent.parent))

import argparse
import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

# ── Tables to migrate and their non-tenant columns ───────────────────────────

_TABLES: list[tuple[str, list[str]]] = [
    (
        "ocr_tasks",
        [
            "id",
            "original_filename",
            "status",
            "ocr_engine",
            "error_message",
            "created_at",
            "completed_at",
        ],
    ),
    (
        "credit_cards",
        [
            "id",
            "task_id",
            "bank_name",
            "bank_type",
            "doc_name",
            "company_name",
            "doc_date",
            "doc_no",
            "merchant_name",
            "bank_companyname",
            "branch_no",
            "transactions",
            "submitted_at",
            "created_at",
        ],
    ),
    (
        "ap_invoices",
        [
            "id",
            "task_id",
            "user_id",
            "vendor_name",
            "doc_no",
            "doc_date",
            "original_filename",
            "created_at",
        ],
    ),
    (
        "ocr_sessions",
        [
            "id",
            "carmen_token_encrypted",
            "user_id",
            "username",
            "bu",
            "is_active",
            "created_at",
            "last_used_at",
        ],
    ),
    (
        "mapping_history",
        [
            "id",
            "bank_name",
            "field_type",
            "dept_code",
            "acc_code",
            "confirmed_count",
            "updated_at",
        ],
    ),
    (
        "correction_feedback",
        [
            "id",
            "doc_no",
            "bank_type",
            "field_name",
            "original_value",
            "corrected_value",
            "user_id",
            "created_at",
        ],
    ),
    (
        "llm_usage_logs",
        [
            "id",
            "task_id",
            "usage_type",
            "model",
            "prompt_tokens",
            "completion_tokens",
            "total_tokens",
            "duration_ms",
            "cost_usd",
            "session_id",
            "user_id",
            "bu_name",
            "created_at",
        ],
    ),
    (
        "audit_logs",
        [
            "id",
            "session_id",
            "user_id",
            "username",
            "bu",
            "action",
            "resource",
            "document_ref",
            "ip_address",
            "created_at",
        ],
    ),
    (
        "performance_logs",
        [
            "id",
            "endpoint",
            "method",
            "duration_ms",
            "status_code",
            "user_id",
            "document_ref",
            "created_at",
        ],
    ),
    (
        "outbound_call_logs",
        [
            "id",
            "service",
            "url",
            "method",
            "status_code",
            "duration_ms",
            "request_size_bytes",
            "session_id",
            "user_id",
            "created_at",
        ],
    ),
    (
        "daily_usage_summary",
        [
            "id",
            "summary_date",
            "total_documents",
            "total_submissions",
            "total_llm_calls",
            "total_tokens",
            "total_cost_usd",
            "avg_llm_latency_ms",
            "total_api_calls",
            "avg_api_latency_ms",
            "p95_api_latency_ms",
            "total_errors",
            "total_corrections",
            "total_outbound_calls",
            "created_at",
        ],
    ),
    (
        "model_pricing",
        [
            "model_name",
            "input_price_per_1m",
            "output_price_per_1m",
            "source",
            "price_verified_at",
            "updated_at",
        ],
    ),
]

# Tables where rows are tenant-scoped (have a `tenant` column in old DB)
_TENANT_SCOPED = {
    "ocr_tasks",
    "credit_cards",
    "ap_invoices",
    "ocr_sessions",
    "mapping_history",
    "correction_feedback",
    "llm_usage_logs",
    "audit_logs",
    "performance_logs",
    "outbound_call_logs",
    "daily_usage_summary",
}

# Tables shared across tenants — copy once into every tenant DB
_GLOBAL_TABLES = {"model_pricing"}

_BATCH = 1000  # rows per INSERT batch


async def get_distinct_tenants(src_conn) -> list[str]:
    result = await src_conn.execute(
        text("SELECT DISTINCT tenant FROM ocr_tasks WHERE tenant IS NOT NULL")
    )
    tenants = [row[0] for row in result.fetchall()]
    logger.info("Found %d tenant(s): %s", len(tenants), tenants)
    return tenants


async def table_exists(conn, table: str) -> bool:
    r = await conn.execute(text(f"SHOW TABLES LIKE '{table}'"))
    return r.fetchone() is not None


async def copy_tenant_table(
    src_conn, dst_conn, table: str, columns: list[str], tenant: str, dry_run: bool
) -> int:
    src_cols = ", ".join(columns)
    result = await src_conn.execute(
        text(f"SELECT {src_cols} FROM {table} WHERE tenant = :tenant ORDER BY id"),
        {"tenant": tenant},
    )
    rows = result.fetchall()
    if not rows:
        return 0
    if dry_run:
        logger.info("  [dry-run] %s: would copy %d rows", table, len(rows))
        return len(rows)

    col_list = ", ".join(columns)
    placeholders = ", ".join(f":{c}" for c in columns)
    insert_sql = text(f"INSERT IGNORE INTO {table} ({col_list}) VALUES ({placeholders})")
    for i in range(0, len(rows), _BATCH):
        batch = [dict(zip(columns, row)) for row in rows[i : i + _BATCH]]
        await dst_conn.execute(insert_sql, batch)
    await dst_conn.commit()
    logger.info("  ✓ %s: %d rows copied", table, len(rows))
    return len(rows)


async def copy_global_table(
    src_conn, dst_conn, table: str, columns: list[str], dry_run: bool
) -> int:
    col_list = ", ".join(columns)
    result = await src_conn.execute(text(f"SELECT {col_list} FROM {table}"))
    rows = result.fetchall()
    if not rows:
        return 0
    if dry_run:
        logger.info("  [dry-run] %s: would copy %d rows", table, len(rows))
        return len(rows)

    placeholders = ", ".join(f":{c}" for c in columns)
    insert_sql = text(f"INSERT IGNORE INTO {table} ({col_list}) VALUES ({placeholders})")
    for i in range(0, len(rows), _BATCH):
        batch = [dict(zip(columns, row)) for row in rows[i : i + _BATCH]]
        await dst_conn.execute(insert_sql, batch)
    await dst_conn.commit()
    logger.info("  ✓ %s: %d rows copied", table, len(rows))
    return len(rows)


async def mark_migrations_applied(dst_conn, migration_names: list[str]) -> None:
    await dst_conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name       VARCHAR(100) PRIMARY KEY,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    )
    for name in migration_names:
        await dst_conn.execute(
            text("INSERT IGNORE INTO schema_migrations (name) VALUES (:name)"),
            {"name": name},
        )
    await dst_conn.commit()


async def run(database_url: str, dry_run: bool) -> None:
    from app.database import _MIGRATIONS, Base

    db_root = database_url.rsplit("/", 1)[0]
    src_url = database_url  # old ocr_db
    migration_names = [name for name, _ in _MIGRATIONS]

    src_engine = create_async_engine(src_url, echo=False)

    async with src_engine.connect() as src_conn:
        # ── Discover tenants ──────────────────────────────────────────────
        if not await table_exists(src_conn, "ocr_tasks"):
            logger.error("Table ocr_tasks not found in source DB — is DATABASE_URL correct?")
            return

        tenants = await get_distinct_tenants(src_conn)
        if not tenants:
            logger.warning("No tenants found in source DB — nothing to migrate.")
            return

        for tenant in tenants:
            dst_url = f"{db_root}/carmen_ai_{tenant}"
            dst_engine = create_async_engine(
                dst_url.replace(f"/{dst_url.rsplit('/', 1)[-1]}", ""), echo=False
            )

            logger.info("\n=== Migrating tenant: %s → carmen_ai_%s ===", tenant, tenant)

            # Create destination database
            if not dry_run:
                admin_engine = create_async_engine(db_root, echo=False)
                async with admin_engine.begin() as admin_conn:
                    await admin_conn.execute(
                        text(
                            f"CREATE DATABASE IF NOT EXISTS carmen_ai_{tenant} "
                            "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                        )
                    )
                await admin_engine.dispose()
                logger.info("  ✓ Database carmen_ai_%s created", tenant)

            dst_engine2 = create_async_engine(dst_url, echo=False)
            try:
                # Create tables
                if not dry_run:
                    async with dst_engine2.begin() as conn:
                        await conn.run_sync(Base.metadata.create_all)
                    logger.info("  ✓ Tables created")

                async with src_engine.connect() as src, dst_engine2.begin() as dst:
                    # Copy tenant-scoped tables
                    for table, columns in _TABLES:
                        if table in _TENANT_SCOPED:
                            await copy_tenant_table(src, dst, table, columns, tenant, dry_run)
                        # global tables handled separately below

                    # Mark migrations applied
                    if not dry_run:
                        await mark_migrations_applied(dst, migration_names)
                        logger.info("  ✓ Migrations pre-marked")

            finally:
                await dst_engine2.dispose()

        # ── Copy global tables into every tenant DB ───────────────────────
        logger.info("\n=== Copying global tables into all tenant DBs ===")
        for tenant in tenants:
            dst_url = f"{db_root}/carmen_ai_{tenant}"
            dst_engine = create_async_engine(dst_url, echo=False)
            try:
                async with src_engine.connect() as src, dst_engine.begin() as dst:
                    for table, columns in _TABLES:
                        if table in _GLOBAL_TABLES:
                            await copy_global_table(src, dst, table, columns, dry_run)
            finally:
                await dst_engine.dispose()

    await src_engine.dispose()
    logger.info("\n✅ Migration complete%s.", " (dry-run)" if dry_run else "")
    if not dry_run:
        logger.info(
            "   Next steps:\n"
            "   1. Verify row counts in each carmen_ai_{tenant} database\n"
            "   2. Deploy new application code\n"
            "   3. Keep old ocr_db as backup until confirmed working\n"
            "   4. Drop old ocr_db when ready: DROP DATABASE ocr_db;"
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate ocr_db → carmen_ai_{tenant}")
    parser.add_argument(
        "--dry-run", action="store_true", help="Show what would be copied without writing"
    )
    args = parser.parse_args()

    from app.config import settings

    asyncio.run(run(settings.database_url, dry_run=args.dry_run))
