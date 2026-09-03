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
from app.routers.credit_card_activity import _counts_stmt, _email_stmt, _manual_stmt
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


def _db(*, statuses=None, pairs=None, manual_count, emails, manuals, seen=None, manual_today=0):
    """Drive the five `db.execute` calls the handler makes, in order.

    1. GROUP BY status, reason_code over email_documents → .all()
    2. count_rows(manual_stmt)                           → .scalar_one()
    3. count_rows(manual_stmt, since=midnight ICT)       → .scalar_one()
    4. the email window                                  → .scalars().all()
    5. the manual window (only when the filter admits manual rows) → .all()

    `statuses` is the shorthand most tests want: {status: n}, no reason code, nothing
    stuck, nothing noted, nothing today. `pairs` is the long form the `attention` tests
    need: {(status, reason_code): (n, stuck, noted)} — `stuck` is how many are older than
    `STUCK_AFTER`, `noted` how many carry an `error_message`. A fourth element sets how many
    of that group arrived today, which is the only thing the Today chip counts.

    `seen` is the `email_queue_seen` row, read with `db.get` rather than `db.execute`
    precisely so it stays out of the ordering above — None means this BU has never opened
    a chip, which is what `make_mock_db` already stubs.
    """
    db = make_mock_db()

    grouped = MagicMock()
    grouped.all.return_value = [
        SimpleNamespace(status=s, reason_code=None, n=n, stuck=0, noted=0, today=0)
        for s, n in (statuses or {}).items()
    ] + [
        SimpleNamespace(status=s, reason_code=rc, n=v[0], stuck=v[1], noted=v[2], today=_today(v))
        for (s, rc), v in (pairs or {}).items()
    ]
    counted = MagicMock()
    counted.scalar_one.return_value = manual_count
    counted_today = MagicMock()
    counted_today.scalar_one.return_value = manual_today
    email_window = MagicMock()
    email_window.scalars.return_value.all.return_value = emails
    manual_window = MagicMock()
    manual_window.all.return_value = manuals

    db.execute.side_effect = [grouped, counted, counted_today, email_window, manual_window]
    if seen is not None:
        db.get.return_value = SimpleNamespace(seen=seen)
    return db


def _today(value):
    """The optional fourth element of a `pairs` value — how many of that group arrived
    today. Absent means none, which is what every test that predates the chip wants."""
    return value[3] if len(value) > 3 else 0


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

    assert counts == {"review": 0, "success": 5, "unposted": 0, "all": 5, "today": 0}


