"""Process the PMS days Carmen's hook announced: read back, map, check, park or post.

Two ways in, one function. The webhook starts `process_event` the moment it stores a day
(`kick`), and `run_pms_processing` — pg_cron every 10 minutes — picks up whatever a
restart, a Carmen outage or a missing credential left at `received`. A claim on
`processed_at` keeps the two from working the same day at once.

A day with anything a person should look at — a code only the AI has mapped, a code
nobody has mapped, a balance off — parks at `pending_review` with what the review needs in
`review_payload`. So does every day of a BU with auto-post off (the default). Only a clean
day of an auto-post BU posts unattended: the email rule (decision-log #24), applied here.
"""

import asyncio
import json
import logging
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import or_, select, update

from app.context import current_carmen_uri, current_tenant_id
from app.database import async_session
from app.models.email_automation import EmailIngestSettings
from app.models.enums import JobStatus
from app.models.observability import JobRun
from app.models.pms import PmsEvent, PmsSettings
from app.services.email_automation import credential
from app.services.pms import day as pms_day
from app.services.pms import mapping, posting
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

_sweep_lock = asyncio.Lock()
# asyncio keeps only a weak reference to a task; these are held until they finish.
_running: set[asyncio.Task] = set()


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


def _newest_day(found: list[dict]) -> dict | None:
    """The Data Bank row to read: the newest with a readable `FileData`.

    Carmen may hold more than one row for a day (a re-run night audit); `LastModified`
    names the current one.
    """
    days = []
    for row in found:
        data = row.get("FileData")
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except ValueError:
                continue
        if isinstance(data, dict) and data.get("Transaction"):
            days.append({**row, "FileData": data})
    return max(days, key=lambda r: str(r.get("LastModified") or ""), default=None)


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
        settings_row = await db.get(PmsSettings, tenant_id)
        rules = await mapping.saved(db, tenant_id, name)
    if not token or not uri:
        return await _retry_or_fail(
            pk,
            attempts,
            "no_credential",
            "No Carmen access is stored for this business unit. Open PMS settings from Carmen's menu.",
        )

    uri_ctx = current_carmen_uri.set(uri)
    try:
        try:
            found = await carmen.get_databank_day(itype, name, doc_type, doc_date, token)
        except carmen.CarmenAPIError as exc:
            reason = (
                "carmen_unauthorized" if exc.status_code in (401, 403) else "databank_unreachable"
            )
            return await _retry_or_fail(pk, attempts, reason, exc.detail)

        databank = _newest_day(found)
        if databank is None:
            return await _retry_or_fail(
                pk,
                attempts,
                "day_not_found",
                f"Carmen's Data Bank has no {name} {doc_type} for {doc_date} yet.",
            )
        try:
            rows = pms_day.rows_of(databank["FileData"])
        except pms_day.UnreadableDay as exc:
            await _write(
                pk, status="failed", reason_code="unreadable_day", error_message=str(exc)[:500]
            )
            return "failed"

        new_keys = [k for k in pms_day.keys(rows) if k not in rules]
        guessed: dict[str, dict] = {}
        if new_keys:
            try:
                accounts, departments = await mapping.masters(token)
                guessed = await mapping.suggest(new_keys, rows, accounts, departments)
            except carmen.CarmenAPIError as exc:
                # No suggestion is not a reason to stop: the day parks with the codes
                # unmapped and the reviewer picks them. A dead credential still is.
                if exc.status_code in (401, 403):
                    return await _retry_or_fail(pk, attempts, "carmen_unauthorized", exc.detail)
                logger.warning("[pms] Could not read Carmen's GL for suggestions: %s", exc.detail)

        payload = {
            "interface_type": itype,
            "interface": name,
            "doc_type": doc_type,
            "doc_date": doc_date,
            "rows": rows,
            "guessed": guessed,
            "flags": pms_day.flags(rows, rules, guessed),
            # Which codes those flags are about, for the queue row (`activity._pms_row`).
            **pms_day.open_keys(rows, rules, guessed),
            "databank_id": databank.get("Id"),
            "last_modified": databank.get("LastModified"),
        }
        auto = bool(settings_row and settings_row.auto_post and settings_row.jv_prefix)
        if payload["flags"] or not auto:
            return await _park(pk, payload)

        body = posting.build_payload(
            pms_day.jv_lines(rows, rules),
            doc_date=date.fromisoformat(doc_date),
            prefix=settings_row.jv_prefix,
            text=posting.description(name, doc_type, date.fromisoformat(doc_date)),
        )
        try:
            jv_no = await posting.post_day(body, token)
        except posting.PostRefused as exc:
            return await _park(pk, payload, "carmen_rejected", str(exc))
        except carmen.CarmenAPIError as exc:
            reason = "carmen_unauthorized" if exc.status_code in (401, 403) else "carmen_rejected"
            # A transport error after the request left may still have posted it.
            return await _park(
                pk, payload, reason, f"{exc.detail} Check Carmen before posting again."
            )
        await _write(
            pk,
            status="posted",
            jv_no=jv_no,
            review_payload=None,
            reason_code=None,
            error_message=None,
            processed_at=datetime.now(UTC),
        )
        logger.info("[pms] Posted %s %s %s as %s", name, doc_type, doc_date, jv_no)
        return "posted"
    finally:
        current_carmen_uri.reset(uri_ctx)


async def _requeue_ready_days() -> int:
    """Send back for posting the parked days of auto-post BUs that are clean now.

    A day parks with `mapping_guessed` until somebody approves the code on *some* day; after
    that its stored rows map cleanly. Recomputing from those rows costs no Carmen call, and
    the day is then read again from the Data Bank before it posts.
    """
    async with async_session() as db:
        result = await db.execute(
            select(PmsEvent.id, PmsEvent.tenant_id, PmsEvent.review_payload)
            .join(PmsSettings, PmsSettings.tenant_id == PmsEvent.tenant_id)
            .where(
                PmsEvent.status == "pending_review",
                PmsEvent.reason_code.is_(None),
                PmsSettings.auto_post.is_(True),
                PmsSettings.jv_prefix.is_not(None),
            )
        )
        parked = result.all()
        ready = []
        rules_by: dict[tuple, dict] = {}
        for pk, tenant_id, payload in parked:
            payload = payload or {}
            key = (tenant_id, payload.get("interface"))
            if key not in rules_by:
                rules_by[key] = await mapping.saved(db, tenant_id, payload.get("interface") or "")
            if not pms_day.flags(payload.get("rows") or [], rules_by[key], {}):
                ready.append(pk)
        if ready:
            await db.execute(
                update(PmsEvent)
                .where(PmsEvent.id.in_(ready), PmsEvent.status == "pending_review")
                .values(status="received", attempts=0, processed_at=None, review_payload=None)
            )
            await db.commit()
    return len(ready)


async def _wake_for_new_credential() -> int:
    """Send back the days a missing or dead credential stopped, once a newer one is proven.

    `PUT /pms/credential` wakes them at once, but it is not the only writer of the BU's one
    credential (decision-log #42): opening the email settings from Carmen's menu stores a
    fresh token too, and the daily token check re-proves one after a passing outage. Each
    moves `carmen_token_verified_at` past the day's last attempt, which is the whole test.
    Without it a day that spent its attempts on an expired token stayed `failed` for good.
    """
    async with async_session() as db:
        result = await db.execute(
            update(PmsEvent)
            .where(
                PmsEvent.status.in_(("received", "failed")),
                PmsEvent.reason_code.in_(("no_credential", "carmen_unauthorized")),
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
