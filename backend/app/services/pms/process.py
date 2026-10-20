"""Process the PMS days Carmen's hook announced: read back, find what is unmapped, park or post.

Two ways in, one function. The webhook starts `process_event` the moment it stores a day
(`kick`), and `run_pms_processing` — pg_cron every 10 minutes — picks up whatever a
restart, a Carmen outage or a missing credential left at `received`. A claim on
`processed_at` keeps the two from working the same day at once.

**Carmen posts; we map** (decision-log #43). The BU's PMS setting in Carmen says where a
day's rows are, what keys its mapping table, and how debit and credit are told apart — each
PMS differently — and Carmen's engine (`interfacePostGL`) posts the day by it. This module
decides nothing about sides or totals. It finds the day's rows Carmen's mapping table has no
account for, lets the AI suggest one, and asks the engine to post once nothing is missing.

A day with a row the table cannot place parks at `pending_review` with what the review
needs in `review_payload`. So does every day of a PMS whose auto-post is off (the default;
Carmen's PMS setting screen sets it per BU and PMS, decision-log #44). Only a fully mapped
day of an auto-post PMS posts unattended: the email rule (decision-log #24).
"""

import asyncio
import json
import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import or_, select, update

from app.context import current_carmen_uri, current_tenant_id
from app.database import async_session
from app.models.email_automation import EmailIngestSettings
from app.models.enums import JobStatus
from app.models.observability import JobRun
from app.models.pms import PmsEvent, PmsSettings
from app.services.email_automation import credential
from app.services.pms import carmen_config as cfg
from app.services.pms import mapping
from app.services.shared import carmen

logger = logging.getLogger(__name__)

# A claimed day nobody finished (the process died) is free again after this long.
LEASE = timedelta(minutes=10)
# How long a reviewer's approve/reject claim (`posting_started_at`) holds a day; the same
# five minutes as the email review's. A repeat hook leaves a day alone while one is live.
REVIEW_CLAIM_TTL = timedelta(minutes=5)
# Reads that failed for a reason that may pass (Carmen down, no credential yet, the day not
# in the Data Bank yet) are tried this often in all before the day shows as failed.
MAX_ATTEMPTS = 3
# The reasons a fresher credential can cure: a token that was missing, dead, short of a
# permission, or unable to read the BU's PMS setting. Storing or re-proving one wakes them.
WAKE_REASONS = (
    "no_credential",
    "carmen_unauthorized",
    "carmen_forbidden",
    "carmen_config_unreadable",
)
# `interfacePostGL` answers a day it has already posted with this code (and HTTP 303).
_ALREADY_POSTED = -200

_sweep_lock = asyncio.Lock()
# asyncio keeps only a weak reference to a task; these are held until they finish.
_running: set[asyncio.Task] = set()


class PostRefused(Exception):
    """Carmen's engine answered, and the answer was no. Its own words are the message."""


def kick(event_pk: uuid.UUID) -> None:
    """Start processing a day the webhook just stored, without making Carmen wait for it."""
    task = asyncio.get_running_loop().create_task(process_event(event_pk))
    _running.add(task)
    task.add_done_callback(_running.discard)


async def _target(db, tenant_id: uuid.UUID) -> tuple[str, str]:
    """(token, carmen_uri) for this BU — the one credential it stored from Carmen's menu.

    The same stored credential the email automation posts with (decision-log #42); a BU
    that never opened either settings page has no row, and gets what an empty row gives.
    """
    row = await db.get(EmailIngestSettings, tenant_id) or EmailIngestSettings(tenant_id=tenant_id)
    return await credential.posting_target(db, row)


