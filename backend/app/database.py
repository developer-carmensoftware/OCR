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

Migrations:
  All migration functions live in app.migrations (append-only list).
"""

import logging
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
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
_SESSION_FACTORY: async_sessionmaker[AsyncSession] | None = None


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
    assert _SESSION_FACTORY is not None
    return _SESSION_FACTORY()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    _get_engine()
    assert _SESSION_FACTORY is not None
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


# ── Migration runner ──────────────────────────────────────────────────────────


async def migrate_db(_tenant: str = "") -> None:
    """Run pending migrations on carmen_ai. _tenant param kept for backward compat."""
    from app.migrations import _MIGRATIONS

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
