"""The credit-card activity table — everything that became (or failed to become) a JV.

One list, two sources. `email_review.py` answers "what is the automation holding for me",
which is a strictly smaller question: this endpoint also lists the scans a person did by
hand, so the page reads as the module's whole history rather than as the robot's inbox.

It is a separate router rather than another route on `email_review.py` because that file's
whole contract is email documents; a manual scan there would make its docstring a lie.
Everything a *reviewer* does — open, approve, reject — stays there.

Design: docs/email-automation/07-human-in-the-loop.md §6 (the screen), §9 (four tabs folded
into one filtered table), §11 (the column order, and `attention`). Where a row came from is
no longer a column of its own — `MANUAL_FILTERS` below is why.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import SessionInfo, get_current_session
from app.database import get_db
from app.models.business import CreditCard, OCRTask
from app.models.email_automation import EmailDocument
from app.models.schemas.email_automation import ActivityPage, ActivityRow
from app.routers.email_review import to_review_row
from app.utils.pagination import count_rows

router = APIRouter(prefix="/api/v1/credit-card", tags=["Credit Card Activity"])

# Filter chip → the ledger statuses under it. Three of the four are the old tabs renamed to
# what the row's Status pill says, so a chip and a pill can never disagree:
#
#   review    needs a human now — the only chip with anything to do
#   success   reached Carmen. Manual scans land here too; they are only ever listed
#             once they have posted.
#   failed    did not reach Carmen and somebody should know. `failed` (a gate or Carmen
#             said no) and `rejected` (a human said no) differ in who decided, which the
#             row's Message says — but not in what is now owed.
#   skipped   the BU's own filename and sender rules said "not this file". Free, never
#             charged, mostly noise. Its own chip so it is findable without being in the way.
FILTERS: dict[str, tuple[str, ...]] = {
    "review": ("pending_review",),
    "success": ("posted",),
    "failed": ("failed", "rejected"),
    "skipped": ("skipped", "received"),
}

# A manual scan is only ever "posted", so it belongs to exactly one chip besides `all`.
MANUAL_FILTERS = ("all", "success")

# Reason codes a person in the BU can clear themselves, which is NOT what `status` records:
# `status = "skipped" if charged is None else "failed"` is a billing split, so every one of
# these lands under the chip the comment above calls "mostly noise". Decision #25 learned
# that for the Actions column and left the filter strip alone; `attention` below is the
# other half of the same fix, now that `skipped` has left the default view.
#
# Must stay in step with `FIX` in frontend/src/components/credit-card/QueueRow.tsx — that map
# is what renders the button; this tuple only puts a dot on the chip that hides it. Nothing
# can assert the two match across the language boundary, so each names the other.
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


def _email_stmt(tenant_id: uuid.UUID, statuses: tuple[str, ...] | None):
    stmt = select(EmailDocument).where(EmailDocument.tenant_id == tenant_id)
    if statuses is not None:
        stmt = stmt.where(EmailDocument.status.in_(statuses))
    return stmt.order_by(EmailDocument.created_at.desc())


def _manual_stmt(tenant_id: uuid.UUID):
    """Manual scans only — the anti-join is what makes that true.

    Email ingestion calls the same `finalize_extraction` the wizard does, so every ingested
    document ALSO has a `credit_cards` row. Without the NOT EXISTS below, one forwarded
    statement appears twice: once as Email and once as Manual.
    """
    ingested = select(EmailDocument.id).where(EmailDocument.task_id == CreditCard.task_id).exists()
    return (
        select(CreditCard, OCRTask)
        .join(OCRTask, OCRTask.id == CreditCard.task_id)
        .where(
            CreditCard.tenant_id == tenant_id,
            CreditCard.deleted_at.is_(None),
            CreditCard.submitted_at.is_not(None),
            ~ingested,
        )
        .order_by(CreditCard.submitted_at.desc())
    )


@router.get("/activity", response_model=ActivityPage)
async def list_activity(
    filter: str = Query("all", description="all | review | success | failed | skipped"),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """This BU's credit-card documents from both sources, newest first.

    `all` remains the API default, but it is no longer what the page opens on: the screen
    asks for `review` (see `useReviewQueue`), because the heading, the empty states and the
    reason line were all written for "what is owed" while the default filter answered "what
    happened". The other four chips are how the history is reached. An unknown filter falls
    back to `all` rather than 400ing: the query string is a UI detail and a stale bookmark
    should land somewhere useful.
    """
    tenant_id = uuid.UUID(str(session.tenant_id))
    if filter not in FILTERS:
        filter = "all"
    statuses = FILTERS.get(filter)  # None for `all` — no status predicate at all

    email_stmt = _email_stmt(tenant_id, statuses)
    manual_stmt = _manual_stmt(tenant_id)
    wants_manual = filter in MANUAL_FILTERS

    # Counts span every row, not the page: one GROUP BY for email plus one count for
    # manual, rather than five round trips. Grouped by (status, reason_code) rather than
    # status alone because `attention` needs the reason — same single round trip either way.
    stale_before = datetime.now(UTC) - STUCK_AFTER
    per_pair = {
        (r.status, r.reason_code): (r.n, r.stale)
        for r in (
            await db.execute(
                select(
                    EmailDocument.status,
                    EmailDocument.reason_code,
                    func.count().label("n"),
                    func.count().filter(EmailDocument.created_at < stale_before).label("stale"),
                )
                .where(EmailDocument.tenant_id == tenant_id)
                .group_by(EmailDocument.status, EmailDocument.reason_code)
            )
        ).all()
    }
    manual_total = await count_rows(db, manual_stmt)
    counts = {
        k: sum(n for (s, _), (n, _stale) in per_pair.items() if s in v) for k, v in FILTERS.items()
    }
    counts["success"] += manual_total
    counts["all"] = sum(counts.values())

    # How many rows under each chip someone here could clear themselves. The page opens on
    # `review`, so `skipped` is out of the default view; without this the causes that are
    # one field away from fixed would be invisible again — the shape of the 2026-08-28
    # `sender_not_allowed` incident. `received` carries no reason_code, so it is counted by
    # age instead: claimed and never finished is a thing to look at, in flight is not.
    attention = {
        k: sum(
            n if rc in FIXABLE_REASONS else stale if s == "received" else 0
            for (s, rc), (n, stale) in per_pair.items()
            if s in v
        )
        for k, v in FILTERS.items()
    }
    attention["all"] = sum(attention.values())

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
    )
