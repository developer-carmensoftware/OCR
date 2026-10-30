"""Review payloads are encrypted at rest — against the real table.

The unit tests pin the column type. These pin what only Postgres can show: what is actually
stored, that the backfill (`encrypt_plaintext_columns`) turns a row written before
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
from app.services.shared.payload_encryption import encrypt_plaintext_columns

from .conftest import AUTH, run

EMAIL, PMS = "email_documents.review_payload", "pms_events.review_payload"

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


async def _sql_null(table, row_id):
    """True only for SQL NULL — `_raw` cannot tell it from the JSON value `null`."""
    async with async_session() as db:
        return await db.scalar(
            text(f"select review_payload is null from {table} where id = :id"), {"id": row_id}
        )


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
            return await encrypt_plaintext_columns(db, dry_run=dry_run, tenant_ids=[tenant_id])

    return run(_go())


def test_the_backfill_encrypts_what_was_written_in_plaintext(plaintext_rows, tenants):
    email_id, cleared_id, pms_id = plaintext_rows
    assert run(_raw("email_documents", email_id)) == SETTLEMENT  # plaintext before

    # A dry run counts and changes nothing. At least: the session's other suites seed
    # plaintext rows for this tenant too (test_read_isolation does).
    counted = _backfill(tenants.a, dry_run=True)
    assert counted[EMAIL] >= 1 and counted[PMS] >= 1
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
    assert not any(_backfill(tenants.a).values())
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


# ── Every way in and out of the column, on real rows ─────────────────────────
#
# The type decrypts in SQLAlchemy's result processing, so each *kind* of read is pinned once:
# an ORM entity (`get_day`), a column select (`_already_pending`), a `.returning()` claim
# (`_claim_for_review`, PMS `_claim`), and the JSON filter (`latest_real_sample`, above).
# Writes: an ORM assignment (`_park_for_review`, PMS `recheck`), a Core `update().values()`
# (PMS `_park`), and the clears (`_finish`).

EXTRACTED = {"bank_code": "KBANK", "doc_date": "15/10/2026", "branch_no": "00000"}
THAI = "ค่าธรรมเนียมบัตร VISA สาขาสยาม"
PMS_BREAKFAST = json.dumps(["729", "Breakfast"])
PMS_ROOM = json.dumps(["103", "Room Revenue"])


def _received(real_engine, tenant_id, doc_no, *, payload_sql=None, status="received"):
    """A ledger row as `_claim` leaves it, before the pipeline parks it."""
    row_id = uuid.uuid4()

    async def _go():
        async with real_engine.begin() as conn:
            await conn.execute(
                text(
                    "insert into email_documents (id, tenant_id, message_id, attachment, status,"
                    " bank_code, doc_no, review_payload, created_at, updated_at) values (:id, :t,"
                    " :msg, 'statement.pdf', :status, 'KBANK', :doc, cast(:p as jsonb), now(),"
                    " now())"
                ),
                {
                    "id": row_id,
                    "t": tenant_id,
                    "msg": f"<{row_id}@enc.test>",
                    "status": status,
                    "doc": doc_no,
                    "p": payload_sql,
                },
            )

    run(_go())
    return row_id


def _extracted(doc_no, rows=1):
    from app.models.schemas import ExtractedCreditCardData
    from app.models.schemas.ocr import ExtractedDetailRow

    return ExtractedCreditCardData(
        **EXTRACTED,
        doc_no=doc_no,
        details=[
            ExtractedDetailRow(transaction=f"{THAI} {i}", pay_amt="100.00") for i in range(rows)
        ],
    )


def _park(row_id, doc_no, *, doc_type="ar_reconcile", rows=1):
    from app.services.email_automation import ledger

    run(
        ledger._park_for_review(
            row_id,
            extracted=_extracted(doc_no, rows),
            task_id=None,
            bank_code="KBANK",
            doc_no=doc_no,
            flags=["warnings"],
            doc_type=doc_type,
        )
    )


def test_d03_the_pipeline_writer_parks_encrypted_and_the_duplicate_guard_reads_it(
    real_engine, tenants
):
    """`_park_for_review` is what every parked email document goes through; `_already_pending`
    reads it back with a column select and decides on `doc_type` in Python."""
    from app.services.email_automation import ledger

    doc_no = f"ENC-D03-{uuid.uuid4().hex[:8]}"
    row_id = _received(real_engine, tenants.a, doc_no)
    _park(row_id, doc_no)

    stored = run(_raw("email_documents", row_id))
    assert set(stored) == {"enc", "doc_type"}
    assert THAI not in json.dumps(stored, ensure_ascii=False)
    assert run(ledger._already_pending(str(tenants.a), "KBANK", doc_no, "ar_reconcile")) is True
    assert run(ledger._already_pending(str(tenants.a), "KBANK", doc_no, "fee_invoice")) is False


def test_d04_approve_claims_the_row_decrypted_and_finish_clears_it(real_engine, tenants):
    """`_claim_for_review` hands approve its row via `.returning()`, and approve branches on
    the `doc_type` in it. `_finish` then empties the column."""
    from app.services.email_automation import ledger
    from app.services.email_automation import review as email_review

    doc_no = f"ENC-D04-{uuid.uuid4().hex[:8]}"
    row_id = _received(real_engine, tenants.a, doc_no)
    _park(row_id, doc_no)

    async def _claim():
        async with async_session() as db:
            return await email_review._claim_for_review(db, row_id, str(tenants.a))

    claimed = run(_claim())
    assert claimed.review_payload["doc_type"] == "ar_reconcile"
    assert claimed.review_payload["extracted"]["doc_no"] == doc_no
    assert claimed.review_payload["extracted"]["details"][0]["transaction"] == f"{THAI} 0"

    run(ledger._finish(row_id, status="rejected", notify=False))
    # SQL NULL, not the JSON `null` the plain JSON type used to write (found 2026-10-29).
    assert run(_sql_null("email_documents", row_id)) is True


def test_d05_a_pms_day_parks_encrypted_reads_back_and_recheck_keeps_it_encrypted(
    real_engine, tenants
):
    """PMS `_park` writes through a Core `update().values()`; `get_day` reads the ORM entity;
    `recheck` rewrites the payload by assignment; `_claim` reads it via `.returning()`."""
    from app.services.pms import process as pms_process
    from app.services.pms import review as pms_review

    interface = f"EncTest-{uuid.uuid4().hex[:6]}"
    pk = uuid.uuid4()

    async def _seed():
        async with real_engine.begin() as conn:
            await conn.execute(
                text(
                    "insert into pms_events (id, tenant_id, event_id, type, payload, status)"
                    " values (:id, :t, :event, 'PMS', cast(:hook as jsonb), 'received')"
                ),
                {
                    "id": pk,
                    "t": tenants.a,
                    "event": f"PMS/{interface}/Daily/2026-10-15",
                    "hook": json.dumps({"InterfaceName": interface, "DocDate": "2026-10-15"}),
                },
            )

    run(_seed())
    payload = {
        "interface": interface,
        "doc_type": "Daily",
        "doc_date": "2026-10-15",
        "key_columns": ["Code", "Description"],
        "rows": [
            {"key": PMS_ROOM, "values": {"Code": "103"}, "amount": "12500.00"},
            {"key": PMS_BREAKFAST, "values": {"Code": "729"}, "amount": "830.00"},
        ],
        "mapped": {PMS_ROOM: {"dept": "GEN", "acc": "4010001", "name": "Room revenue"}},
        "guessed": {},
        "flags": ["mapping_missing"],
        "missing": [PMS_BREAKFAST],
        "ai": [],
    }
    run(pms_process._park(pk, payload))
    assert set(run(_raw("pms_events", pk))) == {"enc"}

    async def _day():
        async with async_session() as db:
            return await pms_review.get_day(db, tenants.a, pk)

    day = run(_day())
    assert [c["key"] for c in day["new_codes"]] == [PMS_BREAKFAST]
    assert day["mapped_count"] == 1

    table = {
        PMS_ROOM: {"dept": "GEN", "acc": "4010001", "name": "Room revenue"},
        PMS_BREAKFAST: {"dept": "GEN", "acc": "4020001", "name": "F&B"},
    }
    assert run(pms_review.recheck(tenants.a, interface, table)) == 1
    assert set(run(_raw("pms_events", pk))) == {"enc"}  # rewritten, still encrypted

    async def _claim():
        async with async_session() as db:
            return await pms_review._claim(db, tenants.a, pk)

    claimed = run(_claim())
    assert claimed.review_payload["flags"] == []
    assert PMS_BREAKFAST in claimed.review_payload["mapped"]


def test_d07_a_payload_another_key_wrote_degrades_instead_of_failing(real_engine, tenants):
    """A rotated key, or a row written by a backend holding another one: the row still lists
    (zeros), opening it does not 500, and the backfill leaves it alone."""
    from cryptography.fernet import Fernet

    from app.services.credit_card import activity as activity_service
    from app.services.email_automation import ledger

    from .conftest import real_client, session_for

    doc_no = f"ENC-D07-{uuid.uuid4().hex[:8]}"
    foreign = Fernet(Fernet.generate_key()).encrypt(json.dumps(SETTLEMENT).encode()).decode()
    row_id = _received(
        real_engine,
        tenants.a,
        doc_no,
        status="pending_review",
        payload_sql=json.dumps({"enc": foreign, "doc_type": "fee_invoice"}),
    )

    async def _read():
        async with async_session() as db:
            payload = await db.scalar(
                select(EmailDocument.review_payload).where(EmailDocument.id == row_id)
            )
            page = await activity_service.list_activity(db, tenants.a, "all", 200, 0)
        return payload, page

    payload, page = run(_read())
    assert payload is None
    row = next(r for r in page.data if r.doc_no == doc_no)
    assert (row.total, row.line_count) == (0, 0)

    with real_client(session_for(tenants.a)) as client:
        res = client.get(f"/api/v1/email/documents/{row_id}", headers=AUTH)
    assert res.status_code != 500, res.text

    assert _backfill(tenants.a)[EMAIL] == 0  # it has "enc": not plaintext
    assert run(_raw("email_documents", row_id))["enc"] == foreign

    # Put away, it is cleared like any other. It reads as None, so an ORM assignment of None
    # looked like no change and left the ciphertext behind (found by the E2E, 2026-10-29).
    run(ledger._finish(row_id, status="rejected", notify=False))
    assert run(_sql_null("email_documents", row_id)) is True


def test_d08_the_backfill_does_not_resurrect_a_row_cleared_while_it_ran(real_engine, tenants):
    """Between the backfill's read and its write, `_finish` empties the row (a reviewer
    approved it). The write must not put the payload back on a finished document."""
    doc_no = f"ENC-D08-{uuid.uuid4().hex[:8]}"
    row_id = _received(
        real_engine, tenants.a, doc_no, status="pending_review", payload_sql=json.dumps(SETTLEMENT)
    )

    async def _race():
        async with async_session() as db:
            read = db.scalar

            async def read_then_finish(stmt, *a, **kw):
                value = await read(stmt, *a, **kw)
                async with real_engine.begin() as other:
                    await other.execute(
                        text(
                            "update email_documents set review_payload = null, status = 'posted'"
                            " where id = :id"
                        ),
                        {"id": row_id},
                    )
                return value

            db.scalar = read_then_finish
            return await encrypt_plaintext_columns(db, tenant_ids=[tenants.a])

    run(_race())
    assert run(_raw("email_documents", row_id)) is None


def test_d09_a_large_thai_payload_round_trips_through_postgres(real_engine, tenants):
    """300 detail lines of Thai text — a big statement — stored as one token and read back
    exactly, with nothing readable on the way."""
    doc_no = f"ENC-D09-{uuid.uuid4().hex[:8]}"
    row_id = _received(real_engine, tenants.a, doc_no)
    _park(row_id, doc_no, doc_type="fee_invoice", rows=300)

    stored = run(_raw("email_documents", row_id))
    assert set(stored) == {"enc", "doc_type"}
    assert "สาขาสยาม" not in json.dumps(stored, ensure_ascii=False)

    async def _read():
        async with async_session() as db:
            return await db.scalar(
                select(EmailDocument.review_payload).where(EmailDocument.id == row_id)
            )

    details = run(_read())["extracted"]["details"]
    assert len(details) == 300
    assert details[299]["transaction"] == f"{THAI} 299"


def test_d10_a_row_the_old_finish_left_as_json_null_is_not_plaintext(real_engine, tenants):
    """Before this type, `_finish` stored Python None as the JSON value `null` (77 such rows on
    dev, 2026-10-29). There is nothing in one to encrypt: the backfill must neither count it
    nor touch it."""
    doc_no = f"ENC-D10-{uuid.uuid4().hex[:8]}"
    row_id = _received(real_engine, tenants.a, doc_no, status="rejected", payload_sql="null")
    assert run(_sql_null("email_documents", row_id)) is False  # JSON null, not SQL NULL

    assert _backfill(tenants.a, dry_run=True)[EMAIL] == 0
    _backfill(tenants.a)
    assert run(_sql_null("email_documents", row_id)) is False  # left exactly as it was


# ── Corrections and bug-report screenshots (`EncryptedText`) ─────────────────

CORR_NEW = "correction_feedback.corrected_value"
SCREENSHOT = "bug_reports.screenshot_b64"
PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


async def _text_cols(table, cols, where, params):
    async with async_session() as db:
        return (await db.execute(text(f"select {cols} from {table} where {where}"), params)).one()


def _correction(client, doc_no, original, corrected, *, batch=False):
    body = {
        "doc_no": doc_no,
        "bank_code": "KBANK",
        "field_name": "merchant_id",
        "original_value": original,
        "corrected_value": corrected,
    }
    if batch:  # what the wizard sends on submit
        return client.post(
            "/api/v1/feedback/corrections", json={"corrections": [body]}, headers=AUTH
        )
    return client.post("/api/v1/feedback/correction", json=body, headers=AUTH)


def test_d11_a_correction_is_stored_as_tokens_on_insert_and_on_conflict(tenants):
    """Both ways the upsert writes — the INSERT and the ON CONFLICT DO UPDATE `set_` — go
    through the column type, and the response still reads back what the user typed."""
    from .conftest import real_client, session_for

    doc_no = f"ENC-D11-{uuid.uuid4().hex[:8]}"
    where, params = "tenant_id = :t and doc_no = :d", {"t": tenants.a, "d": doc_no}
    with real_client(session_for(tenants.a)) as client:
        first = _correction(client, doc_no, "451005282039001", "451005282039009")
        assert first.status_code == 200, first.text
        assert first.json()["corrected_value"] == "451005282039009"
        raw = run(
            _text_cols("correction_feedback", "original_value, corrected_value", where, params)
        )
        assert all(v.startswith("gAAAAA") for v in raw)
        assert not any("4510052820390" in v for v in raw)

        # Same scope again: the conflict path.
        again = _correction(client, doc_no, "451005282039001", "451005282039002")
        assert again.json()["corrected_value"] == "451005282039002"
        assert again.json()["id"] == first.json()["id"]
        raw2 = run(
            _text_cols("correction_feedback", "original_value, corrected_value", where, params)
        )
        assert all(v.startswith("gAAAAA") for v in raw2) and raw2 != raw

        # And the batch endpoint, which is what the wizard actually calls.
        batch_doc = f"{doc_no}-B"
        assert _correction(client, batch_doc, "", "00002", batch=True).json()["saved"] == 1
        raw3 = run(
            _text_cols(
                "correction_feedback",
                "original_value, corrected_value",
                where,
                {**params, "d": batch_doc},
            )
        )
        assert all(v.startswith("gAAAAA") for v in raw3)  # an empty string is encrypted too


def test_d12_a_bug_report_screenshot_is_stored_as_a_token(tenants):
    from app.models.business import BugReport

    from .conftest import real_client, session_for

    body = {"module": "credit_card_ocr", "category": "bug", "description": "ENC-D12",
            "screenshot_b64": PNG_B64, "screenshot_mime": "image/png"}  # fmt: skip
    with real_client(session_for(tenants.a)) as client:
        res = client.post("/api/v1/feedback/bug-report", json=body, headers=AUTH)
    assert res.status_code == 201, res.text
    report_id = res.json()["id"]

    (raw,) = run(_text_cols("bug_reports", "screenshot_b64", "id = :id", {"id": report_id}))
    assert raw.startswith("gAAAAA") and "iVBORw0KGgo" not in raw

    async def _read():
        async with async_session() as db:
            return await db.scalar(
                select(BugReport.screenshot_b64).where(BugReport.id == report_id)
            )

    assert run(_read()) == PNG_B64


def test_d13_the_backfill_encrypts_plaintext_corrections_and_screenshots(real_engine, tenants):
    """Rows written before: plaintext values, an empty one, and a NULL one (not counted)."""
    from app.models.business import BugReport, CorrectionFeedback

    doc_no = f"ENC-D13-{uuid.uuid4().hex[:8]}"

    async def _seed():
        async with real_engine.begin() as conn:
            corr_id = await conn.scalar(
                text(
                    "insert into correction_feedback (tenant_id, doc_no, bank_code, field_name,"
                    " original_value, corrected_value, created_at, updated_at) values"
                    " (:t, :d, 'KBANK', 'merchant_id', '', '451005282039001', now(), now())"
                    " returning id"
                ),
                {"t": tenants.a, "d": doc_no},
            )
            null_id = await conn.scalar(
                text(
                    "insert into correction_feedback (tenant_id, doc_no, bank_code, field_name,"
                    " original_value, corrected_value, created_at, updated_at) values"
                    " (:t, :d, 'KBANK', 'branch_no', '00001', null, now(), now()) returning id"
                ),
                {"t": tenants.a, "d": doc_no},
            )
            bug_id = await conn.scalar(
                text(
                    "insert into bug_reports (tenant_id, module_id, category, description,"
                    " screenshot_b64, screenshot_mime, created_at, updated_at) values"
                    " (:t, 'credit_card_ocr', 'bug', 'ENC-D13', :s, 'image/png', now(), now())"
                    " returning id"
                ),
                {"t": tenants.a, "s": PNG_B64},
            )
        return corr_id, null_id, bug_id

    corr_id, null_id, bug_id = run(_seed())

    counted = _backfill(tenants.a, dry_run=True)
    assert counted[CORR_NEW] >= 1 and counted[SCREENSHOT] >= 1
    assert counted["correction_feedback.original_value"] >= 2  # '' and '00001' are both set
    assert _backfill(tenants.a) == counted

    (orig, new) = run(
        _text_cols(
            "correction_feedback", "original_value, corrected_value", "id = :i", {"i": corr_id}
        )
    )
    assert orig.startswith("gAAAAA") and new.startswith("gAAAAA")
    (orig_n, new_n) = run(
        _text_cols(
            "correction_feedback", "original_value, corrected_value", "id = :i", {"i": null_id}
        )
    )
    assert orig_n.startswith("gAAAAA") and new_n is None  # NULL stays NULL
    (shot,) = run(_text_cols("bug_reports", "screenshot_b64", "id = :i", {"i": bug_id}))
    assert shot.startswith("gAAAAA")

    async def _through_the_app():
        async with async_session() as db:
            corr = await db.get(CorrectionFeedback, corr_id)
            bug = await db.get(BugReport, bug_id)
            return corr.original_value, corr.corrected_value, bug.screenshot_b64

    assert run(_through_the_app()) == ("", "451005282039001", PNG_B64)
    assert not any(_backfill(tenants.a).values())  # idempotent


def test_d14_a_text_token_another_key_wrote_reads_as_none_and_is_left_alone(real_engine, tenants):
    from cryptography.fernet import Fernet

    from app.models.business import CorrectionFeedback

    foreign = Fernet(Fernet.generate_key()).encrypt(b"451005282039001").decode()

    async def _seed():
        async with real_engine.begin() as conn:
            return await conn.scalar(
                text(
                    "insert into correction_feedback (tenant_id, doc_no, bank_code, field_name,"
                    " original_value, corrected_value, created_at, updated_at) values"
                    " (:t, :d, 'KBANK', 'merchant_id', :f, :f, now(), now()) returning id"
                ),
                {"t": tenants.a, "d": f"ENC-D14-{uuid.uuid4().hex[:8]}", "f": foreign},
            )

    corr_id = run(_seed())

    async def _read():
        async with async_session() as db:
            row = await db.get(CorrectionFeedback, corr_id)
            return row.original_value, row.corrected_value

    assert run(_read()) == (None, None)
    _backfill(tenants.a)
    raw = run(
        _text_cols(
            "correction_feedback", "original_value, corrected_value", "id = :i", {"i": corr_id}
        )
    )
    assert raw == (foreign, foreign)  # a token, so not plaintext: not rewritten


# ── A contact person's details (decision-log #49, extended) ─────────────────
#
# Needs migration 20261029010000 (the contact columns widened to text): a token does not fit
# varchar(50). Run against a database that has it — the local Supabase stack until it ships.

CONTACT = "คุณสมหญิง ใจดี ฝ่ายบัญชีเจ้าหนี้ สำนักงานใหญ่ กรุงเทพมหานคร"
TEL = "02-123-4567 ต่อ 1234"
# 200 characters: its token would not fit even the old varchar(255).
LONG_EMAIL = "accounts.payable.team." + "x" * 158 + "@example.co.th"
CONTACT_COLS = "buyer_contact_name, buyer_tel, buyer_email"


def _paid_order(real_engine, tenant_id):
    order_id = uuid.uuid4()

    async def _insert():
        async with real_engine.begin() as conn:
            await conn.execute(
                text(
                    "insert into credit_orders (id, tenant_id, pack_code, credits, amount_thb,"
                    " status, billing_period, created_at, updated_at) values"
                    " (:id, :t, 'pack_small', 500, 1200, 'paid', 'monthly', now(), now())"
                ),
                {"id": order_id, "t": tenant_id},
            )

    run(_insert())
    return order_id


def _proforma(tenant_id, order_id, tax_id):
    """Written through the ORM, as `issue_document` writes it (not through `issue_document`
    itself: that takes a real proforma number off the shared sequence)."""
    from datetime import UTC, datetime
    from decimal import Decimal

    from app.models.billing import BillingDocument
    from app.models.enums import BillingDocumentType

    async def _add():
        async with async_session() as db:
            doc = BillingDocument(
                tenant_id=tenant_id,
                order_id=order_id,
                doc_type=BillingDocumentType.PROFORMA,
                number=f"ENC-PF-{uuid.uuid4().hex[:10]}",
                issue_date=datetime.now(UTC),
                buyer_name="บริษัท ทดสอบการเข้ารหัส จำกัด",
                buyer_tax_id=tax_id,
                buyer_branch="00000",
                buyer_contact_name=CONTACT,
                buyer_tel=TEL,
                buyer_email=LONG_EMAIL,
                pack_code="pack_small",
                credits=500,
                subtotal=Decimal("1200.00"),
                vat_rate=Decimal("7.00"),
                vat_amount=Decimal("84.00"),
                total=Decimal("1284.00"),
                currency="THB",
            )
            db.add(doc)
            await db.commit()
            return doc.id

    return run(_add())


def test_d15_a_proformas_contact_is_stored_as_tokens_and_prefills_decrypted(real_engine, tenants):
    """Also D-19: a 200-character email and a long Thai name fit once encrypted — the widening
    migration, proved by the insert not failing."""
    from app.services.billing.documents import get_last_buyer_info

    order_id = _paid_order(real_engine, tenants.b)
    doc_id = _proforma(tenants.b, order_id, f"9{uuid.uuid4().int % 10**12:012d}")

    raw = run(_text_cols("billing_documents", CONTACT_COLS, "id = :i", {"i": doc_id}))
    assert all(v.startswith("gAAAAA") for v in raw)
    assert not any("สมหญิง" in v or "example.co.th" in v for v in raw)
    (name,) = run(_text_cols("billing_documents", "buyer_name", "id = :i", {"i": doc_id}))
    assert name == "บริษัท ทดสอบการเข้ารหัส จำกัด"  # the company stays plain

    async def _prefill():
        async with async_session() as db:
            return await get_last_buyer_info(db, str(tenants.b))

    info = run(_prefill())
    assert (info["contact_name"], info["tel"]) == (CONTACT, TEL)


def test_d16_the_ar_remark_sent_to_carmen_carries_the_decrypted_contact(real_engine, tenants):
    """`post_ar_batch` reads the proforma through the ORM and writes the contact into Carmen's
    Remark. `post_ar_entry` is replaced, so nothing reaches Carmen."""
    from unittest.mock import AsyncMock, patch

    from app.models.billing import ArCustomerProfile
    from app.services.billing.ar_posting import post_ar_batch

    tax_id = f"8{uuid.uuid4().int % 10**12:012d}"
    order_id = _paid_order(real_engine, tenants.b)
    _proforma(tenants.b, order_id, tax_id)

    async def _post():
        async with async_session() as db:
            db.add(
                ArCustomerProfile(
                    buyer_name="ENC-D16",
                    buyer_tax_id=tax_id,
                    buyer_branch="00000",
                    carmen_ar_code="AR-ENC",
                )
            )
            await db.commit()
            sent = AsyncMock(return_value={"carmen_ar_ref": "AR-REF-ENC"})
            with patch("app.services.billing.ar_posting.post_ar_entry", sent):
                results = await post_ar_batch(db, [str(order_id)], is_global=True, tenant_scope="")
            await db.execute(
                text("delete from ar_customer_profiles where buyer_tax_id = :t"), {"t": tax_id}
            )
            await db.commit()
            return results, sent

    results, sent = run(_post())
    assert results[0].success, results[0].error
    remark = sent.await_args.kwargs["remark"]
    assert CONTACT in remark and TEL in remark and LONG_EMAIL in remark
    assert "gAAAAA" not in remark


def test_d17_owner_emails_are_stored_as_a_token_and_the_sender_check_reads_them(tenants):
    from app.models.email_automation import EmailIngestSettings
    from app.services.email_automation.imap import sender_allowed

    emails = ["accounting@example.co.th", "ap@example.co.th"]

    async def _set(value):
        async with async_session() as db:
            row = await db.get(EmailIngestSettings, tenants.c)
            before = list(row.owner_emails) if row else None
            if row is None:
                row = EmailIngestSettings(tenant_id=tenants.c)
                db.add(row)
            row.owner_emails = value
            await db.commit()
            return before

    async def _as_ingest_reads_it():
        async with async_session() as db:
            row = await db.get(EmailIngestSettings, tenants.c)
            return list(row.owner_emails or [])  # ingest.py, verbatim

    before = run(_set(emails))
    try:
        (raw,) = run(
            _text_cols(
                "email_ingest_settings", "owner_emails::text", "tenant_id = :t", {"t": tenants.c}
            )
        )
        assert set(json.loads(raw)) == {"enc"} and "example" not in raw
        read = run(_as_ingest_reads_it())
        assert read == emails
        assert sender_allowed(read, "Bank <noreply@bank.co.th>, AP <ap@example.co.th>")
        assert not sender_allowed(read, "Someone <ap@example.co.th.evil.io>")
    finally:
        run(_set(before or []))


def test_d18_the_backfill_encrypts_contacts_written_in_plaintext(real_engine, tenants):
    """Rows from before: a proforma's contact (with a NULL email), a tenant's contact email,
    and an `owner_emails` list — a JSON *array*, which the backfill must count too."""
    from app.models.billing import BillingDocument
    from app.models.email_automation import EmailIngestSettings
    from app.models.identity import Tenant

    order_id = _paid_order(real_engine, tenants.b)
    doc_id = uuid.uuid4()

    async def _seed():
        async with real_engine.begin() as conn:
            await conn.execute(
                text(
                    "insert into billing_documents (id, tenant_id, order_id, doc_type, number,"
                    " issue_date, buyer_name, buyer_contact_name, buyer_tel, buyer_email,"
                    " pack_code, credits, subtotal, vat_rate, vat_amount, total, currency,"
                    " created_at, updated_at) values (:id, :t, :o, 'proforma', :n, now(),"
                    " 'ENC-D18', :c, '0812345678', null, 'pack_small', 500, 1200, 7, 84, 1284,"
                    " 'THB', now(), now())"
                ),
                {
                    "id": doc_id,
                    "t": tenants.b,
                    "o": order_id,
                    "n": f"ENC-PF-{doc_id.hex[:10]}",
                    "c": CONTACT,
                },
            )
            await conn.execute(
                text("update tenants set contact_email = 'ops@example.co.th' where id = :t"),
                {"t": tenants.b},
            )
            await conn.execute(
                text(
                    "insert into email_ingest_settings (tenant_id, enabled, tax_ids, rules,"
                    " owner_emails) values (:t, false, '[]', '[]', '[\"ap@example.co.th\"]')"
                    " on conflict (tenant_id) do update set owner_emails = excluded.owner_emails"
                ),
                {"t": tenants.b},
            )

    run(_seed())

    counted = _backfill(tenants.b, dry_run=True)
    for col in ("buyer_contact_name", "buyer_tel"):
        assert counted[f"billing_documents.{col}"] >= 1
    assert counted["tenants.contact_email"] == 1
    assert counted["email_ingest_settings.owner_emails"] == 1
    assert _backfill(tenants.b) == counted

    raw = run(_text_cols("billing_documents", CONTACT_COLS, "id = :i", {"i": doc_id}))
    assert raw[0].startswith("gAAAAA") and raw[1].startswith("gAAAAA") and raw[2] is None
    (email,) = run(_text_cols("tenants", "contact_email", "id = :t", {"t": tenants.b}))
    assert email.startswith("gAAAAA")
    (owners,) = run(
        _text_cols(
            "email_ingest_settings", "owner_emails::text", "tenant_id = :t", {"t": tenants.b}
        )
    )
    assert set(json.loads(owners)) == {"enc"}

    async def _through_the_app():
        async with async_session() as db:
            doc = await db.get(BillingDocument, doc_id)
            tenant = await db.get(Tenant, tenants.b)
            settings_row = await db.get(EmailIngestSettings, tenants.b)
            return (
                doc.buyer_contact_name,
                doc.buyer_tel,
                doc.buyer_email,
                tenant.contact_email,
                settings_row.owner_emails,
            )

    assert run(_through_the_app()) == (
        CONTACT,
        "0812345678",
        None,
        "ops@example.co.th",
        ["ap@example.co.th"],
    )
    assert not any(_backfill(tenants.b).values())  # idempotent


def test_d19_the_backfill_encrypts_an_error_message_written_in_plaintext(real_engine, tenants):
    """Encrypted since 2026-10-30 (#323): a refused mail's addresses written before that sit in
    plaintext until the backfill — which must count, encrypt and leave them readable."""
    doc_no = f"ENC-D19-{uuid.uuid4().hex[:8]}"
    message = "None of this BU's registered addresses appear — this mail carries ap@exampel.co.th"
    row_id = _received(real_engine, tenants.a, doc_no, status="skipped")

    async def _plain():
        async with real_engine.begin() as conn:
            await conn.execute(
                text(
                    "update email_documents set error_message = :m,"
                    " updated_at = now() - interval '80 days' where id = :i"
                ),
                {"m": message, "i": row_id},
            )

    run(_plain())
    (before,) = run(_text_cols("email_documents", "updated_at", "id = :i", {"i": row_id}))
    assert _backfill(tenants.a, dry_run=True)["email_documents.error_message"] >= 1
    _backfill(tenants.a)

    (raw,) = run(_text_cols("email_documents", "error_message", "id = :i", {"i": row_id}))
    assert raw.startswith("gAAAAA") and "exampel" not in raw
    # The 90-day retention clock (fn_purge_email_documents) runs on updated_at: encrypting a
    # value is not an edit, and must not give the addresses in it another 90 days.
    assert run(_text_cols("email_documents", "updated_at", "id = :i", {"i": row_id})) == (before,)

    async def _read():
        async with async_session() as db:
            return await db.scalar(
                select(EmailDocument.error_message).where(EmailDocument.id == row_id)
            )

    assert run(_read()) == message
    assert _backfill(tenants.a)["email_documents.error_message"] == 0  # idempotent
