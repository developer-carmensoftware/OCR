"""Process the PMS days Carmen's hook announced: read back, find what is unmapped, park or post.

Two ways in, one function. The webhook starts `process_event` the moment it stores a day
(`kick`), and `run_pms_processing` — pg_cron every 10 minutes — picks up whatever a
restart, a Carmen outage or a missing credential left at `received`. A claim on
`processed_at` keeps the two from working the same day at once.

**Carmen posts; we map** (decision-log #43). The BU's PMS setting in Carmen says how debit
and credit are told apart and which account takes the counter line — each PMS differently —
and Carmen's engine (`interfacePostGL`) posts the day by it. This module decides nothing
about sides or totals. The setting itself is out of the menu token's reach (decision-log
#51), so this module:
1. reads Carmen's list of the BU's interfaces and the mapping table;
2. asks the engine's preview for the day's rows, keyed as a post would key them
   (decision-log #54);
3. finds the rows the table has no account for, and lets the AI suggest one;
4. asks the engine to post once nothing is missing.

A day with a row the table cannot place parks at `pending_review` with what the review
needs in `review_payload`. So does every day of a PMS whose auto-post is off (the default;
Carmen's PMS setting screen sets it per BU and PMS, decision-log #44). Only a fully mapped
day of an auto-post PMS posts unattended: the email rule (decision-log #24).
"""

import asyncio
import json
import logging
import uuid
from datetime import UTC, date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert

from app.context import current_carmen_uri, current_tenant_id
from app.database import async_session
from app.models.admin import APIKey
from app.models.email_automation import EmailIngestSettings
from app.models.enums import JobStatus
from app.models.identity import Tenant
from app.models.observability import JobRun
from app.models.pms import PmsEvent, PmsSettings
from app.services.email_automation import credential
from app.services.pms import carmen_config as cfg
from app.services.pms import mapping
from app.services.shared import api_keys, carmen

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
# …and a day with a key its mapping table has no account for with this one, posting nothing.
_MAPPING_INCOMPLETE = -500
# …and a date it has no data for with -400 "No Data Found on …" (seen 2026-11-06). -400 also
# means "Configuration is missing", so the words decide, not the code alone.
_NO_DATA = -400
# A day with no data yet (the hotel's day is not in Carmen yet) is asked again this often,
# without spending its attempts, and given up on this long after it was stored.
NOT_READY_WAIT = timedelta(hours=1)
NOT_READY_FOR = timedelta(hours=24)
# A day the sweep opens itself (decision-log #52, #55) says so in its payload.
OPENED_BY_SWEEP = "sweep"
# Yesterday's days are opened from 06:00 ICT, so a day is in the queue before people start
# work (the user, 2026-11-12). A day not in Carmen by then waits hourly (`NOT_READY_WAIT`).
# ponytail: one fixed hour for every BU; per-BU hours if a hotel closes its day later. A PMS
# Carmen fetches live (`PartnerApi`) could give a hotel's day before its night audit closed:
# none posts REVENUE yet; look again when one does (decision-log #55).
ICT = timezone(timedelta(hours=7))
OPEN_AFTER_HOUR = 6

_sweep_lock = asyncio.Lock()
# asyncio keeps only a weak reference to a task; these are held until they finish.
_running: set[asyncio.Task] = set()


class PostRefused(Exception):
    """Carmen's engine answered, and the answer was no. Its own words are the message."""


class MappingIncomplete(PostRefused):
    """The engine's `-500`: a key of the day has no account in Carmen's mapping table. The
    engine checks this itself, for every PMS, and posts nothing (decision-log #52)."""


class NoDataYet(PostRefused):
    """The engine's `-400 "No Data Found on …"`: nothing to post for the date yet."""


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


def _jv_seq(result: dict) -> str | None:
    """The JV Carmen's engine just made, from its answer's `Id` (ask D, 2026-11-03).

    `Id` is a list because a date range can post several JVs; we post one day at a time, so
    one JV. Older answers carry no `Id`: the day still posts, without a link to its JV.
    """
    ids = result.get("Id")
    return str(ids[0]) if isinstance(ids, list) and ids and ids[0] else None


def _engine_body(setting_code: str, doc_date: str, databank_id: Any) -> dict[str, Any]:
    """What the engine's post and its preview both take: the setting, the day, and the Data
    Bank row to read when there is one (a date alone otherwise)."""
    body: dict[str, Any] = {"Code": setting_code, "DateFrom": doc_date, "DateTo": doc_date}
    if databank_id is not None:
        body["id"] = [databank_id]
    return body


