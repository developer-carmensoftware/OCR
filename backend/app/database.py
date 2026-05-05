"""
Database setup — per-tenant MariaDB via SQLAlchemy.

Architecture: Separate Schema per Tenant
  Each Carmen tenant gets its own database: carmen_ai_{tenant}
  Tables are identical across all tenant DBs — no `tenant` column needed.

Engine Registry:
  Engines are created lazily on first request and cached for the process
  lifetime so the connection pool is reused across requests.

Session routing:
  async_session()  — context-aware shim; reads current_tenant context var
                     to pick the correct engine.  All fire-and-forget services
                     (audit, outbound, usage) use this without modification.
  get_db()         — FastAPI dependency; same routing via context var.
"""

import logging
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncConnection,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

from app.config import settings

logger = logging.getLogger(__name__)


# ── URL helpers ───────────────────────────────────────────────────────────────

def _db_root_url() -> str:
    """
    Returns the database root URL without the database name.
    Handles URLs with or without a trailing slash/database name.
    """
    url = settings.database_url.rstrip("/")
    # If the URL contains more than 2 slashes (e.g., mysql://user:pass@host/db)
    # the last part is the database name; strip it.
    if url.count("/") > 2:
        return url.rsplit("/", 1)[0]
    return url

def _tenant_db_url(tenant: str) -> str:
    return f"{_db_root_url()}/carmen_ai_{tenant}"


# ── Engine Registry ───────────────────────────────────────────────────────────

_ENGINES: dict[str, object] = {}          # tenant → AsyncEngine
_SESSION_FACTORIES: dict[str, object] = {}  # tenant → async_sessionmaker


def _get_engine(tenant: str):
    if tenant not in _ENGINES:
        _ENGINES[tenant] = create_async_engine(
            _tenant_db_url(tenant),
            echo=False,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
        )
        _SESSION_FACTORIES[tenant] = async_sessionmaker(
            _ENGINES[tenant],
            class_=AsyncSession,
            expire_on_commit=False,
        )
        logger.debug("Engine created for tenant: %s", tenant)
    return _ENGINES[tenant]


def _get_session_factory(tenant: str):
    _get_engine(tenant)  # ensure engine + factory exist
    return _SESSION_FACTORIES[tenant]


# ── Public Session Factories ──────────────────────────────────────────────────

def async_session() -> AsyncSession:
    """
    Context-aware session — backward-compatible with all existing
    `async with async_session() as db:` call sites.

    Reads current_tenant context var (set by PerformanceMiddleware from
    the Origin header) to route to the correct carmen_ai_{tenant} database.
    """
    from app.context import current_tenant
    tenant = current_tenant.get("") or settings.carmen_tenant_default
    return _get_session_factory(tenant)()


# ── FastAPI Dependency ────────────────────────────────────────────────────────

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency — yields a session for the current tenant.
    Tenant is resolved from current_tenant context var (set by middleware).
    Usage: db: AsyncSession = Depends(get_db)
    """
    from app.context import current_tenant
    tenant = current_tenant.get("") or settings.carmen_tenant_default
    factory = _get_session_factory(tenant)
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ── ORM Base ─────────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


# ── Tenant Provisioning ───────────────────────────────────────────────────────

async def provision_tenant(tenant: str) -> None:
    """
    Create carmen_ai_{tenant} database and initialise all tables.

    Safe to call multiple times — CREATE DATABASE IF NOT EXISTS and
    create_all() are both idempotent.  All current migrations are pre-marked
    as applied because create_all() already produces the final schema.
    """
    root_url = _db_root_url()
    admin_engine = create_async_engine(root_url, echo=False)
    try:
        async with admin_engine.begin() as conn:
            await conn.execute(
                text(f"CREATE DATABASE IF NOT EXISTS carmen_ai_{tenant} "
                     "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            )
        logger.info("Provisioned database: carmen_ai_%s", tenant)
    finally:
        await admin_engine.dispose()

    # Create tables from ORM in the new DB
    engine = _get_engine(tenant)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Pre-mark all current migrations so the runner skips them
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name       VARCHAR(100) PRIMARY KEY,
                applied_at DATETIME     DEFAULT CURRENT_TIMESTAMP
            )
        """))
        for name, _ in _MIGRATIONS:
            await conn.execute(
                text("INSERT IGNORE INTO schema_migrations (name) VALUES (:name)"),
                {"name": name},
            )

    logger.info("Tables and migrations initialised for tenant: %s", tenant)

    # Pre-sync model pricing for the new tenant
    from app.services.usage_service import fetch_openrouter_pricing
    from app.context import current_tenant
    token = current_tenant.set(tenant)
    try:
        await fetch_openrouter_pricing()
    except Exception as e:
        logger.warning("[%s] Initial pricing sync failed: %s", tenant, e)
    finally:
        current_tenant.reset(token)


