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
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.auth.session import SessionInfo
from app.services.credit_card.activity import (
    HIDDEN_REASON,
    NOISE_REASONS,
    PENDING,
    _chip_expr,
    _counts_stmt,
    _email_stmt,
    _manual_counts_stmt,
    _manual_stmt,
    _pms_counts_stmt,
    _pms_row,
    _pms_stmt,
)
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


def _pms_counts(review=0, success=0, unposted=0, today=0):
    return SimpleNamespace(review=review, success=success, unposted=unposted, today=today)


@pytest.fixture(autouse=True)
def pms_part():
    """PMS days (CA-119) are their own two queries, patched here so the positional
    `db.execute` side_effect every other test drives stays the email + manual one. The PMS
    tests at the bottom hand this fixture their own counts and rows."""
    counts = AsyncMock(return_value=_pms_counts())
    rows = AsyncMock(return_value=[])
    with (
        patch("app.services.credit_card.activity._pms_counts", counts),
        patch("app.services.credit_card.activity._pms_rows", rows),
    ):
        yield SimpleNamespace(counts=counts, rows=rows)


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
        # Default None: `_email_cards` then makes no query, so a fixture that does not care
        # about input tax cannot shift the positional `side_effect` in `_db`.
        task_id=None,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _manual(**overrides):
    card = SimpleNamespace(
        id=uuid.uuid4(),
        created_at=NOW - timedelta(hours=2),
        submitted_at=NOW - timedelta(hours=1),
        bank_code="KBANK",
        doc_no="MAN-001",
        jv_no="JV-2026-0042",
        # Default None: `username_map` returns early on an empty id list, so a fixture that
        # does not care about the scanner's name costs no `db.execute` and cannot shift the
        # positional `side_effect` below.
        carmen_user_id=None,
        # Posted before the input-tax sums were stamped, by default: no note either way.
        tax_amt=None,
        input_tax_at=None,
    )
    for k, v in overrides.items():
        setattr(card, k, v)
    return (card, SimpleNamespace(original_filename="scanned_by_hand.pdf"))


def _db(
    *,
    statuses=None,
    pairs=None,
    manual_count,
    emails,
    manuals,
    manual_today=0,
    manual_unposted=0,
    usernames=None,
    cards=None,
):
    """Drive the `db.execute` calls the handler makes, in order.

    1. GROUP BY chip over email_documents                → .all()
    2. _manual_counts_stmt → .one(); `manual_count` is the posted scans, `manual_unposted`
       the charged-but-never-posted ones, `manual_today` both kinds since midnight ICT
    3. the email window                                  → .scalars().all()
    3a. `_email_cards`, the cards behind posted email rows (only when `cards` is given — the
       handler only asks when a posted email row carries a `task_id`) → .scalars().all()
    4. the manual window (only when the filter admits manual rows) → .all()
    5. username_map over those manual rows (only when one carries a user id)
       → .mappings().all(); `usernames` is {carmen_user_id: username}

    `statuses` is the shorthand most tests want: {status: n}, no reason code, nothing today.
    `pairs` is the long form for a bucket the reason code decides: {(status, reason_code):
    (n, today)} — `today` is how many of that group arrived since midnight, which is the only
    thing the Today filter counts.
    """
    db = make_mock_db()

    grouped = MagicMock()
    grouped.all.return_value = [
        g for s, n in (statuses or {}).items() for g in _group(s, None, (n, 0))
    ] + [g for (s, rc), v in (pairs or {}).items() for g in _group(s, rc, v)]
    counted = MagicMock()
    counted.one.return_value = SimpleNamespace(
        posted=manual_count, unposted=manual_unposted, today=manual_today
    )
    email_window = MagicMock()
    # The same `_visible()` the GROUP BY above gets, on the window this time — a test hands
    # `emails` the rows the table holds, and the real query would not return the hidden ones.
    email_window.scalars.return_value.all.return_value = [
        e for e in emails if not _hidden(e.status, e.reason_code)
    ]
    manual_window = MagicMock()
    manual_window.all.return_value = manuals

    # Fifth and last: `username_map`, resolving the scanners of whatever manual rows came
    # back. Always supplied, never always consumed — the handler only asks when a manual row
    # actually carries a `carmen_user_id`, and an unconsumed side_effect entry is harmless.
    names = MagicMock()
    names.mappings.return_value.all.return_value = [
        SimpleNamespace(carmen_user_id=k, username=v) for k, v in (usernames or {}).items()
    ]

    card_lookup = []
    if cards is not None:
        found = MagicMock()
        found.scalars.return_value.all.return_value = cards
        card_lookup = [found]

    db.execute.side_effect = [
        grouped,
        counted,
        email_window,
        *card_lookup,
        manual_window,
        names,
    ]
    return db


