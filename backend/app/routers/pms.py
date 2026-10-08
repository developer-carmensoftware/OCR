"""PMS interface (CA-93).

Two audiences under one prefix:
- `POST /events`: Carmen pushes PMS data here, the first endpoint Carmen calls *into*
  (decision-log #39). Authenticated by a per-tenant API key; the key, not the body, says
  which BU this is.
- `/keys`: the BU's own key screen, `#/pms`, opened from Carmen's menu (decision-log #40).
  Our session JWT; the session's tenant is the only BU these routes can see or touch.
Contract: docs/PMS_INTEGRATION.md.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_session
from app.auth.session import SessionInfo
from app.context import current_tenant_id
from app.database import get_db
from app.exceptions import FileTooLargeError
from app.models.admin import APIKey
from app.models.pms import PmsEvent
from app.models.schemas.pms import PmsEventIn, PmsEventOut, PmsKeyCreateIn
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
    token = (authorization or "").removeprefix("Bearer ").strip()
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
        raise FileTooLargeError("Event body exceeds 1 MB")
    try:
        event = PmsEventIn.model_validate_json(body)
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
    if duplicate:
        # The same Data Bank day again. Whether that is a retry or a re-run after Carmen's
        # AddOrUpdate is still open (CA-116 q4), so keep one row but record when we last
        # heard of it: `updated_at` is what processing will compare with `LastModified`.
        new_id = await db.scalar(
            update(PmsEvent)
            .where(PmsEvent.tenant_id == key.tenant_id, PmsEvent.event_id == event.key)
            .values(updated_at=func.now())
            .returning(PmsEvent.id)
        )
        response.status_code = 200
    await db.commit()
    return PmsEventOut(id=new_id, duplicate=duplicate)


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
