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
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.constants import Module
from app.context import current_carmen_uri, current_tenant_id
from app.database import async_session
from app.exceptions import (
    ExtractionError,
    InsufficientCredits,
    ModuleDisabled,
    PdfPasswordRequired,
    ValidationError,
)
from app.models.business import CreditCard
from app.models.catalog import Bank
from app.models.email_automation import EmailDocument
from app.models.enums import AlertSeverity, JobStatus
from app.models.identity import Tenant
from app.models.observability import JobRun
from app.models.schemas import ExtractedCreditCardData
from app.services import anomaly_service, notification_service, ocr_service
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
from app.services.email_imap import (
    auto_confirm_forwarding,
    fetch_confirmations,
    fetch_unseen,
    gmail_confirm_code,
    gmail_confirm_link,
    mark_seen,
    match_rules,
    sender_allowed,
    tag_from_recipients,
    unique_names,
    unmark_seen,
)
from app.services.module_gate import assert_module_enabled
from app.services.task_service import create_task
from app.utils.bank_detect import detect_bank_code
from app.utils.gl_filter import parse_default_account
from app.utils.image_processing import validate_magic_bytes
from app.utils.pdf_utils import ensure_pdf_openable

logger = logging.getLogger(__name__)

# The stops that say nothing about the document itself: the BU has nothing left to spend,
# or the module is switched off for them. Both are somebody's to reverse, so both hand the
# mail back unread rather than spending a ledger row — and a ledger row is exactly what
# would make it unrecoverable, since `_claim` dedupes on (tenant, message, attachment).
_HOLD = (InsufficientCredits, ModuleDisabled)

# Per poll, not per day: mail to an unknown or missing tag cannot be attributed to
# anyone, so nobody can be told about it. A handful is a mistyped address; a poll full
# of them is someone using the mailbox as a drop box.
UNROUTED_ALERT_THRESHOLD = 5

# How recently a BU must have touched its settings to count as "setting up forwarding
# right now". The gate on the confirmation sweep — see `es.tags_awaiting_confirmation`.
CONFIRM_WINDOW_HOURS = 24


class _Skip(Exception):
    """Not an error — this document will not be posted. Carries a contract reason_code.

    Carries no refund flag on purpose: once the vision model has run, the document is
    charged whatever happens next. Every `_Skip` is raised either before the charge (so
    there is nothing to refund) or after extraction succeeded (so the LLM cost is already
    real) — see the refund boundary in `_run_document`.
    """

    def __init__(self, reason_code: str, message: str):
        self.reason_code = reason_code
        super().__init__(message)


# ── Pipeline ──────────────────────────────────────────────────────────────────

# One poll at a time per process — see `run_ingest`.
_poll_lock = asyncio.Lock()


