"""How many database round trips does one request cost? — in-process, local Supabase only.

    python scripts/qa/jv_filters_e2e.py setup --big      # tenant D with 20,000 rows → fixture.json
    cd <a directory with backend/.env> && python <repo>/scripts/qa/db_roundtrips.py

Why it exists: docs/SQL_PERFORMANCE_AUDIT.md §3.1e found ~3.2 Supavisor authentications per HTTP
request and left the cause open. The local database has no pooler, so this cannot count
authentications; it counts what the *app* asks of the pool, which is what code can reduce:

  checkouts  pool checkouts (each also pays pool_pre_ping and `SET statement_timeout`, see database.py)
  connects   new physical connections (0 on a warm pool; > 0 is churn)
  orm        statements the ORM issued
  server     statements the server saw (pg_stat_statements calls, so BEGIN/ROLLBACK/SET/SELECT 1
             count) — the nearest thing to wire round trips this harness can read

Each case runs once to warm the pool and the session cache, then three times warm, and once cold
(session cache cleared: what the first request after 60 s pays). The app is driven in-process through
ASGI with the fixture's own JWT, so there is no HTTP server and no rate limiter in the way.

**Local only.** DATABASE_URL is forced to the local Supabase before `app` is imported (a wrapper once hit the
shared dev DB), and the script refuses to run otherwise.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
from pathlib import Path

LOCAL = "postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres"
os.environ["DATABASE_URL"] = LOCAL  # before any `app` import — see the docstring

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
FIXTURE = ROOT / ".playwright-mcp/jv-filters/fixture.json"

import asyncpg  # noqa: E402
import httpx  # noqa: E402
from sqlalchemy import event  # noqa: E402

from app.middleware import rate_limit as rl  # noqa: E402

rl._LIMITS["default"] = (1_000_000, 60)  # this process only
rl._LIMITS["auth"] = (1_000_000, 60)

from app.auth import dependencies as auth_deps  # noqa: E402
from app.database import _get_engine  # noqa: E402
from app.main import app  # noqa: E402

CASES = [
    ("auth/usage", "/api/v1/auth/usage"),
    ("notifications", "/api/v1/notifications?limit=20"),
    ("email/documents", "/api/v1/email/documents?limit=25"),
    ("activity page 1", "/api/v1/credit-card/activity?filter=all&limit=100&offset=0"),
    ("activity review", "/api/v1/credit-card/activity?filter=review&limit=100&offset=0"),
    ("activity deep", "/api/v1/credit-card/activity?filter=all&limit=100&offset=19900"),
    ("activity narrowed", "/api/v1/credit-card/activity?filter=all&limit=100&source=email&bank=KBANK&range=30d"),
]

counts = {"checkout": 0, "connect": 0, "orm": 0}


def _wire() -> None:
    sync = _get_engine().sync_engine
    sync.echo = False  # APP_DEBUG turns SQL echo on; the table below is the output
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    event.listen(sync, "checkout", lambda *a: counts.__setitem__("checkout", counts["checkout"] + 1))
    event.listen(sync, "connect", lambda *a: counts.__setitem__("connect", counts["connect"] + 1))
    event.listen(
        sync, "before_cursor_execute", lambda *a, **k: counts.__setitem__("orm", counts["orm"] + 1)
    )


async def _server_calls(conn: asyncpg.Connection) -> int | None:
    try:
        # Reading it is itself one call; callers subtract that.
        return await conn.fetchval(
            "select coalesce(sum(calls), 0)::bigint from pg_stat_statements where dbid = "
            "(select oid from pg_database where datname = current_database())"
        )
    except asyncpg.PostgresError:
        return None


async def _once(client: httpx.AsyncClient, conn: asyncpg.Connection, path: str, headers: dict):
    before = dict(counts)
    s0 = await _server_calls(conn)
    t0 = time.perf_counter()
    r = await client.get(path, headers=headers)
    ms = (time.perf_counter() - t0) * 1000
    s1 = await _server_calls(conn)
    server = None if s0 is None or s1 is None else s1 - s0 - 1
    return r.status_code, ms, {k: counts[k] - before[k] for k in counts}, server


async def main() -> int:
    if not FIXTURE.exists() or "d" not in json.loads(FIXTURE.read_text(encoding="utf-8"))["tenants"]:
        print("run `jv_filters_e2e.py setup --big` first (tenant D carries the 20,000 rows)")
        return 2
    fx = json.loads(FIXTURE.read_text(encoding="utf-8"))
    headers = {"Authorization": "Bearer " + fx["tenants"]["d"]["jwt"]}
    _wire()
    conn = await asyncpg.connect(LOCAL.replace("+asyncpg", ""), statement_cache_size=0)
    if await _server_calls(conn) is None:
        print("(pg_stat_statements is not readable here: the `server` column will be n/a)")
    transport = httpx.ASGITransport(app=app)
    print(f"{'case':20} {'run':5} {'http':>4} {'ms':>7} {'checkouts':>9} {'connects':>8} {'orm':>4} {'server':>6}")
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        for name, path in CASES:
            await _once(client, conn, path, headers)  # warm the pool and the session cache
            runs = [("warm", *(await _once(client, conn, path, headers))) for _ in range(3)]
            auth_deps._session_cache.clear()
            runs.append(("cold", *(await _once(client, conn, path, headers))))
            for kind, status, ms, c, server in runs:
                print(
                    f"{name:20} {kind:5} {status:>4} {ms:7.0f} {c['checkout']:9} {c['connect']:8} "
                    f"{c['orm']:4} {'n/a' if server is None else server:>6}"
                )
    await conn.close()
    await _get_engine().dispose()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
