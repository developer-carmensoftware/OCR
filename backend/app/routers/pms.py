"""PMS interface (CA-93, CA-119).

Three audiences under one prefix:
- `POST /events`: Carmen pushes PMS data here, the first endpoint Carmen calls *into*
  (decision-log #39). Authenticated by a per-tenant API key; the key, not the body, says
  which BU this is. Storing the day starts its processing (`services/pms/process.py`).
- `/keys`: the BU's own key screen, `#/pms`, opened from Carmen's menu (decision-log #40).
  Our session JWT; the session's tenant is the only BU these routes can see or touch.
- `/days/{id}` (+ approve, reject), `/settings` and `/credential`: a parked day's review,
  opened from the AI JV Automation queue, how the BU's days post, and the Carmen credential
  they post with. Session JWT, the session's BU only.
- `POST /process/run`: the retry sweep pg_cron calls with the internal job token.
Contract: docs/PMS_INTEGRATION.md.
"""

import re
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy import func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_session
from app.auth.session import SessionInfo
from app.context import current_tenant_id
from app.database import get_db
from app.exceptions import FileTooLargeError
from app.models.admin import APIKey
from app.models.identity import Tenant
from app.models.pms import PmsEvent
from app.models.schemas.pms import (
    PmsApproveIn,
    PmsApproveOut,
    PmsCredentialIn,
    PmsDayOut,
    PmsEventIn,
    PmsEventOut,
    PmsKeyCreateIn,
    PmsRejectIn,
    PmsSettingsIn,
    PmsSettingsOut,
)
from app.routers.admin.deps import require_maintenance_auth
from app.routers.email_automation.settings_api import _safe_carmen_uri
from app.services.email_automation import credential
from app.services.pms import process
from app.services.pms import review as pms_review
from app.services.shared import api_keys as keys
from app.services.shared.api_keys import PMS_SCOPE, authenticate
from app.services.shared.audit import AuditAction, log_action
from app.services.shared.tenant_lookup import tenant_info_map
from app.utils.client_ip import get_client_ip
from app.utils.pagination import paginate

router = APIRouter(prefix="/api/v1/pms", tags=["PMS"])

# The hook is four short fields (the data stays in Carmen's Data Bank); anything near
# this size is not Carmen.
MAX_BODY_BYTES = 16 * 1024


async def _pms_key(
    request: Request,
    authorization: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
) -> APIKey:
    """`Bearer <key>` or the bare key — Carmen sends its own tokens unlabelled.

    Async so the tenant context it sets is visible to the handler.
    """
    # The scheme is case-insensitive (RFC 7235): "bearer cpk_…" is the same key.
    token = re.sub(r"^\s*bearer\s+", "", authorization or "", flags=re.IGNORECASE).strip()
    key = await authenticate(db, token, PMS_SCOPE, get_client_ip(request))
    if key is None:
        raise HTTPException(401, "Invalid API key", headers={"WWW-Authenticate": "Bearer"})
    current_tenant_id.set(str(key.tenant_id))
    # PerformanceMiddleware only decodes our JWTs; this is how the row gets its tenant.
    request.state.tenant_id = str(key.tenant_id)
    return key


