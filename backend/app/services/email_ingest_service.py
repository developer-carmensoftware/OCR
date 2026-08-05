"""Email Automation — poll the ingest mailbox and post what arrives.

    one address, every BU  ─┬─ dedupe on (Message-ID, attachment)
                            ├─ open the file (every enabled BU's passwords)
                            ├─ extract          ← nobody owns this yet
                            ├─ tax ID → tenant  ← routing
                            ├─ entitled? → charge → GL mapping
                            └─ post the JV with that BU's Carmen token

**The document routes itself.** The BU is identified by the tax ID printed on the
attachment, not by the address the mail was sent to — a `+tag` address could only
ever work for auto-forwarded mail, because a manual forward comes from an employee's
own client and carries no trace of the original recipient. The consequence is that
extraction happens *before* anyone is known to be responsible for it, so a mail we
cannot route costs us one LLM call. That is the price of supporting both arrival
modes with one address, and `summary["unrouted"]` is how we watch it.

Deliberately a plain poll loop driven by an endpoint (see routers/email_automation.py),
not a worker process: pg_cron already calls endpoints with the internal job token, and
one mailbox at 5-minute intervals does not need a queue broker.

ponytail: single pass, no retry of a failed document. The ledger records the reason
and attempts; add a retry sweep when real failures show it is worth it.
"""

from __future__ import annotations

import asyncio
import email
import imaplib
import logging
import uuid
from datetime import UTC, datetime
from email.header import decode_header, make_header
from email.message import Message
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.constants import Module
from app.context import current_carmen_uri, current_tenant_id, pending_llm_usage
from app.database import async_session
from app.exceptions import PdfPasswordRequired, ValidationError
from app.models.business import CreditCard
from app.models.catalog import Bank
from app.models.email_automation import EmailDocument
from app.models.identity import Tenant
from app.models.schemas import ExtractedCreditCardData
from app.services import email_settings_service as es
from app.services import gl_suggestion_service as gl
from app.services import ocr_service
from app.services.accounting_config_service import (
    description_for,
    fill_missing_mappings,
    get_accounting_config,
)
from app.services.carmen_service import (
    CarmenAPIError,
    get_account_codes,
    get_departments,
    get_tax_profiles,
    post_gljv,
    post_input_tax,
)
from app.services.cc_input_tax import build_input_tax_payload
from app.services.cc_jv import build_gljv_payload, build_jv_rows, unmapped_payment_types
from app.services.credit_card_service import finalize_extraction, mark_task_failed
from app.services.credit_service import consume_document, refund_document
from app.services.llm_usage_logger import flush_pending_usage
from app.services.quota_service import assert_module_enabled
from app.services.task_service import create_task
from app.utils.bank_detect import detect_bank_code
from app.utils.gl_filter import parse_default_account
from app.utils.pdf_utils import ensure_pdf_openable

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = (".pdf", ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".heic")


class _Skip(Exception):
    """Not an error — this document will not be posted. Carries a contract reason_code."""

    def __init__(self, reason_code: str, message: str, refund: bool = True):
        self.reason_code = reason_code
        self.refund = refund
        super().__init__(message)


# ── IMAP (blocking, run in a thread) ──────────────────────────────────────────


def _decode(value: str | None) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except (UnicodeDecodeError, LookupError, ValueError):
        return value


def _attachments(msg: Message) -> list[tuple[str, bytes]]:
    out: list[tuple[str, bytes]] = []
    for part in msg.walk():
        if part.get_content_maintype() == "multipart":
            continue
        filename = _decode(part.get_filename())
        if not filename or not filename.lower().endswith(ALLOWED_EXTENSIONS):
            continue
        payload = part.get_payload(decode=True)
        if isinstance(payload, bytes) and payload:
            out.append((filename, payload))
    return out


