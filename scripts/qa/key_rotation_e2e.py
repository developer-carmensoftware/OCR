"""Key rotation (docs/KEY_ROTATION.md) — the data half of key_rotation_ui.mjs. LOCAL STACK ONLY.

    python scripts/qa/key_rotation_e2e.py seed     # a pending email document, under the running key
    python scripts/qa/key_rotation_e2e.py check    # which key opens each of BU carmen's tokens

`seed` writes through the app's models, so it encrypts under whatever SESSION_ENCRYPTION_KEY
the environment gives this process — run it with the same key as the backend. `check` needs
KEY_A and KEY_B in the environment and reads raw values only: for every token it says whether
A, B or neither opens it.

The local Supabase stack (127.0.0.1:54322), never the shared dev database: the run moves
tokens between keys nobody else holds. The script sets DATABASE_URL itself.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import uuid
from collections import Counter
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]  # scripts/qa/this.py -> repo root
load_dotenv(ROOT / "backend" / ".env")
os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres"
sys.path.insert(0, str(ROOT / "backend"))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from cryptography.fernet import Fernet, InvalidToken  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.database import async_session  # noqa: E402
from app.models.email_automation import EmailDocument  # noqa: E402

BU = "carmen"
DOC_NO = "E2E-ROT-01"
ERROR = "None of this BU's registered addresses appear in From/To/Cc — this mail carries ap@exampel.co.th"
PAYLOAD = {
    "extracted": {
        "bank_code": "BAY",
        "doc_no": DOC_NO,
        "doc_date": "15/10/2026",
        "details": [
            {"transaction": "VS INTER PREM", "pay_amt": "5000.00", "commis_amt": "75.00", "tax_amt": "5.25"},
            {"transaction": "MC INTER PREM", "pay_amt": "3000.00", "commis_amt": "45.00", "tax_amt": "3.15"},
        ],
    },
    "flags": [],
    "unmapped": [],
    "guessed": [],
    "suggested": {},
    "doc_type": "fee_invoice",
}


async def _tenant(db) -> uuid.UUID:
    tid = await db.scalar(text("select id from tenants where bu_code = :b"), {"b": BU})
    if tid is None:
        sys.exit(f"[abort] no tenant {BU!r} — sign in through the SSO link first")
    return tid


async def seed() -> None:
    async with async_session() as db:
        tid = await _tenant(db)
        await db.execute(text("delete from email_documents where tenant_id = :t and doc_no = :d"), {"t": tid, "d": DOC_NO})
        db.add(
            EmailDocument(
                id=uuid.uuid4(),
                tenant_id=tid,
                message_id="<e2e-rot@seed.local>",
                attachment="E2E-ROT.pdf",
                status="pending_review",
                bank_code="BAY",
                doc_no=DOC_NO,
                review_payload=PAYLOAD,
                error_message=ERROR,
            )
        )
        await db.commit()
    print("seeded", DOC_NO)


def _which(token: str, keys: dict[str, Fernet]) -> str:
    for name, f in keys.items():
        try:
            f.decrypt(token.encode())
            return name
        except InvalidToken:
            pass
    return "neither"


async def check() -> int:
    keys = {name: Fernet(os.environ[f"KEY_{name}"].encode()) for name in ("A", "B")}
    async with async_session() as db:
        tid = await _tenant(db)
        rows = {
            "email_documents.review_payload": "select review_payload->>'enc' from email_documents where tenant_id = :t and review_payload ? 'enc'",
            "email_documents.error_message": "select error_message from email_documents where tenant_id = :t and error_message like 'gAAAAA%'",
            "billing_documents.contact": "select unnest(array[buyer_contact_name, buyer_tel, buyer_email]) from billing_documents where tenant_id = :t",
            "email_ingest_settings.owner_emails": "select owner_emails->>'enc' from email_ingest_settings where tenant_id = :t and owner_emails ? 'enc'",
            "email_ingest_settings.carmen_token_enc": "select carmen_token_enc from email_ingest_settings where tenant_id = :t",
            "ocr_sessions.carmen_token_encrypted": "select carmen_token_encrypted from ocr_sessions where tenant_id = :t and carmen_token_encrypted like 'gAAAAA%'",
        }
        out = {}
        for name, sql in rows.items():
            tokens = [v for v in (await db.execute(text(sql), {"t": tid})).scalars().all() if v]
            out[name] = dict(Counter(_which(v, keys) for v in tokens))
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "seed":
        asyncio.run(seed())
    elif cmd == "check":
        sys.exit(asyncio.run(check()))
    else:
        sys.exit(__doc__)
