"""Email Automation — poll the ingest mailbox and post what arrives.

    AIAGENT+<tag>@…  ─┬─ tag from the envelope → tenant   ← routing, costs nothing
                      ├─ entitled? → claim the ledger row (dedupe)
                      ├─ filename must match one of this BU's rules
                      ├─ open the file (this BU's passwords only)
                      ├─ charge a credit, create the task
                      ├─ extract                          ← first money spent
                      ├─ tax ID vs this BU's register     ← verification, not routing
                      ├─ GL mapping (AI fills the gaps)   ← runs even when the line above
                      │                                     parks; cannot outrank it
                      ├─ anything to say about it?        ← park for a human if so
                      └─ post the JV (+ the input-tax record) with this BU's token

**Nothing posts unattended that anyone would have been given a reason to look at.** The
review queue's own reason line (`_review_flags`) is the auto-post gate: an empty list means
the document is ready to post, and `auto_post` decides only whether a ready document waits.
A BU with review off still gets the doubtful ones — the flags, not the switch, are what
stands between an uncertain reading and somebody's ledger.

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

Deliberately a plain poll loop driven by an endpoint (see
routers/email_automation/settings_api.py), not a worker process: pg_cron already calls
endpoints with the internal job token, and one mailbox does not need a queue broker.

ponytail: single pass, no retry of a failed document. The ledger records the reason
and attempts; add a retry sweep when real failures show it is worth it.

ponytail: attachments within a poll are processed serially, so one poll of a full batch
costs roughly batch_size × (one vision call + two Carmen posts). Size the cron interval
above that or polls overlap — harmless (`_claim` is an atomic insert, so the second
poll's copy of a document is refused, not charged) but pointless load. Parallelise per message if the daily-commission banks make the
backlog visible in `job_runs`.

This file is the poll loop and message-level routing only (steps 1-2 above, plus the
housekeeping around them). The per-document pipeline (steps 3-7) is `pipeline.py`'s
`_run_document`; the `email_documents` row it all writes to is `ledger.py`; the human's
approve/reject is `review.py`. Split per
codebase-refactor-recursive-scroll.md Phase 2 — see that plan for why each function landed
where it did.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from app.config import settings
from app.constants import Module
from app.context import current_carmen_uri, current_tenant_id
from app.database import async_session
from app.models.enums import AlertSeverity, JobStatus
from app.models.identity import Tenant
from app.models.observability import JobRun
from app.services.email_automation import credential
from app.services.email_automation import ingest_settings as es
from app.services.email_automation.imap import (
    auto_confirm_forwarding,
    fetch_confirmations,
    fetch_pending,
    gmail_confirm_code,
    gmail_confirm_link,
    mark_done,
    tag_from_recipients,
    unique_names,
)
from app.services.email_automation.ledger import (
    REVIEW_BACKLOG_CAP,
    _claim,
    _finish,
    _pending_count,
    _record_auth,
    _release,
)
from app.services.email_automation.pipeline import _HOLD, _run_document
from app.services.shared import anomaly as anomaly_service
from app.services.shared import notification as notification_service

logger = logging.getLogger(__name__)

# Per poll, not per day: mail to an unknown or missing tag cannot be attributed to
# anyone, so nobody can be told about it. A handful is a mistyped address; a poll full
# of them is someone using the mailbox as a drop box.
UNROUTED_ALERT_THRESHOLD = 5

# How recently a BU must have touched its settings to count as "setting up forwarding
# right now". The gate on the confirmation sweep — see `es.tags_awaiting_confirmation`.
CONFIRM_WINDOW_HOURS = 24

# One poll at a time per process — see `run_ingest`.
_poll_lock = asyncio.Lock()


async def run_ingest(limit: int | None = None) -> dict:
    """One poll. Returns a summary the job endpoint echoes back.

    Serialised against itself. A batch whose documents are slow can outlast the poll
    interval, and a second poll starting on top of it would not duplicate work — `_claim`
    dedupes, and nothing is flagged done until a verdict exists — but it would double
    this job's share of a connection pool capped at 15 for the whole application. Skipping
    is free and the backlog is still there in ten minutes.
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
            # Extracted, charged, and parked for a human: either the BU has `auto_post`
            # off, or it is on and `_review_flags` found something to say. In the initial
            # shape for the same reason as `retry_later`: on a BU in review mode this is
            # the *normal* outcome, and a key that only appears when something happened is
            # one the admin page cannot render honestly.
            "pending_review": 0,
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
        # tenant_id → documents parked this poll. Accumulated rather than notified per
        # document: a 20-attachment batch must produce one bell row saying "20 documents
        # need review", not 20 rows saying "one does".
        parked: dict[str, int] = {}
        # The mail this poll has reached a verdict on, and may therefore flag done
        # (`email_imap.DONE_FLAG`). Nothing else is touched: `fetch_pending` flags nothing on
        # the way in, so a poll that dies — crash, deploy, OOM, a killed request — leaves
        # every undecided message pending and the next poll picks it up. Flagged on the way
        # in instead, that mail was done, unclaimed and recorded nowhere at all.
        handled: list[str] = []
        messages: list[dict[str, Any]] = []
        done = 0
        try:
            messages, beyond = await asyncio.to_thread(
                fetch_pending, limit or settings.imap_batch_size
            )
            summary["messages"] = len(messages)
            summary["beyond_window"] = beyond
            for msg in messages:
                outcomes = await _process_message(msg, exhausted, parked)
                await _record_auth(msg["message_id"], msg.get("auth"))
                # `retry_later` is the one verdict that is not about the mail — the BU has
                # nothing to spend or is switched off — so that message stays pending and
                # replays for as long as `since_arg` allows.
                if "retry_later" not in outcomes:
                    handled.append(msg["uid"])
                for outcome in outcomes:
                    summary[outcome] = summary.get(outcome, 0) + 1
                done += 1
        except Exception as exc:
            logger.exception("[email] Poll failed")
            # `messages[done]` — the one that actually raised — is flagged on purpose:
            # leaving it pending would re-crash the next poll on it forever, and the FAILED
            # `job_runs` row plus the traceback above is the trail for that one message.
            # Everything after it was never attempted and stays pending.
            if done < len(messages):
                handled.append(messages[done]["uid"])
            await asyncio.to_thread(mark_done, handled)
            # Documents parked before the crash are real and waiting; a poll that died
            # half way through must not swallow the only signal a reviewer gets.
            await _notify_pending(parked)
            await _record_run(started, summary, error=str(exc))
            raise

        if summary.get("beyond_window"):
            logger.warning(
                "[email] %d pending message(s) are older than the %d-day hold window and "
                "will never be polled again",
                summary["beyond_window"],
                settings.imap_hold_days,
            )
        # One IMAP round trip for the whole batch, after every verdict is on the ledger.
        await asyncio.to_thread(mark_done, handled)
        await _notify_pending(parked)
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
                # document poll picks it up; leaving it pending is what lets that happen
                # (true since `fetch_confirmations` PEEKs — its old `RFC822` fetch marked
                # these read on the way in, F-4).
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

        # Done whether or not Google took it: a link we failed to follow is almost always
        # a dead one, and retrying it every minute for a day is 1 440 requests to Google
        # for a forward the customer can re-trigger with Gmail's own "Resend email".
        await asyncio.to_thread(mark_done, handled)

        if confirmed:
            await _record_run(
                started, {"messages": len(messages)}, job_name="email-confirm", rows=confirmed
            )
        return {"checked": len(messages), "confirmed": confirmed, "waiting": len(waiting)}


