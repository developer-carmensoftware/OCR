"""Email Automation — poll the ingest mailbox and post what arrives.

    AIAGENT+<tag>@…  ─┬─ tag from the envelope → tenant   ← routing, costs nothing
                      ├─ entitled? → claim the ledger row (dedupe)
                      ├─ filename must match one of this BU's rules
                      ├─ open the file (this BU's passwords only)
                      ├─ charge a credit, create the task
                      ├─ extract                          ← first money spent
                      ├─ tax ID vs this BU's register     ← verification, not routing
                      ├─ GL mapping
                      └─ post the JV (+ the input-tax record) with this BU's token

**The envelope names the owner; the document confirms it.** The tag is issued per BU
and delivered inside the recipient address, so it is readable from the message headers
before anything is extracted — which is what gives the ledger row, the document credit
and the `llm_usage_logs` row a real `tenant_id`, and what bounds the spend on a mailbox
whose address is public by design.

The tax ID printed on the document is kept as an independent second check. It parks the
document only on **positive** evidence of conflict (a number registered to a different
BU); nothing matching is not a conflict, because some fee invoices never print the
buyer's TIN. Two signals that can disagree is the point: the one failure unattended
posting cannot recover from is money in the wrong company's ledger.

A `+tag` works for both arrival modes. On an auto-forward it arrives in `Delivered-To`;
on a manual forward the employee *types* the destination, so it is whatever Carmen's
screen told them to send to. (The earlier tax-ID-only design was adopted on the premise
that a manual forward "carries no trace of the original recipient" — true, and
irrelevant, since the recipient is chosen by the person forwarding.)

Deliberately a plain poll loop driven by an endpoint (see routers/email_automation.py),
not a worker process: pg_cron already calls endpoints with the internal job token, and
one mailbox does not need a queue broker.

ponytail: single pass, no retry of a failed document. The ledger records the reason
and attempts; add a retry sweep when real failures show it is worth it.

ponytail: attachments within a poll are processed serially, so one poll of a full batch
costs roughly batch_size × (one vision call + two Carmen posts). Size the cron interval
above that or polls overlap — harmless (`_claim` and the IMAP \\Seen flag both dedupe)
but pointless load. Parallelise per message if the daily-commission banks make the
backlog visible in `job_runs`.
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
from app.models.catalog import Bank
from app.models.email_automation import EmailDocument
from app.models.enums import AlertSeverity, JobStatus
from app.models.identity import Tenant
from app.models.observability import JobRun
from app.models.schemas import ExtractedCreditCardData
from app.services import anomaly_service, ocr_service
from app.services import email_settings_service as es
from app.services import gl_suggestion_service as gl
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
from app.services.quota_service import assert_module_enabled
from app.services.task_service import create_task
from app.utils.bank_detect import detect_bank_code
from app.utils.gl_filter import parse_default_account
from app.utils.image_processing import validate_magic_bytes
from app.utils.pdf_utils import ensure_pdf_openable

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = (".pdf", ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".heic")

# A legitimate bank mail carries one report, occasionally a few. The cap is against a
# forwarded chain whose signature logos are each their own MIME part — `imap_batch_size`
# limits messages per poll, not attachments per message.
MAX_ATTACHMENTS_PER_MESSAGE = 10

# Per poll, not per day: mail to an unknown or missing tag cannot be attributed to
# anyone, so nobody can be told about it. A handful is a mistyped address; a poll full
# of them is someone using the mailbox as a drop box.
UNROUTED_ALERT_THRESHOLD = 5

# Envelope headers only. **Never `To:`** — on an auto-forward that is still the
# customer's own address, so reading it would pass a hand-sent test and route every
# real auto-forward nowhere. `Delivered-To` is Gmail's; the other two are for relays
# that do not set it. A multi-hop forward produces several, hence all values, in order.
_DELIVERY_HEADERS = ("Delivered-To", "X-Original-To", "Envelope-To")

# `Received: … for <addr>` records the envelope recipient at the hop that accepted the
# mail, and it is the fallback because **`Delivered-To` is not guaranteed**: measured
# against the live dev mailbox on 2026-08-06, Gmail omits `Delivered-To` entirely when
# sender and recipient are the same account — the mail is accepted at submission
# (`ESMTPSA`) and never traverses the inbound MX hop that stamps it — while the `for`
# clause carried the tagged address verbatim. Genuine external mail had both.
#
# Same trust level as `Delivered-To`: written by a mail server, not by whoever composed
# the message, which is the distinction that keeps `To:` out. An upstream sender can
# fabricate either one, and gains nothing by it — the tag is the capability, so anyone
# who knows one can simply address the mail to it.
_RECEIVED_FOR = re.compile(r"\bfor\s+<([^>]+)>")


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
    """Every allowed-extension part, capped. `walk()` recurses into a message/rfc822
    part, so a forward-as-attachment still yields the inner PDF under its own name."""
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
        if len(out) >= MAX_ATTACHMENTS_PER_MESSAGE:
            logger.warning("[email] More than %d attachments — rest ignored", len(out))
            break
    return out


def _recipients(msg: Message) -> list[str]:
    """Every envelope-recipient candidate, delivery headers first then `Received … for`.

    Order matters only for a multi-hop forward, where the first match wins; both sources
    are the receiving server's own record of the address it accepted the mail for.
    """
    out = [_decode(v) for h in _DELIVERY_HEADERS for v in (msg.get_all(h) or [])]
    out += [
        found.group(1)
        for value in (msg.get_all("Received") or [])
        if (found := _RECEIVED_FOR.search(" ".join(value.split())))
    ]
    return out


def _fetch_unseen(limit: int) -> list[dict[str, Any]]:
    """Pull unseen mail and mark it seen in the same connection.

    `SMALLER` filters at the server, before `FETCH` pulls the whole message — including
    every attachment — into this process's memory. That is the byte-size cap the ingest
    path never had: `MAX_FILE_SIZE_MB` is enforced in `file_service.py`, which only the
    interactive upload path calls.

    Marked seen even when it turns out to be junk: an unattributable message has no
    ledger row to record it, so the IMAP flag is the only thing stopping it from being
    re-read on every poll forever.
    """
    box = imaplib.IMAP4_SSL(settings.imap_host, settings.imap_port)
    try:
        box.login(settings.imap_user, settings.imap_password)
        box.select(settings.imap_folder)
        max_octets = str(settings.max_file_size_mb * 1024 * 1024)
        try:
            _, data = box.search(None, "UNSEEN", "SMALLER", max_octets)
        except imaplib.IMAP4.error as exc:
            # SMALLER is RFC 3501 mandatory, but a broken server refusing it must not
            # silently mean "no mail today" — that is a total outage with no symptom.
            logger.warning("[email] IMAP SMALLER refused (%s) — searching without it", exc)
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
                    "recipients": _recipients(msg),
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


def tag_from_recipients(candidates: list[str]) -> str | None:
    """The `+tag` on the address this mail was delivered to, or None.

    Matched against our own configured mailbox, so no other address in the headers can
    produce a tag — including the customer's own, which is what `To:` holds on an
    auto-forward and why `To:` is not among the headers collected.
    """
    user, _, domain = settings.email_ingest_address.partition("@")
    if not domain:
        return None
    pattern = re.compile(
        rf"{re.escape(user)}\+([A-Za-z0-9]{{1,32}})@{re.escape(domain)}", re.IGNORECASE
    )
    for value in candidates:
        if found := pattern.search(value):
            return found.group(1).lower()
    return None


# Setting up an auto-forward in Gmail needs a code Google mails to the *destination*
# and the customer types back into their own Gmail screen. The destination is this
# shared mailbox, which no customer can open — so without this the last step of a
# self-service setup needs one of us to read the mail out to them.
_GMAIL_CONFIRM_SENDER = "forwarding-noreply@google.com"

# "(#123456789) Gmail Forwarding Confirmation - Receive Mail from x@y"
# ponytail: the subject only — `_fetch_unseen` does not carry the body, and the code
# is in both. If Google ever drops it from the subject, collect the body there and
# run this same pattern over it.
_GMAIL_CONFIRM_CODE = re.compile(r"\(#\s*(\d{6,12})\s*\)")


def gmail_confirm_code(sender: str, subject: str) -> str | None:
    """The forwarding confirmation code in this message, or None if it is not one.

    The sender is checked, not just the pattern: `(#123456789)` is an unremarkable
    thing for a bank to put in a subject line, and a false positive here would park
    a real document's worth of digits on the settings screen as a "code".
    """
    if _GMAIL_CONFIRM_SENDER not in (sender or "").lower():
        return None
    found = _GMAIL_CONFIRM_CODE.search(subject or "")
    return found.group(1) if found else None


def match_rules(rules: list[dict], sender: str, filename: str) -> list[dict]:
    """This BU's rules that claim this attachment. **Empty means stop** — no LLM call.

    A rule identifies a bank. Both of its conditions must hold, which is stricter than
    either alone: mail from KTC's address carrying a file only the BBL rule names stops
    rather than being scanned as BBL.

        narrow by bank_sender_email  →  matched nothing? keep every rule. A manual
                                        forward carries no bank sender, so this step
                                        must never empty the set.
        filter by filename_patterns  →  nothing left → the caller stops.

    Sender **narrows**, it does not short-circuit: returning on a sender hit without
    looking at the filename would walk straight past the gate.

    Several matches means the BU's patterns overlap. The list is returned rather than a
    winner so the caller can decline to guess the extraction prompt and let the document
    itself say which bank issued it.
    """
    active = [r for r in rules if r.get("is_active", True)]
    sender_l, filename_l = sender.lower(), filename.lower()
    by_sender = [
        r
        for r in active
        if (addr := (r.get("bank_sender_email") or "").lower()) and addr in sender_l
    ]
    # Substring, case-insensitive — `%pattern%`, so the word may sit anywhere in the
    # filename. Deliberately not equality: banks vary their names and employees rename
    # files before forwarding.
    return [
        r
        for r in (by_sender or active)
        if any(p.lower() in filename_l for p in (r.get("filename_patterns") or []) if p)
    ]


# ── Pipeline ──────────────────────────────────────────────────────────────────


async def run_ingest(limit: int | None = None) -> dict:
    """One poll. Returns a summary the job endpoint echoes back."""
    if not settings.imap_host:
        return {"status": "disabled", "reason": "IMAP not configured"}

    started = datetime.now(UTC)
    summary = {"messages": 0, "posted": 0, "failed": 0, "skipped": 0, "unrouted": 0}
    try:
        messages = await asyncio.to_thread(_fetch_unseen, limit or settings.imap_batch_size)
        summary["messages"] = len(messages)
        for msg in messages:
            for outcome in await _process_message(msg):
                summary[outcome] = summary.get(outcome, 0) + 1
    except Exception as exc:
        logger.exception("[email] Poll failed")
        await _record_run(started, summary, error=str(exc))
        raise

    logger.info("[email] Poll finished: %s", summary)
    await _record_run(started, summary)
    return summary


async def _record_run(started: datetime, summary: dict, error: str | None = None) -> None:
    """Persist the poll as a `job_runs` row so `#/admin/jobs` reports this job at all.

    Until now `run_ingest` returned a dict to whoever called the endpoint and wrote
    nothing, so a job that spends money on every poll was absent from the one page that
    answers "is the machine running?".

    Also raises one alert when a poll is mostly mail we cannot attribute — the counter
    §2.5 of the contract promises we watch. Never raises: a failed bookkeeping write
    must not turn a successful poll into a failed one.
    """
    try:
        async with async_session() as db:
            db.add(
                JobRun(
                    job_name="email-ingest",
                    started_at=started,
                    completed_at=datetime.now(UTC),
                    status=JobStatus.FAILED if error else JobStatus.SUCCESS,
                    rows_affected=summary.get("posted", 0),
                    error_message=error,
                )
            )
            await db.commit()
    except Exception as exc:
        logger.error("[email] Could not record the job run: %s", exc)

    if summary.get("unrouted", 0) >= UNROUTED_ALERT_THRESHOLD:
        await anomaly_service.open_alert_if_absent(
            # No tenant owns unrouted mail by definition — "system" is the fallback
            # llm/client.py already uses for cluster-wide alerts.
            tenant_id="system",
            module_id=Module.CREDIT_CARD_OCR,
            metric="email_ingest_unrouted",
            severity=AlertSeverity.WARN,
            description=(f"{summary['unrouted']} message(s) in one poll had no usable ingest tag"),
            actual=summary["unrouted"],
        )


async def _process_message(msg: dict[str, Any]) -> list[str]:
    """One message → one outcome per attachment (or a single message-level outcome).

    Everything expensive is behind two free checks: does it carry a file at all, and
    does its tag name a paying BU. Nothing here spends money, opens a file or writes a
    row for mail that fails either.
    """
    # Before the attachment check, because a confirmation mail has none — it is the
    # one message we care about that carries no document.
    if code := gmail_confirm_code(msg["from"], msg["subject"]):
        if tag := tag_from_recipients(msg["recipients"]):
            async with async_session() as db:
                await es.record_gmail_code(db, tag, code)
        else:
            # Deliberately not "unrouted": that counter watches for documents going
            # nowhere and alerts on five in a poll. A confirmation code we cannot
            # attribute is noise, and raising an alert for it would train us to
            # ignore the one that means real money is being dropped.
            logger.warning("[email] Gmail confirmation code with no usable tag — dropped")
        return ["skipped"]

    if not msg["attachments"]:
        return ["skipped"]

    tag = tag_from_recipients(msg["recipients"])
    if not tag:
        logger.warning("[email] No ingest tag on %s — dropped", msg["message_id"])
        return ["unrouted"]

    async with async_session() as db:
        row = await es.resolve_by_tag(db, tag)
        if row is None:
            # Nobody to notify: an unresolvable tag cannot be attributed to a tenant.
            # `_record_run` makes the volume visible to us instead.
            logger.warning("[email] Unknown ingest tag on %s — dropped", msg["message_id"])
            return ["unrouted"]
        # A lapsed package does not rewrite settings, so `enabled` stays true after it
        # expires — the gate has to be here, not only on the toggle.
        tenant = await db.get(Tenant, row.tenant_id)
        if tenant is None or not await es.is_entitled(db, tenant):
            logger.warning("[email] Tenant %s has no active package — dropped", row.tenant_id)
            return ["skipped"]
        tenant_id = str(row.tenant_id)
        rules = list(row.rules or [])
        passwords = es.rule_passwords(row)
        carmen_token, carmen_uri = await es.posting_target(db, row)

    return [
        await _process_attachment(
            tenant_id=tenant_id,
            message_id=msg["message_id"],
            sender=msg["from"],
            filename=filename,
            blob=blob,
            rules=rules,
            passwords=passwords,
            carmen_token=carmen_token,
            carmen_uri=carmen_uri,
        )
        for filename, blob in msg["attachments"]
    ]


async def _process_attachment(
    *,
    tenant_id: str,
    message_id: str,
    sender: str,
    filename: str,
    blob: bytes,
    rules: list[dict],
    passwords: list[str],
    carmen_token: str,
    carmen_uri: str,
) -> str:
    """Claim the ledger row, then run the document. 'posted' | 'failed' | 'skipped'.

    The claim is first and is the only dedupe: an atomic insert against
    `uq_email_documents_message`, which is keyed `(tenant_id, message_id, attachment)`
    and therefore usable now that the tenant is known up front. The separate
    pre-extraction `_already_seen` scan this replaces existed only because the tenant
    was not — it could not use that index and read the whole table instead.
    """
    async with async_session() as db:
        ledger = await _claim(db, tenant_id, message_id, filename)
    if ledger is None:
        logger.info("[email] Already handled: %s / %s", message_id, filename)
        return "skipped"
    ledger_id: uuid.UUID = ledger.id  # type: ignore[assignment]

    # carmen_service reads the target host from a ContextVar the request middleware
    # normally fills in; consume_document, assert_module_enabled and log_llm_usage read
    # the tenant from another. There is no request here, so the job sets both itself.
    tenant_ctx = current_tenant_id.set(tenant_id)
    uri_ctx = current_carmen_uri.set(carmen_uri)
    try:
        return await _run_document(
            ledger_id=ledger_id,
            tenant_id=tenant_id,
            sender=sender,
            filename=filename,
            blob=blob,
            rules=rules,
            passwords=passwords,
            carmen_token=carmen_token,
            carmen_uri=carmen_uri,
        )
    finally:
        current_carmen_uri.reset(uri_ctx)
        current_tenant_id.reset(tenant_ctx)


async def _run_document(
    *,
    ledger_id: uuid.UUID,
    tenant_id: str,
    sender: str,
    filename: str,
    blob: bytes,
    rules: list[dict],
    passwords: list[str],
    carmen_token: str,
    carmen_uri: str,
) -> str:
    """Gate, charge, extract, verify, post — every exit lands on the ledger."""
    charged: str | None = None
    task_id: str | None = None
    bank_code: str | None = None
    # Recorded on failures too: "several BUs failing on the same issuer at once" is the
    # only early warning that a bank changed its form, and it cannot be computed if a
    # failed row forgets which bank the document came from.
    doc_no: str | None = None
    try:
        matched = match_rules(rules, sender, filename)
        if not matched:
            # A too-narrow pattern silently dropped real documents before the tag named
            # the tenant. Now the miss is a row in *this BU's* ledger, diagnosable from
            # #/admin — and it costs nothing, which is what removes the whole
            # signature-logo class of junk from the spend.
            raise _Skip("no_rule_match", f"No rule matches {filename}", refund=False)
        # Overlapping patterns: don't guess the prompt, let detect_bank_code read the
        # document. A wrong bank prompt is worse than the generic one.
        bank_code = matched[0].get("bank_code") if len(matched) == 1 else None

        # Before any charge: a disguised, locked or corrupt file must not cost anything.
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

        # The first money of the document, and the tenant and task are already known —
        # so `log_llm_usage` inserts a fully attributed row rather than needing the
        # tenant-less parking buffer the tax-ID design forced on it.
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

        # A manual forward carries no bank identity, and overlapping rules name no one
        # bank — resolve it from the document, exactly as finalize_extraction does.
        bank_code = bank_code or detect_bank_code(
            bank_company_name=extracted.bank_company_name,
            bank_name=extracted.bank_name,
            company_name=extracted.company_name,
            doc_name=extracted.doc_name,
            raw_text=extracted.raw_text,
        )
        doc_no = extracted.doc_no

        # The second factor. The envelope said who owns this mail; if the document
        # carries a number registered to someone else, the two disagree and that stops
        # the post rather than picking a winner.
        async with async_session() as db:
            conflict = await es.foreign_tax_id(db, list(extracted.tax_ids or []), tenant_id)
        if conflict:
            raise _Skip(
                "tax_id_mismatch",
                f"Document carries tax ID {conflict}, registered to another BU",
            )

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
        # The gates that run before a credit is charged are the customer's own
        # configuration answering "not this file", not a failure of ours. Filing them as
        # `failed` would put a red row on Carmen's screen for a signature logo.
        status = "skipped" if charged is None else "failed"
        await _finish(
            ledger_id,
            status=status,
            task_id=task_id,
            bank_code=bank_code,
            doc_no=doc_no,
            reason_code=skip.reason_code,
            error=str(skip),
        )
        logger.warning("[email] %s: %s (%s)", skip.reason_code, skip, filename)
        return status
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


# ── Opening the file ──────────────────────────────────────────────────────────


async def _open_or_fail(blob: bytes, filename: str, passwords: list[str]) -> str | None:
    """Open the file, returning the password that worked (None = not encrypted).

    Runs before the credit is charged, so nothing here costs the customer anything.

    The magic-byte check is the gate the ingest path never had: `ensure_pdf_openable`
    is a no-op for anything that is not a PDF, so an `.jpg` that is really a text file
    used to reach the vision model and be paid for.

    Every one of *this BU's* configured passwords is tried, because overlapping rules
    can leave the issuing bank ambiguous. They are all the same customer's.
    """
    try:
        validate_magic_bytes(blob, filename)
    except ValueError as exc:
        raise _Skip("unreadable_document", str(exc), refund=False) from exc

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
