"""
Auth Router — Carmen SSO token exchange.

Flow:
  1. Frontend sends Carmen token + BU (extracted from URL hash params).
  2. This endpoint validates the token against Carmen API.
  3. On success: creates an OcrSession, issues a short-lived OCR JWT.
  4. Frontend stores the OCR JWT in sessionStorage and uses it for all subsequent calls.
"""

import logging
import uuid
from datetime import datetime, timedelta
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_session, SessionInfo

from app.config import settings
from app.database import get_db, provision_tenant, async_session
from app.models.orm import OcrSession
from app.context import current_tenant
from app.auth.session import (
    create_session_jwt,
    decode_session_jwt,
    encrypt_carmen_token,
    extract_user_id_from_token,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

_VALIDATE_TIMEOUT = 10.0


def _carmen_base(tenant: str) -> str:
    """Build Carmen API base URL from tenant subdomain."""
    return f"https://{tenant}.carmen4.com/Carmen.API/api/interface"




# ── Schemas ───────────────────────────────────────────────────────────────────

class ExchangeRequest(BaseModel):
    token: str
    bu: str
    user: str = ""   # username passed directly from Carmen via URL param


class ExchangeResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _validate_token(token: str, tenant: str) -> None:
    """
    Confirms the Carmen token is live by probing a lightweight endpoint.
    Raises HTTPException(401) if Carmen rejects it.
    """
    headers = {"Authorization": token, "User-Agent": "OCR-SSO-Validator"}
    async with httpx.AsyncClient(timeout=_VALIDATE_TIMEOUT) as client:
        resp = await client.get(f"{_carmen_base(tenant)}/department", headers=headers)
    if resp.status_code == 401:
        raise HTTPException(status_code=401, detail="Carmen token rejected — please re-login to Carmen")
    if resp.status_code not in (200, 204):
        logger.warning("Carmen validation probe returned %s", resp.status_code)
        raise HTTPException(status_code=502, detail="Cannot reach Carmen to validate token")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/exchange", response_model=ExchangeResponse)
async def exchange_sso_token(
    request: Request,
    body: ExchangeRequest,
):
    """Exchange a Carmen SSO token for an OCR session JWT."""
    token = body.token.strip()
    bu    = body.bu.strip()

    if not token or not bu:
        raise HTTPException(status_code=400, detail="token and bu are required")

    tenant = current_tenant.get() or settings.carmen_tenant_default

    # Validate token is live against the tenant's Carmen instance
    await _validate_token(token, tenant)

    # Provision DB for this tenant if it's their first login (idempotent)
    await provision_tenant(tenant)

    user_id  = extract_user_id_from_token(token)
    username = body.user or user_id

    try:
        encrypted = encrypt_carmen_token(token, settings.session_encryption_key)
    except Exception:
        logger.exception("Token encryption failed")
        raise HTTPException(status_code=500, detail="Session creation failed")

    session_id = str(uuid.uuid4())

    # Use async_session() after provision_tenant() so the DB is guaranteed to exist
    async with async_session() as db:
        # Auto cleanup: ลบ session เก่าที่ expired หรือถูก deactivate แล้ว
        cutoff = datetime.utcnow() - timedelta(hours=settings.session_ttl_hours)
        deleted = await db.execute(
            delete(OcrSession).where(
                (OcrSession.created_at < cutoff) | (OcrSession.is_active == False)  # noqa: E712
            )
        )
        if deleted.rowcount:
            logger.info("Auto cleanup: removed %d stale session(s)", deleted.rowcount)

        db.add(OcrSession(
            id=session_id,
            carmen_token_encrypted=encrypted,
            user_id=user_id,
            username=username,
            bu=bu,
            is_active=True,
        ))
        await db.commit()

    logger.info("SSO exchange OK — tenant=%s user=%s bu=%s session=%s",
                tenant, username, bu, session_id)

    return ExchangeResponse(
        access_token=create_session_jwt(
            session_id=session_id,
            bu=bu,
            user_id=user_id,
            username=username,
            tenant=tenant,
            secret=settings.ocr_jwt_secret,
            ttl_hours=settings.session_ttl_hours,
        ),
        expires_in=settings.session_ttl_hours * 3600,
        user={"user_id": user_id, "username": username, "bu": bu},
    )


@router.delete("/session")
async def revoke_session(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    """Logout — revokes the current OCR session so the JWT is rejected on next use."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    try:
        payload = decode_session_jwt(authorization[7:], settings.ocr_jwt_secret)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(
        select(OcrSession).where(OcrSession.id == payload.get("sid"))
    )
    session = result.scalar_one_or_none()
    if session:
        session.is_active = False
        await db.commit()
        logger.info("Session revoked: %s", session.id)

    return {"ok": True}
    

@router.get("/usage")
async def get_usage(
    _session: SessionInfo = Depends(get_current_session),
):
    """Get current BU usage and limits."""
    from app.services.usage_service import get_bu_usage
    usage = await get_bu_usage(_session.bu)
    return {
        "bu": _session.bu,
        "usage": usage
    }
