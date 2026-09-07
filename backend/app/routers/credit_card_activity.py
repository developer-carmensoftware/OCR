"""The credit-card activity table — everything that became (or failed to become) a JV.

One list, two sources. `email_review.py` answers "what is the automation holding for me",
which is a strictly smaller question: this endpoint also lists the scans a person did by
hand. The page it feeds is the robot's inbox — what needs a decision — and, under `all`, the
module's log: every attachment ever put in front of the system, so a BU can answer "did my
statement even arrive" without anyone reading the database for them (§14).

It is a separate router rather than another route on `email_review.py` because that file's
whole contract is email documents; a manual scan there would make its docstring a lie.
Everything a *reviewer* does — open, approve, reject — stays there.

Design: docs/email-automation/07-human-in-the-loop.md §6 (the screen), §9 (four tabs folded
into one filtered table), §11 (the column order, and `attention`), §12 (three chips, and
what the dot means now), §13 (the chips re-keyed on who can act, plus `today`), §14 (`all`
back on the strip, and Posted/Not posted narrowed to what a credit was spent on). Where a row
came from is no longer a column of its own — `MANUAL_FILTERS` below is why.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, case, func, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import SessionInfo, get_current_session
from app.database import get_db
from app.exceptions import ValidationError
from app.models.business import CreditCard, OCRTask
from app.models.email_automation import EmailDocument, EmailQueueSeen
from app.models.schemas.email_automation import (
    ActivityPage,
    ActivityRow,
    QueueSeenIn,
    QueueSeenOut,
)
from app.routers.email_review import to_review_row
from app.services.tenant_lookup import username_map
from app.utils.pagination import count_rows

router = APIRouter(prefix="/api/v1/credit-card", tags=["Credit Card Activity"])

# The three status chips, and the reader's question is what splits them — not the pipeline's
# vocabulary:
#
#   review    a document waiting for somebody's decision
#   success   reached Carmen. Manual scans land here too; they are only ever listed
#             once they have posted.
#   unposted  it did not become a JV — every failure, rejection and clearable refusal,
#             one row per attachment.
#
# `failed` and `skipped` used to be two chips. That split is `status = "skipped" if charged
# is None else "failed"` (email_ingest_service.py) — whether a credit was charged — and a
# reader has no way to guess it: both words mean "it did not post".
#
# **These are not a map of statuses.** §13 re-keyed them on *who can act*, which put every
# clearable cause on `review` — right about where the attention belonged, wrong about the
# volume: 46 signature logos buried the nine statements the chip is named for. §18 removes
# the volume at the source (`NOISE_REASONS`) instead of re-filing it, which leaves `review`
# holding documents and `unposted` holding everything that did not become one.
STATUS_CHIPS = ("review", "success", "unposted")

# The one bucket with no chip of its own, and what puts a row in it is **volume** — not the
# charge §14 used, and not who can act (§18).
#
# `NOISE_REASONS` fire per *attachment* on mail that was legitimately this BU's: the
# signature logo, the summary PDF inside every bank zip. 97 of one dev BU's 140 rows. Nothing
# on the status chips and no dot.
#
# The other pre-charge refusals — a wrong PDF password, an unregistered sender, a file type
# we cannot read — are **ordinary rows under `unposted`**, listed one per attachment like
# every other row in the table. They were briefly folded into one row per cause; see §18 #86
# for why that came out again.
#
# The noise is not hidden either: `today` and `all` list it in place, and `all` exists
# precisely so the page can still answer "did my statement even arrive" (§14 #65). That is
# what makes suppressing `no_rule_match` safe — a BU whose filename pattern is too narrow can
# still find the statements it dropped, which is the failure the reason code was introduced
# to make visible in the first place.
NOISE = "noise"

# Every row is in exactly one of these. `counts["all"]` is their sum, which is why the
# chipless bucket has to be in the dict even though nothing filters on it.
LEDGER_BUCKETS = (*STATUS_CHIPS, NOISE)

PENDING = "pending_review"

# The fourth chip, and the only one that is not about state at all. `today` is a *window*
# over the three above — what the robot did since midnight, whatever came of it.
#
# Deliberately unfiltered: a day on which the BU's own filename rules threw out forty
# signature logos is a fact worth being able to see. The noise argument that pulled `all`
# off the strip (§11 #33) was about a view a reader is *stuck* on, and an empty Today is
# never that — `useReviewQueue` falls through it to `review`, and through that to `success`.
TODAY = "today"

# The strip, in the order it draws — `all` last, and it *is* a chip again (§14). It reads as
# the module's log: every attachment this BU has put in front of the system, whatever became
# of it, including the ones nobody was charged for and which therefore appear under no other
# chip. `all` is still the API default, and still what `counts["all"]` answers.
CHIPS = (TODAY, *STATUS_CHIPS, "all")

# The BU's midnight, not UTC's. Every tenant on this system keeps Thai books, so a statement
# read at 06:00 ICT belongs to the day the reviewer is having, not to the one UTC is still
# on. Same +07 the daily rollups are cut on — see backend/db/queries.sql.
ICT = timezone(timedelta(hours=7))

# A manual scan is only ever "posted", so among the status chips it belongs to `success`
# alone — but it is still something that happened today, and a queue that hid the BU's own
# scans from its day view would be answering a different question than the one it asks.
MANUAL_FILTERS = ("all", "success", TODAY)

# The `skipped` reasons that fire per *attachment* on mail that was legitimately this BU's.
# One legitimate statement mail carries three signature logos and a summary PDF, so this pile
# grows with successful traffic rather than with anything wrong — which is why the bell has
# always refused to ring for it (`NOTIFIABLE_SKIPS` in email_ingest_service.py: *"a bell that
# cries every morning is a bell nobody reads on the morning it matters"*). The queue said the
# opposite until §18: `no_rule_match` was in the tuple below, so 46 signature logos sat on the
# work chip beside the statements waiting for approval.
#
# **Read only alongside `status == "skipped"`.** `unreadable_document` is also written on
# charged `failed` rows by the generic handler and inside the refund boundary, and those are a
# crash — exactly what `_attention`'s dot exists for (§13 #57).
NOISE_REASONS = ("no_rule_match", "unreadable_document")


# Reason codes worth an amber dot: a cause somebody here can still act on, and which is rare
# enough that pointing at it does not cry wolf. This is **not** a chip predicate any more —
# `_chip_expr` keys the cause rows off `status` alone — so it decides one thing, `_attention`.
#
# It is the queue's half of `NOTIFIABLE_SKIPS`, and the two now agree: `unsupported_attachment`
# rang the bell and then appeared on no chip and lit nothing, which is a notification with
# nowhere to land.
#
# `mapping_incomplete` is kept for the rows that still carry it — nothing has raised it since
# the auto-post gate replaced it (2026-09-04) — and `carmen_unauthorized`/`tax_id_mismatch`
# park as `pending_review` now, where `_attention` reads them off the status instead.
ATTENTION_REASONS = (
    "mapping_incomplete",
    "carmen_unauthorized",
    "sender_not_allowed",
    "wrong_pdf_password",
    "unsupported_attachment",
    "ingest_paused",
    "tax_id_mismatch",
)

# How long a row may sit at `received` before it counts as stuck rather than in flight.
# `received` is the state every row is claimed into — backpressure writes no row at all — so
# one still there long after its poll run means the pipeline never finished it. Generous
# enough that a document being extracted during a poll never flickers a dot on.
STUCK_AFTER = timedelta(hours=1)

# Sorting key for a row whose timestamp is NULL. Aware, because everything it is compared
# against comes back from Postgres aware and Python refuses to order the two together.
_EPOCH = datetime.min.replace(tzinfo=UTC)


def _wants_a_human():
    """The `review` chip's predicate: a parked document, and nothing else.

    §13 widened this to *"plus any undismissed fixable reason"*, to stop the seven
    clearable causes being filed under the chip §12 itself called the one nobody works —
    the 2026-08-28 `sender_not_allowed` incident in UI form. That was the right fix for the
    wrong shape: it put a *cause* (one setting, forty rows) on a chip that lists *documents*
    (one decision each), and `no_rule_match` came with it at 46 rows on the dev DB.

    §18 keeps the protection and drops the widening. Those rows are still pointed at, and on
    a chip a person reads: they sit under `unposted` carrying `Open settings` and the amber
    dot (`ATTENTION_REASONS` via `_anomalies`), so nothing is buried by narrowing this back
    to what the word on the chip says.

    Since #22 every charged refusal parks as `pending_review`, so the reason codes that used
    to need the second arm are read off the status here anyway.
    """
    return EmailDocument.status == PENDING


def _chip_expr():
    """Which ledger bucket a row is in, as SQL — **the only definition there is.**

    Three of the four are chips. `NOISE` is not: it cannot be passed as a `filter`, and is
    reachable only under `today` and `all`.

    The list filters on it and the counts group by it, so a row cannot be counted under one
    chip and listed under another. The alternative was this rule written twice, once as a
    WHERE clause and once as a Python fold over the GROUP BY, and the two drifting is the
    bug this shape cannot have.

    Exactly one bucket per row. `counts["all"]` is their sum, so an overlap would make that
    number a fiction — which is the same reason `today` is left out of it.

    **`status == "skipped"` is the pre-charge marker**, which is what the last two arms split
    between them. `_park_or_finish` writes `status = "skipped" if charged is None else
    "failed"`, and every other writer of that status (`_skip_all`, the pre-charge `_Skip`s in
    `_open_or_fail` and the gate ladder) sits upstream of `consume_document()`.

    §14 split on that marker alone, on the grounds that a BU should not be shown a signature
    logo as *"a document that did not post"*. True of the logo; false of the wrong PDF
    password sitting beside it, which the same arm then buried. **The split that was wanted is
    `NOISE_REASONS`, not the charge** — so the reason code decides, and the charge is left to
    say what it actually says, which is a billing fact and not a reader's question. What the
    noise arm does not claim falls to `unposted` and is listed there like any other row.

    A stuck `received` row falls to `unposted` on purpose. Its charge is genuinely unknown
    (the pipeline died between the claim and `_finish`), it certainly did not post, and it is
    the one row that says the machine stopped mid-document — `_attention`'s `stuck` dot needs
    a chip to sit on, and `all` deliberately has none.

    A `skipped` row whose `reason_code` is NULL falls to `unposted` with the rest:
    `NULL IN (...)` is NULL, so the noise arm cannot claim it, and an unexplained skip is
    exactly the row a reader should be shown.

    ponytail: a CASE in the WHERE clause cannot use an index. Correct at this repo's volumes
    (largest business table holds 342 rows — docs/SQL_PERFORMANCE_AUDIT.md); if a BU ever
    grows into it, expand the CASE back into explicit clauses keyed off this function so
    there is still one place to read.
    """
    return case(
        (EmailDocument.status == "posted", "success"),
        (_wants_a_human(), "review"),
        (
            and_(
                EmailDocument.status == "skipped",
                EmailDocument.reason_code.in_(NOISE_REASONS),
            ),
            NOISE,
        ),
        else_="unposted",
    )


def _attention(g) -> int:
    """How many rows in this group are **anomalous**.

    The dot this feeds means "something is off here", not "you can fix this" — a dot that
    covers only the fixable ones is a dot nobody can read the absence of. And not "there is
    work here" either: that is what the chip's own count says, and the two would be the same
    number on a chip whose whole job is holding work.

    A lifetime figure, deliberately. Nothing retries a failure, so what puts the dot out is
    the mark in `email_queue_seen` — somebody looking — rather than a clock: this number is
    what the mark is measured against, so it has to count the same things every time.

    - `pending_review`: only the ones carrying a `reason_code`. A statement waiting for an
      OK is the feature working; one that *stopped* on a foreign tax ID or a Carmen refusal
      is not, even though both now sit in the same chip.
    - `failed`: all of them. Since a charged refusal parks, what is left here is a crash
      inside the refund boundary, an unhandled bug, or a second copy of something already
      queued — the machine misbehaving, which is exactly what the dot is for.
    - `rejected`: none. A reviewer's own decision is not an anomaly, and a signal you set
      off by doing your job is one you learn to ignore.
    - `skipped`: `ATTENTION_REASONS` that nobody has put away. A filename rule refusing a file
      it was written to refuse is the system working, and a dismissed row has been answered.
      `NOISE_REASONS` are absent from that tuple, so the noise bucket scores zero without
      needing a case of its own.
    - `received`: the stuck ones only. Every row is *claimed* into this state, so age is
      the only thing separating "the pipeline never finished" from "in flight".
    - `posted`: those carrying an `error_message` — the JV reached Carmen but the input-tax
      record did not. Nothing else in the app says so, and the row looks like a success.
    """
    if g.status == PENDING:
        return g.n if g.reason_code else 0
    if g.status == "failed":
        return g.n
    if g.status == "rejected":
        return 0
    if g.status == "received":
        return g.stuck
    if g.status == "posted":
        return g.noted
    return g.n - g.dismissed if g.reason_code in ATTENTION_REASONS else 0


def _manual_row(card: CreditCard, task: OCRTask, name: str | None) -> ActivityRow:
    """A submitted manual scan, as a row of the same shape an email document produces.

    Timestamped by `submitted_at`, not `created_at`: the moment it became a JV is the only
    one this table is reporting. Drafts (`submitted_at IS NULL`) are excluded entirely —
    an upload someone abandoned mid-wizard is not a notification, they were sitting there.

    The pending-only fields stay at their defaults. There is no payload to summarise and
    nothing waiting on a human, so `total: 0.00` would be a wrong number rather than a
    missing one — the same rule `_summarise` follows for a resolved email document.

    `name` is the scanner, already resolved in bulk by the caller — see `posted_by_name`.
    """
    return ActivityRow(
        id=str(card.id),
        source="manual",
        created_at=card.submitted_at,
        attachment=task.original_filename,
        status="posted",
        bank_code=card.bank_code,
        doc_no=card.doc_no,
        jv_no=card.jv_no,
        posted_by_name=name,
    )


def _day_start() -> datetime:
    """Midnight ICT of the day the reader is having. Aware, so Postgres compares it against
    a `timestamptz` column without either side guessing at a zone."""
    return datetime.now(ICT).replace(hour=0, minute=0, second=0, microsecond=0)


def _counts_stmt(tenant_id: uuid.UUID, now: datetime, day_start: datetime):
    """Every chip's count and every chip's anomalies, in one GROUP BY.

    The status counts span the tenant's whole history. The only clocks are `STUCK_AFTER`
    and `day_start`, and neither is a staleness policy: `received` carries no reason code,
    so age is the sole thing telling a document being extracted right now from one the
    pipeline abandoned, and `day_start` is the Today chip's whole definition. What stops the
    dot being permanently lit is the mark in `email_queue_seen`, not a window here — a
    window was tried (`ATTENTION_WINDOW`, 7 days) and was only ever a guess about how long
    somebody stays interested.
    """
    # **Grouped by the output column's name, never by the expression again.**
    #
    # `GROUP BY <the CASE>` looks like the obvious way to write this and does not work:
    # SQLAlchemy renders the expression a second time with a *fresh set of bind parameters*
    # ($10..$15 where the SELECT used $1..$6), so Postgres cannot see the two as the same
    # thing and rejects `dismissed_at` inside the SELECT's CASE as an ungrouped column.
    #
    # Postgres resolves a bare name in GROUP BY against the output columns when no input
    # column shares it, and `email_documents` has no `chip`. One rendering, one meaning.
    #
    # This is invisible to `literal_binds` compilation — with the values inlined the two
    # CASEs come out textually identical and the statement is valid — so a compiled-SQL
    # test must assert the CASE appears exactly once, which is what
    # `test_the_chip_is_grouped_by_name_not_by_a_second_case` does.
    return (
        select(
            # The chip comes out of the database, not out of a Python fold beside it — see
            # `_chip_expr`. Grouping by it as well as by (status, reason_code) is what lets
            # the counts and the list agree by construction.
            _chip_expr().label("chip"),
            EmailDocument.status,
            EmailDocument.reason_code,
            func.count().label("n"),
            # Claimed and never finished. Age is the only thing separating it from a
            # document being read during this very poll.
            func.count().filter(EmailDocument.created_at < now - STUCK_AFTER).label("stuck"),
            func.count().filter(EmailDocument.error_message.is_not(None)).label("noted"),
            # The Today chip, as one more aggregate over the GROUP BY that was already
            # running. A second round trip for a number this cheap would be the only query
            # on the page that pays for its own answer.
            func.count().filter(EmailDocument.created_at >= day_start).label("today"),
            # Put away by hand. `_attention` reads it — a dismissed row is still counted in
            # Put away by hand, back when a row could be. Only `_attention` reads it now —
            # a dismissed row is still counted in its bucket, it just stops being a reason to
            # shout — and that is what keeps the migration's back-dated pile quiet.
            func.count().filter(EmailDocument.dismissed_at.is_not(None)).label("dismissed"),
        )
        .where(EmailDocument.tenant_id == tenant_id)
        .group_by(literal_column("chip"), EmailDocument.status, EmailDocument.reason_code)
    )


async def _groups(db: AsyncSession, tenant_id: uuid.UUID) -> list:
    """The GROUP BY, fetched. Every number on the strip folds over this one list, so no two
    of them can disagree about what this BU has."""
    stmt = _counts_stmt(tenant_id, datetime.now(UTC), _day_start())
    return list((await db.execute(stmt)).all())


def _anomalies(groups: list) -> dict[str, int]:
    """Anomalies per chip — the number the mark is measured against.

    Keyed off `LEDGER_BUCKETS`, so `today` gets no entry and therefore no dot. That is not an
    omission: `unseen` compares this against a stored lifetime acknowledgement, and a number
    that resets at midnight cannot be measured against yesterday's mark. Today's own count
    is the one number on the strip guaranteed to go down.

    `NOISE` gets an entry and it is always zero, without a special case: `NOISE_REASONS` are
    absent from `ATTENTION_REASONS`, so `_attention` already returns 0 for every row in it.
    It is summed into `all` like the rest rather than being excluded, so the arithmetic stays
    one rule.
    """
    out = dict.fromkeys(LEDGER_BUCKETS, 0)
    for g in groups:
        out[g.chip] += _attention(g)
    return out


async def _seen(db: AsyncSession, tenant_id: uuid.UUID) -> dict[str, int]:
    """What this BU has already been shown, chip → count.

    `db.get`, not a `select` — the mock DB in the tests stubs `db.get` to None and drives
    `db.execute` by a positional `side_effect`, so reading this with `execute` would shift
    every other call in the handler by one.
    """
    row = await db.get(EmailQueueSeen, tenant_id)
    return dict(row.seen or {}) if row else {}


def _email_stmt(
    tenant_id: uuid.UUID,
    chip: str | None,
    since: datetime | None = None,
):
    """The window, filtered by the same expression the counts group by.

    `chip` is None for `all` and for `today` — neither selects on state; what narrows
    `today` is `since`.

    **No per-cause window.** A cause is one row that says what it stopped and names a few of
    them; there is no expansion to fetch, because a list a reader has to open is a list they
    do not read, and what clears a cause is a setting rather than any of the rows behind it.
    Every one of those attachments is under `all` in time order, like all the others.
    """
    stmt = select(EmailDocument).where(EmailDocument.tenant_id == tenant_id)
    if chip is not None:
        stmt = stmt.where(_chip_expr() == chip)
    if since is not None:
        stmt = stmt.where(EmailDocument.created_at >= since)
    return stmt.order_by(EmailDocument.created_at.desc())


def _manual_stmt(tenant_id: uuid.UUID, since: datetime | None = None):
    """Manual scans only — the anti-join is what makes that true.

    Email ingestion calls the same `finalize_extraction` the wizard does, so every ingested
    document ALSO has a `credit_cards` row. Without the NOT EXISTS below, one forwarded
    statement appears twice: once as Email and once as Manual.
    """
    ingested = select(EmailDocument.id).where(EmailDocument.task_id == CreditCard.task_id).exists()
    stmt = (
        select(CreditCard, OCRTask)
        .join(OCRTask, OCRTask.id == CreditCard.task_id)
        .where(
            CreditCard.tenant_id == tenant_id,
            CreditCard.deleted_at.is_(None),
            CreditCard.submitted_at.is_not(None),
            ~ingested,
        )
    )
    if since is not None:
        # `submitted_at`, not `created_at`: the row is timestamped by the moment it became a
        # JV (see `_manual_row`), so that is the moment Today has to be asking about.
        stmt = stmt.where(CreditCard.submitted_at >= since)
    return stmt.order_by(CreditCard.submitted_at.desc())


@router.get("/activity", response_model=ActivityPage)
async def list_activity(
    filter: str = Query("all", description="all | today | review | success | unposted"),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """This BU's credit-card documents from both sources, newest first.

    `all` is the API default and is the module's **log**: no status predicate at all, so it
    is the only view that shows every attachment that ever arrived, noise included (§14).
    `counts["all"]` is also how the page tells a BU that has never had a document from one
    that has — the difference between the sales screen and an empty table. What the page
    opens on is `today`, falling through to `review` and then to `success` — the first chip
    with anything in it (see `useReviewQueue`). Every chip's count travels with this response
    precisely so that decision costs no extra round trip on a day that has something in it.

    `today` is the one chip that is not about state — it is every row since midnight ICT,
    whatever became of it. So it overlaps all of the others by construction, which is why
    `counts["all"]` is summed **before** it is added: counting the same row twice would make
    that number a fiction. The five ledger buckets themselves never overlap — `_chip_expr`
    gives each row exactly one, and three of them have a chip.


    An unknown filter falls back to `all` rather than 400ing: the query string is a UI
    detail and a stale bookmark — `?filter=skipped` from before the chips merged — should
    land somewhere useful.
    """
    tenant_id = uuid.UUID(str(session.tenant_id))
    if filter not in CHIPS:
        filter = "all"
    # None for `all` and for `today` — neither selects on state; what narrows `today` is
    # `since`.
    chip = filter if filter in STATUS_CHIPS else None
    day_start = _day_start()
    since = day_start if filter == TODAY else None

    email_stmt = _email_stmt(tenant_id, chip, since)
    manual_stmt = _manual_stmt(tenant_id, since)
    wants_manual = filter in MANUAL_FILTERS

    # Counts span every row, not the page: one GROUP BY for email plus two counts for
    # manual, rather than a round trip per chip. Grouped by chip AND (status, reason_code),
    # because `_attention` needs the reason — same single round trip.
    groups = await _groups(db, tenant_id)
    manual_total = await count_rows(db, _manual_stmt(tenant_id))
    manual_today = await count_rows(db, _manual_stmt(tenant_id, day_start))
    counts = dict.fromkeys(LEDGER_BUCKETS, 0)
    for g in groups:
        counts[g.chip] += g.n
    counts["success"] += manual_total
    counts["all"] = sum(counts.values())
    # After `all`, deliberately — see the docstring. Today is a window over the three chips
    # above it, not a fourth pile beside them.
    counts[TODAY] = sum(g.today for g in groups) + manual_today

    # How many rows under each chip are wrong in some way — see `_attention` for what that
    # covers, and why it is neither "what a person can fix" nor "how much work is here".
    # The latter matters more now: `review` holds work by definition, so a dot drawn from
    # its size would be lit whenever the feature was doing its job.
    #
    # No `today` key, and therefore no dot on it — see `_anomalies`. Today's rows are all
    # counted under one of the three below, so anything wrong with them is already lit.
    attention = _anomalies(groups)
    attention["all"] = sum(attention.values())

    # …and which of those chips is holding something this BU has not looked at. The count
    # sizes the pile for the screen-reader sentence; this is what lights the dot, so that a
    # failure nobody can retry stops shouting once somebody has actually seen it.
    #
    # **Keyed off `STATUS_CHIPS`, not off `attention`.** `attention` also carries `all` and
    # the two chipless buckets, and iterating it would hand `all` a dot the moment anything
    # anywhere was off — a dot that repeats three others and cannot be put out, since
    # `mark_chip_seen` refuses to store a mark for `all`. Same rule as `today`: a chip that is
    # a view over the others does not get to shout on their behalf.
    seen = await _seen(db, tenant_id)
    unseen = {k: attention[k] > seen.get(k, 0) for k in STATUS_CHIPS}

    # The chip's own size. Every bucket is listed by the chip that counts it, so the Pager
    # can never print a number over a table holding a different pile.
    total = counts[filter]

    # ponytail: merged in Python, not a SQL UNION. Two ordered selects, fetch limit+offset
    # from each, concat, sort, slice. Correct at this repo's volumes (largest business
    # table holds 342 rows — docs/SQL_PERFORMANCE_AUDIT.md) and far more readable than a
    # UNION ALL over two subqueries with hand-aliased columns. Swap it for one if a BU
    # ever pages deep enough for the double-fetch to show up.
    window = limit + offset
    emails = (await db.execute(email_stmt.limit(window))).scalars().all()
    rows = [ActivityRow(**to_review_row(e).model_dump(), source="email") for e in emails]
    if wants_manual:
        manuals = (await db.execute(manual_stmt.limit(window))).all()
        # Who ran each scan. One bulk lookup for the whole window rather than a query per
        # row, and `ocr_sessions` is the only table that has ever held the username — every
        # business table carries the opaque `carmen_user_id` alone. An id it cannot resolve
        # is simply absent from the map, and the row falls back to saying it was scanned by
        # hand without naming anybody; printing a raw UUID at a reader is worse than the
        # vaguer sentence it replaced.
        names = await username_map(db, [c.carmen_user_id for c, _ in manuals])
        rows += [
            _manual_row(card, task, names.get(str(card.carmen_user_id or "")))
            for card, task in manuals
        ]
        rows.sort(key=lambda r: r.created_at or _EPOCH, reverse=True)

    return ActivityPage(
        total=total,
        limit=limit,
        offset=offset,
        data=rows[offset : offset + limit],
        counts=counts,
        attention=attention,
        unseen=unseen,
    )


@router.post("/activity/seen", response_model=QueueSeenOut)
async def mark_chip_seen(
    body: QueueSeenIn,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """Somebody in this BU opened that chip — put its dot out for all of them.

    The count stored is the one **this** request computes, never a number the caller sent:
    a client is free to be wrong, and one bad value would silence that BU's dot for good.

    Anyone with a session for the BU may do it, the same rule approve and auto-post follow.
    That is the point rather than a compromise — the queue is shared, so "has anyone here
    seen this yet" is a fact about the BU and not about a browser or a person.
    """
    if body.filter not in STATUS_CHIPS:
        # A trust boundary: the value becomes a key in the stored JSON. `all` and `today`
        # are rejected with the nonsense, deliberately — neither carries a dot, so neither
        # has a mark to store. `today` additionally could not have one: the mark is a
        # lifetime figure and that count resets at midnight.
        raise ValidationError(f"Unknown filter: {body.filter}")

    tenant_id = uuid.UUID(str(session.tenant_id))
    total = _anomalies(await _groups(db, tenant_id))[body.filter]

    row = await db.get(EmailQueueSeen, tenant_id)
    if row is None:
        # ponytail: read-then-add, so two people opening the same chip in the same second
        # race for the insert and one gets an IntegrityError — a 500 on a UI convenience
        # the browser already swallows. `pg_insert(...).on_conflict_do_update` if it is
        # ever seen. The same idiom `save_settings` uses for its own one-row-per-BU table.
        row = EmailQueueSeen(tenant_id=tenant_id, seen={})
        db.add(row)
    # Replaced, not mutated: SQLAlchemy does not track in-place changes to a JSON column,
    # so `row.seen[k] = v` would commit nothing at all.
    row.seen = {**(row.seen or {}), body.filter: total}
    await db.commit()
    return QueueSeenOut(filter=body.filter, seen=total)