def carmen_words(exc: carmen.CarmenAPIError) -> str:
    """Carmen's own sentence out of an error body (`Access Denied. Permission Name = …`).

    Carmen answers `{"Code", "UserMessage", "InternalMessage", …}`; the raw `HTTP 403: {…}`
    is what support needs, the sentence is what a reviewer can act on.
    """
    _, _, body = exc.detail.partition(": ")
    try:
        data = json.loads(body)
    except ValueError:
        return exc.detail[:500]
    if not isinstance(data, dict):
        return exc.detail[:500]
    words = " ".join(
        str(data[k]).strip()
        for k in ("UserMessage", "InternalMessage", "Message")
        if data.get(k) and str(data[k]).strip()
    )
    return (words or exc.detail)[:500]


def _refusal(exc: carmen.CarmenAPIError, other: str) -> str:
    """The reason code for a Carmen error: the credential's, or `other`."""
    return {401: "carmen_unauthorized", 403: "carmen_forbidden"}.get(exc.status_code, other)


async def post_day(section: dict, doc_date: str, databank_id: Any, carmen_token: str) -> str:
    """Ask Carmen's engine to post one Data Bank day. Returns `posted` or `already_posted`.

    `section` is the payload's `{"setting_code", "post_type", "counter": {"dept", "acc"}}`.
    Raises `PostRefused` with Carmen's words (`Mapping is incomplete.`, a closed period, …),
    or `carmen.CarmenAPIError` when Carmen could not be reached or refused the credential.
    Asking again is safe: the engine refuses a day it has already posted.
    """
    counter = section.get("counter") or {}
    result = await carmen.post_pms_gl(
        section["post_type"],
        {
            "Code": section["setting_code"],
            "DateFrom": doc_date,
            "DateTo": doc_date,
            "DeptCode": counter.get("dept") or "",
            "AccCode": counter.get("acc") or "",
            "id": [databank_id],
        },
        carmen_token,
    )
    if isinstance(result, dict) and result.get("Result") is True:
        return "posted"
    if isinstance(result, dict) and result.get("Code") == _ALREADY_POSTED:
        return "already_posted"
    verdict = None
    if isinstance(result, dict):
        verdict = (
            result.get("UserMessage") or result.get("InternalMessage") or result.get("Message")
        )
        errors = result.get("ErrorList")
        if errors:
            verdict = f"{verdict or 'Carmen refused the day'}: {errors}"
    raise PostRefused(str(verdict or f"Carmen answered {result!r}")[:500])


async def _claim(event_pk: uuid.UUID) -> Any:
    """Take a `received` day for this worker, or None when it is not ours to take."""
    now = datetime.now(UTC)
    async with async_session() as db:
        result = await db.execute(
            update(PmsEvent)
            .where(
                PmsEvent.id == event_pk,
                PmsEvent.status == "received",
                PmsEvent.attempts < MAX_ATTEMPTS,
                or_(PmsEvent.processed_at.is_(None), PmsEvent.processed_at < now - LEASE),
            )
            .values(processed_at=now, attempts=PmsEvent.attempts + 1)
            .returning(PmsEvent.id, PmsEvent.tenant_id, PmsEvent.payload, PmsEvent.attempts)
        )
        row = result.first()
        await db.commit()
    return row


async def _write(event_pk: uuid.UUID, **values) -> None:
    async with async_session() as db:
        await db.execute(update(PmsEvent).where(PmsEvent.id == event_pk).values(**values))
        await db.commit()


async def _park(
    event_pk, payload: dict, reason: str | None = None, error: str | None = None
) -> str:
    await _write(
        event_pk,
        status="pending_review",
        review_payload=payload,
        reason_code=reason,
        error_message=error,
        processed_at=datetime.now(UTC),
    )
    return "pending_review"


async def _retry_or_fail(event_pk, attempts: int, reason: str, error: str) -> str:
    """Leave the day for the next sweep, or give up on it once the attempts are spent."""
    if attempts >= MAX_ATTEMPTS:
        await _write(event_pk, status="failed", reason_code=reason, error_message=error[:500])
        return "failed"
    await _write(event_pk, reason_code=reason, error_message=error[:500])
    return "retry"


