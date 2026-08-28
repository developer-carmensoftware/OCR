"""
Database setup — single shared PostgreSQL database: carmen_ai (Neon-compatible).

Architecture: Single Database, Multi-Tenant via Foreign Keys
  All tenants share one database.
  Data plane tables reference tenants.id (FK) — business_units table was dropped.
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
  Schema is owned by supabase/migrations/*.sql — apply with `supabase db push`.
"""

import logging
from collections.abc import AsyncGenerator

from sqlalchemy import event, text
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
        # Supabase / Neon connection poolers (e.g. PgBouncer, Supavisor on port 6543)
        # require disabling prepared statements in asyncpg.
        connect_args: dict = {}
        db_url = settings.database_url
        if "pooler" in db_url or "6543" in db_url:
            connect_args["statement_cache_size"] = 0
            if "?" in db_url:
                db_url += "&prepared_statement_cache_size=0"
            else:
                db_url += "?prepared_statement_cache_size=0"

        _ENGINE = create_async_engine(
            db_url,
            echo=settings.app_debug,
            pool_pre_ping=True,
            # Supabase Supavisor session mode (port 5432) holds one Postgres backend per
            # pooled connection, so pool_size+max_overflow must stay under the project's
            # Supavisor connection limit (15). 5+5=10 leaves 5 slack for load-test direct
            # connections, background tasks, and admin sessions; prevents EMAXCONNSESSION.
            pool_size=5,
            max_overflow=5,
            pool_recycle=1800,  # Recycle before Supabase/pooler idle timeout drops the conn.
            connect_args=connect_args,
        )

        # Hard ceiling on any single query, admin analytics included — with only 10
        # pooled connections total, a query that hangs holds one of them open
        # indefinitely; a few concurrent hangs exhausts the pool for the whole app
        # (OCR extraction too). 30s is generous for any legitimate query today; one
        # that needs longer should be paginated/bounded instead.
        #
        # Deliberately NOT passed as connect_args={"server_settings": {...}} — verified
        # empirically that Supabase's Supavisor pooler silently drops that startup-packet
        # parameter (a known pgbouncer-family limitation). A "connect"-only listener isn't
        # enough either — also verified empirically that Supavisor resets session-level
        # GUCs on a *reused* pooled connection between logical sessions (same physical
        # connection object, same TCP socket, `SET` still doesn't survive) — so this is
        # re-applied on every "checkout" (one extra trivial round-trip per checkout,
        # negligible next to what it protects against).
        @event.listens_for(_ENGINE.sync_engine, "checkout")
        def _set_statement_timeout(dbapi_connection, connection_record, connection_proxy):
            cursor = dbapi_connection.cursor()
            cursor.execute("SET statement_timeout = '30000'")

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

_DB_INITIALIZED = False


async def ensure_db() -> None:
    """
    Verify DB connectivity at startup. Schema is managed by Supabase CLI migrations —
    this function no longer creates tables or runs migrations.
    Runs once at startup; subsequent calls are no-ops.
    """
    global _DB_INITIALIZED
    if _DB_INITIALIZED:
        return

    engine = _get_engine()
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))

    _DB_INITIALIZED = True


# ── Backward-compat aliases ───────────────────────────────────────────────────


async def provision_tenant(_tenant: str = "") -> None:
    await ensure_db()