@router.post("/events", status_code=202, response_model=PmsEventOut)
async def receive_event(
    request: Request,
    response: Response,
    key: APIKey = Depends(_pms_key),
    db: AsyncSession = Depends(get_db),
):
    # The body is read here, after the key is proven, not by a Pydantic parameter
    # (FastAPI reads those before any dependency runs).
    body = await request.body()
    if len(body) > MAX_BODY_BYTES:
        raise FileTooLargeError("Event body exceeds 16 KB")
    try:
        # Some .NET writers put a UTF-8 BOM before the JSON; it is not part of the value.
        event = PmsEventIn.model_validate_json(body.removeprefix(b"\xef\xbb\xbf"))
    except PydanticValidationError as exc:
        raise RequestValidationError(exc.errors(include_url=False)) from None

    new_id = await db.scalar(
        insert(PmsEvent)
        .values(
            tenant_id=key.tenant_id,
            event_id=event.key,
            type=event.interface_type,
            payload=event.model_dump(by_alias=True, mode="json"),
        )
        .on_conflict_do_nothing(index_elements=["tenant_id", "event_id"])
        .returning(PmsEvent.id)
    )
    duplicate = new_id is None
    process_it = not duplicate
    if duplicate:
        # The same Data Bank day again: one row, and a record of when we last heard of it.
        new_id = await db.scalar(
            update(PmsEvent)
            .where(PmsEvent.tenant_id == key.tenant_id, PmsEvent.event_id == event.key)
            .values(updated_at=func.now())
            .returning(PmsEvent.id)
        )
        # Carmen re-sends a day when the night audit was run again (AddOrUpdate), so an
        # unposted day is read again from scratch (decision-log #42). A posted one never
        # is — that would be a second JV — and neither is one a reviewer is acting on now.
        process_it = (
            await db.scalar(
                update(PmsEvent)
                .where(
                    PmsEvent.id == new_id,
                    PmsEvent.status != "posted",
                    or_(
                        PmsEvent.posting_started_at.is_(None),
                        PmsEvent.posting_started_at < datetime.now(UTC) - process.REVIEW_CLAIM_TTL,
                    ),
                )
                .values(
                    status="received",
                    attempts=0,
                    processed_at=None,
                    review_payload=None,
                    reason_code=None,
                    error_message=None,
                )
                .returning(PmsEvent.id)
            )
            is not None
        )
        response.status_code = 200
    await db.commit()
    if process_it:
        process.kick(new_id)
    return PmsEventOut(id=new_id, duplicate=duplicate)


@router.post("/process/run")
async def run_processing(_: object = Depends(require_maintenance_auth)):
    """The retry sweep (pg_cron, every 10 minutes): days a restart or an outage left behind."""
    return await process.run_pms_processing()


# ── The BU's own keys (#/pms) ──────────────────────────────────────────────────────


