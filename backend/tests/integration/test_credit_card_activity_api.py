"""Integration tests for the activity table a BU sees at #/CreditCardOCR.

  GET /api/v1/credit-card/activity — email documents and manual scans, one list

The one that matters most is the anti-join. Email ingestion calls the same
`finalize_extraction` the wizard does, so every ingested document ALSO has a `credit_cards`
row — without `NOT EXISTS (email_documents.task_id = credit_cards.task_id)` a single
forwarded statement is listed twice, once as Email and once as Manual, and every count on
the page is wrong. That predicate is asserted directly against the compiled SQL, because a
mock DB cannot execute it.
"""

import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.auth.session import SessionInfo
from app.routers.credit_card_activity import _counts_stmt, _manual_stmt
from tests.conftest import make_mock_db
from tests.integration.conftest import make_test_client

BASE = "/api/v1/credit-card/activity"
AUTH = {"Authorization": "Bearer dummy"}
TENANT = str(uuid.uuid4())

# FAKE_SESSION's tenant_id is deliberately not a UUID (see the integration conftest), and
# this router parses it, so these tests bring their own.
SESSION = SessionInfo(
    session_id="sess-activity",
    carmen_token="tok",
    carmen_user_id="u-activity",
    username="reviewer",
    tenant_id=TENANT,
    carmen_uri="https://test.carmenwork.com",
    bu="BU01",
)

NOW = datetime(2026, 8, 31, 10, 0, tzinfo=UTC)


