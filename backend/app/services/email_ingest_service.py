"""Email Automation — poll the ingest mailbox and post what arrives.

    ocr+<tag>@…  ─┬─ tag → tenant (before any LLM call is paid for)
                  ├─ dedupe on Message-ID
                  ├─ extract → tax-ID gate → GL mapping
                  └─ post the JV with that BU's Carmen token

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
import re
import uuid
from datetime import UTC, datetime
from email.header import decode_header, make_header
from email.message import Message
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.constants import Module
from app.context import current_carmen_uri, current_tenant_id
from app.database import async_session
from app.exceptions import PdfPasswordRequired, ValidationError
from app.models.business import CreditCard
from app.models.email_automation import EmailDocument, EmailIngestSettings
from app.services import email_settings_service as es
from app.services import ocr_service
from app.services.accounting_config_service import get_accounting_config
from app.services.carmen_service import CarmenAPIError, post_gljv
from app.services.cc_jv import build_gljv_payload, build_jv_rows, unmapped_payment_types
from app.services.credit_card_service import finalize_extraction, mark_task_failed
from app.services.credit_service import consume_document, refund_document
from app.services.quota_service import assert_module_enabled
from app.services.task_service import create_task
from app.utils.bank_detect import detect_bank_code
from app.utils.pdf_utils import ensure_pdf_openable

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = (".pdf", ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".heic")

# Headers that can still carry the address the mail was *delivered* to. `To:` alone
# is not enough: an auto-forward rule often rewrites it, while Delivered-To /
# X-Original-To survive.
_RECIPIENT_HEADERS = ("Delivered-To", "X-Original-To", "X-Forwarded-To", "To", "Cc")


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
                    "recipients": [
                        v for h in _RECIPIENT_HEADERS for v in (msg.get_all(h) or []) if v
                    ],
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


def extract_tag(recipients: list[str], mailbox_address: str) -> str | None:
    """`ocr+7f3a91@carmensoftware.com` → `7f3a91`, from any recipient header."""
    user, _, domain = mailbox_address.partition("@")
    pattern = re.compile(
        rf"{re.escape(user)}\+([a-zA-Z0-9_-]{{1,32}})@{re.escape(domain)}", re.IGNORECASE
    )
    for value in recipients:
        match = pattern.search(value)
        if match:
            return match.group(1).lower()
    return None


def match_rule(rules: list[dict], sender: str, filename: str) -> dict | None:
    """The rule this attachment belongs to, or None (→ generic prompt + auto-detect).

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
    summary = {"messages": len(messages), "posted": 0, "failed": 0, "skipped": 0}

    for msg in messages:
        tag = extract_tag(msg["recipients"], settings.email_ingest_address)
        if not tag:
            logger.warning("[email] No ingest tag on message %s — dropped", msg["message_id"])
            summary["skipped"] += 1
            continue
        async with async_session() as db:
            row = await es.get_by_tag(db, tag)
            if row is None or not row.enabled:
                logger.warning("[email] Tag %s unknown or disabled — dropped", tag)
                summary["skipped"] += 1
                continue
            tenant_id = str(row.tenant_id)
            rules = list(row.rules or [])
            tax_ids = set(row.tax_ids or [])
            passwords = es.rule_passwords(row)
            token, carmen_uri = await es.posting_target(db, row)

        # carmen_service reads the target host from a ContextVar the request
        # middleware normally fills in. There is no request here, so the job has to
        # set it itself — without this every post raises and lands in the ledger
        # under the wrong reason.
        token_ctx = current_tenant_id.set(tenant_id)
        uri_ctx = current_carmen_uri.set(carmen_uri)
        try:
            for filename, blob in msg["attachments"]:
                outcome = await _process_attachment(
                    tenant_id=tenant_id,
                    message_id=msg["message_id"],
                    sender=msg["from"],
                    filename=filename,
                    blob=blob,
                    rules=rules,
                    tax_ids=tax_ids,
                    passwords=passwords,
                    carmen_token=token,
                    carmen_uri=carmen_uri,
                )
                summary[outcome] = summary.get(outcome, 0) + 1
            if not msg["attachments"]:
                summary["skipped"] += 1
        finally:
            current_carmen_uri.reset(uri_ctx)
            current_tenant_id.reset(token_ctx)

    logger.info("[email] Poll finished: %s", summary)
    return summary


async def _process_attachment(
    *,
    tenant_id: str,
    message_id: str,
    sender: str,
    filename: str,
    blob: bytes,
    rules: list[dict],
    tax_ids: set[str],
    passwords: list[str],
    carmen_token: str,
    carmen_uri: str = "",
) -> str:
    """Extract → verify → post one attachment. Returns 'posted' | 'failed' | 'skipped'."""
    async with async_session() as db:
        ledger = await _claim(db, tenant_id, message_id, filename)
        if ledger is None:
            logger.info("[email] Already seen: %s / %s", message_id, filename)
            return "skipped"
        ledger_id: uuid.UUID = ledger.id  # type: ignore[assignment]

    charged: str | None = None
    task_id: str | None = None
    # Recorded on failures too: "several BUs failing on the same issuer at once"
    # is the only early warning that a bank changed its form, and it cannot be
    # computed if a failed row forgets which bank the document came from.
    bank_code: str | None = None
    doc_no: str | None = None
    try:
        rule = match_rule(rules, sender, filename)
        bank_code = (rule or {}).get("bank_code")

        # Before any charge: a locked or corrupt file must not cost a credit.
        password = await _open_or_fail(blob, filename, passwords)
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

        try:
            extracted = await ocr_service.extract_stateless(
                file_bytes=blob,
                original_filename=filename,
                bank_code=bank_code,
                task_id=task_id,
                pdf_password=password,
            )
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

        # The one check automatic posting cannot recover from (§2.4): a document
        # belonging to another legal entity must never reach these books.
        if not tax_ids & set(extracted.tax_ids or []):
            raise _Skip("tax_id_mismatch", "This document belongs to a different company")

        async with async_session() as db:
            config = await get_accounting_config(db, tenant_id)
        missing = unmapped_payment_types(extracted.details, config.mappings or {})
        if missing:
            raise _Skip("mapping_incomplete", f"No GL mapping for: {', '.join(missing)}")

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

        await _finish(
            ledger_id,
            status="posted",
            task_id=task_id,
            bank_code=bank_code,
            doc_no=doc_no,
            jv_no=str(result.get("InternalMessage") or ""),
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


async def get_settings_status(db: AsyncSession, row: EmailIngestSettings) -> dict:
    """Counts for the `status` block of GET /carmen/settings."""
    from sqlalchemy import func, select

    total, last = (
        await db.execute(
            select(func.count(EmailDocument.id), func.max(EmailDocument.created_at)).where(
                EmailDocument.tenant_id == row.tenant_id
            )
        )
    ).one()
    return {
        "documents_total": total or 0,
        "last_received_at": last.isoformat() if last else None,
    }