def _hidden(status, reason_code):
    """The test suite's reading of `_visible()`, negated — a row the real query never returns.

    Modelled here rather than asserted once, because it is not a chip: a hidden row is absent
    from the GROUP BY *and* from the window, so every fixture carrying one has to see nothing
    rather than see it filed somewhere. `_group` and `_db` both consult this, which is what
    makes "it contributes to no count and appears in no list" the default a test gets for
    free instead of something each one remembers to assert.
    """
    return status == "skipped" and reason_code == HIDDEN_REASON


def _chip_of(status, reason_code):
    """The test suite's reading of `_chip_expr`, which the mock DB never runs.

    Deliberately written as prose the other file can be checked against rather than imported
    from it: a fixture that shares the implementation it is testing proves nothing about it.

    **No `dismissed` argument since §18.** Dismissal stopped deciding the bucket when
    `_wants_a_human` narrowed to `pending_review`.
    """
    if status == "posted":
        return "success"
    if status == PENDING:
        return "review"
    if status == "skipped":
        return "noise" if reason_code in NOISE_REASONS else "unposted"
    return "unposted"


def _group(status, reason_code, value):
    """What one (status, reason_code) contributes to the GROUP BY. `value` is `(n, today)`.

    The real query groups by chip alone, so two pairs in one bucket come back as one row;
    the handler sums `n` per chip either way, which is why a row per pair is equivalent.

    **None at all for a hidden pair.** `_visible()` is a WHERE clause on the counts query, so
    those rows are gone before the GROUP BY sees them — not a bucket with nobody looking at
    it, but no row.
    """
    if _hidden(status, reason_code):
        return []
    n, today = value
    return [SimpleNamespace(chip=_chip_of(status, reason_code), n=n, today=today)]


# ── The anti-join ────────────────────────────────────────────────────────────


def test_manual_rows_exclude_anything_email_ingest_already_owns():
    """The regression guard for double-counted documents. Compiled, not executed: a mock
    DB never runs SQL, and this predicate is the whole correctness of the Manual source."""
    sql = str(_manual_stmt(uuid.uuid4()).compile(compile_kwargs={"literal_binds": True}))
    assert "NOT (EXISTS" in sql
    assert "email_documents" in sql
    # The counts carry the same anti-join, or the chips would count a forwarded statement
    # the list does not show.
    counts_sql = str(
        _manual_counts_stmt(uuid.uuid4(), NOW).compile(compile_kwargs={"literal_binds": True})
    )
    assert "NOT (EXISTS" in counts_sql


def test_each_chip_asks_for_the_manual_scans_it_holds():
    """Posted ones under Posted, charged-but-never-posted ones under Not posted, both under
    All and Today. Compiled, because the mock DB cannot run the predicate."""

    def sql(posted):
        return str(_manual_stmt(uuid.uuid4(), None, posted).compile())

    assert "credit_cards.submitted_at IS NOT NULL" in sql(True)
    assert "credit_cards.submitted_at IS NULL" in sql(False)
    assert "submitted_at IS" not in sql(None)


