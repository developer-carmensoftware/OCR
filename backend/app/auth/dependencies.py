"""
FastAPI dependency — resolves the current authenticated session from JWT + DB.
"""

import logging
from datetime import datetime

from fastapi import Depends, HTTPException, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.orm import OcrSession
from app.auth.session import SessionInfo, decode_session_jwt, decrypt_carmen_token
from app.context import (
    current_ocr_session_id, current_carmen_user_id, current_username,
    current_tenant_id, current_business_unit_id,
    current_carmen_token, current_carmen_uri,
)

logger = logging.getLogger(__name__)


async def get_current_session(
    authorization: str = Header(..., description="Bearer <ocr_jwt>"),
    db: AsyncSession = Depends(get_db),
) -> SessionInfo:
    """
    Validates the OCR JWT, looks up the live session, decrypts the Carmen token,
    and sets request-scoped context vars for middleware and services.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header must be 'Bearer <token>'")

    raw_jwt = authorization[7:]

    try:
        payload = decode_session_jwt(raw_jwt, settings.ocr_jwt_secret)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid or expired OCR token")

    # All identity claims are read from the signed JWT — authoritative at login time.
    session_id       = payload.get("sid", "")
    tenant_id        = payload.get("tid", "")
    business_unit_id = payload.get("bid", "")
    carmen_user_id   = payload.get("cuid", "")
    username         = payload.get("username", "")
    bu               = payload.get("bu", "")
    carmen_uri       = payload.get("carmen_uri", "")

    result = await db.execute(
        select(OcrSession).where(
            OcrSession.id == session_id,
            OcrSession.is_active == True,  # noqa: E712
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=401, detail="Session not found or revoked")

    session.last_used_at = datetime.utcnow()

    try:
        carmen_token = decrypt_carmen_token(session.carmen_token_encrypted, settings.session_encryption_key)
    except ValueError:
        logger.error("Failed to decrypt carmen token for session %s", session_id)
        raise HTTPException(status_code=500, detail="Session data corrupted — please re-login from Carmen")

    info = SessionInfo(
        session_id=session_id,
        carmen_token=carmen_token,
        carmen_user_id=carmen_user_id,
        username=username,
        tenant_id=tenant_id,
        business_unit_id=business_unit_id,
        carmen_uri=carmen_uri,
        bu=bu,
    )

    # Populate request-scoped context vars — read by middleware and services.
    current_ocr_session_id.set(session_id)
    current_carmen_user_id.set(carmen_user_id)
    current_username.set(username)
    current_tenant_id.set(tenant_id)
    current_business_unit_id.set(business_unit_id)
    current_carmen_token.set(carmen_token)
    current_carmen_uri.set(carmen_uri)

    return info


__all__ = ["get_current_session", "SessionInfo"]
