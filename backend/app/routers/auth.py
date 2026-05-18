"""
Auth Router — Carmen SSO token exchange.

Flow:
  1. Frontend sends Carmen token + bu + carmen_uri.
  2. We validate the token against the Carmen API.
  3. Upsert Tenant (by host) + BusinessUnit (by tenant + bu code) — auto-registers
     first-time tenants without any admin intervention.
  4. Create OcrSession with proper FK references.
  5. Issue a short-lived OCR JWT that embeds tenant_id + business_unit_id so
     subsequent requests need no DB lookup for tenant resolution.
"""

import logging
import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import SessionInfo, get_current_session
from app.auth.session import (
    create_session_jwt,
    decode_session_jwt,
    encrypt_carmen_token,
    extract_user_id_from_token,
)
from app.config import settings
from app.database import async_session, get_db, provision_tenant
from app.models.orm import BusinessUnit, OcrSession, Tenant
from app.services.usage_service import upsert_tenant_quota

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

_VALIDATE_TIMEOUT = 10.0

# Simple in-memory rate limiter: max 10 /exchange calls per IP per 60 seconds.
# NOTE: per-process only — does not coordinate across multiple replicas.
# Replace with Redis ZADD/ZCOUNT when deploying more than one app instance.
_exchange_calls: dict[str, list[float]] = defaultdict(list)
_EXCHANGE_WINDOW = 60.0
_EXCHANGE_MAX = 10
_exchange_last_prune = 0.0
_EXCHANGE_PRUNE_INTERVAL = 300.0  # sweep stale IPs every 5 minutes


def _check_exchange_rate_limit(request: Request) -> None:
    global _exchange_last_prune
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()

    # Periodic sweep: remove IPs whose call window has fully expired to prevent
    # the dict from growing indefinitely as unique IPs accumulate over time.
    if now - _exchange_last_prune > _EXCHANGE_PRUNE_INTERVAL:
        stale = [
            k for k, v in _exchange_calls.items() if not any(now - t < _EXCHANGE_WINDOW for t in v)
        ]
        for k in stale:
            del _exchange_calls[k]
        _exchange_last_prune = now

    recent = [t for t in _exchange_calls[ip] if now - t < _EXCHANGE_WINDOW]
    if len(recent) >= _EXCHANGE_MAX:
        _exchange_calls[ip] = recent
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please try again later.",
            headers={"Retry-After": "60"},
        )
    recent.append(now)
    _exchange_calls[ip] = recent


def _carmen_base(uri: str) -> str:
    return f"{uri.rstrip('/')}/Carmen.API/api/interface"


def _validate_uri(uri: str) -> str:
    """
    Validate and normalise the Carmen origin URI against SSRF.
    - HTTPS only
    - Blocks loopback/private/link-local IP ranges
    - When CARMEN_ALLOWED_HOST_REGEX is set, hostname must match (whitelist)
    Returns normalised origin (scheme + host only).
    """
    import ipaddress as _ip
    import re as _re

    if not uri:
        raise HTTPException(status_code=400, detail="uri is required")
    parsed = urlparse(uri)

    if parsed.scheme != "https":
        raise HTTPException(status_code=400, detail="uri must use https")

    hostname = (parsed.hostname or "").lower()
    if not hostname:
        raise HTTPException(status_code=400, detail="uri must include a hostname")

    _BLOCKED = {"localhost", "ip6-localhost", "ip6-loopback", "broadcasthost"}
    if hostname in _BLOCKED:
        raise HTTPException(status_code=400, detail="uri hostname not allowed")

    try:
        addr = _ip.ip_address(hostname)
        if (
            addr.is_private
            or addr.is_loopback
            or addr.is_link_local
            or addr.is_reserved
            or addr.is_multicast
        ):
            raise HTTPException(status_code=400, detail="uri hostname not allowed")
    except ValueError:
        pass  # domain name — proceed to whitelist check below

    # Whitelist check — enforced when CARMEN_ALLOWED_HOST_REGEX is configured.
    # In debug mode without a whitelist, log a warning; in production it is required.
    allowed_regex = settings.carmen_allowed_host_regex.strip()
    if allowed_regex:
        if not _re.fullmatch(allowed_regex, hostname):
            raise HTTPException(status_code=400, detail="uri hostname not allowed")
    elif not settings.app_debug:
        logger.warning(
            "CARMEN_ALLOWED_HOST_REGEX is not set — all HTTPS hostnames accepted. "
            "Set this in .env to restrict Carmen URI to known hosts."
        )

    port_part = f":{parsed.port}" if parsed.port else ""
    return f"https://{parsed.hostname}{port_part}"