async def process_event(event_pk: uuid.UUID) -> str:
    """Take one day from `received` to `pending_review`, `posted` or `failed`.

    Returns what happened (`skipped` when another worker has it). Never raises: a day must
    not be stranded by an error nobody sees, so anything unexpected is recorded on the row.
    """
    claimed = await _claim(event_pk)
    if claimed is None:
        return "skipped"
    tenant_ctx = current_tenant_id.set(str(claimed.tenant_id))
    try:
        return await _process(claimed)
    except Exception as exc:  # noqa: BLE001 — recorded on the row, never lost
        logger.exception("[pms] Processing %s failed", event_pk)
        return await _retry_or_fail(event_pk, claimed.attempts, "processing_error", str(exc))
    finally:
        current_tenant_id.reset(tenant_ctx)


async def _process(claimed) -> str:
    pk, tenant_id, attempts = claimed.id, claimed.tenant_id, claimed.attempts
    hook = claimed.payload or {}
    itype, name = hook.get("InterfaceType", "PMS"), hook["InterfaceName"]
    doc_type, doc_date = hook["DocType"], str(hook["DocDate"])[:10]

    async with async_session() as db:
        token, uri = await _target(db, tenant_id)
        settings_row = await db.get(PmsSettings, (tenant_id, name.lower()))
    if not token or not uri:
        return await _retry_or_fail(
            pk,
            attempts,
            "no_credential",
            "No Carmen access is stored for this business unit. "
            "Open this PMS's setting in Carmen and save it.",
        )

    uri_ctx = current_carmen_uri.set(uri)
    try:
        try:
            section = cfg.find_section(await carmen.get_pms_settings(token), name)
        except carmen.CarmenAPIError as exc:
            return await _retry_or_fail(pk, attempts, "carmen_config_unreadable", exc.detail)
        if section is None:
            return await _retry_or_fail(
                pk,
                attempts,
                "pms_setting_missing",
                f"Carmen has no active PMS posting setting for {name} with a Revenue section.",
            )
        try:
            spec = cfg.spec_of(section.config)
        except cfg.UnsupportedFormat as exc:
            await _write(
                pk,
                status="failed",
                reason_code="unsupported_pms_format",
                error_message=f"{section.setting_code} describes {exc}; only a JSON object is read.",
            )
            return "failed"

        try:
            found = await carmen.get_databank_day(itype, name, doc_type, doc_date, token)
        except carmen.CarmenAPIError as exc:
            reason = _refusal(exc, "databank_unreachable")
            return await _retry_or_fail(pk, attempts, reason, carmen_words(exc))
        databank = cfg.newest_day(found, spec.json_keys)
        if databank is None:
            return await _retry_or_fail(
                pk,
                attempts,
                "day_not_found",
                f"Carmen's Data Bank has no {name} {doc_type} for {doc_date} yet.",
            )
        try:
            rows = cfg.rows_of(databank["FileData"], spec)
        except cfg.UnreadableDay as exc:
            await _write(
                pk, status="failed", reason_code="unreadable_day", error_message=str(exc)[:500]
            )
            return "failed"

        try:
            current = await carmen.get_pms_mapping(section.setting_code, section.post_type, token)
        except carmen.CarmenAPIError as exc:
            return await _retry_or_fail(pk, attempts, "carmen_config_unreadable", exc.detail)
        table = cfg.table_of(current, spec.columns)
        new = cfg.new_keys(rows, table, spec.use_mapping)
        guessed: dict[str, dict] = {}
        if new:
            try:
                accounts, departments = await mapping.masters(token)
                guessed = await mapping.suggest(new, rows, table, accounts, departments)
            except carmen.CarmenAPIError as exc:
                # No suggestion is not a reason to stop: the day parks with the rows
                # unmapped and the reviewer picks them. A dead credential still is.
                if exc.status_code in (401, 403):
                    return await _retry_or_fail(pk, attempts, _refusal(exc, ""), carmen_words(exc))
                logger.warning("[pms] Could not read Carmen's GL for suggestions: %s", exc.detail)

        payload = {
            "interface_type": itype,
            "interface": name,
            "doc_type": doc_type,
            "doc_date": doc_date,
            "setting_code": section.setting_code,
            "post_type": section.post_type,
            "counter": {
                "dept": section.counter_dept,
                "acc": section.counter_acc,
                "name": section.counter_name,
            },
            "key_columns": spec.columns,
            "rows": rows,
            # Carmen's accounts for the keys this day uses, as they were when it was read.
            "mapped": {k: table[k] for k in dict.fromkeys(r["key"] for r in rows) if k in table},
            "guessed": guessed,
            "flags": mapping.flags(new, guessed),
            # Which keys those flags are about, for the queue row (`activity._pms_row`).
            **mapping.open_keys(new, guessed),
            "databank_id": databank.get("Id"),
            "last_modified": databank.get("LastModified"),
        }
        if payload["flags"] or not (settings_row and settings_row.auto_post):
            return await _park(pk, payload)

        try:
            outcome = await post_day(payload, doc_date, payload["databank_id"], token)
        except PostRefused as exc:
            return await _park(pk, payload, "carmen_rejected", str(exc))
        except carmen.CarmenAPIError as exc:
            return await _park(pk, payload, _refusal(exc, "carmen_rejected"), carmen_words(exc))
        await _write(
            pk,
            status="posted",
            jv_no=None,
            review_payload=None,
            reason_code="already_posted" if outcome == "already_posted" else None,
            error_message=None,
            processed_at=datetime.now(UTC),
        )
        logger.info("[pms] %s %s %s %s by Carmen", name, doc_type, doc_date, outcome)
        return "posted"
    finally:
        current_carmen_uri.reset(uri_ctx)