async def _notify_pending(parked: dict[str, int]) -> None:
    """The bell for a poll that parked something: "N documents need review", and — when any
    of the waiting rows stopped on a problem — "M of them are blocked".

    One row per BU, kept current rather than one row per poll: this folds into the BU's
    existing *unread* `document_pending_review` row if one is there (`notify_collapsed`),
    so a customer who hasn't opened the bell in three polls sees one row with today's true
    count, not three rows to scroll past. The moment they read it, the next poll that parks
    anything starts a fresh row — the bell still rings again, just not before they've had a
    chance to see the last one.

    Both figures are counted fresh off the queue rather than off this poll's own `parked`
    dict, because the queue is what the customer is about to open: a document that stopped
    yesterday and is still stopped is part of "what is waiting for me", and a number that
    only ever reflected the last few minutes would undercount it. `parked` still decides
    *which* tenants get looked at — a BU nothing happened for is not touched at all.

    Never raises. A missing bell row is a customer who finds the queue on their next
    login; an exception here would fail a poll whose documents are already safely parked.
    """
    if not parked:
        return
    try:
        async with async_session() as db:
            for tenant_id in parked:
                pending = await _pending_count(db, tenant_id)
                blocked = await _pending_count(db, tenant_id, blocked_only=True)
                payload = {"pending": pending, **({"blocked": blocked} if blocked else {})}
                await notification_service.notify_collapsed(
                    db,
                    tenant_id=uuid.UUID(tenant_id),
                    type_="document_pending_review",
                    key="queue",
                    build_payload=lambda _old, p=payload: p,
                )
            await db.commit()
    except Exception:  # noqa: BLE001 — the documents are parked either way
        logger.exception("[email] Could not raise the review notification")


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