def test_everything_that_did_not_post_lands_under_one_chip():
    """The billing split (`skipped` vs `failed`) is invisible to a reader — both mean "it
    did not post" — so the two chips became one. What separates the rows is the Message
    column, not the strip."""
    db = _db(
        pairs={
            ("skipped", "no_rule_match"): (46, 0, 0),
            ("failed", "carmen_rejected"): (3, 0, 0),
            ("rejected", "rejected_by_reviewer"): (2, 0, 0),
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
            ("skipped", "no_rule_match"): (46, 0, 0),
            ("skipped", "unsupported_attachment"): (12, 0, 0),
            ("failed", "carmen_rejected"): (3, 0, 0),
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


def test_the_dot_spans_every_anomaly_rather_than_a_window():
    """The 7-day window is gone: what puts the dot out is the mark in `email_queue_seen`,
    not a clock. Compiled, not executed, for the same reason as the anti-join above — the
    mock DB runs no SQL, and a date bound sneaking back in would be invisible otherwise.

    `STUCK_AFTER` stays, and is not the same kind of thing: `received` carries no reason
    code, so age is the only thing telling a document being read right now from one the
    pipeline abandoned.
    """
    sql = str(
        _counts_stmt(uuid.uuid4(), NOW, NOW).compile(compile_kwargs={"literal_binds": True})
    ).lower()
    assert str((NOW - timedelta(days=7)).replace(tzinfo=None)) not in sql
    assert str((NOW - timedelta(hours=1)).replace(tzinfo=None)) in sql
    assert "count(*) as n" in sql


def test_a_posted_document_whose_input_tax_failed_still_gets_a_dot():
    """The quietest outcome in the system: the JV reached Carmen, the VAT record did not.
    The row wears the Success pill and nothing else in the app says otherwise."""
    db = _db(
        pairs={("posted", None): (20, 0, 2)},
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
        pairs={("received", None): (4, 1, 0)},
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


# ── Today ────────────────────────────────────────────────────────────────────


def test_today_counts_every_status_and_the_bus_own_scans():
    """The chip answers "what happened today", so it spans all three status chips plus the
    manual scans — a day view that hid the BU's own work would be answering something
    else."""
    db = _db(
        pairs={
            ("posted", None): (40, 0, 0, 3),
            ("skipped", "no_rule_match"): (46, 0, 0, 2),
            ("pending_review", None): (5, 0, 0, 1),
        },
        manual_count=9,
        manual_today=4,
        emails=[],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        counts = client.get(BASE, headers=AUTH).json()["counts"]

    assert counts["today"] == 10  # 3 + 2 + 1 email, + 4 scanned by hand


def test_today_is_left_out_of_the_all_count():
    """`all` is how the page tells a BU that has never had a document from one whose chip is
    merely empty. Today overlaps the other three by construction, so folding it in would
    count the same row twice and make that number a fiction."""
    db = _db(
        pairs={("posted", None): (10, 0, 0, 10)},
        manual_count=0,
        manual_today=0,
        emails=[],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        counts = client.get(BASE, headers=AUTH).json()["counts"]

    assert counts["today"] == 10
    assert counts["all"] == 10


def test_today_carries_no_dot():
    """`unseen` measures an anomaly count against a stored lifetime mark. Today's count
    resets at midnight, so there is nothing a mark could mean — and every one of its rows is
    already counted under a chip that does light."""
    db = _db(
        pairs={("failed", "carmen_rejected"): (3, 0, 0, 3)},
        manual_count=0,
        emails=[],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        body = client.get(BASE, headers=AUTH).json()

    assert "today" not in body["attention"]
    assert "today" not in body["unseen"]
    assert body["unseen"]["unposted"] is True


def test_today_asks_for_manual_rows_too():
    """`MANUAL_FILTERS` admits it, so the fifth `db.execute` is consumed and a scan done by
    hand this morning appears in the day's list beside the forwarded ones."""
    db = _db(
        pairs={("posted", None): (1, 0, 0, 1)},
        manual_count=1,
        manual_today=1,
        emails=[_email(status="posted")],
        manuals=[_manual()],
    )
    with make_test_client(db, session=SESSION) as client:
        body = client.get(f"{BASE}?filter=today", headers=AUTH).json()

    assert [r["source"] for r in body["data"]] == ["email", "manual"]
    assert body["total"] == 2


def test_today_windows_both_sources_on_the_same_midnight():
    """Compiled, not executed. The email side filters `created_at` and the manual side
    `submitted_at` — the moment each row is timestamped by — and both must carry a bound at
    all, or the chip silently lists the BU's whole history."""
    day = datetime(2026, 8, 31, 0, 0, tzinfo=UTC)
    email_sql = str(
        _email_stmt(uuid.uuid4(), None, day).compile(compile_kwargs={"literal_binds": True})
    )
    manual_sql = str(
        _manual_stmt(uuid.uuid4(), day).compile(compile_kwargs={"literal_binds": True})
    )
    assert "email_documents.created_at >=" in email_sql
    assert "credit_cards.submitted_at >=" in manual_sql
    # And nothing is windowed when nothing asked for it.
    assert ">=" not in str(_email_stmt(uuid.uuid4(), None).compile())


# ── Dismiss ──────────────────────────────────────────────────────────────────


def _dismissable(**overrides):
    """A row a person can put away: terminal, and carrying no payload to review."""
    row = _email(status="skipped", reason_code="no_rule_match", review_payload=None)
    row.tenant_id = uuid.UUID(TENANT)
    row.dismissed_at = None
    for k, v in overrides.items():
        setattr(row, k, v)
    return row


def _one_row(row):
    """A db whose only job is to hand back that row from `db.get`."""
    db = make_mock_db()
    db.get.return_value = row
    return db


def test_dismissing_a_row_stamps_it_and_commits():
    row = _dismissable()
    db = _one_row(row)
    with make_test_client(db, session=SESSION) as client:
        res = client.post(f"{BASE}/{row.id}/dismiss", headers=AUTH)

    assert res.status_code == 204
    assert row.dismissed_at is not None
    assert db.commit.await_count == 1


def test_a_document_waiting_for_review_is_rejected_not_dismissed():
    """Reject already retires a real document and records who and why. Two ways to do that,
    with different audit trails, is worse than one — so this refuses rather than offering a
    quieter alternative."""
    row = _dismissable(status="pending_review", review_payload={"extracted": {}})
    db = _one_row(row)
    with make_test_client(db, session=SESSION) as client:
        res = client.post(f"{BASE}/{row.id}/dismiss", headers=AUTH)

    assert res.status_code == 400
    assert row.dismissed_at is None


def test_dismissing_twice_is_not_an_error():
    """The outcome the caller wanted is the outcome that holds, and a double-click is not a
    conflict. Nothing is rewritten, so the first person's timestamp stands."""
    stamped = datetime(2026, 9, 1, 9, 0, tzinfo=UTC)
    row = _dismissable(dismissed_at=stamped)
    db = _one_row(row)
    with make_test_client(db, session=SESSION) as client:
        assert client.post(f"{BASE}/{row.id}/dismiss", headers=AUTH).status_code == 204

    assert row.dismissed_at == stamped
    db.commit.assert_not_awaited()


def test_another_bus_row_is_not_found_rather_than_forbidden():
    """Same answer as everywhere else in this feature: not yours and not there are
    indistinguishable, so the id space says nothing about other BUs."""
    row = _dismissable(tenant_id=uuid.uuid4())
    db = _one_row(row)
    with make_test_client(db, session=SESSION) as client:
        assert client.post(f"{BASE}/{row.id}/dismiss", headers=AUTH).status_code == 404

    assert row.dismissed_at is None


# ── The dot, and what puts it out ────────────────────────────────────────────


def test_a_chip_someone_already_opened_has_no_dot():
    """The whole point: nothing retries a failure, so 49 dead documents would light the dot
    for ever. The mark is what ends that — and it ends only the dot, never the count, which
    still sizes the pile for the sentence a screen reader speaks."""
    db = _db(
        pairs={("skipped", "no_rule_match"): (49, 0, 0)},
        manual_count=0,
        emails=[],
        manuals=[],
        seen={"unposted": 49},
    )
    with make_test_client(db, session=SESSION) as client:
        body = client.get(BASE, headers=AUTH).json()

    assert body["unseen"]["unposted"] is False
    assert body["attention"]["unposted"] == 49
    assert body["counts"]["unposted"] == 49


def test_a_newer_anomaly_brings_the_dot_back():
    """A mark is a high-water line, not an off switch."""
    db = _db(
        pairs={("skipped", "no_rule_match"): (50, 0, 0)},
        manual_count=0,
        emails=[],
        manuals=[],
        seen={"unposted": 49},
    )
    with make_test_client(db, session=SESSION) as client:
        assert client.get(BASE, headers=AUTH).json()["unseen"]["unposted"] is True


def test_opening_one_chip_does_not_silence_another():
    """A mark per chip, not one for the queue. Looking at the failures says nothing about
    a JV that posted without its input-tax record."""
    db = _db(
        pairs={
            ("skipped", "no_rule_match"): (49, 0, 0),
            ("posted", None): (20, 0, 2),
        },
        manual_count=0,
        emails=[],
        manuals=[],
        seen={"unposted": 49},
    )
    with make_test_client(db, session=SESSION) as client:
        unseen = client.get(BASE, headers=AUTH).json()["unseen"]

    assert unseen["unposted"] is False
    assert unseen["success"] is True


def test_a_business_unit_that_has_never_looked_sees_every_dot():
    """No row is not an error — it is the first visit."""
    db = _db(
        pairs={("skipped", "no_rule_match"): (49, 0, 0)},
        manual_count=0,
        emails=[],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        assert client.get(BASE, headers=AUTH).json()["unseen"]["unposted"] is True


def test_marking_a_chip_seen_stores_the_count_the_server_computed():
    """Never the caller's number: a client is free to be wrong, and one bad value would
    silence that BU's dot for good."""
    db = _db(
        pairs={("skipped", "no_rule_match"): (49, 0, 0)},
        manual_count=0,
        emails=[],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        res = client.post(f"{BASE}/seen", headers=AUTH, json={"filter": "unposted", "seen": 0})

    assert res.status_code == 200
    assert res.json() == {"filter": "unposted", "seen": 49}
    # No row yet, so the first mark creates one rather than 404ing the way auto-post does.
    assert db.add.called


def test_marking_a_chip_seen_keeps_the_other_chips_marks():
    """The stored value is replaced, not mutated — SQLAlchemy does not track an in-place
    write to a JSON column, so `row.seen[k] = v` would commit nothing at all."""
    db = _db(
        pairs={("posted", None): (20, 0, 2)},
        manual_count=0,
        emails=[],
        manuals=[],
        seen={"unposted": 49},
    )
    with make_test_client(db, session=SESSION) as client:
        client.post(f"{BASE}/seen", headers=AUTH, json={"filter": "success"})

    assert db.get.return_value.seen == {"unposted": 49, "success": 2}


def test_only_a_real_chip_can_be_marked_seen():
    """A trust boundary: the value becomes a key in stored JSON. `all` and `today` are
    refused with the nonsense — neither carries a dot, so neither has one to put out, and
    `today`'s count resets at midnight where a stored mark never would."""
    for bad in ("all", "today", "nonsense", ""):
        db = _db(statuses={"posted": 1}, manual_count=0, emails=[], manuals=[])
        with make_test_client(db, session=SESSION) as client:
            assert (
                client.post(f"{BASE}/seen", headers=AUTH, json={"filter": bad}).status_code == 400
            )