async def _requeue_ready_days() -> int:
    """Send back for posting the parked days of auto-post PMSs that have nothing left to map.

    A day parks with `mapping_guessed` until somebody approves the row on *some* day, which
    clears it on the BU's other parked days (`review.recheck`); Carmen can also switch
    auto-post on with days already waiting. The day is then read again — setting, Data
    Bank, Carmen's table — before it posts.
    """
    async with async_session() as db:
        on = {
            (t, name)
            for t, name in (
                await db.execute(
                    select(PmsSettings.tenant_id, PmsSettings.interface_name).where(
                        PmsSettings.auto_post.is_(True)
                    )
                )
            ).all()
        }
        if not on:
            return 0
        result = await db.execute(
            select(
                PmsEvent.id, PmsEvent.tenant_id, PmsEvent.payload, PmsEvent.review_payload
            ).where(
                PmsEvent.status == "pending_review",
                PmsEvent.reason_code.is_(None),
                PmsEvent.tenant_id.in_({t for t, _ in on}),
            )
        )
        # The PMS is matched here, not in SQL: it lives in the hook's JSON, and the unit
        # tests' SQLite has no JSONB path. A BU parks a handful of days.
        ready = [
            pk
            for pk, tenant_id, hook, payload in result.all()
            if (tenant_id, str((hook or {}).get("InterfaceName", "")).lower()) in on
            and not (payload or {}).get("flags")
        ]
        if ready:
            await db.execute(
                update(PmsEvent)
                .where(PmsEvent.id.in_(ready), PmsEvent.status == "pending_review")
                .values(status="received", attempts=0, processed_at=None, review_payload=None)
            )
            await db.commit()
    return len(ready)


async def stopped_by_permission(db, tenant_id: uuid.UUID) -> bool:
    """Whether a day of this BU is stuck because the held credential lacks a Carmen permission.

    Then that credential has proven itself not good enough for PMS work, however live it is,
    and the next token Carmen's PMS setting screen proves should replace it rather than be
    turned away by `credential.adopt_token` (decision-log #45): the runbook's fix for
    `carmen_forbidden` is a save from a user who has the permission.
    """
    return bool(
        await db.scalar(
            select(PmsEvent.id)
            .where(
                PmsEvent.tenant_id == tenant_id,
                PmsEvent.status.in_(("received", "failed")),
                PmsEvent.reason_code == "carmen_forbidden",
            )
            .limit(1)
        )
    )


