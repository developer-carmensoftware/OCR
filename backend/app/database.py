"""
Database setup — single shared MariaDB database: carmen_ai

Architecture: Single Database, Multi-Tenant via Columns
  All tenants share one database. Filtering is done by:
    host (ostin.carmenwork.com) → bu (business unit) → user_id

Engine:
  Single AsyncEngine with connection pool, created lazily on first use.

Session:
  async_session()  — returns a session for carmen_ai; used by all services.
  get_db()         — FastAPI dependency yielding a session for carmen_ai.
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
    """Returns the database root URL without the database name."""
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
            pool_size=10,
            max_overflow=20,
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
    """Return a new session for carmen_ai. Use as `async with async_session() as db:`"""
    _get_engine()
    return _SESSION_FACTORY()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields a committed session for carmen_ai."""
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
    Create carmen_ai database if it does not exist, then create/verify all
    tables and run pending migrations. Safe to call multiple times.
    """
    root_url = _db_root_url()
    admin_engine = create_async_engine(root_url, echo=False)
    try:
        async with admin_engine.begin() as conn:
            await conn.execute(text(
                "CREATE DATABASE IF NOT EXISTS carmen_ai "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            ))
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


async def provision_tenant(_tenant: str = "") -> None:
    """Backward-compatible alias — tenant param is ignored; ensures carmen_ai exists."""
    await ensure_db()


async def get_all_tenants() -> list[str]:
    """Returns a single sentinel so retention/scheduler loops run once on carmen_ai."""
    return ["__carmen_ai__"]


async def init_db() -> None:
    """Startup check — ensure carmen_ai exists and tables are up to date."""
    await ensure_db()


# ── Migration functions ───────────────────────────────────────────────────────
# Append-only. Never reorder. Each entry runs exactly once.

async def _m026_fix_bu_usage_pk(conn: AsyncConnection) -> None:
    """
    Rebuild bu_usage with a proper (host, bu_name) composite unique key so that
    two different Carmen instances with the same BU name don't share rate-limit
    rows (cross-tenant data leakage). Existing rows are preserved.
    """
    try:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bu_usage_new (
                id                INT          NOT NULL AUTO_INCREMENT,
                bu_name           VARCHAR(100) NOT NULL,
                host              VARCHAR(255) NULL,
                monthly_calls     INT          DEFAULT 0,
                total_calls       BIGINT       DEFAULT 0,
                max_monthly_calls INT          DEFAULT 50,
                last_reset_month  VARCHAR(7)   NULL,
                updated_at        DATETIME     DEFAULT CURRENT_TIMESTAMP
                                              ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_bu_host_bu_name (host, bu_name),
                INDEX idx_bu_usage_bu   (bu_name),
                INDEX idx_bu_usage_host (host)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """))
        await conn.execute(text("""
            INSERT INTO bu_usage_new
                (bu_name, host, monthly_calls, total_calls, max_monthly_calls, last_reset_month, updated_at)
            SELECT bu_name, host, monthly_calls, total_calls, max_monthly_calls, last_reset_month, updated_at
            FROM bu_usage
        """))
        await conn.execute(text("DROP TABLE bu_usage"))
        await conn.execute(text("RENAME TABLE bu_usage_new TO bu_usage"))
        logger.info("  ~ bu_usage: PK changed to auto-increment, unique(host, bu_name) added")
    except Exception as exc:
        logger.error("Migration 026 failed: %s", exc)
        raise


async def _m024_add_session_carmen_uri(conn: AsyncConnection) -> None:
    try:
        await conn.execute(text(
            "ALTER TABLE ocr_sessions ADD COLUMN carmen_uri VARCHAR(500) NULL"
        ))
        logger.info("  + ocr_sessions.carmen_uri")
    except Exception:
        pass


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
    except Exception as exc:
        logger.error("Failed to create bu_usage table: %s", exc)


async def _m022_add_ap_invoices_submitted_at(conn: AsyncConnection) -> None:
    try:
        await conn.execute(text(
            "ALTER TABLE ap_invoices ADD COLUMN submitted_at DATETIME NULL"
        ))
        logger.info("  + ap_invoices.submitted_at")
    except Exception:
        pass


async def _m021_remove_tenant_columns(conn: AsyncConnection) -> None:
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
            pass

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


