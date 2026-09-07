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
from app.routers.credit_card_activity import (
    NOISE_REASONS,
    PENDING,
    _chip_expr,
    _counts_stmt,
    _email_stmt,
    _manual_stmt,
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
        # Default None: `username_map` returns early on an empty id list, so a fixture that
        # does not care about the scanner's name costs no `db.execute` and cannot shift the
        # positional `side_effect` below.
        carmen_user_id=None,
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
    seen=None,
    manual_today=0,
    usernames=None,
):
    """Drive the six `db.execute` calls the handler makes, in order.

    1. GROUP BY status, reason_code over email_documents → .all()
    2. count_rows(manual_stmt)                           → .scalar_one()
    3. count_rows(manual_stmt, since=midnight ICT)       → .scalar_one()
    4. the email window                                  → .scalars().all()
    5. the manual window (only when the filter admits manual rows) → .all()
    6. username_map over those manual rows (only when one carries a user id)
       → .mappings().all(); `usernames` is {carmen_user_id: username}

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
        g for s, n in (statuses or {}).items() for g in _group(s, None, (n, 0, 0))
    ] + [g for (s, rc), v in (pairs or {}).items() for g in _group(s, rc, v)]
    counted = MagicMock()
    counted.scalar_one.return_value = manual_count
    counted_today = MagicMock()
    counted_today.scalar_one.return_value = manual_today
    email_window = MagicMock()
    email_window.scalars.return_value.all.return_value = emails
    manual_window = MagicMock()
    manual_window.all.return_value = manuals

    # Sixth and last: `username_map`, resolving the scanners of whatever manual rows came
    # back. Always supplied, never always consumed — the handler only asks when a manual row
    # actually carries a `carmen_user_id`, and an unconsumed side_effect entry is harmless.
    names = MagicMock()
    names.mappings.return_value.all.return_value = [
        SimpleNamespace(carmen_user_id=k, username=v) for k, v in (usernames or {}).items()
    ]

    db.execute.side_effect = [
        grouped,
        counted,
        counted_today,
        email_window,
        manual_window,
        names,
    ]
    if seen is not None:
        db.get.return_value = SimpleNamespace(seen=seen)
    return db


def _chip_of(status, reason_code):
    """The test suite's reading of `_chip_expr`, which the mock DB never runs.

    Deliberately written as prose the other file can be checked against rather than imported
    from it: a fixture that shares the implementation it is testing proves nothing about it.

    **No `dismissed` argument since §18.** Dismissal stopped deciding the bucket when
    `_wants_a_human` narrowed to `pending_review`; it only quietens `_attention` now, which
    is what keeps the migration's back-dated pile from shouting. That is also why `_group`
    produces one row where it used to produce two.
    """
    if status == "posted":
        return "success"
    if status == PENDING:
        return "review"
    if status == "skipped":
        return "noise" if reason_code in NOISE_REASONS else "unposted"
    return "unposted"


def _group(status, reason_code, value):
    """The GROUP BY row one (status, reason_code) produces.

    **One row, always.** It used to be two when a group was partly dismissed, because the
    real query groups by chip and dismissal decided the chip. It no longer does, so Postgres
    now returns a single row carrying `dismissed` as a filtered sub-count.

    `value` is `(n, stuck, noted)` plus two optionals: how many of that group arrived today
    and how many have been put away. Absent means none, which is what every test written
    before either existed wants.
    """
    n, stuck, noted = value[0], value[1], value[2]
    return [
        SimpleNamespace(
            chip=_chip_of(status, reason_code),
            status=status,
            reason_code=reason_code,
            n=n,
            stuck=stuck,
            noted=noted,
            today=value[3] if len(value) > 3 else 0,
            dismissed=value[4] if len(value) > 4 else 0,
        )
    ]


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
            ("skipped", "no_rule_match"): (46, 0, 0),
            ("skipped", "wrong_pdf_password"): (12, 0, 0),
            ("failed", "carmen_rejected"): (3, 0, 0),
            ("rejected", "rejected_by_reviewer"): (2, 0, 0),
            ("pending_review", None): (4, 0, 0),
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
    and inside the refund boundary — and those are a crash, which is exactly what the dot is
    for. So the noise arm reads the status as well as the reason."""
    db = _db(
        pairs={
            ("skipped", "unreadable_document"): (9, 0, 0),
            ("failed", "unreadable_document"): (2, 0, 0),
        },
        manual_count=0,
        emails=[],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        body = client.get(BASE, headers=AUTH).json()

    assert body["counts"]["noise"] == 9
    assert body["counts"]["unposted"] == 2
    assert body["attention"]["unposted"] == 2  # the crash still shouts


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
            ("skipped", "wrong_pdf_password"): (11, 0, 0),
            ("skipped", "sender_not_allowed"): (4, 0, 0),
            ("failed", "carmen_rejected"): (3, 0, 0),
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


def test_the_noise_is_still_in_the_log():
    """Suppressing `no_rule_match` is only safe because `all` still has it. A BU whose
    filename pattern is too narrow finds the statements it dropped there — which is the
    failure the reason code was introduced to make visible in the first place."""
    db = _db(
        pairs={("skipped", "no_rule_match"): (7, 0, 0)},
        manual_count=0,
        emails=[_email(status="skipped", reason_code="no_rule_match", review_payload=None)],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        body = client.get(f"{BASE}?filter=all", headers=AUTH).json()

    assert [r["reason_code"] for r in body["data"]] == ["no_rule_match"]
    assert body["total"] == 7  # the log's own size, which is `counts["all"]`
    assert body["counts"]["review"] == 0
    assert body["counts"]["unposted"] == 0


def test_attention_marks_the_machine_misbehaving_not_the_work():
    """The dot means "something is off", not "there is work here" — `review` holds work by
    definition now, so a dot drawn from its size would be lit whenever the feature was doing
    its job. A reviewer's own rejection is not an anomaly either."""
    db = _db(
        pairs={
            ("skipped", "no_rule_match"): (46, 0, 0),
            ("skipped", "wrong_pdf_password"): (12, 0, 0),
            ("failed", "carmen_rejected"): (3, 0, 0),
            ("rejected", "rejected_by_reviewer"): (2, 0, 0),
            ("pending_review", None): (5, 0, 0),
            ("pending_review", "tax_id_mismatch"): (4, 0, 0),
        },
        manual_count=0,
        emails=[],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        body = client.get(BASE, headers=AUTH).json()

    # The 4 that stopped on a problem. The 5 waiting for a plain OK are the feature working.
    assert body["attention"]["review"] == 4
    # 3 Carmen refusals + the 12 the password stopped. **The cause scores onto the chip that
    # draws it**, not onto its own bucket — a dot has to sit where the reader can act on it.
    # The 46 the filename rules threw out are those rules working, and the 2 rejections were
    # somebody's decision.
    assert body["attention"]["unposted"] == 15
    assert body["attention"]["all"] == 19
    # And the plain counts are untouched by any of it.
    assert body["counts"]["review"] == 9
    # 3 Carmen refusals + 2 rejections + the 12 the password stopped.
    assert body["counts"]["unposted"] == 17
    assert body["counts"]["noise"] == 46


def test_a_dismissed_row_stops_lighting_the_dot():
    """ "Seen" was never "fixed", but "put away" is answered — and a row that has been
    answered has nothing left to say. Nothing sets `dismissed_at` any more; what this keeps
    quiet is the pile the 2026-09-03 migration back-dated."""
    db = _db(
        pairs={("skipped", "wrong_pdf_password"): (46, 0, 0, 0, 46)},
        manual_count=0,
        emails=[],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        body = client.get(BASE, headers=AUTH).json()

    assert body["counts"]["unposted"] == 46
    assert body["attention"]["unposted"] == 0


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

    assert attention == {"review": 0, "success": 0, "unposted": 0, "noise": 0, "all": 0}


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
    see the two as one thing and rejects `dismissed_at` inside the SELECT's CASE with
    "must appear in the GROUP BY clause". Grouping by the output column's name renders the
    CASE once, and Postgres resolves a bare name in GROUP BY against the output columns.

    **Compiled with real bind parameters, deliberately.** Under `literal_binds` the two
    renderings come out textually identical and the statement is perfectly valid — which is
    exactly how this shipped: every compiled-SQL assertion here inlined its binds, and the
    mock DB below never executes anything.
    """
    sql = str(_counts_stmt(uuid.uuid4(), NOW, NOW).compile()).lower()
    assert sql.count("case") == 1, "the CASE is rendered twice — see the docstring"
    assert "group by chip" in sql


# ── The dot, and what puts it out ────────────────────────────────────────────


def test_a_chip_someone_already_opened_has_no_dot():
    """The whole point: nothing retries a failure, so 49 dead documents would light the dot
    for ever. The mark is what ends that — and it ends only the dot, never the count, which
    still sizes the pile for the sentence a screen reader speaks."""
    db = _db(
        pairs={("pending_review", "tax_id_mismatch"): (49, 0, 0)},
        manual_count=0,
        emails=[],
        manuals=[],
        seen={"review": 49},
    )
    with make_test_client(db, session=SESSION) as client:
        body = client.get(BASE, headers=AUTH).json()

    assert body["unseen"]["review"] is False
    assert body["attention"]["review"] == 49
    assert body["counts"]["review"] == 49


def test_a_newer_anomaly_brings_the_dot_back():
    """A mark is a high-water line, not an off switch."""
    db = _db(
        pairs={("pending_review", "tax_id_mismatch"): (50, 0, 0)},
        manual_count=0,
        emails=[],
        manuals=[],
        seen={"review": 49},
    )
    with make_test_client(db, session=SESSION) as client:
        assert client.get(BASE, headers=AUTH).json()["unseen"]["review"] is True


def test_opening_one_chip_does_not_silence_another():
    """A mark per chip, not one for the queue. Looking at the failures says nothing about
    a JV that posted without its input-tax record."""
    db = _db(
        pairs={
            ("pending_review", "tax_id_mismatch"): (49, 0, 0),
            ("posted", None): (20, 0, 2),
        },
        manual_count=0,
        emails=[],
        manuals=[],
        seen={"review": 49},
    )
    with make_test_client(db, session=SESSION) as client:
        unseen = client.get(BASE, headers=AUTH).json()["unseen"]

    assert unseen["review"] is False
    assert unseen["success"] is True


def test_the_log_chip_carries_no_dot():
    """`all` is a view over the other chips, so a dot on it would only repeat theirs — and
    it could never be put out, because `mark_chip_seen` refuses to store a mark for anything
    that is not a status chip. Same rule as `today`, and the reason `unseen` is keyed off
    `STATUS_CHIPS` rather than off `attention`, which does carry an `all` entry."""
    db = _db(
        pairs={("failed", "carmen_rejected"): (3, 0, 0)},
        manual_count=0,
        emails=[],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        body = client.get(BASE, headers=AUTH).json()

    assert "all" not in body["unseen"]
    assert "causes" not in body["unseen"]
    assert "noise" not in body["unseen"]
    assert body["unseen"]["unposted"] is True


def test_a_business_unit_that_has_never_looked_sees_every_dot():
    """No row is not an error — it is the first visit."""
    db = _db(
        pairs={("pending_review", "tax_id_mismatch"): (49, 0, 0)},
        manual_count=0,
        emails=[],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        assert client.get(BASE, headers=AUTH).json()["unseen"]["review"] is True


def test_marking_a_chip_seen_stores_the_count_the_server_computed():
    """Never the caller's number: a client is free to be wrong, and one bad value would
    silence that BU's dot for good."""
    db = _db(
        pairs={("pending_review", "tax_id_mismatch"): (49, 0, 0)},
        manual_count=0,
        emails=[],
        manuals=[],
    )
    with make_test_client(db, session=SESSION) as client:
        res = client.post(f"{BASE}/seen", headers=AUTH, json={"filter": "review", "seen": 0})

    assert res.status_code == 200
    assert res.json() == {"filter": "review", "seen": 49}
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
        seen={"review": 49},
    )
    with make_test_client(db, session=SESSION) as client:
        client.post(f"{BASE}/seen", headers=AUTH, json={"filter": "success"})

    assert db.get.return_value.seen == {"review": 49, "success": 2}


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
