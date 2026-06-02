"""One-shot script: wipe carmen_ai's public schema, then run ensure_db() to recreate.

PostgreSQL note:
  Managed providers (Neon, Render Postgres, Supabase) do not let you DROP/CREATE
  the database itself from a connection — that's a console/API operation. This
  script instead drops and recreates the `public` schema, which has the same
  effect on the data + schema-migrations bookkeeping.

  Reads DATABASE_URL from app.config (i.e. your .env). Run with caution.
"""

import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings


async def reset() -> None:
    # Supabase / Neon connection poolers (e.g. PgBouncer, Supavisor on port 6543)
    # require disabling prepared statements in asyncpg.
    connect_args = {}
    if "pooler" in settings.database_url or "6543" in settings.database_url:
        connect_args["prepared_statement_cache_size"] = 0

    engine = create_async_engine(settings.database_url, echo=False, connect_args=connect_args)
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        print("Dropped schema public")
        await conn.execute(text("CREATE SCHEMA public"))
        print("Created schema public")
    await engine.dispose()

    # Force a fresh engine + run full startup to create tables + run migrations.
    import app.database as _db

    _db._ENGINE = None
    _db._SESSION_FACTORY = None

    await _db.ensure_db()
    print("Schema created + migrations applied + seed data inserted.")


if __name__ == "__main__":
    asyncio.run(reset())