def _fetch_unseen(limit: int) -> list[dict[str, Any]]:
    """Pull unseen mail and mark it seen in the same connection.

    Marked seen even when it turns out to be junk: the dedupe ledger cannot record
    a mail we could not attribute to a tenant, so the IMAP flag is the only thing
    stopping an unattributable message from being re-read on every poll forever.
    """
    box = imaplib.IMAP4_SSL(settings.imap_host, settings.imap_port)
    try:
        box.login(settings.imap_user, settings.imap_password)
        box.select(settings.imap_folder)
        _, data = box.search(None, "UNSEEN")
        uids = [u.decode() for u in (data[0] or b"").split()[:limit]]
        messages = []
        for uid in uids:
            _, fetched = box.fetch(uid, "(RFC822)")
            if not fetched or not isinstance(fetched[0], tuple):
                continue
            msg = email.message_from_bytes(fetched[0][1])
            messages.append(
                {
                    "message_id": (msg.get("Message-ID") or f"no-id-{uid}")[:500],
                    "subject": _decode(msg.get("Subject")),
                    "from": _decode(msg.get("From")),
                    "attachments": _attachments(msg),
                }
            )
            box.store(uid, "+FLAGS", "\\Seen")
        return messages
    finally:
        try:
            box.logout()
        except OSError:
            pass


# ── Routing ───────────────────────────────────────────────────────────────────


def match_rule(rules: list[dict], sender: str, filename: str) -> dict | None:
    """The rule this attachment belongs to, or None (→ generic prompt + auto-detect).

    A rule identifies a **bank**, not a BU — "no-reply@ktc.co.th sends KTC fee
    invoices" is equally true whoever the document belongs to. So the pool it is
    matched against is every enabled BU's rules, and the only thing the answer is
    used for is picking the bank-specific extraction prompt before we know the owner.

    Sender match is the fast path for auto-forwarded mail. A manual forward comes
    from an employee, so it falls through to the filename pattern and then to None —
    which is fine, the bank is detected from the document itself.
    """
    active = [r for r in rules if r.get("is_active", True)]
    sender_l, filename_l = sender.lower(), filename.lower()
    for rule in active:
        addr = (rule.get("bank_sender_email") or "").lower()
        if addr and addr in sender_l:
            return rule
    for rule in active:
        pattern = (rule.get("filename_pattern") or "").lower()
        if pattern and pattern in filename_l:
            return rule
    return None


# ── Pipeline ──────────────────────────────────────────────────────────────────


async def run_ingest(limit: int | None = None) -> dict:
    """One poll. Returns a summary the job endpoint echoes back."""
    if not settings.imap_host:
        return {"status": "disabled", "reason": "IMAP not configured"}

    messages = await asyncio.to_thread(_fetch_unseen, limit or settings.imap_batch_size)
    summary = {"messages": len(messages), "posted": 0, "failed": 0, "skipped": 0, "unrouted": 0}

    # Read once per poll, not per attachment: the mailbox is shared, so the pool of
    # bank rules and PDF passwords is the same for every message in it.
    async with async_session() as db:
        rules, passwords = await es.ingest_pool(db)

    for msg in messages:
        for filename, blob in msg["attachments"]:
            outcome = await _process_attachment(
                message_id=msg["message_id"],
                sender=msg["from"],
                filename=filename,
                blob=blob,
                rules=rules,
                passwords=passwords,
            )
            summary[outcome] = summary.get(outcome, 0) + 1
        if not msg["attachments"]:
            summary["skipped"] += 1

    logger.info("[email] Poll finished: %s", summary)
    return summary


async def _process_attachment(
    *,
    message_id: str,
    sender: str,
    filename: str,
    blob: bytes,
    rules: list[dict],
    passwords: list[str],
) -> str:
    """Extract → route → post one attachment.

    Returns 'posted' | 'failed' | 'skipped' | 'unrouted'.

    Everything up to routing runs with no tenant: there is no ledger row to write
    (it needs one) and nothing to charge, so a failure before that point is a log
    line and a counter. The ledger and the money start once the document has named
    its owner.
    """
    if await _already_seen(message_id, filename):
        logger.info("[email] Already seen: %s / %s", message_id, filename)
        return "skipped"

    # `llm_usage_logs.tenant_id` is NOT NULL, and the extraction below happens
    # before anyone is identified. Parking its cost here is what stops the insert
    # from raising inside the logger's own except-and-continue and taking the whole
    # row with it — a live run on 2026-08-05 logged nothing at all without this.
    # `_post_extracted` flushes the buffer once it has a tenant and a task.
    usage_ctx = pending_llm_usage.set([])
    try:
        return await _route_and_post(
            message_id=message_id,
            sender=sender,
            filename=filename,
            blob=blob,
            rules=rules,
            passwords=passwords,
        )
    finally:
        pending_llm_usage.reset(usage_ctx)


