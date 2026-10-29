"""Review payloads are encrypted at rest — against the real table.

The unit tests pin the column type. These pin what only Postgres can show: what is actually
stored, that the backfill (`encrypt_plaintext_review_payloads`) turns a row written before
encryption into a token and leaves a cleared one alone, and that the one SQL filter on the
email column (`ar_reconcile.latest_real_sample`) still finds an encrypted row by its readable
`doc_type`.

The backfill is always narrowed to the seeded tenant: this suite runs against the shared dev
database, and encrypting other BUs' rows from here would hand them to a deployed backend that
cannot read them yet.
"""

import json
import uuid

import pytest
from sqlalchemy import select, text

from app.database import async_session
from app.models.email_automation import EmailDocument
from app.models.pms import PmsEvent
from app.services.credit_card.ar_reconcile import latest_real_sample
from app.services.shared.payload_encryption import encrypt_plaintext_review_payloads

from .conftest import run

SETTLEMENT = {
    "extracted": {
        "doc_no": "210726E00035291",
        "doc_date": "21/07/2026",
        "details": [{"transaction": "VS INTER PREM", "pay_amt": "25091.00"}],
        "total_row": {"commis_amt": "582.99", "tax_amt": "40.81"},
    },
    "flags": [],
    "doc_type": "ar_reconcile",
}
PMS_DAY = {"rows": [{"key": "103", "description": "Room revenue", "amount": 12500.0}]}


async def _raw(table, row_id):
    async with async_session() as db:
        value = await db.scalar(
            text(f"select review_payload::text from {table} where id = :id"), {"id": row_id}
        )
    return json.loads(value) if value is not None else None


@pytest.fixture
def plaintext_rows(real_engine, tenants):
    """One email document and one PMS day written the way they were before 2026-10-29,
    plus an email row already cleared by `_finish`."""
    email_id, cleared_id, pms_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()

    async def _seed():
        async with real_engine.begin() as conn:
            for row_id, payload in ((email_id, SETTLEMENT), (cleared_id, None)):
                await conn.execute(
                    text(
                        "insert into email_documents (id, tenant_id, message_id, attachment,"
                        " status, bank_code, doc_no, review_payload, created_at, updated_at)"
                        " values (:id, :t, :msg, 'report.pdf', :status, 'KBANK',"
                        " '210726E00035291', cast(:p as jsonb), now(), now())"
                    ),
                    {
                        "id": row_id,
                        "t": tenants.a,
                        "msg": f"<{row_id}@enc.test>",
                        "status": "pending_review" if payload else "posted",
                        "p": json.dumps(payload) if payload else None,
                    },
                )
            await conn.execute(
                text(
                    "insert into pms_events (id, tenant_id, event_id, type, payload, status,"
                    " review_payload) values (:id, :t, :event, 'PMS',"
                    " cast(:hook as jsonb), 'pending_review', cast(:p as jsonb))"
                ),
                {
                    "id": pms_id,
                    "t": tenants.a,
                    # Unique per test: (tenant_id, event_id) is a unique key.
                    "event": f"PMS/Test/Daily/{pms_id}",
                    "hook": json.dumps({"InterfaceName": "Test", "DocDate": "2026-10-29"}),
                    "p": json.dumps(PMS_DAY),
                },
            )

    run(_seed())
    return email_id, cleared_id, pms_id


def _backfill(tenant_id, *, dry_run=False):
    async def _go():
        async with async_session() as db:
            return await encrypt_plaintext_review_payloads(
                db, dry_run=dry_run, tenant_ids=[tenant_id]
            )

    return run(_go())


def test_the_backfill_encrypts_what_was_written_in_plaintext(plaintext_rows, tenants):
    email_id, cleared_id, pms_id = plaintext_rows
    assert run(_raw("email_documents", email_id)) == SETTLEMENT  # plaintext before

    # A dry run counts and changes nothing. At least: the session's other suites seed
    # plaintext rows for this tenant too (test_read_isolation does).
    counted = _backfill(tenants.a, dry_run=True)
    assert counted["email_documents"] >= 1 and counted["pms_events"] >= 1
    assert run(_raw("email_documents", email_id)) == SETTLEMENT

    assert _backfill(tenants.a) == counted

    stored = run(_raw("email_documents", email_id))
    assert set(stored) == {"enc", "doc_type"}
    assert stored["doc_type"] == "ar_reconcile"
    assert "VS INTER PREM" not in json.dumps(stored)
    assert set(run(_raw("pms_events", pms_id))) == {"enc"}
    assert run(_raw("email_documents", cleared_id)) is None  # a cleared row stays cleared

    async def _through_the_app():
        async with async_session() as db:
            email = await db.scalar(
                select(EmailDocument.review_payload).where(EmailDocument.id == email_id)
            )
            day = await db.scalar(select(PmsEvent.review_payload).where(PmsEvent.id == pms_id))
        return email, day

    assert run(_through_the_app()) == (SETTLEMENT, PMS_DAY)

    # Idempotent: a second call finds nothing to do and changes nothing.
    assert _backfill(tenants.a) == {"email_documents": 0, "pms_events": 0}
    assert run(_raw("email_documents", email_id))["enc"] == stored["enc"]


def test_the_settlement_sample_still_finds_an_encrypted_report(plaintext_rows, tenants):
    """`latest_real_sample` filters on `review_payload["doc_type"]` in SQL — the one key the
    column keeps readable for exactly this."""
    _backfill(tenants.a)

    async def _sample():
        async with async_session() as db:
            return await latest_real_sample(db, str(tenants.a), "KBANK")

    rows, doc_no, doc_date, total_row = run(_sample())
    assert rows == [("VS INTER PREM", "25091.00")]
    assert (doc_no, doc_date) == ("210726E00035291", "21/07/2026")
    assert total_row == {"commis_amt": "582.99", "tax_amt": "40.81"}
