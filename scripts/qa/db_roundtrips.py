"""How many database round trips does one request cost? — in-process, local Supabase only.

    python scripts/qa/jv_filters_e2e.py setup --big      # tenant D with 20,000 rows → fixture.json
    cd <a directory with backend/.env> && python <repo>/scripts/qa/db_roundtrips.py
    ... db_roundtrips.py --matrix                        # what pre-ping and the timeout listener each cost
    ... db_roundtrips.py --no-pre-ping --no-timeout-listener
    ... db_roundtrips.py --app-engine --breakdown        # the app's own engine, not the rebuilt copy
    ... db_roundtrips.py --breakdown                     # which statements the server saw for one request

Why it exists: docs/SQL_PERFORMANCE_AUDIT.md §3.1e found ~3.2 Supavisor authentications per HTTP
request and left the cause open. The local database has no pooler, so this cannot count
authentications; it counts what the *app* asks of the pool, which is what code can reduce:

  checkouts  pool checkouts (each also pays pool_pre_ping: a BEGIN/ROLLBACK pair, measured with --breakdown)
  connects   new physical connections (0 on a warm pool; > 0 is churn)
  orm        statements the ORM issued
  server     statements the server saw (pg_stat_statements calls, so BEGIN/ROLLBACK/SET/SELECT 1
             count) — the nearest thing to wire round trips this harness can read

Each case runs once to warm the pool and the session cache, then three times warm, and once cold
(session cache cleared: what the first request after 60 s pays). The app is driven in-process through
ASGI with the fixture's own JWT, so there is no HTTP server and no rate limiter in the way.

`--no-pre-ping` and `--no-timeout-listener` build the engine the way `app/database.py` does, minus that
one thing, so what each costs per request is a number. Measured locally: pre-ping costs two server
statements per checkout; the `SET statement_timeout` reaches the server once per physical connection, not
per checkout, so removing the listener changes nothing a warm request can see. `--app-engine` runs against
app/database.py's own engine, to check the rebuilt copy has not drifted. They are an *app-side* count only: whether the
pooler tolerates the removal (stale connections after Supavisor drops an idle one; whether
`ALTER ROLE ... SET statement_timeout` survives its DISCARD ALL) can only be learned on a real pooler.
That experiment is written up in docs/SQL_PERFORMANCE_AUDIT.md §7.

**Local only.** DATABASE_URL is forced to the local Supabase before `app` is imported (a wrapper once hit the
shared dev DB), and the script refuses to run otherwise.
"""

from __future__ import annotations

import argparse
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
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402

from app.middleware import rate_limit as rl  # noqa: E402

rl._LIMITS["default"] = (1_000_000, 60)  # this process only
rl._LIMITS["auth"] = (1_000_000, 60)

from app import database as dbmod  # noqa: E402
from app.auth import dependencies as auth_deps  # noqa: E402
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


async def _install_engine(pre_ping: bool, timeout_listener: bool) -> None:
    """Swap the app's engine for one built like app/database.py's, with or without the two per-checkout costs.

    Mirrors database.py's pool settings (pool_size 5, max_overflow 5, pool_recycle 1800) and its
    `checkout` listener; keep them in sync by hand. The counters are wired on the new engine here.
    """
    if dbmod._ENGINE is not None:
        await dbmod._ENGINE.dispose()
    engine = create_async_engine(
        LOCAL, echo=False, pool_pre_ping=pre_ping, pool_size=5, max_overflow=5, pool_recycle=1800
    )
    sync = engine.sync_engine
    if timeout_listener:

        @event.listens_for(sync, "checkout")
        def _set_statement_timeout(dbapi_connection, connection_record, connection_proxy):
            dbapi_connection.cursor().execute("SET statement_timeout = '30000'")

    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    event.listen(sync, "checkout", lambda *a: counts.__setitem__("checkout", counts["checkout"] + 1))
    event.listen(sync, "connect", lambda *a: counts.__setitem__("connect", counts["connect"] + 1))
    event.listen(
        sync, "before_cursor_execute", lambda *a, **k: counts.__setitem__("orm", counts["orm"] + 1)
    )
    dbmod._ENGINE = engine
    dbmod._SESSION_FACTORY = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