async def _route_and_post(
    *,
    message_id: str,
    sender: str,
    filename: str,
    blob: bytes,
    rules: list[dict],
    passwords: list[str],
) -> str:
    try:
        # Before any charge: a locked or corrupt file must not cost anything.
        password = await _open_or_fail(blob, filename, passwords)
    except _Skip as skip:
        logger.warning("[email] %s: %s (%s)", skip.reason_code, skip, filename)
        return "skipped"

    bank_code = (match_rule(rules, sender, filename) or {}).get("bank_code")
    try:
        extracted = await ocr_service.extract_stateless(
            file_bytes=blob,
            original_filename=filename,
            bank_code=bank_code,
            task_id=None,
            pdf_password=password,
        )
    except Exception:
        logger.exception("[email] Could not extract %s — dropped", filename)
        return "failed"

    async with async_session() as db:
        row = await es.resolve_by_tax_ids(db, list(extracted.tax_ids or []))
        if row is None:
            # We paid for that extraction and nobody owns it. Deliberate: the
            # alternative is refusing manual forwards. Watch the counter.
            logger.warning(
                "[email] No BU registered for tax IDs %s (%s) — dropped",
                extracted.tax_ids,
                filename,
            )
            return "unrouted"
        # A lapsed package does not rewrite settings, so `enabled` stays true after
        # it expires — the gate has to be here, not only on the toggle.
        tenant = await db.get(Tenant, row.tenant_id)
        if tenant is None or not await es.is_entitled(db, tenant):
            logger.warning("[email] Tenant %s has no active package — dropped", row.tenant_id)
            return "skipped"
        tenant_id = str(row.tenant_id)
        carmen_token, carmen_uri = await es.posting_target(db, row)

    # carmen_service reads the target host from a ContextVar the request middleware
    # normally fills in, and consume_document/assert_module_enabled read the tenant
    # from another. There is no request here, so the job sets both itself — and only
    # now, because until this line there was no tenant to set them to.
    tenant_ctx = current_tenant_id.set(tenant_id)
    uri_ctx = current_carmen_uri.set(carmen_uri)
    try:
        return await _post_extracted(
            extracted=extracted,
            tenant_id=tenant_id,
            message_id=message_id,
            filename=filename,
            bank_code=bank_code,
            carmen_token=carmen_token,
            carmen_uri=carmen_uri,
        )
    finally:
        current_carmen_uri.reset(uri_ctx)
        current_tenant_id.reset(tenant_ctx)