def _no_data(result: Any) -> str | None:
    """Carmen's words when the engine has nothing for the date yet, else None.

    Its `-400` also means `Configuration is missing`, so the code alone does not decide: the
    words have to say `No Data Found`.
    """
    if not isinstance(result, dict) or result.get("Code") != _NO_DATA:
        return None
    words = str(result.get("UserMessage") or "").strip()
    return words[:500] if "no data found" in words.lower() else None


async def post_day(
    section: dict, doc_date: str, databank_id: Any, carmen_token: str
) -> tuple[str, str | None]:
    """Ask Carmen's engine to post one Data Bank day.

    Returns `("posted", jv_seq)` — the JV's seq when Carmen names it, which is what the
    queue's Open JV link opens — or `("already_posted", None)`.
    `section` is the payload's `{"setting_code", "post_type"}`. The counter account is left
    to the engine, which takes it from the setting (decision-log #51).
    Raises `MappingIncomplete` for the engine's `-500`, `PostRefused` with Carmen's words for
    any other no (a closed period, an invalid account, …), or `carmen.CarmenAPIError` when
    Carmen could not be reached or refused the credential. Asking again is safe: the engine
    refuses a day it has already posted, and posts nothing while a key is unmapped.
    A day with no Data Bank row (a PartnerApi PMS, which Carmen fetches at post time) is
    posted by date alone, with no `id`.
    """
    body = _engine_body(section["setting_code"], doc_date, databank_id)
    result = await carmen.post_pms_gl(section["post_type"], body, carmen_token)
    if isinstance(result, dict) and result.get("Result") is True:
        return "posted", _jv_seq(result)
    if isinstance(result, dict) and result.get("Code") == _ALREADY_POSTED:
        return "already_posted", None
    if isinstance(result, dict) and result.get("Code") == _MAPPING_INCOMPLETE:
        raise MappingIncomplete(str(result.get("UserMessage") or "Mapping is incomplete.")[:500])
    if words := _no_data(result):
        raise NoDataYet(words)
    verdict = None
    if isinstance(result, dict):
        verdict = (
            result.get("UserMessage") or result.get("InternalMessage") or result.get("Message")
        )
        errors = result.get("ErrorList")
        if errors:
            verdict = f"{verdict or 'Carmen refused the day'}: {errors}"
    raise PostRefused(str(verdict or f"Carmen answered {result!r}")[:500])


def _due(now: datetime):
    """A `received` day a worker may take: unclaimed or abandoned, with attempts left — and
    one Carmen had no data for yet only once `NOT_READY_WAIT` has passed."""
    return and_(
        PmsEvent.status == "received",
        PmsEvent.attempts < MAX_ATTEMPTS,
        or_(PmsEvent.processed_at.is_(None), PmsEvent.processed_at < now - LEASE),
        or_(
            PmsEvent.reason_code.is_distinct_from("day_not_ready"),
            PmsEvent.processed_at < now - NOT_READY_WAIT,
        ),
    )


async def _claim(event_pk: uuid.UUID) -> Any:
    """Take a `received` day for this worker, or None when it is not ours to take."""
    now = datetime.now(UTC)
    async with async_session() as db:
        result = await db.execute(
            update(PmsEvent)
            .where(PmsEvent.id == event_pk, _due(now))
            .values(processed_at=now, attempts=PmsEvent.attempts + 1)
            .returning(
                PmsEvent.id,
                PmsEvent.tenant_id,
                PmsEvent.payload,
                PmsEvent.attempts,
                PmsEvent.created_at,
            )
        )
        row = result.first()
        await db.commit()
    return row


async def store_day(db, tenant_id: uuid.UUID, event_id: str, type_: str, payload: dict):
    """One row per BU × day: the new row's id, or None when the day is already stored.

    The hook stores the days Carmen announces, and the sweep the days of a PartnerApi PMS,
    which nobody announces (decision-log #52). The caller commits.
    """
    return await db.scalar(
        insert(PmsEvent)
        .values(tenant_id=tenant_id, event_id=event_id, type=type_, payload=payload)
        .on_conflict_do_nothing(index_elements=["tenant_id", "event_id"])
        .returning(PmsEvent.id)
    )


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