async def get_all_tenants() -> list[str]:
    """
    List all provisioned tenants by querying INFORMATION_SCHEMA for
    databases named carmen_ai_*.
    """
    root_url = _db_root_url()
    admin_engine = create_async_engine(root_url, echo=False)
    try:
        async with admin_engine.connect() as conn:
            result = await conn.execute(text(
                "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA "
                "WHERE SCHEMA_NAME LIKE 'carmen_ai_%'"
            ))
            return [row[0].replace("carmen_ai_", "") for row in result.fetchall()]
    finally:
        await admin_engine.dispose()


# ── init_db (startup) ─────────────────────────────────────────────────────────

async def init_db() -> None:
    """Ensure tables exist in every provisioned tenant DB."""
    tenants = await get_all_tenants()
    for tenant in tenants:
        engine = _get_engine(tenant)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    if tenants:
        logger.info("init_db: tables verified for %d tenant(s)", len(tenants))
    else:
        logger.warning("init_db: no carmen_ai_* databases found — use provision_tenant() to add one")


# ── Migration functions ───────────────────────────────────────────────────────
# These run ONLY on existing DBs that were migrated from the old shared schema.
# Brand-new DBs provisioned via provision_tenant() skip all of these because
# create_all() already produces the final schema and migrations are pre-marked.

