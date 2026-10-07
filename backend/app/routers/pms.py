"""PMS interface (CA-93) — Carmen pushes PMS data here.

The first endpoint Carmen calls *into* (decision-log #39). Authenticated by a per-tenant
key from `#/admin/api-keys`; the key, not the body, says which BU this is.
Contract: docs/PMS_INTEGRATION.md.
"""

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.context import current_tenant_id
from app.database import get_db
from app.exceptions import FileTooLargeError
from app.models.admin import APIKey
from app.models.pms import PmsEvent
from app.models.schemas.pms import PmsEventIn, PmsEventOut
from app.services.shared.api_keys import PMS_SCOPE, authenticate
from app.utils.client_ip import get_client_ip

router = APIRouter(prefix="/api/v1/pms", tags=["PMS"])

# The contract promises aggregates (~1 event per BU per day), not transaction dumps.
MAX_BODY_BYTES = 1024 * 1024


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
            tenant_id=key.tenant_id, event_id=event.event_id, type=event.type, payload=event.data
        )
        .on_conflict_do_nothing(index_elements=["tenant_id", "event_id"])
        .returning(PmsEvent.id)
    )
    duplicate = new_id is None
    if duplicate:
        # A retry: answer with the row the first delivery made. Its content is not compared.
        new_id = await db.scalar(
            select(PmsEvent.id).where(
                PmsEvent.tenant_id == key.tenant_id, PmsEvent.event_id == event.event_id
            )
        )
        response.status_code = 200
    await db.commit()
    return PmsEventOut(id=new_id, duplicate=duplicate)