async def run_ingest(limit: int | None = None) -> dict:
    """One poll. Returns a summary the job endpoint echoes back.

    Serialised against itself. A batch whose documents are slow can outlast the poll
    interval, and a second poll starting on top of it would not duplicate work — the
    `\\Seen` flag and `_claim` both dedupe — but it would double this job's share of a
    connection pool capped at 15 for the whole application. Skipping is free and the
    backlog is still there in ten minutes.
    """
    if not settings.imap_host:
        return {"status": "disabled", "reason": "IMAP not configured"}
    if _poll_lock.locked():
        logger.info("[email] Poll still running — this tick skipped")
        return {"status": "busy"}

    async with _poll_lock:
        started = datetime.now(UTC)
        # `retry_later` is in the initial shape rather than only appearing when it happens:
        # it is the counter that says "mail is piling up unread because someone switched
        # something off", and a key that vanishes on the healthy path is one the admin page
        # cannot render honestly.
        summary = {
            "messages": 0,
            "posted": 0,
            "failed": 0,
            "skipped": 0,
            "unrouted": 0,
            "retry_later": 0,
            # Unseen mail already past `IMAP_HOLD_DAYS` — no poll will ever see it again.
            # In the initial shape for the same reason as `retry_later`: a key that only
            # appears when things are wrong is one the admin page cannot render honestly.
            "beyond_window": 0,
        }
        # Tags that cannot be spent against right now, and the mail to hand back for them.
        exhausted: set[str] = set()
        retry: list[str] = []
        # How many of `messages` have been decided about. `fetch_unseen` flagged the whole
        # batch on the way in, so anything this loop never reached is `\Seen`, unprocessed
        # and — having never got as far as `_claim` — recorded nowhere at all.
        messages: list[dict[str, Any]] = []
        done = 0
        try:
            messages, beyond = await asyncio.to_thread(
                fetch_unseen, limit or settings.imap_batch_size
            )
            summary["messages"] = len(messages)
            summary["beyond_window"] = beyond
            for msg in messages:
                outcomes = await _process_message(msg, exhausted)
                if "retry_later" in outcomes:
                    retry.append(msg["uid"])
                for outcome in outcomes:
                    summary[outcome] = summary.get(outcome, 0) + 1
                done += 1
        except Exception as exc:
            logger.exception("[email] Poll failed")
            # Everything the loop never attempted goes back unread. `messages[done]` — the
            # one that actually raised — stays `\Seen` on purpose: handing it back would
            # re-crash the next poll on it forever, and the FAILED `job_runs` row plus the
            # traceback above is the trail for that one message.
            retry.extend(m["uid"] for m in messages[done + 1 :])
            await asyncio.to_thread(unmark_seen, retry)
            await _record_run(started, summary, error=str(exc))
            raise

        if summary.get("beyond_window"):
            logger.warning(
                "[email] %d unseen message(s) are older than the %d-day hold window and "
                "will never be polled again",
                summary["beyond_window"],
                settings.imap_hold_days,
            )
        # One IMAP round trip for the whole batch, and only when something was left
        # undone — the common poll never reaches it.
        await asyncio.to_thread(unmark_seen, retry)
        logger.info("[email] Poll finished: %s", summary)
        await _record_run(started, summary)
        return summary


# Per process, which is what "no overlapping sweeps" means on a single Render instance.
# A second replica would sweep concurrently; harmless — both read the same mailbox and
# `record_gmail_confirmed` is idempotent.
_sweep_lock = asyncio.Lock()


async def sweep_confirmations() -> dict:
    """Follow any Gmail forwarding-confirmation link waiting in the mailbox. Cheap by design.

    Split out of `run_ingest` and scheduled every minute because the two jobs have nothing
    in common but the mailbox: a document poll processes attachments serially and a full
    batch runs minutes, while this is a search that usually matches nothing. The customer
    is standing in Gmail's "Awaiting verification" screen when this matters, so latency is
    the whole feature — a confirmation that lands ten minutes later is a customer who has
    already given up and called someone.

    Never spends money: no attachment is parsed, no document charged, no model called.

    Steady-state cost is one indexed-enough SELECT. The mailbox is only opened when a BU
    is actually mid-setup (`tags_awaiting_confirmation`), and a tick that finds the previous
    sweep still running does nothing at all rather than queueing behind it.
    """
    if not settings.imap_host:
        return {"status": "disabled", "reason": "IMAP not configured"}
    if _sweep_lock.locked():
        # A minute is shorter than a pathological IMAP call. Skipping is correct: the
        # sweep in flight is looking at the same mailbox this one would.
        return {"status": "busy"}

    async with _sweep_lock:
        started = datetime.now(UTC)
        async with async_session() as db:
            waiting = await es.tags_awaiting_confirmation(db, CONFIRM_WINDOW_HOURS)
        if not waiting:
            return {"checked": 0, "confirmed": 0, "waiting": 0}

        try:
            messages = await asyncio.to_thread(fetch_confirmations)
        except Exception as exc:
            logger.exception("[email] Confirmation sweep failed")
            await _record_run(started, {"messages": 0}, error=str(exc), job_name="email-confirm")
            raise

        confirmed, handled = 0, []
        for msg in messages:
            tag = tag_from_recipients(msg["recipients"])
            if not tag or tag not in waiting:
                # Someone else's confirmation, or one for a BU that went quiet. The
                # document poll picks it up; leaving it unseen is what lets that happen.
                continue
            handled.append(msg["uid"])
            async with async_session() as db:
                if code := gmail_confirm_code(msg["from"], msg["subject"]):
                    await es.record_gmail_code(db, tag, code)
                link = gmail_confirm_link(msg["body"])
                if link and await auto_confirm_forwarding(link):
                    await es.record_gmail_confirmed(db, tag)
                    confirmed += 1
                else:
                    logger.warning("[email] Could not confirm forwarding for tag %s", tag)

        # Seen whether or not Google took it: a link we failed to follow is almost always
        # a dead one, and retrying it every minute for a day is 1 440 requests to Google
        # for a forward the customer can re-trigger with Gmail's own "Resend email".
        await asyncio.to_thread(mark_seen, handled)

        if confirmed:
            await _record_run(
                started, {"messages": len(messages)}, job_name="email-confirm", rows=confirmed
            )
        return {"checked": len(messages), "confirmed": confirmed, "waiting": len(waiting)}


