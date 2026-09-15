"""Mint a browser session so a real browser can open the app without Carmen SSO.

    python scripts/seed_browser_session.py                 # dev.carmen4.com / carmencloud
    python scripts/seed_browser_session.py --bu carmen
    python scripts/seed_browser_session.py --revoke        # kill the sessions this wrote

Every authenticated endpoint goes through `get_current_session`, which needs a live
`ocr_sessions` row — a correctly signed JWT on its own gets 401 "Session not found or
revoked", because the row is where the encrypted Carmen token lives. So there is no
way to drive the UI from a browser without writing one. This does exactly that and
prints the snippet to paste into DevTools.

**The Carmen credential** comes from `CARMEN_AUTHORIZATION` in `backend/.env` when it is
set, so Carmen-backed screens work too. That value is the *whole* Authorization header —
`carmen_service` sends it verbatim (`"Authorization": carmen_token`, no scheme bolted on),
which is why it starts with `direct `. Store it as-is; stripping the prefix produces a
session that 401s against Carmen with no obvious cause. Without the var the script falls
back to a placeholder, and anything calling Carmen ERP then fails — posting a JV, and
`GET /credits/company-profile`, which falls through to an empty form.

Dev only. It writes one row to whatever DATABASE_URL points at, and `--revoke` takes it
back out again. Note the Carmen token has its own, shorter life than this JWT: when Carmen
expires it, re-run with a fresh `CARMEN_AUTHORIZATION`.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import uuid
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "backend" / ".env")
sys.path.insert(0, str(ROOT / "backend"))

DSN = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
DSN = DSN.replace(":5432/", ":6543/")  # transaction pooler — see the EMAXCONNSESSION note

# Stamped on every row this script writes, so --revoke can find its own work and
# nothing else. A real login writes the Carmen user's UUID here.
MARK = "seed-browser-session"


async def resolve_tenant(conn, host: str, bu: str) -> uuid.UUID:
    row = await conn.fetchrow(
        "select id from tenants where host = $1 and bu_code = $2 and deleted_at is null",
        host,
        bu,
    )
    if row is None:
        raise SystemExit(f"no tenant for {host} / {bu} — log in through Carmen once first")
    return row["id"]


async def revoke(conn) -> int:
    got = await conn.execute(
        "update ocr_sessions set is_active = false where carmen_user_id = $1 and is_active",
        MARK,
    )
    return int(got.split()[-1])


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--host", default="dev.carmen4.com")
    ap.add_argument("--bu", default="carmen")
    ap.add_argument("--hours", type=float, default=8, help="JWT lifetime")
    ap.add_argument("--revoke", action="store_true", help="deactivate seeded sessions and stop")
    args = ap.parse_args()

    # Imported here, not at module scope: these pull in app.config, which validates the
    # whole environment on import and is a confusing failure for `--help`.
    from app.auth.session import create_session_jwt, encrypt_carmen_token
    from app.config import settings

    conn = await asyncpg.connect(DSN, statement_cache_size=0)
    try:
        killed = await revoke(conn)
        if args.revoke:
            print(f"revoked {killed} seeded session(s)")
            return 0
        if killed:
            print(f"revoked {killed} older seeded session(s)")

        tenant = await resolve_tenant(conn, args.host, args.bu)
        session_id = uuid.uuid4()
        carmen_token = os.environ.get("CARMEN_AUTHORIZATION") or ""
        if not carmen_token:
            carmen_token = "not-a-real-carmen-token"
            print("CARMEN_AUTHORIZATION unset — Carmen-backed screens will fail")
        await conn.execute(
            "insert into ocr_sessions"
            " (id, tenant_id, carmen_user_id, username, carmen_token_encrypted,"
            "  carmen_uri, is_active)"
            " values ($1, $2, $3, $4, $5, $6, true)",
            session_id,
            tenant,
            MARK,
            "browser-test",
            encrypt_carmen_token(carmen_token, settings.session_encryption_key),
            f"https://{args.host}",
        )

        token = create_session_jwt(
            session_id=str(session_id),
            tenant_id=str(tenant),
            carmen_user_id=MARK,
            username="browser-test",
            secret=settings.ocr_jwt_secret,
            ttl_hours=args.hours,
            carmen_uri=f"https://{args.host}",
            bu=args.bu,
        )

        print(f"\ntenant {tenant}  ({args.host}/{args.bu})   session {session_id}")
        print(f"expires in {args.hours}h\n")
        print("Open http://localhost:3010, run this in the DevTools console, then reload:\n")
        # sessionStorage, not localStorage — that is where lib/api/client.ts reads it.
        print(f"sessionStorage.setItem('ocr_access_token', '{token}'); location.hash = '#/pricing'")
        print("\nWhen finished:  python scripts/seed_browser_session.py --revoke")
        return 0
    finally:
        await conn.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
