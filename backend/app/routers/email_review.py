"""The review queue — a BU's own view of what email automation is holding for them.

Separate from `email_automation.py` on purpose. That router answers **Carmen's server**
calling us about settings, so it authenticates by replaying the customer's raw Carmen
token and proving it against their own Carmen (`_caller` / `_resolve`). This one answers
**our own frontend**, where the user already holds a session JWT, so it uses
`get_current_session` like every other tenant-facing route in the app.

What lives here is only what a human needs to act on a parked document. Everything a
machine decided is already on the ledger row and visible at `#/admin/email`.

Design: docs/email-automation/07-human-in-the-loop.md
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import SessionInfo, get_current_session
from app.database import get_db
from app.exceptions import NotFoundError
from app.models.email_automation import EmailDocument
from app.models.identity import Tenant
from app.models.schemas import ExtractedCreditCardData
from app.models.schemas.common import Page
from app.models.schemas.email_automation import (
    ApproveIn,
    ApproveResult,
    RejectIn,
    ReviewDocument,
    ReviewDocumentDetail,
    ReviewStatus,
)
from app.services import email_ingest_service as ingest
from app.services import email_settings_service as es
from app.services.cc_jv import num, r2
from app.utils.pagination import paginate

router = APIRouter(prefix="/api/v1/email", tags=["Email Review"])

PENDING = "pending_review"

# Tab → the ledger statuses under it. Grouped by what the answer means to the person
# looking, not by which code path wrote it:
#
#   review   what needs you now — the only tab with anything to do
#   posted   what went through, which is the evidence the automation is working and the
#            reason "all caught up" is not indistinguishable from "nothing ever arrived"
#   problem  it did not reach Carmen and somebody should know. `failed` (a gate or Carmen
#            said no) and `rejected` (a human said no) differ in who decided, which the
#            row shows — but not in what is now owed, which is the same errand either way.
#   skipped  the BU's own filename and sender rules said "not this file". Free, never
#            charged, and mostly noise — its own tab so it is findable without being in
#            the way of the three that matter.
TABS: dict[str, tuple[str, ...]] = {
    "review": (PENDING,),
    "posted": ("posted",),
    "problem": ("failed", "rejected"),
    "skipped": ("skipped", "received"),
}


def _summarise(row: EmailDocument) -> dict:
    """The parts of a queue row that come out of the stored payload rather than a column.

    A row whose payload has gone (a race with someone else's approve, or a status that
    moved underneath us) still renders — with zeroes, not a 500. The queue's job is to
    show the reviewer what is waiting, and one unreadable row must not blank the page.
    """
    payload = row.review_payload or {}
    extracted = payload.get("extracted") or {}
    details = extracted.get("details") or []
    return {
        "doc_date": extracted.get("doc_date"),
        # Gross, which is what lands on the credit side of the JV.
        "total": r2(sum(num(d.get("pay_amt")) for d in details)),
        "line_count": len(details),
        "flags": list(payload.get("flags") or []),
        # Which payment types nothing could map. The review screen turns these into empty
        # pickers; it cannot re-derive them, because the config it would diff against has
        # moved on since the document parked.
        "unmapped": list(payload.get("unmapped") or []),
        "guessed": list(payload.get("guessed") or []),
    }


def to_review_row(row: EmailDocument) -> ReviewDocument:
    """Public: `credit_card_activity.py` lists these rows beside manual scans and must
    build them the same way, or the two screens disagree about one document."""
    return ReviewDocument(
        id=str(row.id),
        created_at=row.created_at,
        attachment=row.attachment,
        status=row.status,
        bank_code=row.bank_code,
        doc_no=row.doc_no,
        jv_no=row.jv_no,
        reason_code=row.reason_code,
        error_message=row.error_message,
        reviewed_by_name=row.reviewed_by_name,
        reviewed_at=row.reviewed_at,
        **_summarise(row),
    )


@router.get("/documents", response_model=Page[ReviewDocument])
async def list_documents(
    tab: str = Query("review", description="review | posted | problem | skipped"),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """One tab of this BU's mail, newest first.

    `review` is the default because it is the only tab with anything to do; the rest are
    there so a customer can answer "did that one go through?" without asking us. An
    unknown tab falls back to `review` rather than 400ing: the query string is a UI
    detail, and a stale bookmark should land on the useful tab, not on an error.
    """
    statuses = TABS.get(tab, TABS["review"])
    stmt = (
        select(EmailDocument)
        .where(
            EmailDocument.tenant_id == uuid.UUID(str(session.tenant_id)),
            EmailDocument.status.in_(statuses),
        )
        .order_by(EmailDocument.created_at.desc())
    )
    rows, total = await paginate(db, stmt, limit, offset)
    return Page[ReviewDocument](
        total=total, limit=limit, offset=offset, data=[to_review_row(r) for r in rows]
    )


@router.get("/documents/{document_id}", response_model=ReviewDocumentDetail)
async def get_pending(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """One parked document, with the payload the review screen edits.

    The tenant filter is in the WHERE clause, not an `if` after the fetch: this is the
    only endpoint that hands back extracted line items, and "the row exists but is not
    yours" must be indistinguishable from "no such row".
    """
    row = await db.scalar(
        select(EmailDocument).where(
            EmailDocument.id == document_id,
            EmailDocument.tenant_id == uuid.UUID(str(session.tenant_id)),
            EmailDocument.status == PENDING,
        )
    )
    if row is None:
        raise NotFoundError("This document is not waiting for review")
    payload = row.review_payload or {}
    return ReviewDocumentDetail(
        **to_review_row(row).model_dump(),
        extracted=payload.get("extracted") or {},
        # Read here rather than in `_summarise`: the list endpoint and
        # `credit_card_activity.py` share that helper, and the dept/acc codes are only
        # ever wanted by the screen that lets someone edit them.
        suggested=payload.get("suggested") or {},
    )


@router.get("/status", response_model=ReviewStatus)
async def review_status(
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """Which of the automation page's four states to render, in one call.

    `blockers` is reused verbatim from the settings service rather than re-derived here,
    so the queue screen and the settings screen can never disagree about whether a BU is
    set up.
    """
    tenant = await db.get(Tenant, uuid.UUID(str(session.tenant_id)))
    if tenant is None:
        raise NotFoundError("Unknown business unit")
    row = await es.get_settings(db, tenant)
    body = await es.build_settings_response(db, tenant, row)
    # One grouped count for every tab, in one query rather than four.
    per_status = {
        r.status: r.n
        for r in (
            await db.execute(
                select(EmailDocument.status, func.count().label("n"))
                .where(EmailDocument.tenant_id == tenant.id)
                .group_by(EmailDocument.status)
            )
        ).all()
    }
    counts = {tab: sum(per_status.get(st, 0) for st in statuses) for tab, statuses in TABS.items()}
    return ReviewStatus(
        enabled=bool(body.get("enabled")),
        auto_post=bool(body.get("auto_post")),
        entitled=bool(body.get("entitled")),
        ingest_address=body.get("ingest_address"),
        blockers=list((body.get("status") or {}).get("blockers") or []),
        counts=counts,
    )


@router.post("/documents/{document_id}/approve", response_model=ApproveResult)
async def approve(
    document_id: uuid.UUID,
    body: ApproveIn,
    session: SessionInfo = Depends(get_current_session),
):
    """Post the document the reviewer just checked, under the BU's own credential.

    Synchronous on purpose. Carmen rejects JVs for reasons only a human can fix (a closed
    period, a dept code it does not know), and telling them ten minutes later in a bell
    notification wastes the fact that they are sitting right here. The cost is one slow
    request, which `post_gljv` already is in the wizard.

    No `db` dependency: the service opens its own short sessions around the lock, the
    Carmen call and the ledger write, so a slow Carmen never holds a pooled connection
    open. The pool is 10 for the whole application (Supavisor caps the project at 15).
    """
    result = await ingest.approve_document(
        document_id,
        tenant_id=str(session.tenant_id),
        reviewer=session.carmen_user_id,
        reviewer_name=session.username,
        extracted=ExtractedCreditCardData.model_validate(body.extracted),
        rows=body.rows,
        post_input_tax_record=body.post_input_tax,
        input_tax=body.input_tax,
    )
    return ApproveResult(**result)


@router.post("/documents/{document_id}/reject", status_code=204)
async def reject(
    document_id: uuid.UUID,
    body: RejectIn,
    session: SessionInfo = Depends(get_current_session),
):
    """Terminal, and not a refund — the vision call ran, and that is what the credit
    paid for. The reason is optional free text: a mandatory one gets typed as "x" by day
    three, and an optional one that reaches `#/admin/email` is how we learn what the
    extractor keeps getting wrong."""
    await ingest.reject_document(
        document_id,
        tenant_id=str(session.tenant_id),
        reviewer=session.carmen_user_id,
        reviewer_name=session.username,
        reason=body.reason,
    )
