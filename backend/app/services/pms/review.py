"""The person's half of a PMS day (CA-119): see what it holds, approve it, or reject it.

Mirrors `email_automation/review.py`. The approve/reject claim is a compare-and-set on
`posting_started_at`, so two reviewers pressing Approve together cannot post a day twice,
and the claim is handed back on every path that does not finish.

**Approving writes the AI's picks into Carmen** (decision-log #43). The day's new rows
travel in its `review_payload` with the AI's suggestion. Approve reads Carmen's mapping
table fresh, adds the reviewer's answer for every row it still cannot place, writes the
table back — whole, because Carmen's PUT replaces it — and asks Carmen's engine to post the
day. Then it re-checks this BU's other parked days, which may now be fully mapped.
"""

import logging
import uuid
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.context import current_carmen_uri
from app.database import async_session
from app.exceptions import CarmenServiceError, ConflictError, NotFoundError, ValidationError
from app.models.email_automation import EmailIngestSettings
from app.models.pms import PmsEvent, PmsSettings
from app.services.credit_card.gl_suggestion import _dept_allowed_map, _pair_ok
from app.services.pms import carmen_config as cfg
from app.services.pms import mapping
from app.services.pms.process import (
    REVIEW_CLAIM_TTL,
    PostRefused,
    _target,
    carmen_words,
    post_day,
)
from app.services.shared import api_keys, carmen

logger = logging.getLogger(__name__)


def _total(amounts: list[str]) -> str:
    """The amount a key's rows add up to, as written — a key is usually one row."""
    try:
        return str(sum((Decimal(a) for a in amounts if a), Decimal(0)))
    except InvalidOperation:
        return amounts[0] if amounts else ""


async def get_day(db: AsyncSession, tenant_id: uuid.UUID, event_pk: uuid.UUID) -> dict | None:
    """What the review modal shows for one parked day, or None when it is not waiting."""
    row = await db.scalar(
        select(PmsEvent).where(
            PmsEvent.id == event_pk,
            PmsEvent.tenant_id == tenant_id,
            PmsEvent.status == "pending_review",
        )
    )
    if row is None or not row.review_payload:
        return None
    payload = row.review_payload
    rows = payload.get("rows") or []
    mapped = payload.get("mapped") or {}
    guessed = payload.get("guessed") or {}
    keys = list(dict.fromkeys(r["key"] for r in rows))
    new_codes = []
    for key in keys:
        if key in mapped:
            continue
        mine = [r for r in rows if r["key"] == key]
        pick = guessed.get(key) or {}
        new_codes.append(
            {
                "key": key,
                "label": cfg.label(key),
                "values": mine[0]["values"] if mine else {},
                "amount": _total([r["amount"] for r in mine]),
                "dept": pick.get("dept"),
                "acc": pick.get("acc"),
                "confidence": pick.get("confidence"),
                "why": pick.get("why"),
            }
        )
    return {
        "id": str(row.id),
        "interface": payload.get("interface"),
        "doc_type": payload.get("doc_type"),
        "doc_date": payload.get("doc_date"),
        "reason_code": row.reason_code,
        "error_message": row.error_message,
        "setting_code": payload.get("setting_code"),
        "post_type": payload.get("post_type"),
        "counter": payload.get("counter") or {},
        "key_columns": payload.get("key_columns") or [],
        "rows": [{**r, **(mapped.get(r["key"]) or {})} for r in rows],
        "mapped_count": sum(1 for k in keys if k in mapped),
        "new_codes": new_codes,
    }


async def _claim(db: AsyncSession, tenant_id: uuid.UUID, event_pk: uuid.UUID) -> Any:
    """Take the day for this approve/reject, or say why not. Commits the claim."""
    now = datetime.now(UTC)
    claimed = (
        await db.execute(
            update(PmsEvent)
            .where(
                PmsEvent.id == event_pk,
                PmsEvent.tenant_id == tenant_id,
                PmsEvent.status == "pending_review",
                or_(
                    PmsEvent.posting_started_at.is_(None),
                    PmsEvent.posting_started_at < now - REVIEW_CLAIM_TTL,
                ),
            )
            .values(posting_started_at=now)
            .returning(PmsEvent.id, PmsEvent.review_payload)
        )
    ).first()
    if claimed is not None:
        await db.commit()
        return claimed
    status = await db.scalar(
        select(PmsEvent.status).where(PmsEvent.id == event_pk, PmsEvent.tenant_id == tenant_id)
    )
    if status is None:
        raise NotFoundError("This day is not waiting for review")
    if status == "pending_review":
        raise ConflictError("Another reviewer is posting this day right now")
    raise ConflictError("Someone else has already handled this day")