async def _upsert_tenant(db: AsyncSession, host: str) -> Tenant:
    """Return existing Tenant for this host, or create one on first encounter."""
    result = await db.execute(
        select(Tenant).where(Tenant.host == host, Tenant.deleted_at.is_(None))
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        tenant = Tenant(
            id=str(uuid.uuid4()),
            host=host,
            name=host,
            plan="free",
            is_active=True,
        )
        db.add(tenant)
        await db.flush()
        logger.info("Auto-registered new tenant: host=%s id=%s", host, tenant.id)
    return tenant


async def _upsert_business_unit(db: AsyncSession, tenant_id: str, bu_code: str) -> BusinessUnit:
    """Return existing BU for this tenant+code, or create one on first encounter."""
    result = await db.execute(
        select(BusinessUnit).where(
            BusinessUnit.tenant_id == tenant_id,
            BusinessUnit.code == bu_code,
            BusinessUnit.deleted_at.is_(None),
        )
    )
    bu = result.scalar_one_or_none()
    if not bu:
        bu = BusinessUnit(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            code=bu_code,
            name=bu_code,
            is_active=True,
        )
        db.add(bu)
        await db.flush()
        logger.info("Auto-registered new BU: tenant=%s code=%s id=%s", tenant_id, bu_code, bu.id)
    return bu


async def _validate_token(token: str, carmen_uri: str) -> None:
    headers = {"Authorization": token, "User-Agent": "OCR-SSO-Validator"}
    async with httpx.AsyncClient(timeout=_VALIDATE_TIMEOUT) as client:
        resp = await client.get(f"{_carmen_base(carmen_uri)}/department", headers=headers)
    if resp.status_code == 401:
        raise HTTPException(
            status_code=401, detail="Carmen token rejected — please re-login to Carmen"
        )
    if resp.status_code not in (200, 204):
        logger.warning("Carmen validation probe returned %s", resp.status_code)
        raise HTTPException(status_code=502, detail="Cannot reach Carmen to validate token")


# ── Schemas ───────────────────────────────────────────────────────────────────


class ExchangeRequest(BaseModel):
    token: str
    bu: str
    user: str = ""
    uri: str = ""


class ExchangeResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/exchange", response_model=ExchangeResponse)
async def exchange_sso_token(request: Request, body: ExchangeRequest):
    """Exchange a Carmen SSO token for an OCR session JWT."""
    _check_exchange_rate_limit(request)

    token = body.token.strip()
    bu = body.bu.strip()

    if not token or not bu:
        raise HTTPException(status_code=400, detail="token and bu are required")

    carmen_uri = _validate_uri(body.uri)
    host = urlparse(carmen_uri).hostname or ""

    await _validate_token(token, carmen_uri)
    await provision_tenant()

    carmen_user_id = extract_user_id_from_token(token)
    username = body.user or carmen_user_id

    try:
        encrypted = encrypt_carmen_token(token, settings.session_encryption_key)
    except Exception:
        logger.exception("Token encryption failed")
        raise HTTPException(status_code=500, detail="Session creation failed")

    async with async_session() as db:
        tenant = await _upsert_tenant(db, host)
        await upsert_tenant_quota(db, tenant.id, tenant.plan)
        business_unit = await _upsert_business_unit(db, tenant.id, bu)

        cutoff = datetime.utcnow() - timedelta(hours=settings.session_ttl_hours)
        deleted = await db.execute(
            delete(OcrSession).where(
                (OcrSession.tenant_id == tenant.id)
                & ((OcrSession.created_at < cutoff) | (OcrSession.is_active == False))  # noqa: E712
            )
        )
        if deleted.rowcount:
            logger.info("Cleaned %d stale session(s) for tenant %s", deleted.rowcount, tenant.id)

        session_id = str(uuid.uuid4())
        db.add(
            OcrSession(
                id=session_id,
                tenant_id=tenant.id,
                business_unit_id=business_unit.id,
                carmen_user_id=carmen_user_id,
                username=username,
                carmen_token_encrypted=encrypted,
                carmen_uri=carmen_uri,
                is_active=True,
            )
        )
        await db.commit()

    logger.info(
        "SSO exchange OK — host=%s bu=%s user=%s session=%s", host, bu, username, session_id
    )

    access_token = create_session_jwt(
        session_id=session_id,
        tenant_id=tenant.id,
        business_unit_id=business_unit.id,
        carmen_user_id=carmen_user_id,
        username=username,
        bu=bu,
        carmen_uri=carmen_uri,
        secret=settings.ocr_jwt_secret,
        ttl_hours=settings.session_ttl_hours,
    )
    return ExchangeResponse(
        access_token=access_token,
        expires_in=settings.session_ttl_hours * 3600,
        user={
            "carmen_user_id": carmen_user_id,
            "username": username,
            "bu": bu,
            "uri": carmen_uri,
            "tenant_id": tenant.id,
            "business_unit_id": business_unit.id,
        },
    )


@router.delete("/session")
async def revoke_session(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    """Logout — revokes the current OCR session."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    try:
        payload = decode_session_jwt(authorization[7:], settings.ocr_jwt_secret)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(OcrSession).where(OcrSession.id == payload.get("sid")))
    session = result.scalar_one_or_none()
    if session:
        session.is_active = False
        await db.commit()
        logger.info("Session revoked: %s", session.id)
    return {"ok": True}


@router.get("/usage")
async def get_usage(_session: SessionInfo = Depends(get_current_session)):
    """Get quota usage for the current tenant."""
    from app.services.usage_service import get_quota_summary

    summary = await get_quota_summary(_session.tenant_id)

    monthly = next(
        (
            q
            for q in summary.get("quotas", [])
            if q["period"] == "monthly" and q["metric"] == "calls"
        ),
        None,
    )
    used = int(monthly["used"]) if monthly else 0
    limit = int(monthly["limit"]) if monthly else 0
    return {
        "usage": {
            "monthly_calls": used,
            "max_monthly_calls": limit,
            "remaining_calls": max(0, limit - used),
        }
    }