def _email(**overrides):
    defaults = dict(
        id=uuid.uuid4(),
        created_at=NOW,
        attachment="statement_july.pdf",
        status="pending_review",
        bank_code="KTC",
        doc_no="INV-001",
        jv_no=None,
        reason_code=None,
        error_message=None,
        reviewed_by_name=None,
        reviewed_at=None,
        review_payload={"extracted": {"details": []}, "flags": ["mapping_guessed"]},
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _manual(**overrides):
    card = SimpleNamespace(
        id=uuid.uuid4(),
        submitted_at=NOW - timedelta(hours=1),
        bank_code="KBANK",
        doc_no="MAN-001",
        jv_no="JV-2026-0042",
    )
    for k, v in overrides.items():
        setattr(card, k, v)
    return (card, SimpleNamespace(original_filename="scanned_by_hand.pdf"))


def _db(*, statuses=None, pairs=None, manual_count, emails, manuals):
    """Drive the four `db.execute` calls the handler makes, in order.

    1. GROUP BY status, reason_code over email_documents → .all()
    2. count_rows(manual_stmt)                           → .scalar_one()
    3. the email window                                  → .scalars().all()
    4. the manual window (only when the filter admits manual rows) → .all()

    `statuses` is the shorthand most tests want: {status: n}, no reason code and nothing
    the dot would look at. `pairs` is the long form the `attention` tests need:
    {(status, reason_code): (n, recent, stuck, noted)} — `n` is the lifetime count the chip
    reports, and the other three are what the SQL already narrowed to `ATTENTION_WINDOW`:
    how many arrived inside it, how many of those are stuck, how many carry an
    `error_message`.
    """
    db = make_mock_db()

    grouped = MagicMock()
    grouped.all.return_value = [
        SimpleNamespace(status=s, reason_code=None, n=n, recent=0, stuck=0, noted=0)
        for s, n in (statuses or {}).items()
    ] + [
        SimpleNamespace(status=s, reason_code=rc, n=n, recent=recent, stuck=stuck, noted=noted)
        for (s, rc), (n, recent, stuck, noted) in (pairs or {}).items()
    ]
    counted = MagicMock()
    counted.scalar_one.return_value = manual_count
    email_window = MagicMock()
    email_window.scalars.return_value.all.return_value = emails
    manual_window = MagicMock()
    manual_window.all.return_value = manuals

    db.execute.side_effect = [grouped, counted, email_window, manual_window]
    return db


# ── The anti-join ────────────────────────────────────────────────────────────


def test_manual_rows_exclude_anything_email_ingest_already_owns():
    """The regression guard for double-counted documents. Compiled, not executed: a mock
    DB never runs SQL, and this predicate is the whole correctness of the Manual source."""
    sql = str(_manual_stmt(uuid.uuid4()).compile(compile_kwargs={"literal_binds": True}))
    assert "NOT (EXISTS" in sql
    assert "email_documents" in sql
    # Drafts are not notifications — the user was sitting right there.
    assert "credit_cards.submitted_at IS NOT NULL" in sql


# ── The merged list ──────────────────────────────────────────────────────────


def test_both_sources_appear_in_one_list_newest_first():
    db = _db(
        statuses={"pending_review": 1},
        manual_count=1,
        emails=[_email()],
        manuals=[_manual()],
    )
    with make_test_client(db, session=SESSION) as client:
        body = client.get(BASE, headers=AUTH).json()

    assert [r["source"] for r in body["data"]] == ["email", "manual"]
    assert body["data"][1]["jv_no"] == "JV-2026-0042"
    assert body["data"][1]["attachment"] == "scanned_by_hand.pdf"
    # A manual scan is only ever listed once it posted, so it wears the Success pill.
    assert body["data"][1]["status"] == "posted"


def test_total_is_the_unlimited_count_not_the_window():
    """`len(data)` as a total is the bug class `Page` exists to kill: a truncated window
    has to be able to say "showing 1 of 4"."""
    db = _db(
        statuses={"pending_review": 2, "posted": 1},
        manual_count=1,
        emails=[_email()],
        manuals=[_manual()],
    )
    with make_test_client(db, session=SESSION) as client:
        body = client.get(f"{BASE}?limit=1", headers=AUTH).json()

    assert len(body["data"]) == 1
    assert body["total"] == 4  # 2 pending + 1 posted email + 1 manual


def test_counts_cover_every_chip_even_at_zero():
    """A chip that appears only when it has rows makes the strip jump as documents
    resolve, so every key is present regardless."""
    db = _db(statuses={"posted": 3}, manual_count=2, emails=[], manuals=[])
    with make_test_client(db, session=SESSION) as client:
        counts = client.get(BASE, headers=AUTH).json()["counts"]

    assert counts == {"review": 0, "success": 5, "unposted": 0, "all": 5}


def test_everything_that_did_not_post_lands_under_one_chip():
    """The billing split (`skipped` vs `failed`) is invisible to a reader — both mean "it
    did not post" — so the two chips became one. What separates the rows is the Message
    column, not the strip."""
    db = _db(
        pairs={
            ("skipped", "no_rule_match"): (46, 46, 0, 0),
            ("failed", "carmen_rejected"): (3, 3, 0, 0),
            ("rejected", "rejected_by_reviewer"): (2, 2, 0, 0),
        },
        manual_count=0,
        emails=[],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        counts = client.get(BASE, headers=AUTH).json()["counts"]

    assert counts["unposted"] == 51
    assert counts["all"] == 51


def test_attention_marks_every_anomaly_not_only_the_fixable_ones():
    """The dot means "something is off", not "you can fix it". A failure nobody in the BU
    can clear is still a failure, and a dot that covers only some of them is one nobody can
    read the absence of. A filename rule doing its job is the exception: not an anomaly."""
    db = _db(
        pairs={
            ("skipped", "no_rule_match"): (46, 46, 0, 0),
            ("skipped", "unsupported_attachment"): (12, 12, 0, 0),
            ("failed", "carmen_rejected"): (3, 3, 0, 0),
        },
        manual_count=0,
        emails=[],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        body = client.get(BASE, headers=AUTH).json()

    # 46 fixable + 3 Carmen refusals. The 12 unreadable attachments are the BU's own rules
    # working — we never stored the bytes, and nothing is owed.
    assert body["attention"]["unposted"] == 49
    assert body["attention"]["all"] == 49
    # And the plain counts are untouched by any of it.
    assert body["counts"]["unposted"] == 61


def test_the_dot_only_looks_at_the_last_week():
    """There is no retry, so a failed row is terminal: fixing the filename rule never
    clears the 46 `no_rule_match` rows behind it. A dot counting those is on for ever, and
    a warning that never goes out is one nobody reads by the day something new breaks.

    Compiled, not executed, for the same reason as the anti-join above: the mock DB runs no
    SQL, and the window lives entirely in these `FILTER` clauses. `n` — what the chip and
    the Pager report — must stay unwindowed, which is the other half of the assertion.
    """
    sql = str(
        _counts_stmt(uuid.uuid4(), NOW).compile(compile_kwargs={"literal_binds": True})
    ).lower()
    week_ago = str((NOW - timedelta(days=7)).replace(tzinfo=None))
    # Three of the four counts are narrowed to the window; `count(*)` alone is not.
    assert sql.count(week_ago) == 3
    assert "count(*) as n" in sql
    # And the stuck count is the window AND the hour, not one or the other.
    assert str((NOW - timedelta(hours=1)).replace(tzinfo=None)) in sql


def test_a_posted_document_whose_input_tax_failed_still_gets_a_dot():
    """The quietest outcome in the system: the JV reached Carmen, the VAT record did not.
    The row wears the Success pill and nothing else in the app says otherwise."""
    db = _db(
        pairs={("posted", None): (20, 20, 0, 2)},
        manual_count=0,
        emails=[],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        body = client.get(BASE, headers=AUTH).json()

    assert body["counts"]["success"] == 20
    assert body["attention"]["success"] == 2


def test_a_document_still_being_read_is_not_a_stuck_one():
    """`received` is the state every row is claimed into, so one in flight during a poll
    must not put a dot on the chip. Only age separates the two, and it carries no
    reason_code to separate them any other way."""
    db = _db(
        pairs={("received", None): (4, 4, 1, 0)},
        manual_count=0,
        emails=[],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        body = client.get(BASE, headers=AUTH).json()

    assert body["counts"]["unposted"] == 4
    assert body["attention"]["unposted"] == 1


def test_attention_covers_every_chip_even_at_zero():
    """Same reason `counts` does: the strip must not reflow as documents resolve."""
    db = _db(statuses={"posted": 3}, manual_count=2, emails=[], manuals=[])
    with make_test_client(db, session=SESSION) as client:
        attention = client.get(BASE, headers=AUTH).json()["attention"]

    assert attention == {"review": 0, "success": 0, "unposted": 0, "all": 0}


def test_review_filter_asks_for_no_manual_rows_at_all():
    """A manual scan is never pending, so the Review chip must not even query for them —
    if it did, the fourth `db.execute` would be consumed and the row would appear."""
    db = _db(statuses={"pending_review": 1}, manual_count=4, emails=[_email()], manuals=[_manual()])
    with make_test_client(db, session=SESSION) as client:
        body = client.get(f"{BASE}?filter=review", headers=AUTH).json()

    assert [r["source"] for r in body["data"]] == ["email"]
    assert body["total"] == 1


def test_an_unknown_filter_lands_on_all_rather_than_400ing():
    """The query string is a UI detail; a stale bookmark should land somewhere useful."""
    db = _db(statuses={"posted": 1}, manual_count=1, emails=[_email(status="posted")], manuals=[])
    with make_test_client(db, session=SESSION) as client:
        res = client.get(f"{BASE}?filter=nonsense", headers=AUTH)

    assert res.status_code == 200
    assert res.json()["total"] == 2
