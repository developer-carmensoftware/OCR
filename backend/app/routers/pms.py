"""PMS interface (CA-93, CA-119).

Three audiences under one prefix:
- `POST /events`: Carmen pushes PMS data here, the first endpoint Carmen calls *into*
  (decision-log #39). Authenticated by a per-BU, per-PMS API key; the key, not the body,
  says which BU this is, and a hook naming another PMS is refused (decision-log #44).
  Storing the day starts its processing (`services/pms/process.py`).
- `/days/{id}` (+ approve, reject): a parked day's review, opened from the AI JV
  Automation queue. Session JWT, the session's BU only.
- `POST /process/run`: the retry sweep pg_cron calls with the internal job token.

The keys and the auto-post switch are set from Carmen's PMS setting screen, through
`routers/pms_carmen.py`. Contract: docs/PMS_INTEGRATION.md.
"""

import re
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy import func, or_, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_session
from app.auth.session import SessionInfo
from app.context import current_tenant_id
from app.database import get_db
from app.exceptions import FileTooLargeError
from app.models.admin import APIKey
from app.models.pms import PmsEvent
from app.models.schemas.pms import (
    PmsApproveIn,
    PmsApproveOut,
    PmsDayOut,
    PmsEventIn,
    PmsEventOut,
    PmsRejectIn,
)
from app.routers.admin.deps import require_maintenance_auth
from app.services.pms import process
from app.services.pms import review as pms_review
from app.services.shared.api_keys import PMS_SCOPE, authenticate
from app.utils.client_ip import get_client_ip

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
    if event.interface_name.lower() != key.interface_name:
        # A key is for one PMS (decision-log #44): another PMS's day is not this key's to
        # store, however valid. Carmen generates each PMS's key on that PMS's setting.
        raise HTTPException(403, f"This key is for PMS '{key.interface_name}'")

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


# ── A parked day's review (CA-119) ──────────────────────────────────────────────────


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
