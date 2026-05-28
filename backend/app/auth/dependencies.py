"""
FastAPI dependency — resolves the current authenticated session from JWT + DB.
"""

import logging
import time
from datetime import UTC, datetime

from fastapi import Header, HTTPException
from sqlalchemy import select, update

from app.auth.session import SessionInfo, decode_session_jwt, decrypt_carmen_token
from app.config import settings
from app.context import (
    current_carmen_token,
    current_carmen_uri,
    current_carmen_user_id,
    current_ocr_session_id,
    current_tenant_id,
    current_username,
)
from app.database import async_session
from app.models.orm import OcrSession

logger = logging.getLogger(__name__)

# Process-local cache of validated sessions. Skips the SELECT + UPDATE on
# ocr_sessions for every authenticated request — the dominant DB hot-spot
# at ~100 active users. Cache entries hold the encrypted carmen token and
# expire after _SESSION_CACHE_TTL_SECONDS so revoked sessions still close
# within that window.
_SESSION_CACHE_TTL_SECONDS = 60.0
_LAST_USED_THROTTLE_SECONDS = 60.0
# session_id → (encrypted_token, cache_expires_at, last_used_persisted_at)
_session_cache: dict[str, tuple[str, float, float]] = {}


async def _resolve_session_token(session_id: str) -> tuple[str | None, bool]:
    """
    Return (encrypted_carmen_token, last_used_already_persisted_recently).
    First checks the in-process cache; on miss, opens a short-lived DB session
    and stores the result. Returns (None, False) if the session is revoked or missing.
    """
    now = time.monotonic()
    cached = _session_cache.get(session_id)
    if cached and cached[1] > now:
        encrypted_token, _expiry, last_used_at = cached
        return encrypted_token, (now - last_used_at) < _LAST_USED_THROTTLE_SECONDS

    async with async_session() as db:
        result = await db.execute(
            select(OcrSession.carmen_token_encrypted, OcrSession.is_active).where(
                OcrSession.id == session_id,
                OcrSession.deleted_at.is_(None),
            )
        )
        row = result.first()

    if not row or not row.is_active:
        _session_cache.pop(session_id, None)
        return None, False

    encrypted_token = str(row.carmen_token_encrypted)
    _session_cache[session_id] = (encrypted_token, now + _SESSION_CACHE_TTL_SECONDS, 0.0)
    # Periodic cheap cleanup — keep the cache from growing past dead sessions.
    if len(_session_cache) > 1000:
        _prune_session_cache(now)
    return encrypted_token, False


async def _touch_session_last_used(session_id: str) -> None:
    """Persist last_used_at and mark this session as recently touched in the cache."""
    now_monotonic = time.monotonic()
    now_dt = datetime.now(UTC).replace(tzinfo=None)
    try:
        async with async_session() as db:
            await db.execute(
                update(OcrSession).where(OcrSession.id == session_id).values(last_used_at=now_dt)
            )
            await db.commit()
    except Exception as exc:
        logger.warning("Failed to update last_used_at for %s: %s", session_id, exc)
        return
    cached = _session_cache.get(session_id)
    if cached:
        _session_cache[session_id] = (cached[0], cached[1], now_monotonic)


def _prune_session_cache(now: float) -> None:
    expired = [sid for sid, (_t, expiry, _u) in _session_cache.items() if expiry <= now]
    for sid in expired:
        _session_cache.pop(sid, None)


def invalidate_session_cache(session_id: str) -> None:
    """Call this when a session is revoked so the cache doesn't keep it alive."""
    _session_cache.pop(session_id, None)


async def get_current_session(
    authorization: str = Header(..., description="Bearer <ocr_jwt>"),
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
    session_id = payload.get("sid", "")
    tenant_id = payload.get("tid", "")
    carmen_user_id = payload.get("cuid", "")
    username = payload.get("username", "")
    bu = payload.get("bu", "")
    carmen_uri = payload.get("carmen_uri", "")

    encrypted_token, last_used_persisted = await _resolve_session_token(session_id)
    if encrypted_token is None:
        raise HTTPException(status_code=401, detail="Session not found or revoked")

    try:
        carmen_token = decrypt_carmen_token(encrypted_token, settings.session_encryption_key)
    except ValueError:
        logger.error("Failed to decrypt carmen token for session %s", session_id)
        raise HTTPException(
            status_code=500, detail="Session data corrupted — please re-login from Carmen"
        )

    # Throttled last_used_at write — once per minute per session, off the hot path.
    if not last_used_persisted:
        await _touch_session_last_used(session_id)

    info = SessionInfo(
        session_id=session_id,
        carmen_token=carmen_token,
        carmen_user_id=carmen_user_id,
        username=username,
        tenant_id=tenant_id,
        carmen_uri=carmen_uri,
        bu=bu,
    )

    # Populate request-scoped context vars — read by middleware and services.
    current_ocr_session_id.set(session_id)
    current_carmen_user_id.set(carmen_user_id)
    current_username.set(username)
    current_tenant_id.set(tenant_id)
    current_carmen_token.set(carmen_token)
    current_carmen_uri.set(carmen_uri)

    return info


__all__ = ["get_current_session", "SessionInfo"]
