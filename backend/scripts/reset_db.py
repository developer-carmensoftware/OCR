"""One-shot script: wipe carmen_ai's public schema (drop + recreate empty).

Schema is owned by Supabase CLI migrations (supabase/migrations/), so this script
does NOT recreate tables — after running it you must re-apply the schema:

    supabase db push

PostgreSQL note:
  Managed providers (Neon, Render Postgres, Supabase) do not let you DROP/CREATE
  the database itself from a connection — that's a console/API operation. This
  script instead drops and recreates the `public` schema, leaving it empty.

  Reads DATABASE_URL from app.config (i.e. your .env). DESTRUCTIVE — run with caution.
"""

import asyncio
import sys
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402


async def reset() -> None:
    # Supabase / Neon connection poolers (e.g. PgBouncer, Supavisor on port 6543)
    # require disabling prepared statements in asyncpg.
    connect_args = {}
    db_url = settings.database_url
    if "pooler" in db_url or "6543" in db_url:
        connect_args["statement_cache_size"] = 0
        if "?" in db_url:
            db_url += "&prepared_statement_cache_size=0"
        else:
            db_url += "?prepared_statement_cache_size=0"

    engine = create_async_engine(db_url, echo=False, connect_args=connect_args)
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        print("Dropped schema public")
        await conn.execute(text("CREATE SCHEMA public"))
        print("Created empty schema public")
    await engine.dispose()

    print("\nSchema is empty. Re-apply tables + seed with:\n    supabase db push")


if __name__ == "__main__":
    asyncio.run(reset())