async def _release(event_pk: uuid.UUID) -> None:
    """Give a claimed day back. Never raises — worst case the claim expires."""
    try:
        async with async_session() as db:
            await db.execute(
                update(PmsEvent)
                .where(PmsEvent.id == event_pk, PmsEvent.status == "pending_review")
                .values(posting_started_at=None)
            )
            await db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("[pms] Could not release the review claim on %s", event_pk)


def _check_picks(picks: dict[str, dict], accounts: list[dict], departments: list[dict]) -> None:
    """Refuse a pick Carmen's chart of accounts does not have, naming the row."""
    valid_acc = {a["code"] for a in accounts}
    valid_dept = {d["code"] for d in departments}
    allowed = _dept_allowed_map(departments)
    for key, p in picks.items():
        row = cfg.label(key)
        if p["dept"] not in valid_dept:
            raise ValidationError(f"{row}: {p['dept']} is not a department in Carmen")
        if p["acc"] not in valid_acc:
            raise ValidationError(f"{row}: {p['acc']} is not an account in Carmen")
        if not _pair_ok(p["dept"], p["acc"], allowed):
            raise ValidationError(
                f"{row}: department {p['dept']} does not allow account {p['acc']}"
            )


async def approve(
    tenant_id: uuid.UUID,
    event_pk: uuid.UUID,
    picks: dict[str, dict],
    *,
    reviewer: str,
    reviewer_name: str | None,
) -> dict:
    """Write the new rows' accounts into Carmen, have Carmen post the day, re-check the rest.

    `picks` is `{key: {"dept", "acc"}}` for the day's new rows. A row Carmen's table has
    meanwhile been given an account for keeps Carmen's (its own screen edits the table).
    Refuses — leaving the day parked — when a row still has no account, Carmen's table
    cannot be read (the PUT replaces it, so it is never written blind), or Carmen says no.
    """
    async with async_session() as db:
        claimed = await _claim(db, tenant_id, event_pk)
    posted = False
    uri_ctx = None
    try:
        payload = claimed.review_payload or {}
        rows = payload.get("rows") or []
        columns = payload.get("key_columns") or []
        code, post_type = payload.get("setting_code") or "", payload.get("post_type") or ""
        async with async_session() as db:
            token, uri = await _target(db, tenant_id)
        if not token or not uri:
            raise ValidationError(
                "No Carmen access is stored for this business unit. Open PMS settings from Carmen's menu."
            )
        uri_ctx = current_carmen_uri.set(uri)

        try:
            current = await carmen.get_pms_mapping(code, post_type, token)
        except carmen.CarmenAPIError as exc:
            raise CarmenServiceError(
                f"Couldn't read Carmen's {payload.get('interface')} mapping, so nothing was "
                f"written or posted: {carmen_words(exc)}"
            ) from exc
        table = cfg.table_of(current, columns)
        chosen: dict[str, dict] = {}
        for key in cfg.new_keys(rows, table):
            p = picks.get(key) or {}
            if not mapping.usable(p):
                raise ValidationError("Pick an account for every new row")
            chosen[key] = {"dept": p["dept"], "acc": p["acc"]}

        if chosen:
            accounts, departments = await mapping.masters(token)
            _check_picks(chosen, accounts, departments)
            try:
                await carmen.put_pms_mapping(
                    code, post_type, cfg.merged_rows(current, chosen, columns), token
                )
            except carmen.CarmenAPIError as exc:
                raise CarmenServiceError(
                    f"Carmen didn't save the accounts, so the day wasn't posted: {carmen_words(exc)}"
                ) from exc

        try:
            outcome = await post_day(payload, payload["doc_date"], payload["databank_id"], token)
        except PostRefused as exc:
            raise ValidationError(f"Carmen didn't post the day: {exc}") from exc
        except carmen.CarmenAPIError as exc:
            raise CarmenServiceError(
                f"{carmen_words(exc)} Approving again is safe: Carmen refuses a day it has already posted."
            ) from exc
        posted = True

        async with async_session() as db:
            await db.execute(
                update(PmsEvent)
                .where(PmsEvent.id == event_pk)
                .values(
                    status="posted",
                    jv_no=None,
                    review_payload=None,
                    reason_code="already_posted" if outcome == "already_posted" else None,
                    error_message=None,
                    posting_started_at=None,
                    reviewed_by=reviewer[:36],
                    reviewed_by_name=(reviewer_name or "")[:100] or None,
                    reviewed_at=datetime.now(UTC),
                )
            )
            await db.commit()
        if chosen:
            fresh = {**table, **{k: {**v, "name": ""} for k, v in chosen.items()}}
            await recheck(tenant_id, payload.get("interface") or "", fresh)
        return {"jv_no": None, "already_posted": outcome == "already_posted"}
    finally:
        if uri_ctx is not None:
            current_carmen_uri.reset(uri_ctx)
        if not posted:
            await _release(event_pk)