async def _m023_create_bu_usage(conn: AsyncConnection) -> None:
    try:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bu_usage (
                bu_name           VARCHAR(100) PRIMARY KEY,
                monthly_calls     INT          DEFAULT 0,
                total_calls       BIGINT       DEFAULT 0,
                max_monthly_calls INT          DEFAULT 50,
                last_reset_month  VARCHAR(7)   NULL,
                updated_at        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """))
        logger.info("  + bu_usage table")
    except Exception as e:
        logger.error("Failed to create bu_usage table: %s", e)
        # We don't raise here if it already exists, although CREATE TABLE IF NOT EXISTS handles it.

async def _m022_add_ap_invoices_submitted_at(conn: AsyncConnection) -> None:
    try:
        await conn.execute(text(
            "ALTER TABLE ap_invoices ADD COLUMN submitted_at DATETIME NULL"
        ))
        logger.info("  + ap_invoices.submitted_at")
    except Exception:
        pass  # column already exists


async def _m021_remove_tenant_columns(conn: AsyncConnection) -> None:
    """
    Remove tenant column (and its index) from all tables.
    Applied when migrating an existing carmen_ai_{tenant} DB that was
    created by splitting from the old shared ocr_db schema.
    """
    tables_cols = [
        ("ocr_tasks",           "tenant"),
        ("credit_cards",        "tenant"),
        ("mapping_history",     "tenant"),
        ("correction_feedback", "tenant"),
        ("llm_usage_logs",      "tenant"),
        ("ocr_sessions",        "tenant"),
        ("audit_logs",          "tenant"),
        ("performance_logs",    "tenant"),
        ("outbound_call_logs",  "tenant"),
        ("daily_usage_summary", "tenant"),
        ("ap_invoices",         "tenant"),
    ]
    for table, col in tables_cols:
        for idx in (f"idx_{table.replace('_logs','').replace('_',''[:8])}_tenant",
                    f"idx_{table}_tenant"):
            try:
                await conn.execute(text(f"ALTER TABLE {table} DROP INDEX {idx}"))
            except Exception:
                pass
        try:
            await conn.execute(text(f"ALTER TABLE {table} DROP COLUMN {col}"))
            logger.info("  - %s.tenant", table)
        except Exception:
            pass  # column already absent

    # Fix unique constraints that previously included tenant
    _fixes = [
        ("mapping_history",
         "uq_mapping_tenant_bank_field_choice",
         "uq_mapping_bank_field_choice",
         "UNIQUE (bank_name, field_type, dept_code, acc_code)"),
        ("correction_feedback",
         "uq_correction_tenant_doc_field",
         "uq_correction_doc_field",
         "UNIQUE (doc_no, field_name)"),
        ("daily_usage_summary",
         "uq_tenant_date",
         "uq_summary_date",
         "UNIQUE (summary_date)"),
    ]
    for table, old_key, new_key, definition in _fixes:
        try:
            await conn.execute(text(f"ALTER TABLE {table} DROP INDEX {old_key}"))
        except Exception:
            pass
        try:
            await conn.execute(text(
                f"ALTER TABLE {table} ADD CONSTRAINT {new_key} {definition}"
            ))
            logger.info("  ~ %s: %s → %s", table, old_key, new_key)
        except Exception:
            pass


# ── Migration Registry ────────────────────────────────────────────────────────
# Append-only. Never reorder. Each entry runs exactly once per DB.
# Migrations 001-020 are pre-marked as applied on fresh DBs (provision_tenant).

_MIGRATIONS: list[tuple[str, object]] = [
    # ── Legacy migrations (001-020) ──────────────────────────────────────────
    # These are historical. New tenant DBs skip them via provision_tenant().
    # Listed here so the registry is complete and pre-marking works correctly.
    ("001_receipt_columns",                             None),
    ("002_ocr_tasks_nullable",                          None),
    ("003_llm_usage_columns",                           None),
    ("004_mapping_history_constraint",                  None),
    ("005_create_audit_logs",                           None),
    ("006_create_performance_logs",                     None),
    ("007_create_outbound_call_logs",                   None),
    ("008_create_ocr_sessions",                         None),
    ("009_drop_llm_usage_token_hash",                   None),
    ("010_drop_sensitive_receipt_columns",              None),
    ("011_merge_receipt_details_into_transactions",     None),
    ("012_drop_session_expires_at",                     None),
    ("013_add_tenant",                                  None),
    ("014_schema_cleanup_and_analytics",                None),
    ("015_create_daily_usage_summary",                  None),
    ("016_partition_log_tables",                        None),
    ("017_create_model_pricing",                        None),
    ("018_create_ap_invoice_tables",                    None),
    ("019_rename_receipts_to_credit_cards",             None),
    ("020_fix_correction_feedback_unique_key",          None),
    # ── Live migrations (021+) ───────────────────────────────────────────────
    # These run on DBs migrated from the old shared schema.
    ("021_remove_tenant_columns",                       _m021_remove_tenant_columns),
    ("022_add_ap_invoices_submitted_at",                _m022_add_ap_invoices_submitted_at),
    ("023_create_bu_usage",                             _m023_create_bu_usage),
]


async def migrate_db(tenant: str) -> None:
    """Run pending migrations for a single tenant DB."""
    engine = _get_engine(tenant)
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name       VARCHAR(100) PRIMARY KEY,
                applied_at DATETIME     DEFAULT CURRENT_TIMESTAMP
            )
        """))
        rows = await conn.execute(text("SELECT name FROM schema_migrations"))
        applied = {row[0] for row in rows.fetchall()}

        for name, fn in _MIGRATIONS:
            if name in applied:
                continue
            if fn is None:
                # Legacy stub — mark as applied, nothing to run
                await conn.execute(
                    text("INSERT IGNORE INTO schema_migrations (name) VALUES (:name)"),
                    {"name": name},
                )
                continue
            logger.info("[%s] Applying migration: %s", tenant, name)
            try:
                await fn(conn)
                await conn.execute(
                    text("INSERT INTO schema_migrations (name) VALUES (:name)"),
                    {"name": name},
                )
                logger.info("[%s] Migration %s applied.", tenant, name)
            except Exception as exc:
                logger.error("[%s] Migration %s FAILED: %s", tenant, name, exc)
                raise


async def migrate_all_tenants() -> None:
    """Run pending migrations across every provisioned tenant DB."""
    tenants = await get_all_tenants()
    for tenant in tenants:
        await migrate_db(tenant)