async def _post_extracted(
    *,
    extracted: ExtractedCreditCardData,
    tenant_id: str,
    message_id: str,
    filename: str,
    bank_code: str | None,
    carmen_token: str,
    carmen_uri: str,
) -> str:
    """Charge, record and post a document whose owner is now known."""
    async with async_session() as db:
        ledger = await _claim(db, tenant_id, message_id, filename)
        if ledger is None:
            # `_already_seen` answered before the extraction; this is the atomic
            # guard against two polls racing on the same attachment.
            logger.info("[email] Already claimed: %s / %s", message_id, filename)
            return "skipped"
        ledger_id: uuid.UUID = ledger.id  # type: ignore[assignment]

    charged: str | None = None
    task_id: str | None = None
    # Recorded on failures too: "several BUs failing on the same issuer at once"
    # is the only early warning that a bank changed its form, and it cannot be
    # computed if a failed row forgets which bank the document came from.
    doc_no: str | None = None
    try:
        await assert_module_enabled(Module.CREDIT_CARD_OCR)
        charged = await consume_document()

        async with async_session() as db:
            task = await create_task(
                db,
                tenant_id=tenant_id,
                module_id=Module.CREDIT_CARD_OCR,
                original_filename=filename,
                carmen_user_id=None,
            )
            task_id = str(task.id)

        # The extraction's cost, parked before we knew whose document this was.
        await flush_pending_usage(task_id)

        try:
            extracted = await finalize_extraction(extracted, task_id, tenant_id, bank_code, None)
        except Exception as exc:
            await mark_task_failed(task_id, exc)
            raise

        # A manual forward carries no bank identity, so the rule may not have named
        # one — resolve it from the document, exactly as finalize_extraction does.
        bank_code = bank_code or detect_bank_code(
            bank_company_name=extracted.bank_company_name,
            bank_name=extracted.bank_name,
            company_name=extracted.company_name,
            doc_name=extracted.doc_name,
            raw_text=extracted.raw_text,
        )
        doc_no = extracted.doc_no

        if extracted.is_duplicate:
            raise _Skip("duplicate_document", f"Document {extracted.doc_no} already submitted")

        async with async_session() as db:
            config = await get_accounting_config(db, tenant_id)
        missing = unmapped_payment_types(extracted.details, config.mappings or {})
        if missing:
            # Nobody is here to confirm a guess, and parking every document of a BU
            # that never opened the mapping page is the worse failure. So the AI fills
            # the gap and what it picked is *saved* — the next document carrying the
            # same payment type is deterministic.
            suggested = await _suggest_missing_mappings(missing, bank_code, carmen_token)
            if suggested:
                async with async_session() as db:
                    await fill_missing_mappings(db, tenant_id, suggested)
                config.mappings = {**(config.mappings or {}), **suggested}
            still = unmapped_payment_types(extracted.details, config.mappings or {})
            if still:
                # Fallback, not a closed door: the LLM had no answer or Carmen's
                # master was unreachable.
                raise _Skip("mapping_incomplete", f"No GL mapping for: {', '.join(still)}")

        rows = build_jv_rows(extracted.details, config.mappings or {})
        if not rows or not any(r["credit"] for r in rows):
            # Zero-total document: posting an empty JV is worse than absorbing the
            # extraction cost, so refund and stop.
            raise _Skip("unreadable_document", "Document has no postable amounts")

        if not carmen_token:
            raise _Skip("carmen_rejected", "No Carmen posting credential for this BU")
        if not carmen_uri:
            # Park with the honest reason. Without this the RuntimeError from
            # carmen_service._base_url falls through to the generic handler and the
            # document is filed as unreadable, which sends everyone looking at the PDF.
            raise _Skip("carmen_rejected", "No Carmen host known for this BU")

        payload = build_gljv_payload(
            rows, doc_date=extracted.doc_date, bank_code=bank_code, config=config
        )
        result = await post_gljv(payload, carmen_token)
        if not result or result.get("Code", -1) != 0:
            raise _Skip(
                "carmen_rejected",
                str((result or {}).get("UserMessage") or "Carmen rejected the JV"),
                refund=False,  # the extraction was fine; the ERP declined it
            )

        await _mark_submitted(extracted.id)

        # The statement's second Carmen document (wizard step 4). Deliberately after
        # the JV and deliberately unable to fail it: the JV is already in Carmen's
        # books and there is no rollback, so a missing input-tax record is recorded
        # for a human to add rather than turned into a failure that refunds a
        # credit for work that was done.
        tax_error = await _post_input_tax(
            extracted, bank_code=bank_code, config=config, carmen_token=carmen_token
        )

        await _finish(
            ledger_id,
            status="posted",
            task_id=task_id,
            bank_code=bank_code,
            doc_no=doc_no,
            jv_no=str(result.get("InternalMessage") or ""),
            error=tax_error,
        )
        logger.info("[email] Posted %s (%s) for tenant %s", extracted.doc_no, filename, tenant_id)
        return "posted"

    except _Skip as skip:
        if skip.refund and charged:
            await refund_document(charged)
        await _finish(
            ledger_id,
            status="failed",
            task_id=task_id,
            bank_code=bank_code,
            doc_no=doc_no,
            reason_code=skip.reason_code,
            error=str(skip),
        )
        logger.warning("[email] %s: %s (%s)", skip.reason_code, skip, filename)
        return "failed"
    except CarmenAPIError as exc:
        # Transport failure — the JV's fate is unknown, so do NOT refund and do not
        # retry automatically; a human decides after checking Carmen.
        await _finish(
            ledger_id,
            status="failed",
            task_id=task_id,
            bank_code=bank_code,
            doc_no=doc_no,
            reason_code="carmen_rejected",
            error=str(exc),
        )
        return "failed"
    except Exception as exc:
        if charged:
            await refund_document(charged)
        await _finish(
            ledger_id,
            status="failed",
            task_id=task_id,
            bank_code=bank_code,
            doc_no=doc_no,
            reason_code="unreadable_document",
            error=str(exc),
        )
        logger.exception("[email] Failed on %s", filename)
        return "failed"


