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
what the dot means now). Where a row came from is no longer a column of its own —
`MANUAL_FILTERS` below is why.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
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

# Filter chip → the ledger statuses under it. Three of the four, and the reader's question
# is what splits them — not the pipeline's vocabulary (the fourth, `today`, is below):
#
#   review    needs a human now — the only chip with anything to decide
#   success   reached Carmen. Manual scans land here too; they are only ever listed
#             once they have posted.
#   unposted  did not become a JV, whatever the cause.
#
# `failed` and `skipped` used to be two chips. That split is `status = "skipped" if charged
# is None else "failed"` (email_ingest_service.py) — whether a credit was charged — and a
# reader has no way to guess it: both words mean "it did not post". Worse, every
# customer-clearable cause lands under `skipped`, the one the old comment here called
# "mostly noise". One chip, and the row's Message says which of the seven causes it is.
FILTERS: dict[str, tuple[str, ...]] = {
    "review": ("pending_review",),
    "success": ("posted",),
    "unposted": ("failed", "rejected", "skipped", "received"),
}

# The fourth chip, and the only one that is not a selection of statuses. `today` is a
# *window* over all three — what the robot did since midnight, whatever came of it — so it
# cannot live in FILTERS without giving that map two kinds of value. It is a documented
# special case in the three places that care, rather than a rewrite of FILTERS into
# predicates for one member.
#
# Deliberately unfiltered: a day on which the BU's own filename rules threw out forty
# signature logos is a fact worth being able to see. The noise argument that pulled `all`
# off the strip (§11 #33) was about the *landing* view, and this is not it — the page still
# opens on `review`/`success`.
TODAY = "today"

# The strip, in the order it draws. `all` is in neither: it remains the API default and
# `counts["all"]`, and has no chip.
CHIPS = (TODAY, *FILTERS)

# The BU's midnight, not UTC's. Every tenant on this system keeps Thai books, so a statement
# read at 06:00 ICT belongs to the day the reviewer is having, not to the one UTC is still
# on. Same +07 the daily rollups are cut on — see backend/db/queries.sql.
ICT = timezone(timedelta(hours=7))

# A manual scan is only ever "posted", so among the status chips it belongs to `success`
# alone — but it is still something that happened today, and a queue that hid the BU's own
# scans from its day view would be answering a different question than the one it asks.
MANUAL_FILTERS = ("all", "success", TODAY)

# Reason codes a person in the BU can clear themselves. Its one remaining job is deciding
# which `skipped` rows are an anomaly rather than the BU's own filename rules doing exactly
# what they were written to do — see `_attention`.
#
# Must stay in step with `FIX` in frontend/src/components/credit-card/QueueRow.tsx — that map
# is what renders the Actions button. Nothing can assert the two match across the language
# boundary, so each names the other.
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


def _attention(status: str, reason_code: str | None, n: int, stuck: int, noted: int) -> int:
    """How many rows in this (status, reason_code) group are **anomalous**.

    The dot this feeds means "something is off here", not "you can fix this". It used to
    mean the latter, which made it silent about every failure a person cannot clear — and a
    dot that covers only some anomalies is a dot nobody can read the absence of.

    A lifetime figure, deliberately. Nothing retries a failure, so what puts the dot out is
    the mark in `email_queue_seen` — somebody looking — rather than a clock: this number is
    what the mark is measured against, so it has to count the same things every time.

    - `failed` / `rejected`: all of them. A document that did not post is off regardless of
      who can act on it.
    - `skipped`: only `FIXABLE_REASONS`. A filename rule refusing a file it was written to
      refuse is the system working, and it is the bulk of this bucket.
    - `received`: the stuck ones only. Every row is *claimed* into this state, so age is
      the only thing separating "the pipeline never finished" from "in flight".
    - `posted`: those carrying an `error_message` — the JV reached Carmen but the input-tax
      record did not. Nothing else in the app says so, and the row looks like a success.
    """
    if status in ("failed", "rejected"):
        return n
    if status == "received":
        return stuck
    if status == "posted":
        return noted
    return n if reason_code in FIXABLE_REASONS else 0


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
        )
        .where(EmailDocument.tenant_id == tenant_id)
        .group_by(EmailDocument.status, EmailDocument.reason_code)
    )


