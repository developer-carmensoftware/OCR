"""A contact person's details encrypted at rest — the data half of contact_pii_ui.mjs.

    python scripts/qa/contact_pii_e2e.py legacy      # plaintext rows, the way they sat before
    python scripts/qa/contact_pii_e2e.py check       # every value of BU carmen is a token we open
    python scripts/qa/contact_pii_e2e.py admin-jwt   # an admin token for the C-5/C-6 API calls

LOCAL STACK ONLY (`npx supabase start`, Postgres on 127.0.0.1:54322): the migration that
widens these columns (20261029010000) is not on the shared dev database until it ships, and
`legacy` writes plaintext on purpose. The script sets DATABASE_URL itself and never reads
backend/.env's. The key is backend/.env's SESSION_ENCRYPTION_KEY, as the backend on 8011 uses.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import uuid
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]  # scripts/qa/this.py -> repo root
load_dotenv(ROOT / "backend" / ".env")
os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres"
sys.path.insert(0, str(ROOT / "backend"))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from sqlalchemy import text  # noqa: E402

from app.database import async_session  # noqa: E402
from app.models.encrypted_json import TOKEN_PREFIX, read_stored, read_text  # noqa: E402

BU = "carmen"
LEGACY_CONTACT = "คุณวิชัย ระบบเดิม"


async def _tenant(db) -> uuid.UUID:
    tid = await db.scalar(text("select id from tenants where bu_code = :b"), {"b": BU})
    if tid is None:
        sys.exit(f"[abort] no tenant {BU!r} — sign in through the SSO link first (C-1)")
    return tid


async def legacy() -> None:
    """A tenant contact email and a proforma written in plaintext (the order is void, so it
    neither blocks a new checkout nor feeds the prefill)."""
    async with async_session() as db:
        tid = await _tenant(db)
        order_id, doc_id = uuid.uuid4(), uuid.uuid4()
        await db.execute(
            text("update tenants set contact_email = 'ops.legacy@example.co.th' where id = :t"),
            {"t": tid},
        )
        await db.execute(
            text(
                "insert into credit_orders (id, tenant_id, pack_code, credits, amount_thb, status,"
                " billing_period, created_at, updated_at) values (:id, :t, 'pack_small', 500, 1200,"
                " 'void', 'monthly', now() - interval '1 day', now() - interval '1 day')"
            ),
            {"id": order_id, "t": tid},
        )
        await db.execute(
            text(
                "insert into billing_documents (id, tenant_id, order_id, doc_type, number, issue_date,"
                " buyer_name, buyer_contact_name, buyer_tel, buyer_email, pack_code, credits,"
                " subtotal, vat_rate, vat_amount, total, currency, created_at, updated_at) values"
                " (:id, :t, :o, 'proforma', :n, now(), 'E2E legacy buyer', :c, '0899999999',"
                " 'legacy@example.co.th', 'pack_small', 500, 1200, 7, 84, 1284, 'THB',"
                " now() - interval '1 day', now() - interval '1 day')"
            ),
            {"id": doc_id, "t": tid, "o": order_id, "n": f"E2E-PF-{doc_id.hex[:8]}", "c": LEGACY_CONTACT},
        )
        await db.commit()
    print(json.dumps({"tenant_id": str(tid), "legacy_order": str(order_id)}))


async def check() -> int:
    bad = 0
    async with async_session() as db:
        tid = await _tenant(db)
        rows = (
            await db.execute(
                text(
                    "select 'proforma ' || number, buyer_contact_name, buyer_tel, buyer_email"
                    " from billing_documents where tenant_id = :t"
                    " union all select 'tenant', contact_email, null, null from tenants where id = :t"
                ),
                {"t": tid},
            )
        ).all()
        owners = await db.scalar(
            text("select owner_emails::text from email_ingest_settings where tenant_id = :t"), {"t": tid}
        )
    for name, *values in rows:
        for v in values:
            if v is None:
                continue
            ok = v.startswith(TOKEN_PREFIX) and read_text(v) is not None
            bad += not ok
            print(f"  {'ok ' if ok else 'BAD'} {name:28} {'token' if ok else 'PLAINTEXT ' + v[:30]}")
    if owners is not None:
        stored = json.loads(owners)
        ok = isinstance(stored, dict) and set(stored) == {"enc"} and read_stored(stored) is not None
        bad += not ok
        print(f"  {'ok ' if ok else 'BAD'} {'owner_emails':28} {'token' if ok else 'PLAINTEXT ' + owners[:40]}")
    print(f"  {bad} wrong")
    return 1 if bad else 0


def admin_jwt() -> None:
    from app.auth.admin_session import create_admin_jwt
    from app.services.admin.auth import get_admin_jwt_secret

    print(
        create_admin_jwt(
            "e2e-admin", "e2e", ["e2e"], ["orders:read", "tenants:read"], get_admin_jwt_secret(), ttl_hours=1
        )
    )


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "legacy":
        asyncio.run(legacy())
    elif cmd == "check":
        sys.exit(asyncio.run(check()))
    elif cmd == "admin-jwt":
        admin_jwt()
    else:
        sys.exit(__doc__)
