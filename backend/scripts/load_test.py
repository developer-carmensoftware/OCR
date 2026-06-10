"""
Ramp-up load test for /api/v1/credit-card/extract.

Strategy
--------
- Bypass /auth/exchange (it validates against the real Carmen API).
- Open a direct DB connection, upsert a test tenant + BU + OcrSession,
  then mint an OCR JWT locally with the same OCR_JWT_SECRET the app uses.
- Spoof a unique X-Forwarded-For per virtual user so the per-IP HTTP rate
  limiter (30 req/60s on /extract) doesn't cap the test prematurely.
- Ramp concurrency upward; hold each level for HOLD_SECONDS; stop when
  error rate > MAX_ERR_RATE OR p95 latency > MAX_P95_SEC.

Run:
    backend\\venv\\Scripts\\python.exe backend\\scripts\\load_test.py
"""

from __future__ import annotations

import asyncio
import sys
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

import aiomysql
import httpx
from cryptography.fernet import Fernet
from dotenv import dotenv_values
from jose import jwt

# ── Config ────────────────────────────────────────────────────────────────────

BACKEND_URL = "http://127.0.0.1:8010"
EXTRACT_PATH = "/api/v1/credit-card/extract?bank_code=BBL"
IMAGE_PATH = Path(__file__).resolve().parent.parent / "example_field" / "BBLbank.png"

RAMP_LEVELS = [1, 2, 4, 8, 16, 24, 32, 48, 64]
HOLD_SECONDS = 15.0  # how long to sustain each level
MAX_ERR_RATE = 0.05  # stop when > 5% errors
MAX_P95_SEC = 30.0  # absolute ceiling — LLM call itself is ~5s, so this allows queue depth ~6x
P95_MULTIPLIER_OF_BASELINE = 4.0  # stop when p95 grows past 4x the C=1 baseline
REQUEST_TIMEOUT = 120.0  # per-request HTTP timeout (LLM cap is 60s + 3 retries)

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


# ── Setup ─────────────────────────────────────────────────────────────────────


def _parse_db_url(url: str) -> dict:
    # mysql+aiomysql://root:123456@localhost:3306  →  components
    from urllib.parse import urlparse

    p = urlparse(url.replace("mysql+aiomysql://", "mysql://", 1))
    return {
        "host": p.hostname or "localhost",
        "port": p.port or 3306,
        "user": p.username or "root",
        "password": p.password or "",
        "db": "carmen_ai",
    }


async def setup_session(env: dict) -> str:
    """Insert a tenant + session row and return a freshly minted JWT."""
    cfg = _parse_db_url(env["DATABASE_URL"])
    conn = await aiomysql.connect(autocommit=True, **cfg)
    try:
        async with conn.cursor() as cur:
            tenant_id = str(uuid.uuid4())
            session_id = str(uuid.uuid4())
            carmen_user_id = "loadtest-" + uuid.uuid4().hex[:12]

            # tenant (one row per host+bu pair)
            await cur.execute(
                """
                INSERT INTO tenants (id, host, bu_code, name, plan, is_active)
                VALUES (%s, %s, %s, %s, 'free', 1)
                """,
                (
                    tenant_id,
                    f"loadtest-{tenant_id[:8]}.local",
                    "LT",
                    "loadtest/LT",
                ),
            )
            # encrypted carmen token (fake — we won't actually call Carmen)
            f = Fernet(env["SESSION_ENCRYPTION_KEY"].encode())
            encrypted = f.encrypt(b"loadtest|fake-carmen-token").decode()

            await cur.execute(
                """
                INSERT INTO ocr_sessions
                  (id, tenant_id, carmen_user_id, username,
                   carmen_token_encrypted, carmen_uri, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, 1)
                """,
                (
                    session_id,
                    tenant_id,
                    carmen_user_id,
                    "loadtest",
                    encrypted,
                    "https://example.invalid",
                ),
            )
    finally:
        conn.close()

    from datetime import UTC, datetime, timedelta

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


# ── Load test ─────────────────────────────────────────────────────────────────


@dataclass
class LevelStats:
    concurrency: int
    total: int = 0
    errors: int = 0
    error_kinds: dict[str, int] = field(default_factory=dict)
    latencies: list[float] = field(default_factory=list)

    def add(self, ok: bool, latency: float, error: str | None = None) -> None:
        self.total += 1
        self.latencies.append(latency)
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
        # Middleware reads X-Forwarded-For first.
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
            stats.add(True, dt)
        else:
            body = r.text[:120].replace("\n", " ")
            stats.add(False, dt, error=f"HTTP{r.status_code}:{body[:60]}")
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


async def main() -> None:
    env = dotenv_values(ENV_PATH)
    for k in ("OCR_JWT_SECRET", "SESSION_ENCRYPTION_KEY", "DATABASE_URL"):
        if not env.get(k):
            print(f"[abort] missing {k} in {ENV_PATH}")
            sys.exit(2)

    if not IMAGE_PATH.exists():
        print(f"[abort] image not found: {IMAGE_PATH}")
        sys.exit(2)
    image_bytes = IMAGE_PATH.read_bytes()
    print(f"image: {IMAGE_PATH.name}  size={len(image_bytes):,} bytes")

    print("setup: creating test tenant/BU/session...")
    token = await setup_session(env)
    print(f"setup: JWT minted ({len(token)} chars)")

    # Sanity ping with the JWT before ramping
    async with httpx.AsyncClient() as c:
        r = await c.get(
            BACKEND_URL + "/api/v1/auth/usage",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        print(f"sanity /auth/usage -> {r.status_code}")
        if r.status_code != 200:
            print(f"  body: {r.text[:200]}")
            print("[abort] sanity failed — JWT or session is not accepted by the backend")
            sys.exit(3)

    print()
    print(
        f"ramp: {RAMP_LEVELS}  hold={HOLD_SECONDS}s/level  "
        f"stop_at err>{MAX_ERR_RATE * 100:.0f}% or p95>{MAX_P95_SEC}s "
        f"or p95>{P95_MULTIPLIER_OF_BASELINE}x baseline"
    )
    print("-" * 110)

    results: list[LevelStats] = []
    baseline_p95: float | None = None
    for c in RAMP_LEVELS:
        print(f"running C={c} for {HOLD_SECONDS}s ...", flush=True)
        s = await run_level(token, c, HOLD_SECONDS, image_bytes)
        print("  " + s.line())
        results.append(s)
        if baseline_p95 is None and s.latencies:
            baseline_p95 = s.percentile(95)
            print(f"  baseline p95 = {baseline_p95:.2f}s (everything above is overhead from load)")
        if s.err_rate > MAX_ERR_RATE:
            print(f"  => STOP: error rate {s.err_rate * 100:.1f}% > {MAX_ERR_RATE * 100:.0f}%")
            break
        if s.percentile(95) > MAX_P95_SEC:
            print(f"  => STOP: p95 {s.percentile(95):.2f}s > {MAX_P95_SEC}s")
            break
        if baseline_p95 and s.percentile(95) > baseline_p95 * P95_MULTIPLIER_OF_BASELINE:
            print(
                f"  => STOP: p95 {s.percentile(95):.2f}s > {P95_MULTIPLIER_OF_BASELINE}x baseline ({baseline_p95:.2f}s)"
            )
            break

    print()
    print("FINAL")
    print("-" * 110)
    for s in results:
        print(s.line())


if __name__ == "__main__":
    asyncio.run(main())