async def reject(
    tenant_id: uuid.UUID,
    event_pk: uuid.UUID,
    reason: str | None,
    *,
    reviewer: str,
    reviewer_name: str | None,
) -> None:
    """Retire the day without a JV. Carmen re-sending it brings it back (`routers/pms.py`)."""
    async with async_session() as db:
        await _claim(db, tenant_id, event_pk)
        await db.execute(
            update(PmsEvent)
            .where(PmsEvent.id == event_pk)
            .values(
                status="rejected",
                reason_code="rejected_by_reviewer",
                error_message=(reason or "").strip()[:500] or None,
                review_payload=None,
                posting_started_at=None,
                reviewed_by=reviewer[:36],
                reviewed_by_name=(reviewer_name or "")[:100] or None,
                reviewed_at=datetime.now(UTC),
            )
        )
        await db.commit()


async def recheck(tenant_id: uuid.UUID, interface: str, table: dict[str, dict]) -> int:
    """Recompute the open rows of this BU's other parked days against Carmen's table as it
    now is (`table`, just written by an approve).

    A row approved on one day stops being "AI suggested" on every other day that has it.
    Costs no Carmen call: the rows are in each day's payload. Returns how many changed.
    Never raises — the approve it follows has already posted.
    """
    try:
        async with async_session() as db:
            parked = (
                (
                    await db.execute(
                        select(PmsEvent).where(
                            PmsEvent.tenant_id == tenant_id,
                            PmsEvent.status == "pending_review",
                        )
                    )
                )
                .scalars()
                .all()
            )
            changed = 0
            for row in parked:
                payload = dict(row.review_payload or {})
                if payload.get("interface") != interface:
                    continue
                rows, guessed = payload.get("rows") or [], payload.get("guessed") or {}
                keys = dict.fromkeys(r["key"] for r in rows)
                new = [k for k in keys if k not in table]
                fresh = {
                    "mapped": {k: table[k] for k in keys if k in table},
                    "flags": mapping.flags(new, guessed),
                    **mapping.open_keys(new, guessed),
                }
                if any(payload.get(k) != v for k, v in fresh.items()):
                    # Replaced, not mutated: SQLAlchemy does not see in-place JSON edits.
                    row.review_payload = {**payload, **fresh}
                    changed += 1
            await db.commit()
            return changed
    except Exception:  # noqa: BLE001
        logger.exception("[pms] Could not re-check parked days for %s", tenant_id)
        return 0


async def get_settings(db: AsyncSession, tenant_id: uuid.UUID, interface_name: str) -> dict:
    """What Carmen's PMS setting screen shows for one PMS: its posting switch, its hook key
    (never the key itself), and whether this BU has a Carmen credential stored at all."""
    row = await db.get(PmsSettings, (tenant_id, interface_name))
    ingest = await db.get(EmailIngestSettings, tenant_id)
    key = await api_keys.live_key(db, tenant_id, interface_name)
    return {
        "pms": interface_name,
        "auto_post": bool(row and row.auto_post),
        "key": key
        and {
            "prefix": key.key_prefix,
            "created_at": key.created_at,
            "last_used_at": key.last_used_at,
        },
        "has_credential": bool(ingest and ingest.carmen_token_enc),
    }


async def save_settings(
    db: AsyncSession, tenant_id: uuid.UUID, interface_name: str, *, auto_post: bool, actor: str
) -> None:
    """Replace this BU's posting switch for one PMS. The caller commits."""
    row = await db.get(PmsSettings, (tenant_id, interface_name))
    if row is None:
        row = PmsSettings(tenant_id=tenant_id, interface_name=interface_name, created_by=actor)
        db.add(row)
    row.auto_post = auto_post
    row.updated_by = actor
    await db.flush()