@router.get("/keys")
async def list_keys(
    session: SessionInfo = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    """This BU's keys, newest first; revoked ones stay as history. A BU has a handful."""
    stmt = (
        select(APIKey)
        .where(APIKey.tenant_id == UUID(session.tenant_id))
        .order_by(APIKey.created_at.desc(), APIKey.id.desc())
    )
    rows, total = await paginate(db, stmt, 50, 0)
    tenants = await tenant_info_map(db, [session.tenant_id])
    return {
        "total": total,
        "limit": 50,
        "offset": 0,
        "data": [keys.key_row(k, tenants) for k in rows],
    }


@router.post("/keys", status_code=201)
async def create_key(
    body: PmsKeyCreateIn,
    request: Request,
    session: SessionInfo = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    """Issue a key for the session's BU. 409 at the 2-active cap. The plaintext is in this
    response and nowhere else."""
    key, plaintext = await keys.issue(
        db, UUID(session.tenant_id), body.name, actor=f"user:{session.carmen_user_id}"
    )
    await db.commit()
    await log_action(
        session,
        AuditAction.API_KEY_CREATE,
        resource="api_keys",
        resource_id=str(key.id),
        ip_address=get_client_ip(request),
    )
    tenants = await tenant_info_map(db, [key.tenant_id])
    return {**keys.key_row(key, tenants), "key": plaintext}


@router.delete("/keys/{key_id}")
async def revoke_key(
    key_id: UUID,
    request: Request,
    reason: str | None = Query(None, max_length=500),
    session: SessionInfo = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    """Revoke one of the session BU's live keys. Another BU's key is a 404, same as none."""
    revoked = await keys.revoke(
        db,
        key_id,
        # revoked_by is 36 wide: the Carmen user UUID, as the audit row's carmen_user_id.
        by=session.carmen_user_id[:36],
        reason=reason,
        tenant_id=UUID(session.tenant_id),
    )
    if not revoked:
        raise HTTPException(status_code=404, detail="Active key not found")
    await db.commit()
    await log_action(
        session,
        AuditAction.API_KEY_REVOKE,
        resource="api_keys",
        resource_id=str(key_id),
        ip_address=get_client_ip(request),
    )
    return {"id": str(key_id), "revoked": True}


# ── A parked day's review, and how the BU's days post (CA-119) ────────────────────


@router.get("/days/{day_id}", response_model=PmsDayOut)
async def get_day(
    day_id: UUID,
    session: SessionInfo = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    """One parked day of the session's BU. Anything else — another BU's, a posted one — is
    the same 404, so "not yours" and "not there" read alike."""
    day = await pms_review.get_day(db, UUID(session.tenant_id), day_id)
    if day is None:
        raise HTTPException(status_code=404, detail="This day is not waiting for review")
    return day


@router.post("/days/{day_id}/approve", response_model=PmsApproveOut)
async def approve_day(
    day_id: UUID,
    body: PmsApproveIn,
    session: SessionInfo = Depends(get_current_session),
):
    """Save the new codes' accounts and post the day. 409 when someone else has it, 400 with
    the reason when it cannot post (and it stays parked), 503 when Carmen could not be read."""
    return await pms_review.approve(
        UUID(session.tenant_id),
        day_id,
        {k: p.model_dump() for k, p in body.mappings.items()},
        reviewer=session.carmen_user_id,
        reviewer_name=session.username,
    )


@router.post("/days/{day_id}/reject", status_code=204)
async def reject_day(
    day_id: UUID,
    body: PmsRejectIn,
    session: SessionInfo = Depends(get_current_session),
):
    await pms_review.reject(
        UUID(session.tenant_id),
        day_id,
        body.reason,
        reviewer=session.carmen_user_id,
        reviewer_name=session.username,
    )
    return Response(status_code=204)


@router.get("/settings", response_model=PmsSettingsOut)
async def get_settings(
    session: SessionInfo = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    return await pms_review.get_settings(db, UUID(session.tenant_id))


@router.put("/settings", response_model=PmsSettingsOut)
async def put_settings(
    body: PmsSettingsIn,
    session: SessionInfo = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    """Replace this BU's PMS posting settings (the JV prefix and the auto-post switch)."""
    out = await pms_review.save_settings(
        db, UUID(session.tenant_id), jv_prefix=body.jv_prefix, auto_post=body.auto_post
    )
    await db.commit()
    return out


@router.put("/credential", response_model=PmsSettingsOut)
async def put_credential(
    body: PmsCredentialIn,
    session: SessionInfo = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    """Store the Carmen token #/pms was opened with as this BU's credential (decision #42).

    Carmen's menu opens #/pms with the SSO link, whose token is the one credential a BU
    has (decision #35, shared with email automation): `set_token` proves it against Carmen
    before storing it, at the origin the session's tenant was validated for. The days that
    were waiting for exactly this are read again at once.
    """
    tenant = await db.get(Tenant, UUID(session.tenant_id))
    if tenant is None:
        raise HTTPException(status_code=404, detail="Business unit not found")
    origin = await _safe_carmen_uri(tenant)
    await credential.set_token(
        db, tenant, body.token.get_secret_value(), origin, f"user:{session.carmen_user_id}"
    )
    waiting = (
        (
            await db.execute(
                update(PmsEvent)
                .where(
                    PmsEvent.tenant_id == tenant.id,
                    PmsEvent.status.in_(("received", "failed")),
                    PmsEvent.reason_code.in_(("no_credential", "carmen_unauthorized")),
                )
                .values(status="received", attempts=0, processed_at=None)
                .returning(PmsEvent.id)
            )
        )
        .scalars()
        .all()
    )
    await db.commit()
    for day_id in waiting:
        process.kick(day_id)
    return await pms_review.get_settings(db, tenant.id)