async def _process_message(
    msg: dict[str, Any],
    exhausted: set[str] | None = None,
    parked: dict[str, int] | None = None,
) -> list[str]:
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
        passwords = credential.rule_passwords(row)
        auto_post = bool(row.auto_post)
        carmen_token, carmen_uri = await credential.posting_target(db, row)

        # Backpressure. Every document costs a credit at extraction and may then wait for a
        # human — so a BU that stops reading its queue would keep paying for a pile nobody
        # has looked at, and there is no refund for any of it once the vision call has run
        # (decision-log #17).
        #
        # Same shape as running out of credits: mail handed back unread, no ledger row,
        # nothing charged, replays on the poll after someone clears the backlog. The
        # 14-day hold window bounds how long that offer lasts, and mail past it already
        # raises `email_ingest_beyond_window`.
        #
        # Unconditional since auto-post narrowed to clean documents. It read `not auto_post`
        # from a time when nothing parked with review off; a BU running auto-post now parks
        # every document that has anything to say about it, and without this a dead
        # credential would fill their queue while still charging for each one.
        if await _pending_count(db, tenant_id) >= REVIEW_BACKLOG_CAP:
            logger.warning(
                "[email] Tenant %s has %d+ documents awaiting review — mail held unread",
                tenant_id,
                REVIEW_BACKLOG_CAP,
            )
            if exhausted is not None:
                exhausted.add(tag)
            return ["retry_later"]

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
    # than replayed, and marked done. It still gets a ledger row per attachment: the
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
            "Arrived while AI JV Automation was switched off — key this one by hand",
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
            outcome = await _process_attachment(
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
                auto_post=auto_post,
            )
            outcomes.append(outcome)
            if outcome == "pending_review" and parked is not None:
                parked[tenant_id] = parked.get(tenant_id, 0) + 1
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
    auto_post: bool,
) -> str:
    """Claim the ledger row, then run the document.

    'posted' | 'pending_review' | 'failed' | 'skipped'.

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
                auto_post=auto_post,
            )
        except _HOLD:
            # Not a verdict on this document — the BU has nothing left to spend, or the
            # module is switched off for them. Drop the claim so a poll after that is
            # fixed can take it again; the caller leaves the mail itself pending by never
            # flagging it done (`$OcrDone`).
            await _release(ledger_id)
            raise
    finally:
        current_carmen_uri.reset(uri_ctx)
        current_tenant_id.reset(tenant_ctx)
