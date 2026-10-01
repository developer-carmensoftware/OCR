"""The credit-card activity table — everything that became (or failed to become) a JV.

One list, two sources. `email_automation/review.py` answers "what is the automation holding for me",
which is a strictly smaller question: this endpoint also lists the scans a person did by
hand. The page it feeds is the robot's inbox — what needs a decision — and, under `all`, the
module's log: every attachment the system took seriously, so a BU can answer "did my statement
even arrive" without anyone reading the database for them (§14). One reason code is outside
even that — see `HIDDEN_REASON`.

It is a separate router rather than another route on `email_automation/review.py` because that file's
whole contract is email documents; a manual scan there would make its docstring a lie.
Everything a *reviewer* does — open, approve, reject — stays there.

Design: docs/email-automation/07-human-in-the-loop.md §6 (the screen), §9 (four tabs folded
into one filtered table), §11 (the column order, and `attention`), §12 (three chips, and
what the dot means now), §13 (the chips re-keyed on who can act, plus `today`), §14 (`all`
back on the strip, and Posted/Not posted narrowed to what a credit was spent on). Where a row
came from is no longer a column of its own — `MANUAL_CHIPS` below is why.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import SessionInfo, get_current_session
from app.database import get_db
from app.exceptions import ValidationError
from app.models.schemas.email_automation import (
    ActivityPage,
    QueueSeenIn,
    QueueSeenOut,
)
from app.services.credit_card import activity as activity_service
from app.services.credit_card.input_tax import file_input_tax_for_card

router = APIRouter(prefix="/api/v1/credit-card", tags=["Credit Card Activity"])


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
    is the only view that shows every attachment that arrived, noise included (§14) — bar
    `HIDDEN_REASON`, the one thing the log is better off not being (§20 #97).
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
    return await activity_service.list_activity(
        db, uuid.UUID(str(session.tenant_id)), filter, limit, offset
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
    if body.filter not in activity_service.STATUS_CHIPS:
        # A trust boundary: the value becomes a key in the stored JSON. `all` and `today`
        # are rejected with the nonsense, deliberately — neither carries a dot, so neither
        # has a mark to store. `today` additionally could not have one: the mark is a
        # lifetime figure and that count resets at midnight.
        raise ValidationError(f"Unknown filter: {body.filter}")

    tenant_id = uuid.UUID(str(session.tenant_id))
    total = await activity_service.mark_chip_seen(db, tenant_id, body.filter)
    return QueueSeenOut(filter=body.filter, seen=total)


@router.post("/activity/{card_id}/input-tax", status_code=204)
async def record_input_tax(
    card_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """File the input tax a manual scan's posted JV still owes — the row's `input_tax_owed`.

    The wizard files it on step 4, and a session that died before then (or a step 4 that was
    skipped) used to leave the VAT claim with no trace anywhere but a browser draft. This is
    the same record, built server-side from what was stamped on the card with the JV, and
    posted with the caller's own Carmen token — as the wizard would have.

    404 for another BU's card, 409 when there is nothing left to file, 400 with the reason
    when the record cannot be built or Carmen refuses it.
    """
    await file_input_tax_for_card(
        db, uuid.UUID(str(session.tenant_id)), card_id, session.carmen_token
    )
