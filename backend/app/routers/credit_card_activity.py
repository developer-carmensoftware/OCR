"""The credit-card activity table — everything that became (or failed to become) a JV.

One list, two sources. `email_review.py` answers "what is the automation holding for me",
which is a strictly smaller question: this endpoint also lists the scans a person did by
hand. The page it feeds is the robot's inbox — what needs a decision — and the manual rows
are there as the count of the work the automation exists to remove, not as history.

It is a separate router rather than another route on `email_review.py` because that file's
whole contract is email documents; a manual scan there would make its docstring a lie.
Everything a *reviewer* does — open, approve, reject — stays there.

Design: docs/email-automation/07-human-in-the-loop.md §6 (the screen), §9 (four tabs folded
into one filtered table), §11 (the column order, and `attention`), §12 (three chips, and
what the dot means now), §13 (the chips re-keyed on who can act, plus `today`). Where a row
came from is no longer a column of its own — `MANUAL_FILTERS` below is why.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import SessionInfo, get_current_session
from app.database import get_db
from app.exceptions import NotFoundError, ValidationError
from app.models.business import CreditCard, OCRTask
from app.models.email_automation import EmailDocument, EmailQueueSeen
from app.models.schemas.email_automation import ActivityPage, ActivityRow, QueueSeenIn, QueueSeenOut
from app.routers.email_review import to_review_row
from app.utils.pagination import count_rows

router = APIRouter(prefix="/api/v1/credit-card", tags=["Credit Card Activity"])

# The three status chips, and the reader's question is what splits them — not the pipeline's
# vocabulary:
#
#   review    wants a human now
#   success   reached Carmen. Manual scans land here too; they are only ever listed
#             once they have posted.
#   unposted  did not become a JV and nothing is owed on it.
#
# `failed` and `skipped` used to be two chips. That split is `status = "skipped" if charged
# is None else "failed"` (email_ingest_service.py) — whether a credit was charged — and a
# reader has no way to guess it: both words mean "it did not post".
#
# **These are no longer a map of statuses**, because "wants a human" stopped being one.
# `review` holds parked documents AND the failures somebody here can clear from settings;
# `unposted` is what is left. §12 of 07-human-in-the-loop.md considered exactly this re-key
# and declined it — *"it costs a vocabulary the API does not speak"* — and the answer to that
# is `_chip_expr` below: the API speaks it now, in one place, so a row's chip is one
# definition rather than one per caller.
STATUS_CHIPS = ("review", "success", "unposted")

PENDING = "pending_review"

# The fourth chip, and the only one that is not about state at all. `today` is a *window*
# over the three above — what the robot did since midnight, whatever came of it.
#
# Deliberately unfiltered: a day on which the BU's own filename rules threw out forty
# signature logos is a fact worth being able to see. The noise argument that pulled `all`
# off the strip (§11 #33) was about the *landing* view, and this is not it — the page still
# opens on `review`/`success`.
TODAY = "today"

# The strip, in the order it draws. `all` is in neither: it remains the API default and
# `counts["all"]`, and has no chip.
CHIPS = (TODAY, *STATUS_CHIPS)

# The BU's midnight, not UTC's. Every tenant on this system keeps Thai books, so a statement
# read at 06:00 ICT belongs to the day the reviewer is having, not to the one UTC is still
# on. Same +07 the daily rollups are cut on — see backend/db/queries.sql.
ICT = timezone(timedelta(hours=7))

# A manual scan is only ever "posted", so among the status chips it belongs to `success`
# alone — but it is still something that happened today, and a queue that hid the BU's own
# scans from its day view would be answering a different question than the one it asks.
MANUAL_FILTERS = ("all", "success", TODAY)

# Reason codes a person in the BU can clear themselves. This is now what decides chip
# membership for a row that did not post: one of these, undismissed, means somebody here can
# still act, and `review` is where the things that want a person live.
#
# Must stay in step with `FIX` in frontend/src/lib/reviewReasons.ts — that map is what
# renders the link. Nothing can assert the two match across the language boundary, so each
# names the other.
FIXABLE_REASONS = (
    "mapping_incomplete",
    "carmen_unauthorized",
    "no_rule_match",
    "sender_not_allowed",
    "wrong_pdf_password",
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
    """The `review` chip's predicate: the two kinds of row that are somebody's job.

    A parked document — a decision to take, and since a refusal that came after a paid-for
    extraction parks rather than finishing, that includes most of what used to be `failed`.
    And a row nobody was charged for but somebody here can still clear from settings, until
    they put it away: filing those under the chip §12 itself calls the one nobody works is
    how eight `sender_not_allowed` rows cost a day of diagnosis on 2026-08-28.

    `coalesce` is load-bearing. `NULL IN (...)` is NULL, not false, so without it the
    negation this predicate is put through for `unposted` evaluates to NULL for every row
    with no reason code — silently dropping every `received` row out of both chips.
    """
    return or_(
        EmailDocument.status == PENDING,
        and_(
            func.coalesce(EmailDocument.reason_code, "").in_(FIXABLE_REASONS),
            EmailDocument.dismissed_at.is_(None),
        ),
    )


def _chip_expr():
    """Which chip a row is in, as SQL — **the only definition there is.**

    The list filters on it and the counts group by it, so a row cannot be counted under one
    chip and listed under another. The alternative was this rule written twice, once as a
    WHERE clause and once as a Python fold over the GROUP BY, and the two drifting is the
    bug this shape cannot have.

    Exactly one chip per row. `counts["all"]` is their sum, so an overlap would make that
    number a fiction — which is the same reason `today` is left out of it.

    ponytail: a CASE in the WHERE clause cannot use an index. Correct at this repo's volumes
    (largest business table holds 342 rows — docs/SQL_PERFORMANCE_AUDIT.md); if a BU ever
    grows into it, expand the CASE back into three explicit clauses keyed off this function
    so there is still one place to read.
    """
    return case(
        (EmailDocument.status == "posted", "success"),
        (_wants_a_human(), "review"),
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
    - `skipped`: `FIXABLE_REASONS` that nobody has put away. A filename rule refusing a file
      it was written to refuse is the system working, and a dismissed row has been answered.
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
    return g.n - g.dismissed if g.reason_code in FIXABLE_REASONS else 0


def _manual_row(card: CreditCard, task: OCRTask) -> ActivityRow:
    """A submitted manual scan, as a row of the same shape an email document produces.

    Timestamped by `submitted_at`, not `created_at`: the moment it became a JV is the only
    one this table is reporting. Drafts (`submitted_at IS NULL`) are excluded entirely —
    an upload someone abandoned mid-wizard is not a notification, they were sitting there.

    The pending-only fields stay at their defaults. There is no payload to summarise and
    nothing waiting on a human, so `total: 0.00` would be a wrong number rather than a
    missing one — the same rule `_summarise` follows for a resolved email document.
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
            # Put away by hand. Only `_attention` reads it — a dismissed row is still under
            # `unposted` and still counted there, it just stops being a reason to shout.
            func.count().filter(EmailDocument.dismissed_at.is_not(None)).label("dismissed"),
        )
        .where(EmailDocument.tenant_id == tenant_id)
        .group_by(_chip_expr(), EmailDocument.status, EmailDocument.reason_code)
    )