async def _per_pair(db: AsyncSession, tenant_id: uuid.UUID) -> dict:
    """The GROUP BY, fetched. Both the list and the mark fold over the same numbers, so
    neither can disagree with the other about what this BU's dot is worth."""
    stmt = _counts_stmt(tenant_id, datetime.now(UTC), _day_start())
    return {
        (r.status, r.reason_code): (r.n, r.stuck, r.noted, r.today)
        for r in (await db.execute(stmt)).all()
    }


def _anomalies(per_pair: dict) -> dict[str, int]:
    """Anomalies per chip — the number the mark is measured against.

    Folds over `FILTERS`, so `today` gets no entry and therefore no dot. That is not an
    omission: `unseen` compares this against a stored lifetime acknowledgement, and a number
    that resets at midnight cannot be measured against yesterday's mark. Today's own count
    is the one number on the strip guaranteed to go down.
    """
    return {
        k: sum(
            _attention(s, rc, n, stuck, noted)
            for (s, rc), (n, stuck, noted, _today) in per_pair.items()
            if s in v
        )
        for k, v in FILTERS.items()
    }


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
    statuses: tuple[str, ...] | None,
    since: datetime | None = None,
):
    stmt = select(EmailDocument).where(EmailDocument.tenant_id == tenant_id)
    if statuses is not None:
        stmt = stmt.where(EmailDocument.status.in_(statuses))
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

    `today` is the one chip that is not a selection of statuses — it is every row since
    midnight ICT, whatever became of it. So it overlaps all three of the others by
    construction, which is why `counts["all"]` is summed **before** it is added: `all` is
    what the page uses to tell a BU that has never had a document from one whose current
    chip is empty, and counting the same row twice would make that number a fiction.

    An unknown filter falls back to `all` rather than 400ing: the query string is a UI
    detail and a stale bookmark — `?filter=skipped` from before the chips merged — should
    land somewhere useful.
    """
    tenant_id = uuid.UUID(str(session.tenant_id))
    if filter not in CHIPS:
        filter = "all"
    # None for `all` and for `today` — neither has a status predicate at all; what makes
    # `today` narrower is `since`.
    statuses = FILTERS.get(filter)
    day_start = _day_start()
    since = day_start if filter == TODAY else None

    email_stmt = _email_stmt(tenant_id, statuses, since)
    manual_stmt = _manual_stmt(tenant_id, since)
    wants_manual = filter in MANUAL_FILTERS

    # Counts span every row, not the page: one GROUP BY for email plus two counts for
    # manual, rather than a round trip per chip. Grouped by (status, reason_code) rather
    # than status alone because `_attention` needs the reason — same single round trip.
    per_pair = await _per_pair(db, tenant_id)
    manual_total = await count_rows(db, _manual_stmt(tenant_id))
    manual_today = await count_rows(db, _manual_stmt(tenant_id, day_start))
    counts = {
        k: sum(n for (s, _), (n, *_) in per_pair.items() if s in v) for k, v in FILTERS.items()
    }
    counts["success"] += manual_total
    counts["all"] = sum(counts.values())
    # After `all`, deliberately — see the docstring. Today is a window over the three chips
    # above it, not a fourth pile beside them.
    counts[TODAY] = sum(t for (_s, _rc), (*_, t) in per_pair.items()) + manual_today

    # How many rows under each chip are wrong in some way — see `_attention` for what that
    # covers and why it is not "what a person can fix". The status chips are three, so a
    # cause nothing points at is a cause nobody finds: that is the 2026-08-28
    # `sender_not_allowed` incident, and `unposted` is where all seven of its siblings live.
    #
    # No `today` key, and therefore no dot on it — see `_anomalies`. Today's rows are all
    # counted under one of the three below, so anything wrong with them is already lit.
    attention = _anomalies(per_pair)
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
    if body.filter not in FILTERS:
        # A trust boundary: the value becomes a key in the stored JSON. `all` and `today`
        # are rejected with the nonsense, deliberately — neither carries a dot, so neither
        # has a mark to store. `today` additionally could not have one: the mark is a
        # lifetime figure and that count resets at midnight.
        raise ValidationError(f"Unknown filter: {body.filter}")

    tenant_id = uuid.UUID(str(session.tenant_id))
    total = _anomalies(await _per_pair(db, tenant_id))[body.filter]

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