async def _not_ready(claimed, error: str) -> str:
    """Carmen has no data for the date yet (a PartnerApi PMS before the hotel's day is in).
    Asked again hourly without spending an attempt; given up on a day after it was stored."""
    if datetime.now(UTC) - claimed.created_at >= NOT_READY_FOR:
        await _write(claimed.id, status="failed", reason_code="day_not_found", error_message=error)
        return "failed"
    await _write(
        claimed.id,
        reason_code="day_not_ready",
        error_message=error,
        attempts=max(claimed.attempts - 1, 0),
    )
    return "retry"


async def _retry_or_fail(event_pk, attempts: int, reason: str, error: str) -> str:
    """Leave the day for the next sweep, or give up on it once the attempts are spent."""
    if attempts >= MAX_ATTEMPTS:
        await _write(event_pk, status="failed", reason_code=reason, error_message=error[:500])
        return "failed"
    await _write(event_pk, reason_code=reason, error_message=error[:500])
    return "retry"


async def with_carmen_keys(payload: dict, token: str) -> dict:
    """The day's review after Carmen's `-500`, with the keys Carmen named in it to map here.

    Carmen's engine writes every key a post found unmapped into the mapping table, with no
    account (decision-log #53). Those rows join the day's, with the AI's suggestions, so the
    reviewer maps them in this app: all of them, this day's and any earlier day's, because
    Carmen needs them all. If the table cannot be read, the payload stays as it was and the
    day parks saying why.
    """
    columns = payload.get("key_columns") or []
    try:
        current, _ = await carmen.get_pms_mapping(
            payload["setting_code"], payload["post_type"], token
        )
    except carmen.CarmenAPIError as exc:
        logger.warning("[pms] Could not read Carmen's mapping after its -500: %s", exc.detail)
        return payload
    rows = list(payload.get("rows") or [])
    have = {r["key"] for r in rows}
    rows += [b for b in cfg.blank_keys(current, columns) if b["key"] not in have]
    table = cfg.table_of(current, columns)
    new = cfg.new_keys(rows, table)
    guessed = dict(payload.get("guessed") or {})
    todo = [k for k in new if k not in guessed]
    if todo:
        try:
            accounts, departments = await mapping.masters(token)
            guessed |= await mapping.suggest(todo, table, accounts, departments, columns)
        except carmen.CarmenAPIError as exc:
            logger.warning("[pms] Could not read Carmen's GL for suggestions: %s", exc.detail)
    return {
        **payload,
        "rows": rows,
        "mapped": {k: table[k] for k in dict.fromkeys(r["key"] for r in rows) if k in table},
        "guessed": guessed,
        "flags": mapping.flags(new, guessed),
        **mapping.open_keys(new, guessed),
        "preview": bool(payload.get("preview", True) or rows),
    }


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
        key = await api_keys.live_key(db, tenant_id, name.lower())
    if key is None:
        # The BU switched this PMS off (its key was revoked) while the day waited, or in the
        # instant of the revoke: it never posts, whatever auto-post says (decision-log #56).
        # Closed as `switch_off` closes the PMS's other days, before any Carmen call or AI.
        await _write(
            pk,
            status="rejected",
            reason_code="pms_switched_off",
            error_message="Switched off in Carmen's PMS setting.",
            review_payload=None,
        )
        return "rejected"
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
            interfaces = await carmen.get_interfaces(token)
        except carmen.CarmenAPIError as exc:
            return await _retry_or_fail(pk, attempts, "carmen_config_unreadable", exc.detail)
        section = cfg.find_section(interfaces, itype, name)
        if section is None:
            return await _retry_or_fail(
                pk,
                attempts,
                "pms_setting_missing",
                f"Carmen has no PMS interface {name} posting Revenue to GL.",
            )
        try:
            current, table_columns = await carmen.get_pms_mapping(
                section.setting_code, section.post_type, token
            )
        except carmen.CarmenAPIError as exc:
            return await _retry_or_fail(pk, attempts, "carmen_config_unreadable", exc.detail)
        columns = cfg.key_columns(table_columns)
        if not columns:
            return await _retry_or_fail(
                pk,
                attempts,
                "carmen_config_unreadable",
                f"Carmen's {section.setting_code} mapping table names no key columns.",
            )

        # A day our sweep opened may have no Data Bank row: none ever, for a PMS Carmen fetches
        # at post time, or not yet, for one whose day the hotel has not sent. Carmen's preview
        # then answers No Data and the day waits hourly. A hooked day is in the Data Bank.
        opened = hook.get("Source") == OPENED_BY_SWEEP
        try:
            found = await carmen.get_databank_day(itype, name, doc_type, doc_date, token)
        except carmen.CarmenAPIError as exc:
            reason = _refusal(exc, "databank_unreachable")
            return await _retry_or_fail(pk, attempts, reason, carmen_words(exc))
        if not found and not opened:
            return await _retry_or_fail(
                pk,
                attempts,
                "day_not_found",
                f"Carmen's Data Bank has no {name} {doc_type} for {doc_date} yet.",
            )
        # Carmen may hold more than one row for a day (a night audit run again); `LastModified`
        # names the current one. Only its id is used: the engine reads the row itself.
        databank = max(found or [{}], key=lambda d: str(d.get("LastModified") or ""))
        databank_id = databank.get("Id")

        # The day's rows as Carmen's engine keys them, from its preview of the post
        # (decision-log #54). It reads the day by the BU's INI, for any PMS, so no layout is
        # ours to read. It is given the same Data Bank row the post will be.
        try:
            answer = await carmen.preview_pms_gl(
                section.post_type,
                _engine_body(section.setting_code, doc_date, databank_id),
                token,
            )
        except carmen.CarmenAPIError as exc:
            if exc.status_code in (401, 403):
                return await _retry_or_fail(pk, attempts, _refusal(exc, ""), carmen_words(exc))
            # The preview is not what posts. Without it the day parks with no rows, Carmen's
            # engine checks the mapping when it is posted, and its `-500` brings the keys it
            # lacks into the review (`with_carmen_keys`), as before decision-log #54.
            logger.warning("[pms] Carmen's preview of %s %s: %s", name, doc_date, exc.detail)
            answer = None
        if words := _no_data(answer):
            return await _not_ready(claimed, words)
        rows = cfg.preview_rows(answer, columns) or []

        table = cfg.table_of(current, columns)
        new = cfg.new_keys(rows, table)
        guessed: dict[str, dict] = {}
        if new:
            try:
                accounts, departments = await mapping.masters(token)
                guessed = await mapping.suggest(new, table, accounts, departments, columns)
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
            "key_columns": columns,
            "rows": rows,
            # Carmen's accounts for the keys this day uses, as they were when it was read.
            "mapped": {k: table[k] for k in dict.fromkeys(r["key"] for r in rows) if k in table},
            "guessed": guessed,
            "flags": mapping.flags(new, guessed),
            # Which keys those flags are about, for the queue row (`activity._pms_row`).
            **mapping.open_keys(new, guessed),
            # False: Carmen's preview gave no rows, so the review shows none and Carmen checks
            # the mapping when the day is posted.
            "preview": bool(rows),
            "databank_id": databank_id,
            "last_modified": databank.get("LastModified"),
        }
        if payload["flags"] or not (settings_row and settings_row.auto_post):
            return await _park(pk, payload)

        try:
            outcome, jv_no = await post_day(payload, doc_date, payload["databank_id"], token)
        except MappingIncomplete as exc:
            payload = await with_carmen_keys(payload, token)
            return await _park(pk, payload, "pms_mapping_incomplete", str(exc))
        except NoDataYet as exc:
            return await _not_ready(claimed, str(exc))
        except PostRefused as exc:
            return await _park(pk, payload, "carmen_rejected", str(exc))
        except carmen.CarmenAPIError as exc:
            return await _park(pk, payload, _refusal(exc, "carmen_rejected"), carmen_words(exc))
        await _write(
            pk,
            status="posted",
            jv_no=jv_no,
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
                    # Auto-post on, and the PMS still switched on: a live key (decision-log #56).
                    select(PmsSettings.tenant_id, PmsSettings.interface_name)
                    .join(
                        APIKey,
                        and_(
                            APIKey.tenant_id == PmsSettings.tenant_id,
                            APIKey.interface_name == PmsSettings.interface_name,
                            APIKey.revoked_at.is_(None),
                        ),
                    )
                    .where(PmsSettings.auto_post.is_(True))
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


# The PMSs each BU posts REVENUE with, read from Carmen's interface list once a day: a list
# that failed to read is not cached, so the next sweep asks again.
_listed_cache: dict[uuid.UUID, tuple[date, dict[str, str]]] = {}


async def _listed_pms(tenant_id: uuid.UUID, today: date) -> dict[str, str] | None:
    """`{lower-cased name: name}` of the PMSs this BU posts REVENUE to GL with, or None when
    Carmen's list could not be read (no credential, a refusal, Carmen's own 500)."""
    hit = _listed_cache.get(tenant_id)
    if hit and hit[0] == today:
        return hit[1]
    async with async_session() as db:
        token, uri = await _target(db, tenant_id)
    if not token or not uri:
        return None
    ctx = current_carmen_uri.set(uri)
    try:
        names = cfg.revenue_interfaces(await carmen.get_interfaces(token))
    except carmen.CarmenAPIError as exc:
        logger.warning("[pms] Carmen's interface list for %s: %s", tenant_id, exc.detail)
        return None
    finally:
        current_carmen_uri.reset(ctx)
    _listed_cache[tenant_id] = (today, names)
    return names


async def _open_days(now: datetime | None = None) -> int:
    """Open yesterday's day for every PMS a BU has switched on (decision-log #52, #55).

    From `OPEN_AFTER_HOUR` (ICT) each BU × PMS with a live key that Carmen's interface list
    names as posting REVENUE to GL gets the row a hook would have stored, whatever its
    `From`. A PMS Carmen fetches itself (`PartnerApi`) never sends a hook; for the others the
    hook only brings the day sooner, and a lost or refused hook no longer loses the day.
    Only an INSERT: the sweep then works through the days one at a time, so a hundred BUs
    never reach Carmen at once. A day that already has a row (a hook came) is left alone.
    """
    local = (now or datetime.now(UTC)).astimezone(ICT)
    if local.hour < OPEN_AFTER_HOUR:
        return 0
    day = (local.date() - timedelta(days=1)).isoformat()
    async with async_session() as db:
        live = (
            await db.execute(
                select(APIKey.tenant_id, APIKey.interface_name)
                .join(Tenant, Tenant.id == APIKey.tenant_id)
                .where(
                    APIKey.revoked_at.is_(None),
                    APIKey.interface_name.is_not(None),
                    Tenant.deleted_at.is_(None),
                    Tenant.is_active.is_(True),
                )
            )
        ).all()
    keys: dict[uuid.UUID, set[str]] = {}
    for tenant_id, interface in live:
        keys.setdefault(tenant_id, set()).add(interface)
    opened = 0
    for tenant_id, interfaces in keys.items():
        listed = await _listed_pms(tenant_id, local.date())
        if not listed:
            continue
        async with async_session() as db:
            for lowered in sorted(interfaces & listed.keys()):
                name = listed[lowered]
                hook = {"InterfaceType": "PMS", "InterfaceName": name, "DocType": "Daily"}
                payload = {**hook, "DocDate": day, "Source": OPENED_BY_SWEEP}
                event_id = f"PMS/{name}/Daily/{day}"
                # Carmen's list may spell the PMS unlike a hook does (`Hoteltime` / `HotelTime`),
                # and the unique key is case-sensitive: a day a hook stored stays the one row.
                held = await db.scalar(
                    select(PmsEvent.id).where(
                        PmsEvent.tenant_id == tenant_id,
                        func.lower(PmsEvent.event_id) == event_id.lower(),
                    )
                )
                if held is None and await store_day(db, tenant_id, event_id, "PMS", payload):
                    opened += 1
            await db.commit()
    return opened


async def run_pms_processing(limit: int = 50) -> dict:
    """One sweep: every day waiting at `received`, oldest first. Serialised against itself."""
    if _sweep_lock.locked():
        return {"status": "busy"}
    async with _sweep_lock:
        started = datetime.now(UTC)
        summary: dict = {"status": "ok", "opened": 0, "requeued": 0, "woken": 0}
        error = None
        try:
            summary["opened"] = await _open_days()
            summary["requeued"] = await _requeue_ready_days()
            summary["woken"] = await _wake_for_new_credential()
            now = datetime.now(UTC)
            async with async_session() as db:
                result = await db.execute(
                    select(PmsEvent.id).where(_due(now)).order_by(PmsEvent.created_at).limit(limit)
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
            v
            for k, v in summary.items()
            if k not in ("status", "opened", "requeued", "woken", "skipped")
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
