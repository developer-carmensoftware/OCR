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
from app.context import current_session_id, current_user_id, current_username, current_bu, current_host, current_carmen_token, current_tenant, current_carmen_uri

logger = logging.getLogger(__name__)


async def get_current_session(
    authorization: str = Header(..., description="Bearer <ocr_jwt>"),
    db: AsyncSession = Depends(get_db),
) -> SessionInfo:
    """
    Validates the OCR JWT, looks up the session record, and returns a SessionInfo
    containing the decrypted Carmen token ready for Carmen proxy calls.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header must be 'Bearer <token>'")

    raw_jwt = authorization[7:]

    try:
        payload = decode_session_jwt(raw_jwt, settings.ocr_jwt_secret)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid or expired OCR token")

    session_id = payload.get("sid")
    token_tenant = payload.get("tenant")

    result = await db.execute(
        select(OcrSession).where(
            OcrSession.id == session_id,
            OcrSession.is_active == True,  # noqa: E712
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=401, detail="Session not found or revoked")

    # JWT exp claim already verified in decode_session_jwt above; Carmen 401 (caught
    # in services/carmen_service._on_response) flips is_active=False — those two
    # signals replace the per-row expires_at column.
    session.last_used_at = datetime.utcnow()

    try:
        carmen_token = decrypt_carmen_token(session.carmen_token_encrypted, settings.session_encryption_key)
    except ValueError:
        logger.error("Failed to decrypt carmen token for session %s", session_id)
        raise HTTPException(status_code=500, detail="Session data corrupted — please re-enter from Carmen")

    from urllib.parse import urlparse

    # JWT claims are authoritative — set at login time and signed; not derivable
    # from headers which an attacker could spoof.
    authoritative_tenant = token_tenant or ""
    authoritative_uri    = payload.get("carmen_uri") or session.carmen_uri or ""
    authoritative_host   = urlparse(authoritative_uri).hostname or "" if authoritative_uri else ""

    info = SessionInfo(
        session_id=session.id,
        carmen_token=carmen_token,
        user_id=session.user_id or "",
        username=session.username or "",
        bu=session.bu or "",
        tenant=authoritative_tenant,
        carmen_uri=authoritative_uri,
    )

    # Populate request-scoped context vars for middleware and services
    current_session_id.set(info.session_id)
    current_user_id.set(info.user_id)
    current_username.set(info.username)
    current_bu.set(info.bu)
    current_host.set(authoritative_host)
    current_carmen_token.set(info.carmen_token)
    current_tenant.set(info.tenant)
    current_carmen_uri.set(info.carmen_uri)

    return info


# Re-export dataclass so routes can type-hint without importing two modules
__all__ = ["get_current_session", "SessionInfo"]