# ── Charged but never posted ────────────────────────────────────────────────


def test_an_unposted_manual_scan_is_listed_under_not_posted():
    """A BU that only scans by hand reads this page for what its credits went on, and a
    scan abandoned at step 3 was charged all the same."""
    card = _manual(submitted_at=None, jv_no=None)
    db = _db(statuses={}, manual_count=0, manual_unposted=1, emails=[], manuals=[card])
    with make_test_client(db, session=SESSION) as client:
        body = client.get(f"{BASE}?filter=unposted", headers=AUTH).json()

    row = body["data"][0]
    assert row["status"] == "scanned"
    assert row["source"] == "manual"
    assert row["jv_no"] is None
    # Timestamped by when it was scanned — there is no other moment it has.
    assert row["created_at"].startswith((NOW - timedelta(hours=2)).isoformat()[:19])
    assert body["counts"]["unposted"] == 1
    assert body["counts"]["all"] == 1


@pytest.mark.parametrize(
    ("overrides", "owed"),
    [
        # The case this exists for: JV posted, VAT owed, the ACTX never followed.
        ({"tax_amt": Decimal("70.00")}, True),
        # Filed — by step 4 or by the row's own button.
        ({"tax_amt": Decimal("70.00"), "input_tax_at": NOW}, False),
        # No VAT on the statement: nothing was owed.
        ({"tax_amt": Decimal("0.00")}, False),
        # Posted before the sums were stored — nobody knows what it owed, so it says nothing.
        ({}, False),
        # Never posted: there is no JV for an input-tax record to follow.
        ({"tax_amt": Decimal("70.00"), "submitted_at": None, "jv_no": None}, False),
    ],
)
def test_a_manual_row_says_when_its_input_tax_is_still_owed(overrides, owed):
    """A session that died on step 4 used to lose the VAT claim with no trace anywhere."""
    card = _manual(**overrides)
    db = _db(statuses={}, manual_count=1, emails=[], manuals=[card])
    with make_test_client(db, session=SESSION) as client:
        body = client.get(BASE, headers=AUTH).json()

    assert body["data"][0]["input_tax_owed"] is owed
    assert body["data"][0]["card_id"] == str(card[0].id)


def _email_card(task_id, **overrides):
    card = SimpleNamespace(
        id=uuid.uuid4(),
        task_id=task_id,
        submitted_at=NOW,
        tax_amt=Decimal("70.00"),
        input_tax_at=None,
    )
    for k, v in overrides.items():
        setattr(card, k, v)
    return card


@pytest.mark.parametrize(
    ("overrides", "owed"),
    [
        # Refused, failed, or unticked at approve: the sums were stamped, the record was not.
        ({}, True),
        # Filed with the JV, or from this row later.
        ({"input_tax_at": NOW}, False),
        # Posted before CA-111 stamped email cards: nobody knows what it owed.
        ({"tax_amt": None}, False),
    ],
    ids=["owed", "filed", "pre-release"],
)
def test_an_email_row_answers_input_tax_owed_from_its_card(overrides, owed):
    """CA-111: an email document's claim can be filed late too, keyed on its card, not on
    its ledger row's id."""
    task_id = uuid.uuid4()
    card = _email_card(task_id, **overrides)
    note = "Input tax not recorded: bank KTC has no registered tax ID on file"
    email = _email(status="posted", jv_no="JV-1", review_payload=None, task_id=task_id)
    email.error_message = note
    db = _db(statuses={"posted": 1}, manual_count=0, emails=[email], manuals=[], cards=[card])
    with make_test_client(db, session=SESSION) as client:
        row = client.get(BASE, headers=AUTH).json()["data"][0]

    assert row["source"] == "email"
    assert row["id"] == str(email.id)
    assert row["card_id"] == str(card.id)
    assert row["input_tax_owed"] is owed
    # The note is the row's own and survives either way: the pre-release row has nothing else.
    assert row["error_message"] == note


