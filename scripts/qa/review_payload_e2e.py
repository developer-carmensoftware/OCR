"""Review payloads encrypted at rest — the data half of the browser E2E (review_payload_ui.mjs).

    python scripts/qa/review_payload_e2e.py seed     # 3 encrypted docs + 1 plaintext + 1 PMS day
    python scripts/qa/review_payload_e2e.py check    # what each seeded row holds in the table
    python scripts/qa/review_payload_e2e.py clear    # remove everything seed wrote

BU `carmen` on dev (dev.carmen4.com): it already has a posting credential and GL mappings for
BAY / SCB / KBANK, so a seeded document can be approved for real. Not carmencloud, which QA
uses. Seeding goes through the app's own models, so the column type encrypts exactly as the
pipeline would — no LLM call, no credit. The plaintext row is written with raw SQL, the way a
row parked before 2026-10-29 sits in the table.

Every email row carries Message-ID `<e2e-enc-…@seed.local>` and every PMS day the interface
`E2E-ENC`; `clear` removes those, their tasks and cards, and nothing else. **Approving a
seeded document posts a real JV to Carmen dev** — that one is on purpose (E-05).

Runs on the transaction pooler (6543) so it cannot crowd the session cap while a backend is up.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import uuid
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]  # scripts/<qa|dev|ops>/this.py -> repo root
load_dotenv(ROOT / "backend" / ".env")
os.environ["DATABASE_URL"] = os.environ["DATABASE_URL"].replace(":5432/", ":6543/")
if "lhlncsjqxttcdegkqvid" in os.environ["DATABASE_URL"]:
    sys.exit("[abort] DATABASE_URL points at PRODUCTION")
sys.path.insert(0, str(ROOT / "backend"))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from sqlalchemy import delete, select, text  # noqa: E402

from app.database import async_session  # noqa: E402
from app.models.business import CreditCard, OCRTask  # noqa: E402
from app.models.email_automation import EmailDocument  # noqa: E402
from app.models.identity import Tenant  # noqa: E402
from app.models.pms import PmsEvent  # noqa: E402
from app.models.schemas import ExtractedCreditCardData  # noqa: E402
from app.models.schemas.ocr import ExtractedDetailRow  # noqa: E402

BU = "carmen"
MSG = "<e2e-enc-{}@seed.local>"
PMS_NAME = "E2E-ENC"


def _row(tx, pay, commis, tax):
    net = f"{float(pay) - float(commis) - float(tax):.2f}"
    return ExtractedDetailRow(transaction=tx, pay_amt=pay, commis_amt=commis, tax_amt=tax, total=net)


# label -> (bank, doc_no, doc_type, detail rows, total_row, plaintext?)
DOCS = {
    # E-04/E-05: mapped for BU carmen (BAY's VS INTER *), so Approve is open as it stands.
    "bay": (
        "BAY",
        "E2E-BAY-ENC-01",
        "fee_invoice",
        [
            _row("VS INTER NON-PREM", "10000.00", "150.00", "10.50"),
            _row("VS INTER PREM", "5000.00", "75.00", "5.25"),
        ],
        None,
        False,
    ),
    # E-06: rejected with a reason.
    "scb": (
        "SCB",
        "E2E-SCB-ENC-02",
        "fee_invoice",
        [_row("VSA-INT", "8000.00", "120.00", "8.40")],
        None,
        False,
    ),
    # E-07: a settlement report — the one doc_type SQL filters on.
    "kbank": (
        "KBANK",
        "E2E-KB-ENC-03",
        "ar_reconcile",
        [
            ExtractedDetailRow(transaction="VS INTER PREM", pay_amt="25091.00"),
            ExtractedDetailRow(transaction="MC INTER NON-PREM", pay_amt="4120.00"),
        ],
        ExtractedDetailRow(commis_amt="582.99", tax_amt="40.81", total="28587.20"),
        False,
    ),
    # E-08/E-09: parked before encryption shipped — plaintext in the table.
    "legacy": (
        "BAY",
        "E2E-BAY-LEGACY-04",
        "fee_invoice",
        [_row("VS INTER NON-PREM", "3000.00", "45.00", "3.15")],
        None,
        True,
    ),
}


def _payload(label) -> dict:
    bank, doc_no, doc_type, details, total_row, _ = DOCS[label]
    extracted = ExtractedCreditCardData(
        bank_code=bank,
        doc_no=doc_no,
        doc_date="15/10/2026",
        branch_no="00000",
        details=details,
        total_row=total_row,
    )
    # The same keys `ledger._park_for_review` writes.
    return {
        "extracted": extracted.model_dump(mode="json", exclude={"raw_text"}),
        "flags": [],
        "unmapped": [],
        "guessed": [],
        "suggested": {},
        "doc_type": doc_type,
    }


def _pms_payload() -> dict:
    room, breakfast = json.dumps(["103", "Room Revenue"]), json.dumps(["729", "Breakfast"])
    return {
        "interface_type": "PMS",
        "interface": PMS_NAME,
        "doc_type": "Daily",
        "doc_date": "2026-10-15",
        "setting_code": "E2E",
        "post_type": "REVENUE",
        "counter": {"dept": "GEN", "acc": "1011001", "name": "Cash"},
        "key_columns": ["Code", "Description"],
        "rows": [
            {"key": room, "values": {"Code": "103", "Description": "Room Revenue"}, "amount": "12500.00"},
            {"key": breakfast, "values": {"Code": "729", "Description": "Breakfast"}, "amount": "830.00"},
        ],
        "mapped": {room: {"dept": "GEN", "acc": "4010001", "name": "Room revenue"}},
        "guessed": {},
        "flags": ["mapping_missing"],
        "missing": [breakfast],
        "ai": [],
        "databank_id": None,
        "last_modified": None,
    }


async def _tenant_id(db) -> uuid.UUID:
    tid = await db.scalar(select(Tenant.id).where(Tenant.bu_code == BU))
    if tid is None:
        sys.exit(f"[abort] no tenant for BU {BU!r}")
    return tid


async def seed() -> None:
    async with async_session() as db:
        tid = await _tenant_id(db)
        for label, (bank, doc_no, doc_type, _, _, plaintext) in DOCS.items():
            task_id, card_id, doc_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
            db.add(
                OCRTask(
                    id=task_id,
                    tenant_id=tid,
                    module_id="credit_card_ocr",
                    original_filename=f"E2E-ENC-{label}.pdf",
                    status="completed",
                    charged_docs=1,
                )
            )
            db.add(
                CreditCard(
                    id=card_id,
                    task_id=task_id,
                    tenant_id=tid,
                    bank_code=bank,
                    doc_no=doc_no,
                    doc_date=date(2026, 10, 15),
                    doc_type=doc_type,
                    branch_no="00000",
                )
            )
            await db.flush()
            payload = _payload(label)
            payload["extracted"]["id"] = str(card_id)
            payload["extracted"]["task_id"] = str(task_id)
            db.add(
                EmailDocument(
                    id=doc_id,
                    tenant_id=tid,
                    message_id=MSG.format(label),
                    attachment=f"E2E-ENC-{label}.pdf",
                    status="pending_review",
                    task_id=task_id,
                    bank_code=bank,
                    doc_no=doc_no,
                    review_payload=None if plaintext else payload,
                )
            )
            await db.flush()
            if plaintext:
                await db.execute(
                    text("update email_documents set review_payload = cast(:p as jsonb) where id = :id"),
                    {"p": json.dumps(payload), "id": doc_id},
                )
            print(f"  seeded {label:7} {doc_no:20} id={doc_id}  card={card_id}")
        day_id = uuid.uuid4()
        db.add(
            PmsEvent(
                id=day_id,
                tenant_id=tid,
                event_id=f"PMS/{PMS_NAME}/Daily/2026-10-15",
                type="PMS",
                payload={
                    "InterfaceType": "PMS",
                    "InterfaceName": PMS_NAME,
                    "DocType": "Daily",
                    "DocDate": "2026-10-15",
                },
                status="pending_review",
                review_payload=_pms_payload(),
            )
        )
        await db.commit()
        print(f"  seeded pms     {PMS_NAME} 15/10/2026     id={day_id}")


async def check() -> int:
    """Raw table contents of every seeded row. Exit 1 if any encrypted row leaks plaintext."""
    bad = 0
    async with async_session() as db:
        rows = (
            await db.execute(
                text(
                    "select 'email' as kind, doc_no as name, status, review_payload::text as p"
                    " from email_documents where message_id like '<e2e-enc-%@seed.local>'"
                    " union all"
                    " select 'pms', event_id, status, review_payload::text from pms_events"
                    " where event_id like :pms"
                ),
                {"pms": f"PMS/{PMS_NAME}/%"},
            )
        ).all()
    for kind, name, status, raw in rows:
        stored = json.loads(raw) if raw else None
        keys = sorted(stored) if isinstance(stored, dict) else stored
        legacy = name and "LEGACY" in name
        leak = isinstance(stored, dict) and ("extracted" in stored or "rows" in stored)
        if stored is not None and not legacy and (leak or "enc" not in stored):
            bad += 1
        print(f"  {kind:5} {name:34} {status:15} stored keys={keys}")
    print("  OK — no seeded row stores its contents in plaintext (legacy excepted)" if not bad
          else f"  {bad} row(s) store plaintext")
    return 1 if bad else 0


async def clear() -> None:
    async with async_session() as db:
        tid = await _tenant_id(db)
        tasks = (
            await db.execute(
                select(OCRTask.id).where(
                    OCRTask.tenant_id == tid, OCRTask.original_filename.like("E2E-ENC-%")
                )
            )
        ).scalars().all()
        n_docs = (
            await db.execute(
                delete(EmailDocument).where(
                    EmailDocument.tenant_id == tid,
                    EmailDocument.message_id.like("<e2e-enc-%@seed.local>"),
                )
            )
        ).rowcount
        n_cards = (await db.execute(delete(CreditCard).where(CreditCard.task_id.in_(tasks)))).rowcount
        n_tasks = (await db.execute(delete(OCRTask).where(OCRTask.id.in_(tasks)))).rowcount
        n_pms = (
            await db.execute(
                delete(PmsEvent).where(
                    PmsEvent.tenant_id == tid, PmsEvent.event_id.like(f"PMS/{PMS_NAME}/%")
                )
            )
        ).rowcount
        await db.commit()
    print(f"  cleared {n_docs} documents, {n_cards} cards, {n_tasks} tasks, {n_pms} PMS days")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "seed":
        asyncio.run(seed())
    elif cmd == "check":
        sys.exit(asyncio.run(check()))
    elif cmd == "clear":
        asyncio.run(clear())
    else:
        sys.exit(__doc__)
