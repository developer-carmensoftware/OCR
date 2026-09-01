"""Seed two `pending_review` documents so the Needs-review state can actually be looked at.

The dev database has never held one: both BUs run `auto_post = false`, but the deployed
backend predates the review fork, so nothing has ever parked. `IMAP_HOST` is empty locally,
so the real pipeline cannot be run to make one either.

Creates, per document, the three rows the review screen and `approve_document` need:

    ocr_tasks  ->  credit_cards (submitted_at NULL)  ->  email_documents (pending_review)

`review_payload.extracted.id` points at the `credit_cards` row because that is what
`_mark_submitted` stamps on approve. `submitted_at` stays NULL, so these do NOT show up as
Manual rows in the activity table — only as the email documents they claim to be.

    python scripts/seed_review_demo.py            # seed
    python scripts/seed_review_demo.py --clean    # remove everything it made

⚠️  DEMO-CLEAN is approvable, and approving it posts a real JV into that BU's Carmen.
    DEMO-BENT does not reconcile, so `AccountingReview` disables Approve on it — that one
    is safe to click through end to end.

ponytail: raw asyncpg over the transaction pooler, not the app's ORM session. This is a
one-off dev fixture; importing the app to write six rows would drag in config validation,
the LLM client and the 15-connection Supavisor budget uvicorn is already using.
"""

from __future__ import annotations

import asyncio
import json
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import asyncpg

BU = "carmencloud"  # the BU with mail, a verified posting credential, and real rules
TAG = "demo-review"  # every row this script writes carries it, so --clean is exact


def dsn() -> str:
    env = Path(__file__).resolve().parent.parent / ".env"
    url = next(
        line.split("=", 1)[1].strip()
        for line in env.read_text(encoding="utf-8").splitlines()
        if line.startswith("DATABASE_URL=")
    )
    # Transaction pooler + no prepared-statement cache: a session-mode connection here
    # competes with uvicorn for the 15-connection project cap (see the EMAXCONNSESSION
    # incident in docs/LOAD_TEST_REPORT_V2.md).
    return (
        url.replace("postgresql+asyncpg://", "postgresql://")
        .split("?")[0]
        .replace(":5432/", ":6543/")
    )


def _doc(card_id: str, doc_no: str, *, bent: bool) -> dict:
    """The `/extract` response verbatim — what `useOcrExtraction.applyExtractedData` eats.

    `bent` breaks the third line's `total` so Σ pay_amt no longer equals
    Σ(commis + tax + total). That is precisely the arithmetic `AccountingReview` refuses to
    submit, which is what makes this row safe to click Approve on.
    """
    details = [
        {
            "transaction": "VISA",
            "pay_amt": "4000.00",
            "commis_amt": "120.00",
            "tax_amt": "8.40",
            "total": "3871.60",
        },
        {
            "transaction": "MASTERCARD",
            "pay_amt": "2100.00",
            "commis_amt": "63.00",
            "tax_amt": "4.41",
            "total": "2032.59",
        },
        {
            "transaction": "JCB",
            "pay_amt": "1500.00",
            "commis_amt": "45.00",
            "tax_amt": "3.15",
            "total": "1451.85",
        },
    ]
    if bent:
        details[2]["total"] = "1200.00"  # 251.85 short — the JV cannot balance
    return {
        "extracted": {
            "id": card_id,
            "bank_name": "KASIKORNBANK",
            "doc_name": "Tax Invoice",
            "company_name": "DEMO COMPANY LIMITED",
            "doc_date": "31/08/2026",
            "doc_no": doc_no,
            "merchant_name": "DEMO MERCHANT",
            "merchant_id": "0012345678",
            "bank_company_name": "KASIKORNBANK PCL",
            "branch_no": "00000",
            "tax_ids": [],
            "details": details,
            "is_duplicate": False,
            "warnings": [],
        },
        # Computed at park time by the real pipeline; hand-written here to match.
        "flags": ["unbalanced"] if bent else ["mapping_guessed"],
        # WHICH rules the AI invented, not just that it did. Without this the queue row
        # says "GL mapping guessed" and stops, and the review screen marks nothing —
        # which is exactly what the demo looked like before it was added.
        "guessed": [] if bent else ["tax", "JCB"],
        "unmapped": [],
    }


async def seed(c: asyncpg.Connection) -> None:
    tenant_id = await c.fetchval("select id from tenants where bu_code = $1", BU)
    if tenant_id is None:
        sys.exit(f"No tenant with bu_code={BU!r}")

    now = datetime.now(UTC)
    for i, (doc_no, bent) in enumerate([("DEMO-CLEAN-0001", False), ("DEMO-BENT-0002", True)]):
        task_id, card_id, ledger_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        filename = f"{TAG}_{doc_no}.pdf"
        created = now - timedelta(minutes=30 * (i + 1))

        await c.execute(
            "insert into ocr_tasks (id, tenant_id, module_id, original_filename, status,"
            " charged_docs, created_at) values ($1,$2,'credit_card_ocr',$3,'completed',1,$4)",
            task_id,
            tenant_id,
            filename,
            created,
        )
        # submitted_at stays NULL: this document has NOT posted, which is the whole point,
        # and it is also what keeps it out of the activity table's Manual half.
        await c.execute(
            "insert into credit_cards (id, tenant_id, task_id, bank_code, company_name,"
            " bank_company_name, doc_date, doc_no, branch_no, created_at)"
            " values ($1,$2,$3,'KBANK','DEMO COMPANY LIMITED','KASIKORNBANK PCL',"
            " date '2026-08-31',$4,'00000',$5)",
            card_id,
            tenant_id,
            task_id,
            doc_no,
            created,
        )
        await c.execute(
            "insert into email_documents (id, tenant_id, message_id, attachment, status,"
            " task_id, bank_code, doc_no, review_payload, attempts, created_at)"
            " values ($1,$2,$3,$4,'pending_review',$5,'KBANK',$6,$7,1,$8)",
            ledger_id,
            tenant_id,
            f"<{TAG}-{ledger_id}@demo.local>",
            filename,
            task_id,
            doc_no,
            json.dumps(_doc(str(card_id), doc_no, bent=bent)),
            created,
        )
        print(
            f"  + {doc_no:<16} {'unbalanced, Approve disabled' if bent else 'clean, Approve LIVE'}"
        )


async def clean(c: asyncpg.Connection) -> None:
    # email_documents first: it FKs ocr_tasks. credit_cards likewise.
    n = await c.execute("delete from email_documents where attachment like $1", f"{TAG}_%")
    print("  email_documents:", n)
    n = await c.execute(
        "delete from credit_cards where task_id in"
        " (select id from ocr_tasks where original_filename like $1)",
        f"{TAG}_%",
    )
    print("  credit_cards:   ", n)
    n = await c.execute("delete from ocr_tasks where original_filename like $1", f"{TAG}_%")
    print("  ocr_tasks:      ", n)


async def main() -> None:
    doing_clean = "--clean" in sys.argv
    c = await asyncpg.connect(dsn(), statement_cache_size=0)
    try:
        print(
            "removing demo rows..." if doing_clean else f"seeding 2 pending_review rows on {BU}..."
        )
        await (clean(c) if doing_clean else seed(c))
        left = await c.fetchval(
            "select count(*) from email_documents where status='pending_review'"
        )
        print(f"pending_review rows now: {left}")
    finally:
        await c.close()


if __name__ == "__main__":
    asyncio.run(main())