async def _m025_add_bu_host_columns(conn: AsyncConnection) -> None:
    """
    Add bu + host columns to all data tables for cross-tenant filtering.
    host = hostname portion of carmen_uri (e.g. 'ostin.carmenwork.com').
    bu   = business unit identifier (tenant within a customer).
    """
    ops = [
        # table, column, definition
        ("ocr_tasks",           "bu",   "VARCHAR(100) NULL"),
        ("ocr_tasks",           "host", "VARCHAR(255) NULL"),
        ("credit_cards",        "bu",   "VARCHAR(100) NULL"),
        ("ap_invoices",         "bu",   "VARCHAR(100) NULL"),
        ("ap_invoices",         "host", "VARCHAR(255) NULL"),
        ("llm_usage_logs",      "host", "VARCHAR(255) NULL"),
        ("audit_logs",          "host", "VARCHAR(255) NULL"),
        ("performance_logs",    "bu",   "VARCHAR(100) NULL"),
        ("outbound_call_logs",  "bu",   "VARCHAR(100) NULL"),
        ("bu_usage",            "host", "VARCHAR(255) NULL"),
    ]
    for table, col, defn in ops:
        try:
            await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {defn}"))
            logger.info("  + %s.%s", table, col)
        except Exception:
            pass  # column already exists

    # Add indexes for common filter columns
    indexes = [
        ("ocr_tasks",          "idx_ocr_tasks_bu",          "bu"),
        ("ocr_tasks",          "idx_ocr_tasks_host",        "host"),
        ("credit_cards",       "idx_credit_cards_bu",       "bu"),
        ("ap_invoices",        "idx_ap_invoices_bu",        "bu"),
        ("ap_invoices",        "idx_ap_invoices_host",      "host"),
        ("llm_usage_logs",     "idx_llm_usage_host",        "host"),
        ("audit_logs",         "idx_audit_logs_host",       "host"),
        ("performance_logs",   "idx_perf_logs_bu",          "bu"),
        ("outbound_call_logs", "idx_outbound_logs_bu",      "bu"),
    ]
    for table, idx_name, col in indexes:
        try:
            await conn.execute(text(
                f"ALTER TABLE {table} ADD INDEX {idx_name} ({col})"
            ))
        except Exception:
            pass  # index already exists

    # Fix MappingHistory unique: add bu so mappings are isolated per tenant
    try:
        await conn.execute(text(
            "ALTER TABLE mapping_history ADD COLUMN bu VARCHAR(100) NULL"
        ))
        logger.info("  + mapping_history.bu")
    except Exception:
        pass
    try:
        await conn.execute(text("ALTER TABLE mapping_history DROP INDEX uq_mapping_bank_field_choice"))
    except Exception:
        pass
    try:
        await conn.execute(text(
            "ALTER TABLE mapping_history ADD CONSTRAINT uq_mapping_bu_bank_field_choice "
            "UNIQUE (bu, bank_name, field_type, dept_code, acc_code)"
        ))
        logger.info("  ~ mapping_history: unique now includes bu")
    except Exception:
        pass

    # Fix CorrectionFeedback unique: add bu so corrections are isolated per tenant
    try:
        await conn.execute(text(
            "ALTER TABLE correction_feedback ADD COLUMN bu VARCHAR(100) NULL"
        ))
        logger.info("  + correction_feedback.bu")
    except Exception:
        pass
    try:
        await conn.execute(text("ALTER TABLE correction_feedback DROP INDEX uq_correction_doc_field"))
    except Exception:
        pass
    try:
        await conn.execute(text(
            "ALTER TABLE correction_feedback ADD CONSTRAINT uq_correction_bu_doc_field "
            "UNIQUE (bu, doc_no, field_name)"
        ))
        logger.info("  ~ correction_feedback: unique now includes bu")
    except Exception:
        pass

    # Fix DailyUsageSummary unique: one row per (bu, date)
    try:
        await conn.execute(text(
            "ALTER TABLE daily_usage_summary ADD COLUMN bu VARCHAR(100) NULL"
        ))
        logger.info("  + daily_usage_summary.bu")
    except Exception:
        pass
    try:
        await conn.execute(text("ALTER TABLE daily_usage_summary DROP INDEX uq_summary_date"))
    except Exception:
        pass
    try:
        await conn.execute(text(
            "ALTER TABLE daily_usage_summary ADD CONSTRAINT uq_summary_bu_date "
            "UNIQUE (bu, summary_date)"
        ))
        logger.info("  ~ daily_usage_summary: unique now (bu, summary_date)")
    except Exception:
        pass


# ── Migration Registry ────────────────────────────────────────────────────────
# Append-only. Never reorder. Each entry runs exactly once.

_MIGRATIONS: list[tuple[str, object]] = [
    # ── Legacy (001-020): pre-mark only, no logic ────────────────────────────
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
    # ── Live migrations (021+) ────────────────────────────────────────────────
    ("021_remove_tenant_columns",                       _m021_remove_tenant_columns),
    ("022_add_ap_invoices_submitted_at",                _m022_add_ap_invoices_submitted_at),
    ("023_create_bu_usage",                             _m023_create_bu_usage),
    ("024_add_session_carmen_uri",                      _m024_add_session_carmen_uri),
    ("025_add_bu_host_columns",                         _m025_add_bu_host_columns),
    ("026_fix_bu_usage_pk",                             _m026_fix_bu_usage_pk),
]


async def migrate_db(_tenant: str = "") -> None:
    """Run pending migrations on carmen_ai. tenant param kept for backward compat."""
    engine = _get_engine()
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


async def migrate_all_tenants() -> None:
    """Backward-compatible alias — runs migrate_db() once on carmen_ai."""
    await migrate_db()