# ── Input tax (the statement's second Carmen document) ────────────────────────


async def _post_input_tax(
    extracted: ExtractedCreditCardData,
    *,
    bank_code: str | None,
    config: Any,
    carmen_token: str,
) -> str | None:
    """File the VAT the bank charged. Returns a note to keep on the ledger, or None.

    Never raises. The JV it follows is already in Carmen's books, so the only useful
    answers here are "done" and "someone needs to add this by hand" — turning a
    failure into an exception would refund a credit and mark a posted document as
    failed, which is the one outcome that is wrong twice.
    """
    async with async_session() as db:
        bank = await db.get(Bank, bank_code) if bank_code else None

    try:
        payload, skipped = build_input_tax_payload(
            extracted.details,
            doc_no=extracted.doc_no,
            doc_date=extracted.doc_date,
            bank=bank,
            branch=getattr(config, "branch", None),
            description=description_for(config, bank_code),
            tax_profiles_raw=await get_tax_profiles(carmen_token),
        )
        if payload is None:
            if skipped:
                # A claim that should have been made and was not. Kept on the ledger
                # rather than only in a log line, because nothing else would ever
                # tell the customer the VAT is theirs to add by hand.
                logger.warning("[email] %s (%s)", skipped, extracted.doc_no)
            return skipped
        result = await post_input_tax(payload, carmen_token)
    except Exception as exc:
        logger.exception("[email] Input tax failed for %s", extracted.doc_no)
        return f"JV posted; input tax not recorded: {exc}"

    if not result or result.get("Code", -1) != 0:
        message = str((result or {}).get("UserMessage") or "Carmen rejected the input-tax record")
        logger.error("[email] Input tax rejected for %s: %s", extracted.doc_no, message)
        return f"JV posted; input tax not recorded: {message}"

    logger.info("[email] Input tax recorded for %s", extracted.doc_no)
    return None


# ── GL mapping the BU never set ───────────────────────────────────────────────

# `unmapped_payment_types` speaks the config's keys; the suggester speaks the
# wizard's labels. Same three fields (useMappingSuggestions.ts `suggestKeyMap`).
_FIXED_LABEL = {
    "commission": "Credit card commission",
    "tax": "Input Tax",
    "net": "Bank Account",
}