async def _record_run(
    started: datetime,
    summary: dict,
    error: str | None = None,
    job_name: str = "email-ingest",
    rows: int | None = None,
) -> None:
    """Persist the poll as a `job_runs` row so `#/admin/jobs` reports this job at all.

    Until now `run_ingest` returned a dict to whoever called the endpoint and wrote
    nothing, so a job that spends money on every poll was absent from the one page that
    answers "is the machine running?".

    Also raises one alert when a poll is mostly mail we cannot attribute — the counter
    §2.5 of the contract promises we watch. Never raises: a failed bookkeeping write
    must not turn a successful poll into a failed one.

    **A poll that found no mail writes no row.** `job_runs` has no retention and no
    partitioning, and `#/admin/jobs` shows the newest 100 rows with no way to filter by
    job name — so a poll on a schedule would bury every other job's history under its own
    idle ticks within hours. A failure always writes, and so does any poll that actually
    carried mail; "the poller is alive on a quiet day" is what `keep-warm` is for.
    """
    if error or summary.get("messages", 0):
        try:
            async with async_session() as db:
                db.add(
                    JobRun(
                        job_name=job_name,
                        started_at=started,
                        completed_at=datetime.now(UTC),
                        status=JobStatus.FAILED if error else JobStatus.SUCCESS,
                        rows_affected=summary.get("posted", 0) if rows is None else rows,
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

    if summary.get("beyond_window", 0):
        # A toast on #/admin/email is seen by whoever clicked Poll; this is for the case
        # nobody clicked anything — a poller outage longer than IMAP_HOLD_DAYS, which
        # loses real mail with no other symptom whatsoever. `open_alert_if_absent` dedupes
        # on (tenant, metric) while the alert is open, so a standing backlog raises one
        # alert, not one every ten minutes.
        await anomaly_service.open_alert_if_absent(
            tenant_id="system",
            module_id=Module.CREDIT_CARD_OCR,
            metric="email_ingest_beyond_window",
            severity=AlertSeverity.WARN,
            description=(
                f"{summary['beyond_window']} unseen message(s) are older than the "
                f"{settings.imap_hold_days}-day hold window and will never be polled again"
            ),
            actual=summary["beyond_window"],
        )


async def _process_message(msg: dict[str, Any], exhausted: set[str] | None = None) -> list[str]:
    """One message → one outcome per attachment (or a single message-level outcome).

    Everything expensive is behind two free checks: does it name a file at all, and
    does its tag name a paying BU. Nothing here spends money or opens a file for mail
    that fails either.

    An attachment we cannot read is not the same as no attachment: it gets a ledger row
    (`skipped` / `unsupported_attachment`) so the customer who forwarded an `.xlsx` has
    an answer, while a mail with no named part at all is still a free silent skip.

    `exhausted` collects the tags that ran out of documents earlier in this same poll.
    It is checked against the tag, not the tenant, so the rest of that BU's backlog is
    skipped without even the one SELECT that resolving it would cost — while another
    BU's mail in the same batch is unaffected.
    """
    # Before the attachment check, because a confirmation mail has none — it is the
    # one message we care about that carries no document.
    link = gmail_confirm_link(msg["body"])
    code = gmail_confirm_code(msg["from"], msg["subject"])
    if link or code:
        tag = tag_from_recipients(msg["recipients"])
        if not tag:
            # Deliberately not "unrouted": that counter watches for documents going
            # nowhere and alerts on five in a poll. A confirmation we cannot attribute
            # is noise, and raising an alert for it would train us to ignore the one
            # that means real money is being dropped.
            logger.warning("[email] Gmail confirmation with no usable tag — dropped")
            return ["skipped"]
        async with async_session() as db:
            if code:
                await es.record_gmail_code(db, tag, code)
            # The link is followed even when a code came with it: the code needs a
            # customer to act on it and this does not.
            if link and await auto_confirm_forwarding(link):
                await es.record_gmail_confirmed(db, tag)
        return ["skipped"]

    rejected = list(msg.get("rejected") or [])
    if not msg["attachments"] and not rejected:
        # Nothing named at all — a "your statement is ready" notice, a bare reply. Free
        # and silent on purpose: a ledger row for every one of those buries the ones that
        # matter. A mail that *did* carry files we could not read falls through instead.
        return ["skipped"]

    tag = tag_from_recipients(msg["recipients"])
    if not tag:
        logger.warning("[email] No ingest tag on %s — dropped", msg["message_id"])
        return ["unrouted"]
    if exhausted is not None and tag in exhausted:
        return ["retry_later"]

    async with async_session() as db:
        row = await es.resolve_by_tag(db, tag)
        # Nobody to notify, and nobody to hold the mail for: an unresolvable tag cannot be
        # attributed to a tenant. `_record_run` makes the volume visible to us instead.
        # A missing tenant row is the same answer — a broken FK, not a temporary state.
        tenant = await db.get(Tenant, row.tenant_id) if row is not None else None
        if row is None or tenant is None:
            logger.warning("[email] Unknown ingest tag on %s — dropped", msg["message_id"])
            return ["unrouted"]
        # **Switched off is a pause, not a verdict on the mail.** All three of these are
        # conditions the customer can reverse — the toggle, the module, an expired package
        # (which never rewrites settings, so `enabled` stays true after it lapses) — so the
        # message goes back unread and replays on the poll after they fix it, exactly as
        # `InsufficientCredits` already does. `since_arg` bounds how long that offer lasts.
        if not row.enabled or not await es.is_entitled(db, tenant):
            logger.info(
                "[email] Tenant %s is %s — mail held unread",
                row.tenant_id,
                "switched off" if not row.enabled else "out of package",
            )
            if exhausted is not None:
                exhausted.add(tag)  # the rest of this BU's mail in this batch too
            return ["retry_later"]
        tenant_id = str(row.tenant_id)
        enabled_at = row.enabled_at
        owner_emails = list(row.owner_emails or [])
        rules = list(row.rules or [])
        passwords = es.rule_passwords(row)
        carmen_token, carmen_uri = await es.posting_target(db, row)

    # One name per attachment, across both lists at once: they share the ledger's unique
    # index, so disambiguating them separately would still let a rejected `report.pdf`
    # collide with an accepted one. See `unique_names`.
    blobs = [blob for _, blob in msg["attachments"]]
    names = unique_names([f for f, _ in msg["attachments"]] + rejected)
    accepted = list(zip(names[: len(blobs)], blobs, strict=True))
    unreadable = names[len(blobs) :]

    # **The toggle is not the same kind of pause as the two above it.** A BU that switches
    # the feature off is telling us they are keying these documents themselves — and a
    # document keyed straight into Carmen writes no `credit_cards` row, so the duplicate
    # guard cannot see it and the whole held backlog would post a second time the moment
    # the toggle goes back on. Mail older than the switch-on is therefore dropped rather
    # than replayed, and left `\Seen`. It still gets a ledger row per attachment: the
    # customer needs the list of what arrived while they were off, or this fix would just
    # trade duplicate posts for silent loss. Message-level because arrival time is a fact
    # about the mail — nothing here enters the money path.
    arrived_at = msg.get("arrived_at")
    if enabled_at and arrived_at and arrived_at < enabled_at.timestamp():
        return await _skip_all(
            tenant_id,
            msg["message_id"],
            names,
            "ingest_paused",
            "Arrived while Email Automation was switched off — key this one by hand",
        )

    # A file the customer forwarded and we cannot read. Before this it left no trace
    # anywhere — the mail was marked `\Seen`, dropped on the attachment check, and "I
    # forwarded it on Tuesday" had nothing to answer it with. Costs nothing: this is far
    # ahead of `consume_document`, so there is nothing to refund either.
    outcomes = await _skip_all(
        tenant_id,
        msg["message_id"],
        unreadable,
        "unsupported_attachment",
        "{name} is not a file type this module can read",
    )

    for filename, blob in accepted:
        try:
            outcomes.append(
                await _process_attachment(
                    tenant_id=tenant_id,
                    message_id=msg["message_id"],
                    sender=msg["from"],
                    people=msg["people"],
                    filename=filename,
                    blob=blob,
                    owner_emails=owner_emails,
                    rules=rules,
                    passwords=passwords,
                    carmen_token=carmen_token,
                    carmen_uri=carmen_uri,
                )
            )
        except _HOLD:
            # The remaining attachments would each fail the same way, one wasted
            # `consume_document` at a time. Hand the whole message back instead: the
            # attachments already posted keep their ledger rows, and re-delivery of
            # this message dedupes on those, so nothing is charged twice.
            if exhausted is not None:
                exhausted.add(tag)
            return [*outcomes, "retry_later"]
    return outcomes


async def _skip_all(
    tenant_id: str,
    message_id: str,
    names: list[str],
    reason_code: str,
    error: str,
) -> list[str]:
    """Record every one of `names` as skipped, and charge for none of them.

    The two callers that stop a whole message before it costs anything: an attachment we
    cannot read, and mail that arrived while the BU had automation switched off. Both need
    the *row* more than the outcome — it is the customer's answer to "where did my document
    go", and `#/admin/email` is where they read it.

    `error` is a template so the per-file case can name the file; a message-level reason
    simply carries no `{name}`.
    """
    outcomes = []
    for name in names:
        async with async_session() as db:
            ledger = await _claim(db, tenant_id, message_id, name)
        if ledger is None:
            outcomes.append("skipped")
            continue
        await _finish(
            ledger.id,  # type: ignore[arg-type]
            status="skipped",
            reason_code=reason_code,
            error=error.format(name=name),
        )
        outcomes.append("skipped")
    return outcomes


async def _process_attachment(
    *,
    tenant_id: str,
    message_id: str,
    sender: str,
    people: str,
    filename: str,
    blob: bytes,
    owner_emails: list[str],
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
        try:
            return await _run_document(
                ledger_id=ledger_id,
                tenant_id=tenant_id,
                sender=sender,
                people=people,
                filename=filename,
                blob=blob,
                owner_emails=owner_emails,
                rules=rules,
                passwords=passwords,
                carmen_token=carmen_token,
                carmen_uri=carmen_uri,
            )
        except _HOLD:
            # Not a verdict on this document — the BU has nothing left to spend, or the
            # module is switched off for them. Drop the claim so a poll after that is
            # fixed can take it again; the caller hands the mail itself back by clearing
            # \Seen.
            await _release(ledger_id)
            raise
    finally:
        current_carmen_uri.reset(uri_ctx)
        current_tenant_id.reset(tenant_ctx)


async def _run_document(
    *,
    ledger_id: uuid.UUID,
    tenant_id: str,
    sender: str,
    people: str,
    filename: str,
    blob: bytes,
    owner_emails: list[str],
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
        # Coarsest question first, and free: is this even from someone this BU accepts?
        # Before match_rules so mail that is not theirs at all is not filed under the
        # narrower "your pattern was too tight" reason.
        if not sender_allowed(owner_emails, people):
            raise _Skip(
                "sender_not_allowed",
                "No registered address of this BU appears in From/To/Cc",
            )
        matched = match_rules(rules, sender, filename)
        if not matched:
            # A too-narrow pattern silently dropped real documents before the tag named
            # the tenant. Now the miss is a row in *this BU's* ledger, diagnosable from
            # #/admin — and it costs nothing, which is what removes the whole
            # signature-logo class of junk from the spend.
            raise _Skip("no_rule_match", f"No rule matches {filename}")
        # Overlapping patterns: don't guess the prompt, let detect_bank_code read the
        # document. A wrong bank prompt is worse than the generic one.
        bank_code = matched[0].get("bank_code") if len(matched) == 1 else None

        # Before any charge: a disguised, locked or corrupt file must not cost anything.
        password = await _open_or_fail(blob, filename, passwords)

        await assert_module_enabled(Module.CREDIT_CARD_OCR)
        charged = await consume_document()

        # ── The refund boundary ───────────────────────────────────────────────
        #
        # This block is the ONLY place in the pipeline that refunds. Everything in it
        # can fail without the model ever having run — a dead pool connection on
        # `create_task`, an OpenRouter socket that never opened — and that is our
        # failure to deliver, not work the customer received. So it is given back.
        #
        # Once `finalize_extraction` returns, the vision call has been made and billed
        # to us. From there on the document is charged whatever happens next: a
        # duplicate, a foreign tax ID, an unmappable GL account and a Carmen refusal
        # are all decisions taken *about a document we successfully read*, not failures
        # to read it. That is the whole rule, and it is why `_Skip` carries no refund
        # flag — see the handlers at the bottom of this function.
        try:
            async with async_session() as db:
                task = await create_task(
                    db,
                    tenant_id=tenant_id,
                    module_id=Module.CREDIT_CARD_OCR,
                    original_filename=filename,
                    carmen_user_id=None,
                    charged_docs=1 if charged else 0,
                )
                task_id = str(task.id)

            # The first money of the document, and the tenant and task are already known —
            # so `log_llm_usage` inserts a fully attributed row rather than needing the
            # tenant-less parking buffer the tax-ID design forced on it.
            extracted = await ocr_service.extract_stateless(
                file_bytes=blob,
                original_filename=filename,
                bank_code=bank_code,
                task_id=task_id,
                pdf_password=password,
            )
            extracted = await finalize_extraction(extracted, task_id, tenant_id, bank_code, None)
        except Exception as exc:
            if charged:
                await refund_document(charged)
            if task_id is not None:
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
            # Zero-total document: posting an empty JV is worse than stopping here.
            # The read itself succeeded, so the charge stands.
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
            )

        await _mark_submitted(extracted.id)

        # The statement's second Carmen document (wizard step 4). Deliberately after
        # the JV and deliberately unable to fail it: the JV is already in Carmen's
        # books and there is no rollback, so a missing input-tax record is recorded
        # for a human to add rather than turned into a failure on a document that
        # posted successfully.
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
        # No refund here, ever. A `_Skip` raised before the charge has nothing to give
        # back; one raised after it comes from a document the model already read, and
        # that reading is what the credit paid for. The refund boundary above owns the
        # only case where money goes back.
        #
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
    except _HOLD as stop:
        # Out before the generic handler below, which would file this as
        # `unreadable_document` — sending whoever debugs it to look at a PDF that is
        # perfectly fine, and putting a red `document_failed` in the customer's bell for
        # a module *we* switched off. Nothing was charged at either point (both gates run
        # ahead of `consume_document`), so there is nothing to refund and no row to finish.
        logger.warning("[email] Tenant %s: %s — mail held unread", tenant_id, stop)
        raise
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
        # Anything reaching here from *inside* the refund boundary was already refunded
        # and re-raised there; refunding again would hand back a second credit for one
        # document. Anything reaching here from after it is post-extraction and keeps
        # its charge like every other late failure.
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
    failure into an exception would mark a document Carmen has already accepted as
    failed, which is the one outcome that is plainly wrong.
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
        raise _Skip("unreadable_document", str(exc)) from exc

    last: Exception | None = None
    for pwd in [None, *passwords]:
        try:
            await ensure_pdf_openable(blob, filename, pwd)
            return pwd
        except (PdfPasswordRequired, ValidationError) as exc:
            last = exc
        except ExtractionError as exc:
            # The bytes are wrong, not the password, so the remaining passwords cannot
            # help. Raised as a _Skip rather than left to the generic handler, which
            # files everything as `failed` — and nothing has been charged at this point.
            # A junk attachment must not put a red row on the customer's screen.
            raise _Skip("unreadable_document", str(exc)) from exc
    raise _Skip("wrong_pdf_password", str(last or "Could not open the attachment"))


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
        if status in ("posted", "failed"):
            # "skipped" is deliberately excluded — it's the customer's own filename/
            # sender rules saying "not this file", not a failure worth a notification
            # (see the _Skip handler above).
            notification_service.notify(
                db,
                tenant_id=row.tenant_id,  # type: ignore[arg-type]
                order_id=None,
                type_=f"document_{status}",
                payload={
                    "document_id": str(row.id),
                    # The attachment filename is the only identity the customer
                    # recognises when the document never got far enough to have a
                    # bank_code or doc_no — which is exactly the failure case.
                    "attachment": row.attachment,
                    "bank_code": bank_code,
                    "doc_no": doc_no,
                    **(
                        {"jv_no": jv_no}
                        if status == "posted"
                        else {"reason_code": reason_code, "message": (error or "")[:500]}
                    ),
                },
            )
        await db.commit()