def test_a_pending_email_row_costs_no_card_lookup():
    """Only a posted row can owe input tax. `cards` is not supplied, so a lookup here would
    take the manual window's place in the side_effect and the list would come back wrong."""
    email = _email(task_id=uuid.uuid4())  # pending_review by default
    db = _db(statuses={PENDING: 1}, manual_count=0, emails=[email], manuals=[])
    with make_test_client(db, session=SESSION) as client:
        row = client.get(BASE, headers=AUTH).json()["data"][0]
    assert (row["card_id"], row["input_tax_owed"]) == (None, False)


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


def test_a_manual_row_names_whoever_ran_the_scan():
    """ "Scanned and posted by hand" answered *how*, which the reader can already see, and
    not *who*, which is what they were reading the row for."""
    uid = "e6942437-7db4-4a1e-9c3d-000000000001"
    db = _db(
        statuses={},
        manual_count=1,
        emails=[],
        manuals=[_manual(carmen_user_id=uid)],
        usernames={uid: "somchai"},
    )
    with make_test_client(db, session=SESSION) as client:
        body = client.get(BASE, headers=AUTH).json()

    assert body["data"][0]["posted_by_name"] == "somchai"


def test_a_manual_row_whose_scanner_is_no_longer_known_names_nobody():
    """The name is resolved from `ocr_sessions`, not stored, so it really can be gone — and
    a row that cannot name the person says so in words rather than printing a raw user id.

    Kept distinct from `reviewed_by_name`, which IS a stored ledger column, for exactly this
    reason: one field holding both guarantees is how the weaker one gets trusted."""
    db = _db(
        statuses={},
        manual_count=1,
        emails=[],
        manuals=[_manual(carmen_user_id="1f0e0000-0000-0000-0000-00000000dead")],
        usernames={},  # scrubbed — the session that ran it is past the 90-day window
    )
    with make_test_client(db, session=SESSION) as client:
        body = client.get(BASE, headers=AUTH).json()

    assert body["data"][0]["posted_by_name"] is None
    assert body["data"][0]["reviewed_by_name"] is None


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

    assert counts == {
        "review": 0,
        "success": 5,
        "unposted": 0,
        "noise": 0,
        "all": 5,
        "today": 0,
    }


