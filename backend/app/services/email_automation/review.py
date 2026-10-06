"""Email Automation — the human's two verbs: approve and reject a parked document.

Lives in its own module, not a router, because `approve_document` is the second half of
`pipeline.py`'s `_run_document`: it picks up exactly where the review fork stopped, under
the BU's own Carmen credential rather than the reviewer's session, and it must stay
consistent with `ledger.py`'s `_finish` semantics (which nulls `review_payload` on the way
to a terminal status). Imports from both `pipeline.py` (`_post_input_tax`, the statement's
second Carmen document) and `ledger.py` (`_finish`, `_mark_submitted`) — never the reverse,
per codebase-refactor-recursive-scroll.md's stated direction, `review → pipeline, ledger`.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import DocType
from app.context import current_carmen_uri, current_tenant_id
from app.database import async_session
from app.exceptions import CarmenServiceError, ConflictError, NotFoundError, ValidationError
from app.models.business import CreditCard
from app.models.email_automation import EmailDocument, shown_attachment
from app.models.identity import Tenant
from app.models.schemas import ExtractedCreditCardData
from app.models.schemas.email_automation import ReviewDocument
from app.services.credit_card import ar_reconcile as ar_svc
from app.services.credit_card.accounting_config import get_accounting_config
from app.services.credit_card.jv import (
    _FIXED_TYPES,
    BALANCE_EPSILON,
    build_gljv_payload,
    num,
    r2,
)
from app.services.email_automation import credential
from app.services.email_automation import ingest_settings as es
from app.services.email_automation.ledger import _finish, _mark_submitted
from app.services.email_automation.pipeline import _post_input_tax
from app.services.shared import carmen
from app.services.shared.carmen import CarmenAPIError
from app.utils.date_parsing import parse_doc_date
from app.utils.db_helpers import has_submitted_doc

logger = logging.getLogger(__name__)

# How long an approve/reject may hold a parked document before its claim is presumed dead
# (`_claim_for_review`). The longest an approval legitimately takes is two Carmen posts —
# the JV and the input-tax record — at `carmen_service._TIMEOUT` (30 s) each.
#
# ponytail: a fixed TTL, not a heartbeat. Make it a heartbeat if approvals ever grow slow
# enough to outlive five minutes.
POSTING_CLAIM_TTL = timedelta(minutes=5)


async def _claim_for_review(db: AsyncSession, document_id: uuid.UUID, tenant_id: str) -> Any:
    """Take the row for this approve/reject, or explain why not. Commits the claim.

    Two reviewers in one BU with the queue open is the expected case, not the edge case:
    the notification goes to the whole business unit, since `user_notifications` has no
    user to address it to.

    A compare-and-set on the row, not a lock. The previous version took `SELECT … FOR
    UPDATE` in a session that closed before `post_gljv` was awaited, so the lock was gone by
    the time it mattered and two reviewers pressing Approve together both posted the JV
    (DEF-1, reproduced in tests/tenancy/test_email_approve_integrity.py). The claim lives in
    the row instead, so it outlasts the session without holding a pooled connection across
    the Carmen call: the caller gives it back (`_release_claim`) on every path that does not
    finish, and one older than POSTING_CLAIM_TTL belongs to a process that died and can be
    retaken.

    Returns the claimed row's (id, bank_code, task_id, doc_no, review_payload).
    """
    now = datetime.now(UTC)
    claimed = (
        await db.execute(
            update(EmailDocument)
            .where(
                EmailDocument.id == document_id,
                EmailDocument.tenant_id == uuid.UUID(tenant_id),
                EmailDocument.status == "pending_review",
                or_(
                    EmailDocument.posting_started_at.is_(None),
                    EmailDocument.posting_started_at < now - POSTING_CLAIM_TTL,
                ),
            )
            .values(posting_started_at=now)
            .returning(
                EmailDocument.id,
                EmailDocument.bank_code,
                EmailDocument.task_id,
                EmailDocument.doc_no,
                EmailDocument.review_payload,
            )
        )
    ).first()
    if claimed is not None:
        await db.commit()
        return claimed

    # Why not. Tenant-scoped, so "not yours" and "not there" stay the same answer: this row
    # carries extracted line items.
    status = await db.scalar(
        select(EmailDocument.status).where(
            EmailDocument.id == document_id,
            EmailDocument.tenant_id == uuid.UUID(tenant_id),
        )
    )
    if status is None:
        raise NotFoundError("This document is not waiting for review")
    if status == "pending_review":
        raise ConflictError("Another reviewer is posting this document right now")
    raise ConflictError("Someone else has already handled this document")


async def _release_claim(ledger_id: uuid.UUID) -> None:
    """Give a claimed row back to the queue. Never raises — worst case the claim expires."""
    try:
        async with async_session() as db:
            await db.execute(
                update(EmailDocument)
                .where(EmailDocument.id == ledger_id, EmailDocument.status == "pending_review")
                .values(posting_started_at=None)
            )
            await db.commit()
    except Exception:
        logger.exception("[email] Could not release the review claim on %s", ledger_id)


def _as_shown(built: list[dict], sent: list[dict]) -> list[dict]:
    """A rebuilt settlement JV, refused unless it is the one the screen showed, and carrying
    the comment the reviewer gave each leg.

    The figures and accounts are rebuilt from the document and the config, and the browser
    builds the same legs in the same order (`buildJvRows`' settlement branch, pinned by
    contracts/cc-jv.contract.json). So the two can only differ when something moved under
    the reviewer — a colleague's mapping save, a Credit breakdown switched elsewhere — and
    posting the rebuild then would post a JV nobody looked at. The three fixed legs are
    keyless here and keyed commission/tax/net there.

    An empty `sent` compares nothing and keeps the rebuild's wording; the review screen
    always sends what it showed.
    """
    if not sent:
        return built
    if len(sent) != len(built):
        raise ValidationError(_JV_MOVED)
    out = []
    for b, s in zip(built, sent):
        same_leg = (s.get("key") or "") == b["key"] or (
            not b["key"] and s.get("key") in _FIXED_TYPES
        )
        same_post = (
            (s.get("dept") or "") == b["dept"]
            and (s.get("acc") or "") == b["acc"]
            and abs(num(str(s.get("debit") or 0)) - b["debit"]) <= BALANCE_EPSILON
            and abs(num(str(s.get("credit") or 0)) - b["credit"]) <= BALANCE_EPSILON
        )
        if not (same_leg and same_post):
            raise ValidationError(_JV_MOVED)
        desc = s.get("desc")
        out.append({**b, "desc": desc} if isinstance(desc, str) and desc.strip() else b)
    return out


_JV_MOVED = (
    "This JV changed since the review screen built it — the mapping or the Credit breakdown "
    "was saved meanwhile. Close and reopen the document, then check it again."
)


async def approve_document(
    document_id: uuid.UUID,
    *,
    tenant_id: str,
    reviewer: str | None,
    reviewer_name: str | None = None,
    extracted: ExtractedCreditCardData,
    rows: list[dict],
    post_input_tax_record: bool = True,
    input_tax: Any = None,
) -> dict:
    """Post what the reviewer approved, under the BU's own credential.

    `rows` are the JV rows the review screen displayed, not rows rebuilt here. The screen
    derives them against the live accounting config, so rebuilding would risk posting
    something other than what was on screen when the button was pressed, which is the one
    thing an approval must never do.

    Three things this deliberately does NOT do:

    * It does not post through `routers/carmen.py:proxy_gljv`. That reads the *session's*
      Carmen token, so an ingested document would be attributed to whichever colleague
      happened to open the queue. The credential belongs to the BU, not the reviewer.
    * It does not use a credential stored at park time. Tokens rotate, and
      `sweep_token_health` may have unverified one while the document sat, so it is
      re-read here.
    * It does not trust `is_duplicate` from the extraction. That was computed before the
      document waited, and a wait is exactly when someone keys the same statement into
      Carmen by hand.

    It also does not write the GL rules back to the BU's config. Ingest stopped doing that
    for a suggestion (a guess nobody had read was becoming the BU's own rule, and then the
    *second* copy of a statement auto-posted on it), and the review screen already writes
    them itself — `patchAccountingConfig`, immediately before it calls this. One writer,
    and it is the click that means a human confirmed them.
    """
    async with async_session() as db:
        claimed = await _claim_for_review(db, document_id, tenant_id)
    ledger_id: uuid.UUID = claimed.id
    bank_code: str | None = claimed.bank_code
    task_id = str(claimed.task_id) if claimed.task_id else None
    doc_type = (claimed.review_payload or {}).get("doc_type") or DocType.FEE_INVOICE

    # Set the moment Carmen accepts the JV. Before that, every way out of this function
    # gives the claim back so the document is approvable again at once. After it, the claim
    # is left to expire rather than released: `_mark_submitted` has normally made a second
    # approve a 409 by then, and handing the row back early is the one move that could post
    # the same JV twice.
    posted = False
    tenant_ctx = uri_ctx = None
    try:
        async with async_session() as db:
            tenant = await db.get(Tenant, uuid.UUID(tenant_id))
            settings_row = await es.get_settings(db, tenant) if tenant else None
            carmen_token, carmen_uri = (
                await credential.posting_target(db, settings_row) if settings_row else ("", "")
            )

        if not carmen_token:
            raise ValidationError("No Carmen posting credential for this business unit")
        if not carmen_uri:
            raise ValidationError("No Carmen host known for this business unit")

        doc_no = extracted.doc_no
        # `post_gljv` reads the target host from a ContextVar the request middleware fills
        # in for the *user's* Carmen, and this posts to the *BU's*. Set both, reset both.
        tenant_ctx = current_tenant_id.set(tenant_id)
        uri_ctx = current_carmen_uri.set(carmen_uri)
        async with async_session() as db:
            # doc_date + doc_type match `finalize_extraction`'s duplicate key (see its
            # comment): KBANK prints one tax invoice number across both the commission fee
            # invoice and this settlement report, and without them a fee invoice that had
            # already posted would refuse the settlement report sharing its number here.
            if doc_no and await has_submitted_doc(
                db,
                CreditCard,
                tenant_id=uuid.UUID(tenant_id),
                doc_no=doc_no,
                doc_date=parse_doc_date(extracted.doc_date),
                doc_type=doc_type,
            ):
                raise ConflictError(f"Document {doc_no} has already been posted to Carmen")
            config = await get_accounting_config(db, tenant_id, bank_code)

        description: str | None = None
        if doc_type == DocType.AR_RECONCILE:
            # Rebuilt here rather than taken from the caller, which is not a weakening of
            # "post what the screen displayed" but the same rule reached differently: the
            # screen builds these rows with a contract-pinned twin of this builder, from the
            # same edited document and the mapping it saved just before, while a browser
            # free to send arbitrary figures against a control account is not something to
            # accept on trust. The caller's rows are the check that the two agree, and each leg's
            # comment is theirs (`_as_shown`).
            async with async_session() as db:
                built = await ar_svc.jv_for_document(
                    db, tenant_id, bank_code, extracted.model_dump(mode="json")
                )
            if built is None:
                raise ValidationError("AR reconciliation is not configured for this bank any more")
            if built.unmapped:
                raise ValidationError(
                    "Map these payment types before posting: " + ", ".join(built.unmapped)
                )
            if not built.balanced:
                # A real check since 2026-09-18: the debit side (commission/VAT/net) comes
                # from the report's own total row, independent of the credit rows it is
                # compared against — see `jv.is_balanced`. `_review_flags` already parks a
                # document in this state; this is the belt to that brace for the
                # direct-approve path, where a stale `built` could theoretically slip past
                # if the mapping changed between park and approve.
                raise ValidationError(
                    "This report's totals don't reconcile — check the settlement report "
                    "before posting"
                )
            rows = _as_shown([r.model_dump() for r in built.rows], rows)
            description = built.description
        else:
            # The screen will not post a line carrying money without an account (JvEditor's
            # `blankAccount`), and neither does this. The API is reachable without the
            # screen, and Carmen refuses such a line only after the post — as
            # `carmen_rejected`, with the GL code nowhere in its message.
            blank = [
                str(r.get("desc") or "a line")
                for r in rows
                if (num(str(r.get("debit") or 0)) or num(str(r.get("credit") or 0)))
                and not str(r.get("acc") or "").strip()
            ]
            if blank:
                raise ValidationError(
                    "Choose an account for every line that carries an amount: " + ", ".join(blank)
                )

        payload = build_gljv_payload(
            rows,
            doc_date=extracted.doc_date,
            doc_no=doc_no,
            bank_code=bank_code,
            config=config,
            description=description,
        )
        try:
            result = await carmen.post_gljv(payload, carmen_token)
        except CarmenAPIError as exc:
            # Transport, not judgement: the JV's fate is genuinely unknown. The document
            # stays reviewable, but the message has to say so — a reviewer told only
            # "failed" will press the button again, and if the first call did land that
            # posts the statement twice. `submitted_at` is stamped on success only, so
            # nothing on our side can tell them; Carmen can.
            logger.error("[email] Carmen unreachable while approving %s: %s", doc_no, exc)
            raise CarmenServiceError(
                f"Carmen did not answer ({exc.detail}). Check whether the JV posted "
                f"before approving this document again."
            ) from exc

        if not result or result.get("Code", -1) != 0:
            # A judgement, not an outage — 400 with Carmen's own words, not the 503 that
            # `CarmenServiceError` would produce and that would read as "try again later".
            #
            # Left `pending_review` on purpose. The reviewer is standing right there, and
            # what Carmen rejects (a closed period, a dept code it does not know) is
            # usually something they can fix and resubmit. This is the only place in the
            # feature where a failed post is not terminal.
            raise ValidationError(
                str((result or {}).get("UserMessage") or "Carmen rejected the JV")
            )

        posted = True
        # The ledger row's own task, never `extracted.id` — that is whatever the browser
        # sent, and it once let one BU stamp another's card (DEF-2).
        await _mark_submitted(tenant_id, task_id)
        # The settlement report files this claim itself (decision #28) — see
        # `_run_document`'s identical call for why `total_row`, not `extracted.details`,
        # is what has anything to sum for this document type.
        ar_input_tax_details = [extracted.total_row] if extracted.total_row else []
        tax_note = (
            await _post_input_tax(
                extracted,
                bank_code=bank_code,
                config=config,
                carmen_token=carmen_token,
                overrides=input_tax,
                details=ar_input_tax_details if doc_type == DocType.AR_RECONCILE else None,
            )
            if post_input_tax_record
            else None
        )
        jv_no = str(result.get("InternalMessage") or "")
        await _finish(
            ledger_id,
            status="posted",
            task_id=task_id,
            bank_code=bank_code,
            doc_no=doc_no,
            jv_no=jv_no,
            error=tax_note,
            # The reviewer is the one who just posted this — telling them again in the
            # bell wastes the fact that they are sitting right here watching it happen.
            notify=False,
        )
        await _stamp_reviewer(ledger_id, reviewer, reviewer_name)
        logger.info(
            "[email] %s approved and posted %s (JV %s)", reviewer_name or reviewer, doc_no, jv_no
        )
        return {"jv_no": jv_no, "tax_note": tax_note}
    finally:
        if uri_ctx is not None:
            current_carmen_uri.reset(uri_ctx)
        if tenant_ctx is not None:
            current_tenant_id.reset(tenant_ctx)
        if not posted:
            await _release_claim(ledger_id)


async def reject_document(
    document_id: uuid.UUID,
    *,
    tenant_id: str,
    reviewer: str | None,
    reviewer_name: str | None = None,
    reason: str | None = None,
) -> None:
    """Terminal, and deliberately not a refund.

    The vision call ran, which is what the credit paid for (decision-log #17). Refunding
    here would make the two pipelines disagree about cost again, and would price a
    reviewer's judgement as though the extraction had never happened.

    There is no un-reject: re-extracting is what the manual wizard is for.

    Takes the same claim as approve, so a reject racing an approve on one document gets a
    409 instead of marking rejected a JV that is at that moment going into Carmen.
    """
    async with async_session() as db:
        row = await _claim_for_review(db, document_id, tenant_id)
    ledger_id: uuid.UUID = row.id
    bank_code: str | None = row.bank_code
    doc_no: str | None = row.doc_no
    task_id = str(row.task_id) if row.task_id else None

    try:
        await _finish(
            ledger_id,
            status="rejected",
            task_id=task_id,
            bank_code=bank_code,
            doc_no=doc_no,
            reason_code="rejected_by_reviewer",
            error=(reason or "").strip()[:500] or None,
            # Same reviewer, same click, same reasoning as approve's `notify=False` above —
            # "rejected" isn't in _finish's own notify-triggering status/reason sets today,
            # but that should stay true by design, not by accident of those sets' contents.
            notify=False,
        )
    except Exception:
        await _release_claim(ledger_id)
        raise
    await _stamp_reviewer(ledger_id, reviewer, reviewer_name)
    logger.info("[email] %s rejected %s", reviewer_name or reviewer, doc_no)


async def _stamp_reviewer(
    ledger_id: uuid.UUID, reviewer: str | None, reviewer_name: str | None
) -> None:
    """Who decided, and when. Audit only: there is no users table to point at, and any
    Carmen session for this BU may approve, so this records rather than authorises.

    Both the id and the name. Everywhere else in this codebase only `carmen_user_id` is
    stored and the name is resolved later through `tenant_lookup.username_map`, which reads
    `ocr_sessions` — scrubbed after 90 days, so that lookup quietly decays into a raw UUID.
    Fine for a usage chart. Not fine for the record of who approved a journal entry, which
    has to still read as a name when someone asks in a year.

    After `_finish`, not inside it. `_finish` also runs on the machine path, where there is
    no reviewer, and a nullable column written from two places drifts.
    """
    try:
        async with async_session() as db:
            row = await db.get(EmailDocument, ledger_id)
            if row is not None:
                row.reviewed_by = reviewer  # type: ignore[assignment]
                row.reviewed_by_name = reviewer_name  # type: ignore[assignment]
                row.reviewed_at = datetime.now(UTC)  # type: ignore[assignment]
                await db.commit()
    except Exception:  # noqa: BLE001 — the decision is already recorded; this is metadata
        logger.exception("[email] Could not stamp the reviewer on %s", ledger_id)


# ── The queue row: one parked document as both review screens list it ─────────


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
    """Public: `credit_card/activity.py` lists these rows beside manual scans and must
    build them the same way, or the two screens disagree about one document."""
    return ReviewDocument(
        id=str(row.id),
        created_at=row.created_at,
        attachment=shown_attachment(row.attachment),
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
