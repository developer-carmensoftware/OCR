"""
Database setup — single shared PostgreSQL database: carmen_ai (Neon-compatible).

Architecture: Single Database, Multi-Tenant via Foreign Keys
  All tenants share one database.
  Data plane tables reference tenants.id + business_units.id (FK).
  Control plane tables are global.

Fresh start requirement:
  The carmen_ai database must be created in Neon's console (or any other
  Postgres provider) before the app starts. The app does NOT create databases
  automatically — managed Postgres providers reserve that operation.

  Local reset:
    psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
    uvicorn app.main:app --reload

Engine:
  Single AsyncEngine with connection pool, created lazily on first use.
  Pool sized conservatively for Neon free tier (shared compute, ~100 conn cap).

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


# ── URL helpers (kept for backward-compat logging only) ──────────────────────


def _db_root_url() -> str:
    """Return the connection URL with the password masked, for logging."""
    url = settings.database_url
    if "@" in url and "://" in url:
        scheme, rest = url.split("://", 1)
        if "@" in rest:
            creds, host = rest.split("@", 1)
            if ":" in creds:
                user = creds.split(":", 1)[0]
                return f"{scheme}://{user}:***@{host}"
    return url


# ── Single Engine ─────────────────────────────────────────────────────────────

_ENGINE = None
_SESSION_FACTORY: async_sessionmaker[AsyncSession] | None = None


def _get_engine():
    global _ENGINE, _SESSION_FACTORY
    if _ENGINE is None:
        _ENGINE = create_async_engine(
            settings.database_url,
            echo=settings.app_debug,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=40,
            pool_recycle=1800,  # Neon idle-suspends after ~5min; recycle stale conns.
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
    Verify connectivity, create/verify all tables, run migrations.
    Safe to call multiple times (idempotent).

    NOTE: Unlike the previous MariaDB implementation, this does NOT create the
    database itself — Neon (and most managed Postgres providers) require the
    database to be provisioned via their console/API.
    """
    # Force all ORM models to register with Base before create_all().
    import app.models.orm  # noqa: F401

    engine = _get_engine()

    # Sanity ping — fail fast with a clear error if Neon URL is wrong.
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))

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
                text("SELECT id FROM tenants WHERE is_active = true AND deleted_at IS NULL")
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
                applied_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
            )
        """)
        )
        rows = await conn.execute(text("SELECT name FROM schema_migrations"))
        applied = {row[0] for row in rows.fetchall()}

        for name, fn in _MIGRATIONS:
            if name in applied:
                continue
            if fn is None:
                await conn.execute(
                    text(
                        "INSERT INTO schema_migrations (name) VALUES (:name)"
                        " ON CONFLICT (name) DO NOTHING"
                    ),
                    {"name": name},
                )
                continue
            logger.info("Applying migration: %s", name)
            try:
                await fn(conn)
                await conn.execute(
                    text(
                        "INSERT INTO schema_migrations (name) VALUES (:name)"
                        " ON CONFLICT (name) DO NOTHING"
                    ),
                    {"name": name},
                )
                logger.info("Migration %s applied.", name)
            except Exception as exc:
                logger.error("Migration %s FAILED: %s", name, exc)
                raise
