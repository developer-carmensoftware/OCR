"""Fill a BU's review queue with believable documents, so the screens can be looked at.

    python scripts/seed_review_queue.py                    # dev.carmen4.com / carmencloud
    python scripts/seed_review_queue.py --bu carmen
    python scripts/seed_review_queue.py --clear            # remove what this script wrote

Ten rows, one per thing the queue has to render: five waiting for review (clean, AI-filled
mapping, a line that does not add up, a missing document number, an extraction warning) and
five already resolved (two posted, one Carmen refusal, one rejection, one skipped). A
resolved row renders from its ledger columns and has no payload left, so a queue seeded
only with pending documents never shows that half.

Everything it writes carries `<mock-...@seed.local>` as its Message-ID, which is what
`--clear` matches. It touches nothing else: no credits, no `ocr_tasks`, no Carmen.

**Dev only, and mind the Approve button** — approving one of these posts a real JV to
whatever Carmen this BU's stored credential points at.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "backend" / ".env")

DSN = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
DSN = DSN.replace(":5432/", ":6543/")  # transaction pooler — see the EMAXCONNSESSION note

MARK = "@seed.local>"


def line(txn: str, pay: float, *, off: float = 0.0) -> dict:
    """One statement line, arithmetically honest: gross = fee + VAT + net.

    `off` breaks it on purpose — that is what the queue's `unbalanced` flag is for, and a
    reviewer has to be able to see one to know the flag works.
    """
    fee = round(pay * 0.0185, 2)
    vat = round(fee * 0.07, 2)
    return {
        "transaction": txn,
        "pay_amt": f"{pay:.2f}",
        "commis_amt": f"{fee:.2f}",
        "tax_amt": f"{vat:.2f}",
        "total": f"{pay - fee - vat + off:.2f}",
    }


def doc(bank: str, doc_no: str | None, lines: list[dict], **over) -> dict:
    """The raw `/extract` shape, which is what `_park_for_review` stores verbatim."""
    return {
        "bank_name": bank,
        "doc_name": "Credit Card Statement",
        "company_name": HOTEL,
        "doc_date": over.pop("doc_date", "31/07/2026"),
        "doc_no": doc_no,
        "merchant_name": HOTEL,
        "merchant_id": "0001234567",
        "bank_company_name": bank,
        "branch_no": "00000",
        "tax_ids": [],
        "details": lines,
        "is_duplicate": False,
        "warnings": over.pop("warnings", []),
        **over,
    }


HOTEL = "Grand Riverside Hotel Co., Ltd."

# attachment, bank, payload, flags, age in hours
PENDING = [
    (
        "ktc_commission_july.pdf",
        "KTC",
        doc("KTC", "KTC-2026-0731", [line("VISA", 128_400), line("MASTERCARD", 96_250), line("JCB", 18_900)]),
        [],
        2,
    ),
    (
        "kbank_mdr_0802.pdf",
        "KBANK",
        doc(
            "KBANK",
            "MDR-0802/26",
            [
                line("VISA", 212_780),
                line("MASTERCARD", 154_300),
                line("UNIONPAY", 41_120),
                line("AMEX", 22_640),
                line("QR PromptPay", 9_875),
            ],
        ),
        ["mapping_guessed"],
        6,
    ),
    (
        "bbl_etax_880123.pdf",
        "BBL",
        doc("BBL", "BBL-ETAX-880123", [line("VISA", 74_500), line("MASTERCARD", 33_200, off=-1_250.00)]),
        ["unbalanced"],
        20,
    ),
    (
        "scb_statement_scan.pdf",
        "SCB",
        doc(
            "SCB",
            None,
            [line("VISA", 58_300)],
            warnings=["Footer VAT could not be read - 7% assumed on the printed fee."],
        ),
        ["warnings"],
        27,
    ),
    (
        "bay_settlement_0726.pdf",
        "BAY",
        doc(
            "BAY",
            "BAY-STM-0726",
            [
                line("VISA", 88_100),
                line("MASTERCARD", 45_600, off=0.90),
                line("JCB", 12_300),
                line("UNIONPAY", 7_450),
            ],
            doc_date="26/07/2026",
        ),
        ["mapping_guessed", "unbalanced"],
        50,
    ),
]

# attachment, bank, doc_no, status, jv_no, reason_code, error, reviewer, age in hours
RESOLVED = [
    ("ktc_commission_june.pdf", "KTC", "KTC-2026-0630", "posted", "JV-2026-0912", None, None, "somchai", 73),
    ("kbank_mdr_0701.pdf", "KBANK", "MDR-0701/26", "posted", "JV-2026-0911", None, None, "malee", 96),
    (
        "scb_statement_june.pdf", "SCB", "SCB-2026-0630", "failed", None,
        "carmen_rejected", "Accounting period 2026-06 is closed", None, 121,
    ),
    (
        "paypal_fees_july.pdf", "PAYPAL", "PP-2026-07", "rejected", None,
        "rejected_by_reviewer", "wrong company - belongs to the Phuket BU", "somchai", 130,
    ),
    ("newsletter.pdf", None, None, "skipped", None, "no_rule_match", None, None, 145),
]

INSERT = (
    "insert into email_documents (id, tenant_id, message_id, attachment, status,"
    " bank_code, doc_no, jv_no, reason_code, error_message, review_payload,"
    " reviewed_by_name, reviewed_at, created_at, updated_at, attempts)"
    " values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $14, 1)"
)


async def resolve_tenant(conn, args) -> uuid.UUID:
    row = await conn.fetchrow(
        "select id from tenants where host = $1 and bu_code = $2 and deleted_at is null",
        args.host,
        args.bu,
    )
    if row is None:
        raise SystemExit(f"no tenant for {args.host} / {args.bu}")
    return row["id"]


async def clear(conn, tenant: uuid.UUID) -> int:
    got = await conn.execute(
        "delete from email_documents where tenant_id = $1 and message_id like $2",
        tenant,
        f"%{MARK}",
    )
    return int(got.split()[-1])


async def seed(conn, tenant: uuid.UUID) -> None:
    now = datetime.now(UTC)
    rows: list[tuple] = []

    for attachment, bank, payload, flags, age in PENDING:
        rows.append(
            (
                uuid.uuid4(), tenant, f"<mock-{uuid.uuid4().hex[:12]}{MARK}", attachment,
                "pending_review", bank, payload["doc_no"], None, None, None,
                json.dumps({"extracted": payload, "flags": flags}), None, None,
                now - timedelta(hours=age),
            )
        )

    for attachment, bank, doc_no, status, jv, reason, err, who, age in RESOLVED:
        at = now - timedelta(hours=age)
        rows.append(
            (
                uuid.uuid4(), tenant, f"<mock-{uuid.uuid4().hex[:12]}{MARK}", attachment,
                status, bank, doc_no, jv, reason, err,
                # No payload: `_finish` clears it on every terminal transition, which is
                # why the queue reads a resolved row off its ledger columns instead.
                None, who, (at if who else None),
                at,
            )
        )

    await conn.executemany(INSERT, rows)


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--host", default="dev.carmen4.com")
    ap.add_argument("--bu", default="carmencloud")
    ap.add_argument("--clear", action="store_true", help="remove seeded rows and stop")
    args = ap.parse_args()

    conn = await asyncpg.connect(DSN, statement_cache_size=0)
    try:
        tenant = await resolve_tenant(conn, args)
        removed = await clear(conn, tenant)
        print(f"{args.host}/{args.bu} -> {tenant}: removed {removed} seeded row(s)")
        if args.clear:
            return 0

        await seed(conn, tenant)
        for r in await conn.fetch(
            "select status, count(*) as n from email_documents where tenant_id = $1"
            " group by status order by status",
            tenant,
        ):
            print(f"  {r['status']:<15} {r['n']}")
        print("\nOpen #/CreditCardOCR. Approving one posts a real JV to this BU's Carmen.")
        return 0
    finally:
        await conn.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
