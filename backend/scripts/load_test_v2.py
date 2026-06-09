"""
Load Test V2 — multi-key capacity pool (Postgres / asyncpg edition).

Ported from scripts/load_test.py (which targeted MariaDB/aiomysql). The app now
runs on PostgreSQL (Supabase), and the LLM layer is a multi-key capacity pool
(split vision/text semaphores, least-loaded routing, cross-key failover, 429
safety valve). This script measures that pool with real OpenRouter calls.

Modes
-----
  health        Ping each OpenRouter key DIRECTLY (no backend) — confirm both keys
                are usable before any comparison run.
  ramp          Ramp-up concurrency against POST /api/v1/ocr/extract (the same
                vision-only endpoint the old report used). The backend's pool
                config (single vs multi key) is set via env at launch, not here.
  valve         Saturate a deliberately small pool to prove the 429 safety valve:
                fire a burst, count HTTP 200 vs 429 (+ Retry-After), assert no hang/500.
  distribution  Query outbound_call_logs to show how vision calls spread across keys
                (we log url=".../chat/completions#keyN").
  cleanup       Delete loadtest tenants/sessions/tasks created by this script.

Run (PowerShell), paths use / to stay escape-clean:
  $env:PYTHONIOENCODING='utf-8'
  # 0. health — verify both keys
  backend/venv/Scripts/python.exe backend/scripts/load_test_v2.py --mode health
  # 1. single-key backend, then:
  backend/venv/Scripts/python.exe backend/scripts/load_test_v2.py --mode ramp --label single-key
  # 2. multi-key backend, then:
  backend/venv/Scripts/python.exe backend/scripts/load_test_v2.py --mode ramp --label multi-key
  backend/venv/Scripts/python.exe backend/scripts/load_test_v2.py --mode distribution --since-min 20
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import time
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

import asyncpg
import httpx
from cryptography.fernet import Fernet
from dotenv import dotenv_values
from jose import jwt

# ── Config ────────────────────────────────────────────────────────────────────

BACKEND_URL = "http://127.0.0.1:8010"
EXTRACT_PATH = "/api/v1/ocr/extract?bank_code=BBL"
IMAGE_PATH = Path(__file__).resolve().parent.parent / "example_field" / "BBLbank.png"

DEFAULT_RAMP = [1, 2, 4, 8, 12, 16, 24, 32]
HOLD_SECONDS = 12.0
MAX_ERR_RATE = 0.05
MAX_P95_SEC = 30.0
P95_MULTIPLIER_OF_BASELINE = 4.0
REQUEST_TIMEOUT = 120.0

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


# ── DB helpers (asyncpg / Postgres) ───────────────────────────────────────────


def _asyncpg_dsn(database_url: str) -> tuple[str, dict]:
    """Turn the app's SQLAlchemy DATABASE_URL into (dsn, connect_kwargs) for asyncpg.

    Strips the `+asyncpg` driver tag and SQLAlchemy-only query params, and returns
    connect kwargs (ssl + disabled statement cache for Supabase Supavisor pooler).
    """
    url = database_url
    if url.startswith("postgresql+asyncpg://"):
        url = "postgresql://" + url[len("postgresql+asyncpg://") :]
    elif url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]

    parts = urlsplit(url)
    needs_ssl = False
    for k, v in parse_qsl(parts.query):
        if k.lower() == "sslmode" and v not in ("disable", "allow"):
            needs_ssl = True
        if k.lower() == "ssl" and v in ("require", "true", "1"):
            needs_ssl = True
    # Supabase pooler hostnames always need TLS.
    if "pooler.supabase.com" in (parts.hostname or "") or "supabase" in (parts.hostname or ""):
        needs_ssl = True

    dsn = f"{parts.scheme}://{parts.netloc}{parts.path}"  # drop query
    kwargs: dict = {"statement_cache_size": 0}  # Supavisor: no prepared statements
    if needs_ssl:
        kwargs["ssl"] = "require"
    return dsn, kwargs


async def setup_session(env: dict) -> str:
    """Insert a loadtest tenant + ocr_session and return a freshly minted OCR JWT."""
    dsn, kwargs = _asyncpg_dsn(env["DATABASE_URL"])
    conn = await asyncpg.connect(dsn, **kwargs)
    try:
        tenant_id = str(uuid.uuid4())
        session_id = str(uuid.uuid4())
        carmen_user_id = "loadtest-" + uuid.uuid4().hex[:12]

        await conn.execute(
            """
            INSERT INTO tenants (id, host, bu_code, name, plan, is_active)
            VALUES ($1, $2, $3, $4, 'free', true)
            """,
            uuid.UUID(tenant_id),
            f"loadtest-{tenant_id[:8]}.local",
            "LT",
            "loadtest/LT",
        )
        f = Fernet(env["SESSION_ENCRYPTION_KEY"].encode())
        encrypted = f.encrypt(b"loadtest|fake-carmen-token").decode()
        await conn.execute(
            """
            INSERT INTO ocr_sessions
              (id, tenant_id, carmen_user_id, username,
               carmen_token_encrypted, carmen_uri, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, true)
            """,
            uuid.UUID(session_id),
            uuid.UUID(tenant_id),
            carmen_user_id,
            "loadtest",
            encrypted,
            "https://example.invalid",
        )
    finally:
        await conn.close()

    now = datetime.now(UTC).replace(tzinfo=None)
    payload = {
        "sid": session_id,
        "tid": tenant_id,
        "cuid": carmen_user_id,
        "username": "loadtest",
        "bu": "LT",
        "carmen_uri": "https://example.invalid",
        "iat": now,
        "exp": now + timedelta(hours=2),
    }
    return jwt.encode(payload, env["OCR_JWT_SECRET"], algorithm="HS256")


# ── Stats ─────────────────────────────────────────────────────────────────────


@dataclass
class LevelStats:
    concurrency: int
    total: int = 0
    errors: int = 0
    error_kinds: dict[str, int] = field(default_factory=dict)
    latencies: list[float] = field(default_factory=list)
    status_counts: dict[int, int] = field(default_factory=dict)

    def add(self, ok: bool, latency: float, error: str | None = None, status: int = 0) -> None:
        self.total += 1
        self.latencies.append(latency)
        if status:
            self.status_counts[status] = self.status_counts.get(status, 0) + 1
        if not ok:
            self.errors += 1
            key = error or "unknown"
            self.error_kinds[key] = self.error_kinds.get(key, 0) + 1

    @property
    def err_rate(self) -> float:
        return self.errors / self.total if self.total else 0.0

    def percentile(self, p: float) -> float:
        if not self.latencies:
            return 0.0
        ordered = sorted(self.latencies)
        k = max(0, min(len(ordered) - 1, int(round((p / 100) * (len(ordered) - 1)))))
        return ordered[k]

    def line(self) -> str:
        if not self.latencies:
            return f"C={self.concurrency:<3}  no samples"
        rps = self.total / max(self.latencies)
        kinds = ", ".join(f"{k}={v}" for k, v in self.error_kinds.items()) or "—"
        return (
            f"C={self.concurrency:<3}  n={self.total:<4}  "
            f"err={self.err_rate * 100:5.1f}%  "
            f"p50={self.percentile(50):5.2f}s  "
            f"p95={self.percentile(95):5.2f}s  "
            f"p99={self.percentile(99):5.2f}s  "
            f"max={max(self.latencies):5.2f}s  "
            f"~rps={rps:5.1f}  errors: {kinds}"
        )


async def fire_one(
    client: httpx.AsyncClient, token: str, vu_id: int, image_bytes: bytes, stats: LevelStats
) -> None:
    headers = {
        "Authorization": f"Bearer {token}",
        # Spoof per-VU IP so the per-IP HTTP rate limiter doesn't cap us.
        "X-Forwarded-For": f"10.99.{(vu_id >> 8) & 0xFF}.{vu_id & 0xFF}",
    }
    files = {"files": ("BBLbank.png", image_bytes, "image/png")}
    t0 = time.perf_counter()
    try:
        r = await client.post(
            BACKEND_URL + EXTRACT_PATH, headers=headers, files=files, timeout=REQUEST_TIMEOUT
        )
        dt = time.perf_counter() - t0
        if r.status_code == 200:
            stats.add(True, dt, status=200)
        else:
            body = r.text[:120].replace("\n", " ")
            stats.add(False, dt, error=f"HTTP{r.status_code}:{body[:50]}", status=r.status_code)
    except Exception as exc:
        dt = time.perf_counter() - t0
        stats.add(False, dt, error=type(exc).__name__)


async def run_level(token: str, concurrency: int, hold_s: float, image_bytes: bytes) -> LevelStats:
    stats = LevelStats(concurrency=concurrency)
    stop_at = time.monotonic() + hold_s
    limits = httpx.Limits(
        max_connections=concurrency + 8, max_keepalive_connections=concurrency + 8
    )
    async with httpx.AsyncClient(limits=limits) as client:

        async def worker(vu: int) -> None:
            while time.monotonic() < stop_at:
                await fire_one(client, token, vu, image_bytes, stats)

        await asyncio.gather(*[worker(i) for i in range(concurrency)])
    return stats


# ── Shared backend prep ───────────────────────────────────────────────────────


def _load_env() -> dict:
    env = dotenv_values(ENV_PATH)
    for k in ("OCR_JWT_SECRET", "SESSION_ENCRYPTION_KEY", "DATABASE_URL"):
        if not env.get(k):
            print(f"[abort] missing {k} in {ENV_PATH}")
            sys.exit(2)
    return env


def _keys_from_env(env: dict) -> list[str]:
    """Resolve the OpenRouter keys the same way the app's property does, tolerant of
    the operator stuffing multiple comma-separated keys into the singular var."""
    raw = (env.get("OPENROUTER_API_KEYS") or env.get("OPENROUTER_API_KEY") or "").strip()
    keys = [k.strip() for k in raw.split(",") if k.strip()]
    # De-dup, preserve order.
    seen: set[str] = set()
    return [k for k in keys if not (k in seen or seen.add(k))]


async def _sanity_ping(token: str) -> None:
    async with httpx.AsyncClient() as c:
        r = await c.get(
            BACKEND_URL + "/api/v1/auth/usage",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        print(f"sanity /auth/usage -> {r.status_code}")
        if r.status_code != 200:
            print(f"  body: {r.text[:200]}")
            print("[abort] sanity failed — JWT/session not accepted by backend")
            sys.exit(3)


# ── Modes ─────────────────────────────────────────────────────────────────────


async def mode_health(env: dict) -> None:
    """Ping each OpenRouter key directly (no backend)."""
    keys = _keys_from_env(env)
    base = env.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
    model = env.get("OPENROUTER_OCR_MODEL", "google/gemini-2.5-flash-lite")
    if not keys:
        print("[abort] no OpenRouter keys found in .env")
        sys.exit(2)
    print(f"health: probing {len(keys)} key(s) against {base} model={model}")
    print("-" * 90)
    all_ok = True
    async with httpx.AsyncClient(timeout=30) as c:
        for i, key in enumerate(keys, start=1):
            t0 = time.perf_counter()
            try:
                r = await c.post(
                    f"{base}/chat/completions",
                    headers={"Authorization": f"Bearer {key}"},
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": "ping"}],
                        "max_tokens": 1,
                        "temperature": 0.0,
                    },
                )
                dt = (time.perf_counter() - t0) * 1000
                tail = key[-6:]
                if r.status_code == 200:
                    print(f"  key{i} (...{tail}) -> 200 OK   {dt:6.0f}ms")
                else:
                    all_ok = False
                    print(f"  key{i} (...{tail}) -> {r.status_code} FAIL  {r.text[:120]}")
            except Exception as exc:
                all_ok = False
                print(f"  key{i} (...{key[-6:]}) -> ERROR {type(exc).__name__}: {exc}")
    print("-" * 90)
    print("health: ALL KEYS OK" if all_ok else "health: SOME KEYS FAILED — fix before comparison")
    sys.exit(0 if all_ok else 4)


async def mode_ramp(env: dict, label: str, levels: list[int], hold_s: float) -> None:
    if not IMAGE_PATH.exists():
        print(f"[abort] image not found: {IMAGE_PATH}")
        sys.exit(2)
    image_bytes = IMAGE_PATH.read_bytes()
    print(f"[{label}] image={IMAGE_PATH.name} size={len(image_bytes):,}B")
    print(f"[{label}] setup: creating loadtest tenant/session...")
    token = await setup_session(env)
    await _sanity_ping(token)
    print()
    print(
        f"[{label}] ramp: {levels}  hold={hold_s}s/level  "
        f"stop_at err>{MAX_ERR_RATE * 100:.0f}% or p95>{MAX_P95_SEC}s "
        f"or p95>{P95_MULTIPLIER_OF_BASELINE}x baseline"
    )
    print("-" * 112)
    results: list[LevelStats] = []
    baseline_p95: float | None = None
    for c in levels:
        print(f"[{label}] running C={c} for {hold_s}s ...", flush=True)
        s = await run_level(token, c, hold_s, image_bytes)
        print("  " + s.line())
        results.append(s)
        if baseline_p95 is None and s.latencies:
            baseline_p95 = s.percentile(95)
            print(f"  baseline p95 = {baseline_p95:.2f}s")
        if s.err_rate > MAX_ERR_RATE:
            print(f"  => STOP: error rate {s.err_rate * 100:.1f}% > {MAX_ERR_RATE * 100:.0f}%")
            break
        if s.percentile(95) > MAX_P95_SEC:
            print(f"  => STOP: p95 {s.percentile(95):.2f}s > {MAX_P95_SEC}s")
            break
        if baseline_p95 and s.percentile(95) > baseline_p95 * P95_MULTIPLIER_OF_BASELINE:
            print(
                f"  => STOP: p95 {s.percentile(95):.2f}s > "
                f"{P95_MULTIPLIER_OF_BASELINE}x baseline ({baseline_p95:.2f}s)"
            )
            break
    print()
    print(f"FINAL [{label}]")
    print("-" * 112)
    for s in results:
        print(s.line())


async def mode_valve(env: dict, burst: int, hold_s: float) -> None:
    """Saturate a small pool and prove the 429 safety valve.

    Launch the backend with e.g. LLM_VISION_CONCURRENCY_PER_KEY=2,
    LLM_MAX_QUEUE_WAIT_SECONDS=2, single key, then run this.
    """
    if not IMAGE_PATH.exists():
        print(f"[abort] image not found: {IMAGE_PATH}")
        sys.exit(2)
    image_bytes = IMAGE_PATH.read_bytes()
    print(f"valve: setup tenant; firing burst C={burst} for {hold_s}s")
    token = await setup_session(env)
    await _sanity_ping(token)
    s = await run_level(token, burst, hold_s, image_bytes)
    print("-" * 112)
    print(s.line())
    ok = s.status_counts.get(200, 0)
    too_many = s.status_counts.get(429, 0)
    server_err = sum(v for k, v in s.status_counts.items() if k >= 500)
    timeouts = sum(v for k, v in s.error_kinds.items() if "Timeout" in k or "timeout" in k)
    print()
    print(f"valve: 200={ok}  429={too_many}  5xx={server_err}  timeouts={timeouts}")
    if too_many > 0 and server_err == 0 and timeouts == 0:
        print("valve: PASS — pool shed load with 429 (Retry-After), no hang/5xx")
    elif too_many == 0:
        print("valve: NO 429 seen — pool never saturated (raise burst or lower per-key cap)")
    else:
        print("valve: CHECK — saw 5xx/timeouts; inspect backend logs")


async def mode_distribution(env: dict, since_min: int) -> None:
    """Show how recent OpenRouter vision calls spread across keys."""
    dsn, kwargs = _asyncpg_dsn(env["DATABASE_URL"])
    since = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=since_min)
    conn = await asyncpg.connect(dsn, **kwargs)
    try:
        rows = await conn.fetch(
            """
            SELECT
              CASE WHEN position('#' in url) > 0
                   THEN split_part(url, '#', 2) ELSE '(no-label)' END AS key_label,
              count(*) AS n,
              count(*) FILTER (WHERE status_code = 200) AS ok,
              round(avg(duration_ms)::numeric, 0) AS avg_ms
            FROM outbound_call_logs
            WHERE service = 'openrouter' AND created_at >= $1
            GROUP BY 1 ORDER BY 1
            """,
            since,
        )
    finally:
        await conn.close()
    print(f"distribution: openrouter calls in last {since_min} min")
    print("-" * 60)
    total = sum(r["n"] for r in rows)
    for r in rows:
        pct = (r["n"] / total * 100) if total else 0
        print(
            f"  {r['key_label']:<12} n={r['n']:<5} ok={r['ok']:<5} "
            f"avg={r['avg_ms']}ms  ({pct:4.1f}%)"
        )
    print("-" * 60)
    print(f"  total={total}")


async def mode_cleanup(env: dict) -> None:
    dsn, kwargs = _asyncpg_dsn(env["DATABASE_URL"])
    conn = await asyncpg.connect(dsn, **kwargs)
    try:
        # Child rows first (FK order): transactions -> credit_cards -> ocr_tasks,
        # then sessions, then tenants. Scope by the loadtest tenant host pattern.
        tenant_ids = await conn.fetch("SELECT id FROM tenants WHERE host LIKE 'loadtest-%.local'")
        ids = [r["id"] for r in tenant_ids]
        if not ids:
            print("cleanup: no loadtest tenants found")
            return
        # Best-effort cleanup of child rows; skip tables that may not exist in this env.
        for stmt in [
            "DELETE FROM credit_card_transactions WHERE credit_card_id IN (SELECT id FROM credit_cards WHERE tenant_id = ANY($1::uuid[]))",
            "DELETE FROM credit_cards WHERE tenant_id = ANY($1::uuid[])",
            "DELETE FROM ocr_tasks WHERE tenant_id = ANY($1::uuid[])",
        ]:
            try:
                await conn.execute(stmt, ids)
            except Exception:
                pass
        await conn.execute("DELETE FROM ocr_sessions WHERE tenant_id = ANY($1::uuid[])", ids)
        await conn.execute("DELETE FROM tenants WHERE id = ANY($1::uuid[])", ids)
        print(f"cleanup: removed {len(ids)} loadtest tenant(s) and their rows")
    finally:
        await conn.close()


# ── Entry ─────────────────────────────────────────────────────────────────────


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--mode",
        choices=["health", "ramp", "valve", "distribution", "cleanup"],
        default="ramp",
    )
    ap.add_argument("--label", default="run", help="label for ramp output")
    ap.add_argument("--levels", default=",".join(map(str, DEFAULT_RAMP)))
    ap.add_argument("--hold", type=float, default=HOLD_SECONDS)
    ap.add_argument("--burst", type=int, default=12, help="valve burst concurrency")
    ap.add_argument("--since-min", type=int, default=20, help="distribution lookback window")
    args = ap.parse_args()

    env = _load_env()
    if args.mode == "health":
        await mode_health(env)
    elif args.mode == "ramp":
        levels = [int(x) for x in args.levels.split(",") if x.strip()]
        await mode_ramp(env, args.label, levels, args.hold)
    elif args.mode == "valve":
        await mode_valve(env, args.burst, args.hold)
    elif args.mode == "distribution":
        await mode_distribution(env, args.since_min)
    elif args.mode == "cleanup":
        await mode_cleanup(env)


if __name__ == "__main__":
    asyncio.run(main())