async def wake_waiting(db, tenant_id: uuid.UUID) -> list[uuid.UUID]:
    """Put back to `received` this BU's days a credential stopped, after a new one is stored.

    Returns their ids; the caller commits, then `kick`s each.
    """
    result = await db.execute(
        update(PmsEvent)
        .where(
            PmsEvent.tenant_id == tenant_id,
            PmsEvent.status.in_(("received", "failed")),
            PmsEvent.reason_code.in_(WAKE_REASONS),
        )
        .values(status="received", attempts=0, processed_at=None)
        .returning(PmsEvent.id)
    )
    return list(result.scalars().all())


async def _wake_for_new_credential() -> int:
    """Send back the days a credential stopped, once a newer one is proven.

    A save on Carmen's PMS setting screen wakes them at once (`wake_waiting`), but it is not
    the only writer of the BU's one credential (decision-log #42): opening the email
    settings from Carmen's menu stores a fresh token too, and the daily token check
    re-proves one after a passing outage. Each moves `carmen_token_verified_at` past the
    day's last attempt, which is the whole test.
    Without it a day that spent its attempts on an expired token stayed `failed` for good.
    """
    async with async_session() as db:
        result = await db.execute(
            update(PmsEvent)
            .where(
                PmsEvent.status.in_(("received", "failed")),
                PmsEvent.reason_code.in_(WAKE_REASONS),
                EmailIngestSettings.tenant_id == PmsEvent.tenant_id,
                EmailIngestSettings.carmen_token_verified_at > PmsEvent.processed_at,
            )
            .values(status="received", attempts=0, processed_at=None)
            .returning(PmsEvent.id)
        )
        woken = result.scalars().all()
        await db.commit()
    return len(woken)


async def run_pms_processing(limit: int = 50) -> dict:
    """One sweep: every day waiting at `received`, oldest first. Serialised against itself."""
    if _sweep_lock.locked():
        return {"status": "busy"}
    async with _sweep_lock:
        started = datetime.now(UTC)
        summary: dict = {"status": "ok", "requeued": 0, "woken": 0}
        error = None
        try:
            summary["requeued"] = await _requeue_ready_days()
            summary["woken"] = await _wake_for_new_credential()
            now = datetime.now(UTC)
            async with async_session() as db:
                result = await db.execute(
                    select(PmsEvent.id)
                    .where(
                        PmsEvent.status == "received",
                        PmsEvent.attempts < MAX_ATTEMPTS,
                        or_(PmsEvent.processed_at.is_(None), PmsEvent.processed_at < now - LEASE),
                    )
                    .order_by(PmsEvent.created_at)
                    .limit(limit)
                )
                pks = list(result.scalars().all())
            for pk in pks:
                outcome = await process_event(pk)
                summary[outcome] = summary.get(outcome, 0) + 1
        except Exception as exc:  # noqa: BLE001 — reported in job_runs, not raised at pg_cron
            logger.exception("[pms] Sweep failed")
            error = str(exc)
            summary["status"] = "error"
        worked = sum(
            v for k, v in summary.items() if k not in ("status", "requeued", "woken", "skipped")
        )
        await _record_run(started, worked, error)
        return summary


async def _record_run(started: datetime, rows: int, error: str | None) -> None:
    """A `job_runs` row for `#/admin/jobs` — only when the sweep did something or failed,
    the same rule as the email poll, so an idle schedule does not bury other jobs."""
    if not (rows or error):
        return
    try:
        async with async_session() as db:
            db.add(
                JobRun(
                    job_name="pms-process",
                    started_at=started,
                    completed_at=datetime.now(UTC),
                    status=JobStatus.FAILED if error else JobStatus.SUCCESS,
                    rows_affected=rows,
                    error_message=error,
                )
            )
            await db.commit()
    except Exception as exc:  # noqa: BLE001 — bookkeeping must not fail the sweep
        logger.error("[pms] Could not record the job run: %s", exc)