def _wire_existing() -> None:
    """Count on the app's OWN engine (app/database.py, untouched) instead of a rebuilt copy."""
    sync = dbmod._get_engine().sync_engine
    sync.echo = False
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


async def _statements(conn: asyncpg.Connection) -> dict[str, int]:
    rows = await conn.fetch(
        "select left(query, 70) as q, sum(calls)::bigint as c from pg_stat_statements where dbid = "
        "(select oid from pg_database where datname = current_database()) group by 1"
    )
    return {r["q"]: r["c"] for r in rows}


async def _breakdown(client, conn, headers) -> None:
    """Which statements the server saw for ONE warm request, per case — the answer behind the `server` count."""
    for name, path in CASES[:2]:
        await _once(client, conn, path, headers)  # warm
        before = await _statements(conn)
        await client.get(path, headers=headers)
        after = await _statements(conn)
        print(f"-- {name}")
        for q, n in sorted(after.items(), key=lambda kv: -(kv[1] - before.get(kv[0], 0))):
            d = n - before.get(q, 0)
            if d > 0 and "pg_stat_statements" not in q and "pg_database" not in q:
                print(f"   {d:>2} x {q.strip()[:68]}")


async def _table(client, conn, headers) -> None:
    print(f"{'case':20} {'run':5} {'http':>4} {'ms':>7} {'checkouts':>9} {'connects':>8} {'orm':>4} {'server':>6}")
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


async def _matrix(client, conn, headers) -> None:
    """One warm request per case under each combination: checkouts / ORM / server statements."""
    combos = [
        ("as the app is", True, True),
        ("no pre-ping", False, True),
        ("no timeout listener", True, False),
        ("neither", False, False),
    ]
    grid: dict[str, dict[str, str]] = {name: {} for name, _ in CASES}
    for label, pre_ping, listener in combos:
        await _install_engine(pre_ping, listener)
        for name, path in CASES:
            await _once(client, conn, path, headers)  # warm
            _, _, c, server = await _once(client, conn, path, headers)
            grid[name][label] = f"{c['checkout']}/{c['orm']}/{'n/a' if server is None else server}"
    print("warm request: checkouts / ORM statements / server statements")
    print(f"{'case':20} " + " ".join(f"{label:>20}" for label, _, _ in combos))
    for name, _ in CASES:
        print(f"{name:20} " + " ".join(f"{grid[name][label]:>20}" for label, _, _ in combos))


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--no-pre-ping", action="store_true", help="build the engine without pool_pre_ping")
    ap.add_argument("--no-timeout-listener", action="store_true", help="build it without the per-checkout SET")
    ap.add_argument("--matrix", action="store_true", help="all four combinations, warm requests only")
    ap.add_argument("--app-engine", action="store_true", help="use app/database.py's engine as it is, not a rebuilt copy")
    ap.add_argument("--breakdown", action="store_true", help="the statements the server saw for one warm request")
    args = ap.parse_args()
    if not FIXTURE.exists() or "d" not in json.loads(FIXTURE.read_text(encoding="utf-8"))["tenants"]:
        print("run `jv_filters_e2e.py setup --big` first (tenant D carries the 20,000 rows)")
        return 2
    fx = json.loads(FIXTURE.read_text(encoding="utf-8"))
    headers = {"Authorization": "Bearer " + fx["tenants"]["d"]["jwt"]}
    if args.app_engine:
        _wire_existing()
    else:
        await _install_engine(not args.no_pre_ping, not args.no_timeout_listener)
    conn = await asyncpg.connect(LOCAL.replace("+asyncpg", ""), statement_cache_size=0)
    if await _server_calls(conn) is None:
        print("(pg_stat_statements is not readable here: the `server` column will be n/a)")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        if args.breakdown:
            await _breakdown(client, conn, headers)
        elif args.matrix:
            await _matrix(client, conn, headers)
        else:
            await _table(client, conn, headers)
    await conn.close()
    await dbmod._ENGINE.dispose()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