def test_the_review_chip_holds_documents_and_nothing_else():
    """§18. §13 put every clearable cause on `review` — right about where the attention
    belonged, wrong about the unit. A cause is one setting and forty rows, so forty of them
    buried the documents the chip is named for. They are pointed at as causes now."""
    db = _db(
        pairs={
            ("skipped", "unreadable_document"): (46, 0),
            ("skipped", "wrong_pdf_password"): (12, 0),
            ("failed", "carmen_rejected"): (3, 0),
            ("rejected", "rejected_by_reviewer"): (2, 0),
            ("pending_review", None): (4, 0),
        },
        manual_count=0,
        emails=[],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        counts = client.get(BASE, headers=AUTH).json()["counts"]

    assert counts["review"] == 4  # the parked documents, and only those
    # 3 refused by Carmen + 2 rejected by a reviewer + the 12 the password stopped, which
    # are ordinary rows on this chip.
    assert counts["unposted"] == 17
    # Fires per attachment on legitimate mail. No chip and no dot.
    assert counts["noise"] == 46
    # Exactly one bucket each, which is what keeps `all` a true total rather than a sum of
    # overlapping piles.
    assert counts["all"] == 67


def test_the_noise_arm_only_claims_a_row_that_was_never_charged():
    """`unreadable_document` is written on charged `failed` rows too — by the generic handler
    and inside the refund boundary — and those are a crash, which a BU must find under Not
    posted rather than in the quiet bucket. So the noise arm reads the status as well."""
    db = _db(
        pairs={
            ("skipped", "unreadable_document"): (9, 0),
            ("failed", "unreadable_document"): (2, 0),
        },
        manual_count=0,
        emails=[],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        body = client.get(BASE, headers=AUTH).json()

    assert body["counts"]["noise"] == 9
    assert body["counts"]["unposted"] == 2  # the crash is a row a reader finds


def test_a_clearable_refusal_is_an_ordinary_row_under_not_posted():
    """A wrong password, an unregistered sender and a file type we cannot read are listed one
    per attachment, like every other row in the table.

    They were briefly folded into one row per cause with the filenames underneath — reported
    as *"ไม่เอาแบบนี้ เอาให้เหมือน skipped ของ tab all ไปเลย"*, and the fold came out again
    (§18 #86). So they are counted in `unposted` and returned in `data`, which is also what
    keeps the Pager honest: `total` is `counts[filter]`, so a bucket the list does not return
    would print *"showing 25 of 340"* over a different pile.
    """
    row = _email(status="skipped", reason_code="wrong_pdf_password", review_payload=None)
    db = _db(
        pairs={
            ("skipped", "wrong_pdf_password"): (11, 0),
            ("skipped", "sender_not_allowed"): (4, 0),
            ("failed", "carmen_rejected"): (3, 0),
        },
        manual_count=0,
        emails=[row],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        body = client.get(f"{BASE}?filter=unposted", headers=AUTH).json()

    # 11 + 4 + 3, all of them rows this chip lists.
    assert body["counts"]["unposted"] == 18
    assert body["total"] == 18
    assert [r["reason_code"] for r in body["data"]] == ["wrong_pdf_password"]
    # No fold left anywhere in the envelope.
    assert "causes" not in body


def test_a_filename_rule_refusal_is_in_no_view_at_all():
    """§19 #97, reversing §14 #65. `all` is the view with no state predicate, so it was where
    `no_rule_match` survived being taken off the chips — the log a BU reads to find a
    statement that never arrived. It was also the largest thing in that log by a distance,
    every row of it their own rule doing exactly what they wrote it to do, and none of it
    something they can act on: no document behind it, nothing charged, nothing to press.

    The rows are still written and `#/admin/email` still lists them by reason, which is where
    a too-narrow pattern is actually diagnosed — by the customer asking, rather than by them
    reading 46 rows of a rule working."""
    db = _db(
        pairs={
            ("skipped", HIDDEN_REASON): (7, 0),
            ("pending_review", None): (2, 0),
        },
        manual_count=0,
        emails=[
            _email(status="skipped", reason_code=HIDDEN_REASON, review_payload=None),
            _email(),
        ],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        body = client.get(f"{BASE}?filter=all", headers=AUTH).json()

    assert [r["reason_code"] for r in body["data"]] == [None]
    # Out of the arithmetic too, not merely off the list — the Pager cannot offer a page of
    # rows the window will not return.
    assert body["total"] == 2
    assert body["counts"] == {
        "review": 2,
        "success": 0,
        "unposted": 0,
        "noise": 0,
        "all": 2,
        "today": 0,
    }


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
            ("posted", None): (40, 3),
            ("skipped", "unreadable_document"): (46, 2),
            ("pending_review", None): (5, 1),
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
        pairs={("posted", None): (10, 10)},
        manual_count=0,
        manual_today=0,
        emails=[],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        counts = client.get(BASE, headers=AUTH).json()["counts"]

    assert counts["today"] == 10
    assert counts["all"] == 10


def test_today_asks_for_manual_rows_too():
    """`MANUAL_CHIPS` admits it, so the fourth `db.execute` is consumed and a scan done by
    hand this morning appears in the day's list beside the forwarded ones."""
    db = _db(
        pairs={("posted", None): (1, 1)},
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
    `coalesce(submitted_at, created_at)` — the moment each row is timestamped by — and both
    must carry a bound at all, or the chip silently lists the BU's whole history."""
    day = datetime(2026, 8, 31, 0, 0, tzinfo=UTC)
    email_sql = str(
        _email_stmt(uuid.uuid4(), None, day).compile(compile_kwargs={"literal_binds": True})
    )
    manual_sql = str(
        _manual_stmt(uuid.uuid4(), day).compile(compile_kwargs={"literal_binds": True})
    )
    assert "email_documents.created_at >=" in email_sql
    assert "coalesce(credit_cards.submitted_at, credit_cards.created_at) >=" in manual_sql
    # And nothing is windowed when nothing asked for it.
    assert ">=" not in str(_email_stmt(uuid.uuid4(), None).compile())


def test_the_chip_expression_never_drops_a_row_with_no_reason_code():
    """`NULL IN (...)` is NULL, not false, so the noise arm cannot claim a `skipped` row
    carrying no reason code. It has to fall somewhere a reader looks — `unposted`, via the
    `else_` — rather than vanishing from the strip while still counting toward `all`. An
    unexplained skip is exactly the row somebody should be shown.

    The arm order is the other half: `skipped` appears in two arms, and the narrower one
    (with the reason test) must come first or every skip would be noise.

    Compiled rather than executed: the mock DB runs no SQL, so an arm quietly reordered here
    would be invisible to every other test in this file.
    """
    sql = str(_chip_expr().compile(compile_kwargs={"literal_binds": True})).lower()
    for chip in ("success", "review", "unposted", "noise"):
        assert chip in sql
    # The noise arm has to test the status as well, or a charged `unreadable_document`
    # failure — a crash inside the refund boundary — would be filed as somebody's logo.
    assert "status = 'skipped' and" in sql


def test_hiding_a_filename_rule_refusal_is_null_safe_and_on_both_statements():
    """The one way `_visible()` can be written wrong, and the mock DB cannot see either half.

    `NOT (status = 'skipped' AND reason_code = 'no_rule_match')` is the obvious negation and
    is NULL for a `skipped` row carrying no reason code — a NULL is not a match, so that row
    would disappear from the table without anybody deciding it should. The `else_` in
    `_chip_expr` files it under `unposted` precisely so a reader sees it (the test above), and
    a `!=` here would delete it one clause earlier. `IS DISTINCT FROM` answers TRUE.

    And it has to be on **both** statements: the window decides what is listed, the GROUP BY
    decides `counts` and therefore `total`, and one without the other is a Pager offering
    pages of rows the window will not return.

    Compiled, not executed — the mock DB runs no SQL, so nothing else in this file would
    notice either mistake.
    """
    for sql in (
        str(_email_stmt(uuid.uuid4(), None).compile(compile_kwargs={"literal_binds": True})),
        str(_counts_stmt(uuid.uuid4(), NOW).compile(compile_kwargs={"literal_binds": True})),
    ):
        sql = sql.lower()
        assert f"reason_code is distinct from '{HIDDEN_REASON}'" in sql
        assert f"reason_code != '{HIDDEN_REASON}'" not in sql
        # The status arm. `no_rule_match` is only ever written before the charge, but
        # charged-means-reviewable says a charged row is owed to the reader either way.
        assert "status != 'skipped' or" in sql


def test_the_chip_expression_reads_status_alone_for_review():
    """The narrowing §18 turns on: `review` is `pending_review` and nothing else. A reason
    code creeping back into this arm is what put 46 signature logos on the work chip."""
    sql = str(_chip_expr().compile(compile_kwargs={"literal_binds": True})).lower()
    head = sql[: sql.index("'review'")]
    assert "reason_code" not in head
    assert "dismissed_at" not in head


def test_the_chip_is_grouped_by_name_not_by_a_second_case():
    """The 500 of 2026-09-03, and the reason no other test in this file caught it.

    `GROUP BY <the CASE>` reads as the obvious way to write this and is invalid: SQLAlchemy
    renders the expression again with a *fresh set of bind parameters*, so Postgres cannot
    see the two as one thing and rejects the columns inside the SELECT's CASE with
    "must appear in the GROUP BY clause". Grouping by the output column's name renders the
    CASE once, and Postgres resolves a bare name in GROUP BY against the output columns.

    **Compiled with real bind parameters, deliberately.** Under `literal_binds` the two
    renderings come out textually identical and the statement is perfectly valid — which is
    exactly how this shipped: every compiled-SQL assertion here inlined its binds, and the
    mock DB below never executes anything.
    """
    sql = str(_counts_stmt(uuid.uuid4(), NOW).compile()).lower()
    assert sql.count("case") == 1, "the CASE is rendered twice — see the docstring"
    assert "group by chip" in sql


# ── PMS days (CA-119) ──────────────────────────────────────────────────────────


def _pms_day(**overrides):
    defaults = dict(
        id=uuid.uuid4(),
        created_at=NOW + timedelta(minutes=5),
        payload={
            "InterfaceType": "PMS",
            "InterfaceName": "Comanche",
            "DocType": "Daily",
            "DocDate": "2024-09-05",
        },
        status="pending_review",
        review_payload={
            "rows": [
                {"key": '["103","Extra Bed"]', "values": {}, "amount": "1.00"},
                {"key": '["103","Extra Bed - VAT"]', "values": {}, "amount": "0.07"},
            ],
            "flags": ["mapping_guessed"],
            "missing": [],
            "ai": ['["103","Extra Bed"]', '["103","Extra Bed - VAT"]', '["729","Rebate"]'],
        },
        jv_no=None,
        reason_code=None,
        error_message=None,
        reviewed_by_name=None,
        reviewed_at=None,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_a_parked_pms_day_reads_like_a_document():
    row = _pms_row(_pms_day())
    assert row.source == "pms"
    assert (row.bank_code, row.doc_no, row.attachment) == ("PMS", "05/09/2024", "Comanche · Daily")
    assert row.flags == ["mapping_guessed"]
    # One name per PMS code: the two rows of code 103 read as one "103".
    assert row.guessed == ["103", "729"]
    assert row.line_count == 2


def test_a_resolved_pms_day_carries_only_the_ledger_columns():
    row = _pms_row(_pms_day(status="posted", review_payload=None, reviewed_by_name="Nok"))
    assert row.status == "posted"
    # Carmen's engine answers without the JV's number (CA-116).
    assert row.jv_no is None
    assert row.flags == [] and row.guessed == [] and row.doc_date is None


def test_pms_days_join_the_counts_and_the_list(pms_part):
    pms_part.counts.return_value = _pms_counts(review=2, success=5, unposted=1, today=1)
    pms_part.rows.return_value = [_pms_row(_pms_day())]
    db = _db(statuses={"pending_review": 1}, manual_count=0, emails=[_email()], manuals=[])
    with make_test_client(db, session=SESSION) as client:
        body = client.get(f"{BASE}?filter=review", headers=AUTH).json()

    assert body["counts"]["review"] == 3
    assert body["counts"]["success"] == 5
    assert body["counts"]["unposted"] == 1
    assert body["counts"]["all"] == 9
    assert body["counts"]["today"] == 1
    # Newest first across sources: the day arrived five minutes after the email.
    assert [r["source"] for r in body["data"]] == ["pms", "email"]
    assert pms_part.rows.await_args.args[2] == "review"


def test_the_pms_queries_hide_a_day_being_read_and_select_by_chip():
    tenant = uuid.uuid4()
    listed = str(_pms_stmt(tenant, "unposted").compile(compile_kwargs={"literal_binds": True}))
    assert "pms_events.status IN ('pending_review', 'posted', 'rejected', 'failed')" in listed
    assert "'unposted'" in listed
    counted = str(_pms_counts_stmt(tenant, NOW).compile(compile_kwargs={"literal_binds": True}))
    assert "'received'" not in counted
    assert "pms_events.status IN ('pending_review', 'posted', 'rejected', 'failed')" in counted
