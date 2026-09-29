"""Email Automation — the ledger: one `email_documents` row per (message, attachment).

The dedupe (`_claim`), the terminal writes (`_finish`, `_park_for_review`), and the
duplicate/backlog checks the pipeline gates on before it spends anything further
(`_already_pending`, `_possibly_posted`, `_pending_count`). Nothing here calls into
`pipeline.py`, `review.py` or `ingest.py` — this is the base of the package's import graph,
per codebase-refactor-recursive-scroll.md's stated direction.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import DocType
from app.database import async_session
from app.models.business import CreditCard
from app.models.email_automation import EmailDocument
from app.models.schemas import ExtractedCreditCardData
from app.services.credit_card.jv import num, r2
from app.services.shared import notification as notification_service
from app.utils.date_parsing import parse_doc_date

logger = logging.getLogger(__name__)

# How many unreviewed documents a BU may accumulate before ingestion stops for them.
# Generous on purpose: this is a guard against a queue nobody is reading, not a work
# limit, and a BU handling fifty statements a fortnight must never hit it.
#
# ponytail: one number for every BU. Per-BU tuning when someone actually needs it.
REVIEW_BACKLOG_CAP = 50

# The `skipped` reasons the customer has to hear about, because only they can fix them
# and the document is otherwise gone in silence — a wrong PDF password parks nothing in
# the queue, raises nothing in the bell, and reads exactly like a poll that never ran.
#
# Every other `skipped` reason stays silent on purpose: `no_rule_match` fires on the
# summary PDF inside every bank zip, and `ingest_paused`/`duplicate_document` describe
# something the customer already did. A bell that cries every morning is a bell nobody
# reads on the morning it matters.
#
# `sender_not_allowed` left this list 2026-09-23: anyone who learns the BU's +tag address
# can make it fire, for a document the customer never sent and cannot fix by looking at
# it. It still writes its ledger row (`#/admin/email` and the settings page can see it),
# it just does not cost the customer's attention.
NOTIFIABLE_SKIPS = ("wrong_pdf_password", "unsupported_attachment")

# ── Ledger ────────────────────────────────────────────────────────────────────


async def _claim(
    db: AsyncSession, tenant_id: str, message_id: str, filename: str
) -> EmailDocument | None:
    """Insert the ledger row. None = this (message, attachment) was already handled.

    The whole dedupe, in one atomic insert against `uq_email_documents_message`. It runs
    before anything is opened or extracted, so a re-delivered mail costs nothing.
    """
    row = EmailDocument(
        id=uuid.uuid4(),
        tenant_id=uuid.UUID(tenant_id),
        message_id=message_id,
        attachment=filename[:255],
        status="received",
        attempts=1,
    )
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return None
    return row


async def _record_auth(message_id: str, verdict: str | None) -> None:
    """Stamp `auth_verdict` on every ledger row this message produced. Never raises.

    Once per message, after `_process_message`, rather than threaded through `_claim`:
    the verdict is a fact about the mail, not about any one attachment or gate, and this
    reaches every row the message wrote whichever path wrote it. Keyed on `message_id`
    alone because the tenant is not known here; the same mail delivered to two tags got
    one verdict from our MX anyway. Measurement only, so a failure is a log line.

    ponytail: no index on `message_id` alone — the table is retention-bounded
    (`fn_purge_email_documents`) and this runs at most `imap_batch_size` times a poll.
    """
    if not verdict:
        return
    try:
        async with async_session() as db:
            await db.execute(
                update(EmailDocument)
                .where(EmailDocument.message_id == message_id, EmailDocument.auth_verdict.is_(None))
                .values(auth_verdict=verdict[:100])
            )
            await db.commit()
    except Exception as exc:  # noqa: BLE001 — a measurement must not fail a poll
        logger.warning("[email] Could not record auth verdict for %s: %s", message_id, exc)


# Shorter than this, one number sitting inside another says nothing (every "12" is in
# some "0412…"). Real statement numbers are 12+ characters.
_MIN_OVERLAP = 8


def _overlapping_doc_no(doc_no: str, candidates: list[str]) -> str | None:
    """The first candidate one of whose numbers contains the other — the shape of a misread
    that added or dropped characters (F-7: `041125E00023869` was once posted as
    `041125E00023869767`). Exact equality is the other guard's job, and a one-digit
    substitution is deliberately not matched: sequential numbers on the same day
    (`269110800001`, `…003`) are the ordinary case, not a duplicate."""
    for other in candidates:
        if other == doc_no or min(len(other), len(doc_no)) < _MIN_OVERLAP:
            continue
        if doc_no in other or other in doc_no:
            return other
    return None


async def _possibly_posted(tenant_id: str, doc_no: str | None, doc_date: Any) -> str | None:
    """A document this BU already posted on the same date whose number overlaps this one.

    `has_submitted_doc` and `_already_pending` both key on `doc_no` by exact equality, so
    one misread character let a document post twice (F-7, 2026-09-25 QA). This does not
    block — nothing here can prove the two are the same statement — it gives the reviewer
    the number to compare, and keeps the document out of auto-post. No amount in the key:
    `credit_cards` stores none, and rows posted before a new column would have none either.
    """
    parsed = parse_doc_date(doc_date)
    if not doc_no or parsed is None:
        return None
    try:
        async with async_session() as db:
            posted = (
                await db.scalars(
                    select(CreditCard.doc_no).where(
                        CreditCard.tenant_id == uuid.UUID(tenant_id),
                        CreditCard.doc_date == parsed,
                        CreditCard.submitted_at.isnot(None),
                        CreditCard.deleted_at.is_(None),
                        CreditCard.doc_no.isnot(None),
                    )
                )
            ).all()
    except Exception as exc:  # noqa: BLE001
        # Fail open like `_already_pending`: this is a second opinion, not the gate.
        logger.error("[email] Could not check for near-duplicate documents: %s", exc)
        return None
    return _overlapping_doc_no(doc_no, list(posted))


async def _already_pending(
    tenant_id: str, bank_code: str | None, doc_no: str | None, doc_type: str
) -> bool:
    """Is an identical document already sitting in this BU's review queue?

    A document with no `doc_no` is not comparable — two unnumbered statements are not
    evidence of anything — so it never matches. That blindness is itself why
    `doc_no_missing` is a flag: it keeps an unnumbered document out of auto-post, where
    nothing else could catch a second copy.

    **`doc_type` is checked too, in Python.** KBANK prints one tax invoice number across
    both the commission fee invoice and the settlement report that reclassifies the same
    day's takings — `finalize_extraction`'s duplicate key already carries `doc_type` for
    exactly this reason (see its comment), and without it here a fee invoice parked for
    review would sink the settlement report sharing its number as a false "copy already
    waiting". `email_documents` has no `doc_type` column, but `_park_for_review` already
    stores it in `review_payload` — the only place downstream that has to tell the two
    documents apart from this row anyway — so this reads it back rather than adding a
    migration for one more comparison.
    """
    if not doc_no:
        return False
    try:
        async with async_session() as db:
            rows = (
                (
                    await db.execute(
                        select(EmailDocument.review_payload).where(
                            EmailDocument.tenant_id == uuid.UUID(tenant_id),
                            EmailDocument.status == "pending_review",
                            EmailDocument.bank_code == bank_code,
                            EmailDocument.doc_no == doc_no,
                        )
                    )
                )
                .scalars()
                .all()
            )
        return any(
            (payload or {}).get("doc_type", DocType.FEE_INVOICE) == doc_type for payload in rows
        )
    except Exception as exc:  # noqa: BLE001
        # Fail open, like every other infra guard on this path. A missed duplicate costs
        # the reviewer one extra row to reject; a raised exception here would file a
        # perfectly good document as `failed / unreadable_document`.
        logger.error("[email] Could not check the review queue for duplicates: %s", exc)
        return False


async def _pending_count(db: AsyncSession, tenant_id: str, *, blocked_only: bool = False) -> int:
    """How many documents this BU has left unreviewed.

    `blocked_only` narrows it to the ones that stopped on a problem rather than on the
    ordinary review fork — `reason_code IS NOT NULL` is the whole distinction. Both numbers
    are the same question of the same rows, so they are one query with one predicate rather
    than two functions that could drift on what "waiting" means.
    """
    stmt = (
        select(func.count())
        .select_from(EmailDocument)
        .where(
            EmailDocument.tenant_id == uuid.UUID(tenant_id),
            EmailDocument.status == "pending_review",
        )
    )
    if blocked_only:
        stmt = stmt.where(EmailDocument.reason_code.is_not(None))
    return (await db.scalar(stmt)) or 0


async def _release(ledger_id: uuid.UUID) -> None:
    """Undo the claim, so the next poll can take this (message, attachment) again.

    The ledger row IS the dedupe — a row that stays behind means "already handled" for
    ever. Deleting it is only correct for a stop that says nothing about the document
    itself (out of credits); every real verdict goes through `_finish` and stays.
    """
    try:
        async with async_session() as db:
            row = await db.get(EmailDocument, ledger_id)
            if row is not None:
                await db.delete(row)
                await db.commit()
    except Exception as exc:  # noqa: BLE001 — worst case the retry dedupes instead
        logger.error("[email] Could not release the ledger claim: %s", exc)


async def _mark_submitted(tenant_id: str, task_id: str | None) -> None:
    """Stamp `credit_cards.submitted_at` — the same thing the wizard does after posting.

    Without it the duplicate guard is blind to everything this job posts: the check
    on the way in reads `submitted_at IS NOT NULL` (`has_submitted_doc`), so a
    document forwarded twice in two different mails posts twice. The ledger's own
    dedupe key is (message, attachment), which catches the same *mail* again and
    not the same *document* — and both arrival modes carrying one report is exactly
    the case CARMEN_INTEGRATION.md §0.1 promises we handle.

    Found by the server-owned key, never by an id from a request body. This used to take
    `extracted.id` — which on the approve path is whatever the browser sent — and load it
    with no tenant filter, so a reviewer in one BU could stamp another BU's card and make
    its next legitimate copy read as already posted (DEF-2, 2026-09-24 QA). `task_id` comes
    from the ledger row this BU owns, and `uq_credit_cards_task` makes it name exactly one
    live card; the tenant filter is the same one the wizard's `proxy_gljv` applies.

    Failing here must not undo a JV Carmen has already accepted, so this logs and
    returns; the partial unique index on (tenant, bank_code, doc_no) is what makes
    a lost stamp loud rather than silent.
    """
    if not task_id:
        return
    try:
        async with async_session() as db:
            card = await db.scalar(
                select(CreditCard).where(
                    CreditCard.task_id == uuid.UUID(task_id),
                    CreditCard.tenant_id == uuid.UUID(tenant_id),
                    CreditCard.deleted_at.is_(None),
                )
            )
            if card is not None:
                card.submitted_at = datetime.now(UTC)  # type: ignore[assignment]
                await db.commit()
    except Exception:
        logger.exception("[email] Could not stamp submitted_at for task %s", task_id)


def _review_flags(
    extracted: ExtractedCreditCardData,
    *,
    mapping_guessed: bool,
    mapping_missing: list[str] | None = None,
    doc_type: str = DocType.FEE_INVOICE,
    ar_unbalanced: bool = False,
    tin_unverified: bool = False,
) -> list[str]:
    """Why this document might be worth opening. Computed once, here, and stored.

    The queue paints a reason line per row, and neither of these can be recovered later
    from a list query: `mapping_guessed` is knowable only inside `_run_document` (it is
    whether the AI had to invent a GL mapping on the way past), and re-deriving
    `unbalanced` at list time would mean loading every payload just to paint a list.

    `unbalanced` is the same arithmetic AccountingReview does in the browser
    (`imbalancedLines`): every layout satisfies gross = commission + tax + net per line, so
    a line that breaks it was misread and its JV would post unbalanced.

    **The settlement report's lines are not that shape** — it prints THB AMT per payment
    type and leaves VAT AMT and NET AMT as dashes on those rows, so the per-line identity
    above is false for every one of them and cannot be reused here. `ar_unbalanced` is the
    caller's own `not jv.is_balanced(rows)`: since 2026-09-18 the debit side of
    that JV comes from the report's own total row (independent of the credit rows it is
    compared against), so this is a real check, not the tautology `is_balanced` used to be
    when the debit leg was derived from the very rows it was checked against.

    **This is also the auto-post gate.** An empty list is what `auto_post` posts on — the
    queue's own "nothing to say about this one", which the row already prints as *Ready to
    post*. One predicate on purpose: a document a reviewer would have been given a reason
    for must not be the one that posts unattended.

    `tin_unverified` (AR only): the settlement report's own page prints no tax ID, so it
    has nothing for `foreign_tax_id` to check unless the CSV sidecar supplied one by
    merchant ID. Not a conflict — that is `tax_id_mismatch`, a `_Skip` raised earlier and
    never reaching here — just an unattended post this document has not earned yet.
    """
    flags: list[str] = []
    # Above `mapping_guessed` in the row's reason ladder: a guess posts and may post to the
    # wrong account, a gap cannot post at all until the reviewer fills it.
    if mapping_missing:
        flags.append("mapping_missing")
    if mapping_guessed:
        flags.append("mapping_guessed")
    if doc_type == DocType.AR_RECONCILE:
        if ar_unbalanced:
            flags.append("unbalanced")
        if tin_unverified:
            flags.append("tin_unverified")
    elif any(
        abs(r2(num(d.pay_amt) - (num(d.commis_amt) + num(d.tax_amt) + num(d.total)))) > 0.01
        for d in extracted.details
    ):
        flags.append("unbalanced")
    if not extracted.doc_no:
        # Advisory on the row — a reviewer can post a JV without a document number — and
        # decisive for auto-post, which is why it is a flag rather than a `_Skip`. Both
        # duplicate guards key on `doc_no`: `has_submitted_doc` and `_already_pending`
        # answer False when there is none, so an unnumbered statement forwarded twice
        # would post twice into real books with nothing able to catch it.
        flags.append("doc_no_missing")
    if extracted.warnings:
        flags.append("warnings")
    return flags


async def _park_for_review(
    ledger_id: uuid.UUID,
    *,
    extracted: ExtractedCreditCardData,
    task_id: str | None,
    bank_code: str | None,
    doc_no: str | None,
    flags: list[str],
    mapping_suggested: dict[str, dict[str, str]] | None = None,
    mapping_missing: list[str] | None = None,
    reason_code: str | None = None,
    error: str | None = None,
    doc_type: str = DocType.FEE_INVOICE,
) -> None:
    """Stop short of Carmen and wait for a human.

    The payload is the raw extraction shape — the same JSON `/extract` returns — because
    the browser already knows how to load that: `useOcrExtraction.applyExtractedData` takes
    it verbatim. `raw_text` is dropped: it is the bulkiest field, nothing reads it, and this
    row sits in the database until someone clicks.

    Not stored, deliberately: the built JV rows (the review screen derives them live against
    the *current* accounting config, so a stored copy would go stale behind what the reviewer
    is looking at) and the Carmen credential (re-read at approve time — it rotates, and
    `sweep_token_health` may have unverified it while the document sat).

    **`reason_code` is what makes this two functions in one.** Without it this is the review
    fork: the ordinary stop one step short of `post_gljv`, and no news — the queue's own
    count is the channel for that. With it, the pipeline got further and then hit something
    it could not decide alone: a foreign tax ID, a GL account nothing maps, a Carmen
    refusal. Those used to be `_finish(status="failed")`, which threw away an extraction the
    customer had already paid for. They keep their payload now and land in the same queue,
    where the one thing that can clear them — a person — already is.

    Nothing is notified from here, with or without a reason. The bell for both is raised
    once per BU per poll by `_notify_pending` — a bank sending a twenty-attachment zip
    against a dead credential would otherwise put twenty rows in the customer's bell and
    bury everything else in it.
    """
    payload = extracted.model_dump(mode="json", exclude={"raw_text"})
    async with async_session() as db:
        row = await db.get(EmailDocument, ledger_id)
        if row is None:
            return
        row.status = "pending_review"  # type: ignore[assignment]
        row.task_id = uuid.UUID(task_id) if task_id else None  # type: ignore[assignment]
        row.bank_code = bank_code  # type: ignore[assignment]
        row.doc_no = doc_no  # type: ignore[assignment]
        row.reason_code = reason_code  # type: ignore[assignment]
        row.error_message = error  # type: ignore[assignment]
        row.review_payload = {  # type: ignore[assignment]
            "extracted": payload,
            # Passed in, not computed here: since `auto_post` started meaning "post what is
            # ready to post", this same list is the gate that decided the document parks at
            # all. Recomputing it would be two readings of one question, one file apart.
            "flags": flags,
            # Which payment types the reviewer has to map before this can post, and which
            # rules the AI invented on the way past. Stored rather than re-derived: the
            # review screen would otherwise have to diff the document against the live
            # config to find them, and the config moves.
            #
            # `suggested` carries the AI's dept/acc as well as its keys, because since
            # 2026-09-04 nothing writes them to the BU's config until a human approves —
            # the live config the review screen derives its JV rows from does not have
            # them, so this row is the only copy. Re-asking the model on open would cost a
            # second call and could answer differently than the queue's own reason line.
            "unmapped": list(mapping_missing or []),
            "guessed": sorted(mapping_suggested or {}),
            "suggested": dict(mapping_suggested or {}),
            # Which of the two documents this is. Everything downstream that has to build
            # a JV from this row — the review screen's read, and `approve_document`'s post
            # — branches on it, and nothing on the extraction itself says which layout
            # produced it: a settlement report and its commission invoice share the bank,
            # the date and the tax invoice number.
            "doc_type": doc_type,
        }
        await db.commit()


async def _finish(
    ledger_id: uuid.UUID,
    *,
    status: str,
    task_id: str | None = None,
    bank_code: str | None = None,
    doc_no: str | None = None,
    jv_no: str | None = None,
    reason_code: str | None = None,
    error: str | None = None,
    notify: bool = True,
) -> None:
    async with async_session() as db:
        row = await db.get(EmailDocument, ledger_id)
        if row is None:
            return
        row.status = status  # type: ignore[assignment]
        row.task_id = uuid.UUID(task_id) if task_id else None  # type: ignore[assignment]
        row.bank_code = bank_code  # type: ignore[assignment]
        row.doc_no = doc_no  # type: ignore[assignment]
        row.jv_no = jv_no or None  # type: ignore[assignment]
        row.reason_code = reason_code  # type: ignore[assignment]
        row.error_message = error  # type: ignore[assignment]
        # Terminal, so nobody is acting on it any more — an approve/reject claim ends here.
        row.posting_started_at = None  # type: ignore[assignment]
        # Every status this function writes is terminal, so the review payload has no
        # reader left. This is what keeps "extracted line items are not persisted" true in
        # the only sense that matters: they exist while a human owes us a decision about
        # them, and not one moment longer.
        row.review_payload = None  # type: ignore[assignment]
        # Most of `skipped` is deliberately silent — the customer's own filename/sender
        # rules saying "not this file" (see the _Skip handler above). `NOTIFIABLE_SKIPS`
        # is the part that is not: a document that was theirs, matched their rules, and
        # still never arrived because of something only they can change.
        notify_type = (
            f"document_{status}"
            if status in ("posted", "failed")
            else "document_blocked"
            if reason_code in NOTIFIABLE_SKIPS
            else None
        )
        if notify_type == "document_posted" and notify:
            # A receipt per document, deliberately not collapsed — unlike blocked/failed
            # below, the customer wants *this* document's JV number, not a running count.
            notification_service.notify(
                db,
                tenant_id=row.tenant_id,  # type: ignore[arg-type]
                order_id=None,
                type_=notify_type,
                payload={
                    "document_id": str(row.id),
                    "attachment": row.attachment,
                    "bank_code": bank_code,
                    "doc_no": doc_no,
                    "jv_no": jv_no,
                },
            )
        elif notify_type and notify:
            # Blocked/failed collapse per reason: a bad PDF password or a dead extractor
            # repeats across a batch the same way a busy poll does, so this folds into one
            # unread "N files: <reason>" row instead of one dialog per attachment. The
            # payload carries no document_id — the row opens the queue's `unposted` chip
            # (NotificationBell.tsx), not a per-document detail, so there is nowhere for
            # one to point.
            key = reason_code or "unknown"
            attachment = row.attachment
            message = (error or "")[:500]

            def _bump(prev: dict[str, Any] | None) -> dict[str, Any]:
                return {
                    "reason_code": reason_code,
                    "count": (prev.get("count", 0) if prev else 0) + 1,
                    "attachment": attachment,
                    "message": message,
                }

            await notification_service.notify_collapsed(
                db,
                tenant_id=row.tenant_id,  # type: ignore[arg-type]
                type_=notify_type,
                key=key,
                build_payload=_bump,
            )
        await db.commit()