async def _suggest_missing_mappings(
    missing: list[str], bank_code: str | None, carmen_token: str
) -> dict[str, dict[str, str]]:
    """AI-fill the mappings this BU has none for, using the wizard's own suggester.

    Only pairs where both codes survived validation against Carmen's master (and the
    dept's DefaultAccount rule) are returned — a half-filled mapping would post a JV
    line with a blank account.
    """
    if not carmen_token:
        return {}
    try:
        accounts_raw = await get_account_codes(carmen_token)
        depts_raw = await get_departments(carmen_token)
    except CarmenAPIError as exc:
        logger.warning("[email] Could not read Carmen GL master for suggestions: %s", exc)
        return {}

    accounts = [
        {
            "code": a["AccCode"],
            "name": a.get("Description") or "",
            "type": (a.get("Type") or "").lower(),
        }
        for a in (accounts_raw.get("Data") or [])
        if a.get("AccCode") and a.get("AccCode") != "AccCode"
    ]
    departments = [
        {
            "code": d["DeptCode"],
            "name": d.get("Description") or "",
            "allowed_accounts": sorted(parse_default_account(d.get("DefaultAccount"))),
        }
        for d in (depts_raw.get("Data") or [])
        if d.get("DeptCode") and d.get("DeptCode") != "CodeDep"
    ]

    out: dict[str, dict[str, str]] = {}
    if fixed := [m for m in missing if m in _FIXED_LABEL]:
        result = await gl.suggest_fixed_fields(accounts, departments)
        sugg = (result.output or {}).get("suggestions") or {}
        out.update({key: sugg.get(_FIXED_LABEL[key]) or {} for key in fixed})
    if dynamic := [m for m in missing if m not in _FIXED_LABEL]:
        result = await gl.suggest_payment_types(
            payment_types=dynamic, accounts=accounts, departments=departments, bank_code=bank_code
        )
        out.update((result.output or {}).get("suggestions") or {})

    filled = {k: v for k, v in out.items() if v.get("dept") and v.get("acc")}
    logger.info("[email] AI filled %d/%d missing GL mapping(s)", len(filled), len(missing))
    return filled


# ── PDF passwords ─────────────────────────────────────────────────────────────


async def _open_or_fail(blob: bytes, filename: str, passwords: list[str]) -> str | None:
    """Open the file, returning the password that worked (None = not encrypted).

    Every configured password is tried because the issuing bank is usually not known
    yet — a manual forward carries no bank identity (§2.3). They are all the
    customer's own and there is a handful at most.
    """
    last: Exception | None = None
    for pwd in [None, *passwords]:
        try:
            await ensure_pdf_openable(blob, filename, pwd)
            return pwd
        except (PdfPasswordRequired, ValidationError) as exc:
            last = exc
    raise _Skip("wrong_pdf_password", str(last or "Could not open the attachment"), refund=False)


# ── Ledger ────────────────────────────────────────────────────────────────────


async def _already_seen(message_id: str, filename: str) -> bool:
    """Have we handled this (message, attachment) before, under *any* tenant?

    Has to run before extraction now, and cannot name a tenant — that is the whole
    point, we do not know one yet. Without it a re-delivered mail is re-extracted
    (and paid for) before `_claim` gets the chance to reject it.

    ponytail: the unique index starts with tenant_id, so this predicate cannot use
    it and scans instead. `email_documents` holds one row per attachment we have
    ever looked at, which is small for a long time; add an index on
    `(message_id, attachment)` when it stops being.
    """
    async with async_session() as db:
        return (
            await db.scalar(
                select(EmailDocument.id)
                .where(
                    EmailDocument.message_id == message_id,
                    EmailDocument.attachment == filename[:255],
                )
                .limit(1)
            )
        ) is not None


async def _claim(
    db: AsyncSession, tenant_id: str, message_id: str, filename: str
) -> EmailDocument | None:
    """Insert the ledger row. None = this (message, attachment) was already handled."""
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


async def _mark_submitted(card_id: str | None) -> None:
    """Stamp `credit_cards.submitted_at` — the same thing the wizard does after posting.

    Without it the duplicate guard is blind to everything this job posts: the check
    on the way in reads `submitted_at IS NOT NULL` (`has_submitted_doc`), so a
    document forwarded twice in two different mails posts twice. The ledger's own
    dedupe key is (message, attachment), which catches the same *mail* again and
    not the same *document* — and both arrival modes carrying one report is exactly
    the case CARMEN_INTEGRATION.md §0.1 promises we handle.

    Failing here must not undo a JV Carmen has already accepted, so this logs and
    returns; the partial unique index on (tenant, bank_code, doc_no) is what makes
    a lost stamp loud rather than silent.
    """
    if not card_id:
        return
    try:
        async with async_session() as db:
            card = await db.get(CreditCard, uuid.UUID(card_id))
            if card is not None:
                card.submitted_at = datetime.now(UTC)  # type: ignore[assignment]
                await db.commit()
    except Exception:
        logger.exception("[email] Could not stamp submitted_at on card %s", card_id)


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
        await db.commit()