async def _groups(db: AsyncSession, tenant_id: uuid.UUID) -> list:
    """The GROUP BY, fetched. Every number on the strip folds over this one list, so no two
    of them can disagree about what this BU has."""
    stmt = _counts_stmt(tenant_id, datetime.now(UTC), _day_start())
    return list((await db.execute(stmt)).all())


def _anomalies(groups: list) -> dict[str, int]:
    """Anomalies per chip — the number the mark is measured against.

    Keyed off `STATUS_CHIPS`, so `today` gets no entry and therefore no dot. That is not an
    omission: `unseen` compares this against a stored lifetime acknowledgement, and a number
    that resets at midnight cannot be measured against yesterday's mark. Today's own count
    is the one number on the strip guaranteed to go down.
    """
    out = dict.fromkeys(STATUS_CHIPS, 0)
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

    `all` remains the API default and is **not a chip** — it has no tab on the screen. It
    survives because `counts["all"]` is how the page tells a BU that has never had a
    document from one that has: the difference between the sales screen and an empty table.
    What the page opens on is `review`, or `success` when the BU has switched review off
    (see `useReviewQueue`) — a BU that auto-posts has nothing in `review` by definition, and
    landing it on a permanently empty chip would hide the work the robot is doing for it.

    `today` is the one chip that is not about state — it is every row since midnight ICT,
    whatever became of it. So it overlaps all three of the others by construction, which is
    why `counts["all"]` is summed **before** it is added: `all` is what the page uses to
    tell a BU that has never had a document from one whose current chip is empty, and
    counting the same row twice would make that number a fiction. The three status chips
    themselves never overlap — `_chip_expr` gives each row exactly one.

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
    counts = dict.fromkeys(STATUS_CHIPS, 0)
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
    seen = await _seen(db, tenant_id)
    unseen = {k: v > seen.get(k, 0) for k, v in attention.items()}

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
        rows += [_manual_row(card, task) for card, task in manuals]
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


@router.post("/activity/{document_id}/dismiss", status_code=204)
async def dismiss_row(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """Put a row away: it leaves the Review chip and stays in Not posted.

    The Review chip holds everything that wants a human, which includes failures a person
    can clear from settings. Nothing retries those, so fixing the filename rule today never
    clears the rows behind it — without a way to put one away, the chip fills with dead rows
    until nobody can find the live ones, and its number stops being able to go down.

    **Only a row with no `review_payload`.** A parked document has the audited verb for this
    already: Reject stamps the reviewer and takes a reason. Two ways to retire a real
    document, with different audit trails, is worse than one — so this refuses them rather
    than offering a quieter alternative.

    Not found and not yours are the same answer, as everywhere else in this feature.
    Dismissing a dismissed row is a no-op rather than a 409: the outcome the caller wanted
    is the outcome that holds, and a double-click is not an error.
    """
    row = await db.get(EmailDocument, document_id)
    if row is None or row.tenant_id != uuid.UUID(str(session.tenant_id)):
        raise NotFoundError("No such document")
    if row.review_payload is not None:
        raise ValidationError("A document waiting for review is rejected, not dismissed")
    if row.dismissed_at is None:
        row.dismissed_at = datetime.now(UTC)  # type: ignore[assignment]
        await db.commit()
