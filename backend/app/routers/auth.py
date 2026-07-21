"""
Auth Router — Carmen SSO token exchange.

Flow:
  1. Frontend sends Carmen token + bu + carmen_uri.
  2. We validate the token against the Carmen API.
  3. Upsert Tenant (by host + bu pair) — auto-registers first-time tenants
     without any admin intervention.
  4. Create OcrSession with the tenant FK.
  5. Issue a short-lived OCR JWT that embeds tenant_id so subsequent requests
     need no DB lookup for tenant resolution.
"""

import ipaddress
import logging
import uuid
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import SessionInfo, get_current_session
from app.auth.session import (
    create_session_jwt,
    decode_session_jwt,
    encrypt_carmen_token,
    extract_user_id_from_token,
    revoke_session_by_id,
)
from app.config import settings
from app.constants import BlockedHosts
from app.database import async_session, get_db, provision_tenant
from app.models.orm import OcrSession, Tenant
from app.models.schemas import ExchangeRequest, ExchangeResponse
from app.services.rate_limit_service import InMemoryRateLimiter
from app.services.usage_service import upsert_tenant_quota

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

_VALIDATE_TIMEOUT = 10.0

# Brute-force guard on the pre-auth SSO exchange. Now that get_client_ip resolves
# the real client (trust_proxy), this is genuinely per-client — keep it tight.
# NOTE: in-memory per-process; move to Redis if running multiple replicas.
_exchange_limiter = InMemoryRateLimiter(max_calls=5, window_seconds=60.0)


def _carmen_base(uri: str) -> str:
    return f"{uri.rstrip('/')}/Carmen.API/api/interface"


def _is_internal_ip(addr: "ipaddress.IPv4Address | ipaddress.IPv6Address") -> bool:
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_multicast
        or addr.is_unspecified
    )


def _validate_uri(uri: str) -> str:
    """
    Validate and normalise the Carmen origin URI against SSRF.
    - HTTPS only
    - Host must be on ALLOWED_CARMEN_HOSTS when that allowlist is configured
    - Blocks loopback/private/link-local IPs, whether given as a literal or
      resolved from a hostname (defence against DNS-based SSRF)
    Returns normalised origin (scheme + host only).
    """
    import socket as _socket

    if not uri:
        raise HTTPException(status_code=400, detail="uri is required")
    parsed = urlparse(uri)

    if parsed.scheme != "https":
        raise HTTPException(status_code=400, detail="uri must use https")

    hostname = (parsed.hostname or "").lower()
    if not hostname:
        raise HTTPException(status_code=400, detail="uri must include a hostname")

    if hostname in BlockedHosts.LOOPBACK:
        raise HTTPException(status_code=400, detail="uri hostname not allowed")

    # Primary control: only permit explicitly allowlisted Carmen hosts (when set).
    allowlist = settings.allowed_carmen_hosts_list
    if allowlist and hostname not in allowlist:
        logger.warning("Rejected Carmen uri host not on allowlist: %s", hostname)
        raise HTTPException(status_code=400, detail="uri hostname not allowed")

    try:
        addr = ipaddress.ip_address(hostname)
    except ValueError:
        addr = None

    if addr is not None:
        # Literal IP in the URI — check it directly.
        if _is_internal_ip(addr):
            raise HTTPException(status_code=400, detail="uri hostname not allowed")
    else:
        # Hostname — resolve and reject if ANY resolved address is internal.
        # (Defence-in-depth; the host allowlist above is the primary control.)
        # Fail open on resolution errors: a name that can't be resolved here can't
        # be connected to either, so the IP-literal check + allowlist still hold.
        try:
            infos = _socket.getaddrinfo(hostname, parsed.port or 443, proto=_socket.IPPROTO_TCP)
        except OSError:
            logger.warning("Could not resolve Carmen uri host %s for SSRF check", hostname)
            infos = []
        for info in infos:
            ip_str = info[4][0]
            try:
                if _is_internal_ip(ipaddress.ip_address(ip_str)):
                    logger.warning("Carmen uri %s resolves to internal IP %s", hostname, ip_str)
                    raise HTTPException(status_code=400, detail="uri hostname not allowed")
            except ValueError:
                continue

    port_part = f":{parsed.port}" if parsed.port else ""
    return f"https://{parsed.hostname}{port_part}"


def _active_tenant_query(host: str, bu_code: str):
    return select(Tenant).where(
        Tenant.host == host,
        Tenant.bu_code == bu_code,
        Tenant.deleted_at.is_(None),
    )


async def _upsert_tenant(db: AsyncSession, host: str, bu_code: str) -> Tenant:
    """Return existing Tenant for this (host, bu_code), or create one on first encounter.

    The create path is race-safe: a Core INSERT ... ON CONFLICT DO NOTHING against the
    partial unique index uq_tenants_host_bu_active means two concurrent first-logins for
    the same (host, bu_code) both resolve to a single tenant row, instead of one of them
    failing the whole /exchange with an IntegrityError.
    """
    tenant = (await db.execute(_active_tenant_query(host, bu_code))).scalar_one_or_none()
    if tenant:
        return tenant

    ins = (
        pg_insert(Tenant)
        .values(
            id=uuid.uuid4(),
            host=host,
            bu_code=bu_code,
            name=f"{host}/{bu_code}",
            plan="free",
            is_active=True,
        )
        .on_conflict_do_nothing(
            index_elements=["host", "bu_code"],
            index_where=text("deleted_at IS NULL"),
        )
        .returning(Tenant.id)
    )
    created = (await db.execute(ins)).first()
    if created is not None:
        logger.info("Auto-registered new tenant: host=%s bu=%s id=%s", host, bu_code, created[0])

    # Re-select so we return a session-managed ORM Tenant — this covers both the row we
    # just inserted and a row a concurrent transaction may have committed first.
    return (await db.execute(_active_tenant_query(host, bu_code))).scalar_one()


async def _validate_token(token: str, carmen_uri: str) -> None:
    from app.services.carmen_service import _get_client

    headers = {"Authorization": token, "User-Agent": "OCR-SSO-Validator"}
    resp = await _get_client().get(
        f"{_carmen_base(carmen_uri)}/department",
        headers=headers,
        timeout=_VALIDATE_TIMEOUT,
    )
    if resp.status_code == 401:
        raise HTTPException(
            status_code=401, detail="Carmen token rejected — please re-login to Carmen"
        )
    if resp.status_code not in (200, 204):
        logger.warning("Carmen validation probe returned %s", resp.status_code)
        raise HTTPException(status_code=502, detail="Cannot reach Carmen to validate token")


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/exchange", response_model=ExchangeResponse)
async def exchange_sso_token(request: Request, body: ExchangeRequest):
    """Exchange a Carmen SSO token for an OCR session JWT."""
    _exchange_limiter.check(request)

    token = body.token.strip()
    bu = body.bu.strip().lower()

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
        tenant = await _upsert_tenant(db, host, bu)
        await upsert_tenant_quota(db, str(tenant.id), str(tenant.plan))

        session_id = uuid.uuid4()
        db.add(
            OcrSession(
                id=session_id,
                tenant_id=tenant.id,
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
        session_id=str(session_id),
        tenant_id=str(tenant.id),
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

    sid = str(payload.get("sid", ""))
    revoked = await revoke_session_by_id(db, sid)
    if revoked:
        from app.auth.dependencies import invalidate_session_cache

        invalidate_session_cache(sid)
    return {"ok": True}


@router.get("/usage")
async def get_usage(_session: SessionInfo = Depends(get_current_session)):
    """Get quota usage + top-up credit balance + active subscription for the tenant."""
    from app.services.credit_service import get_active_subscription, get_credit_balance
    from app.services.usage_service import get_quota_summary

    summary = await get_quota_summary(_session.tenant_id)

    monthly = next(
        (
            q
            for q in summary.get("quotas", [])
            if q["period"] == "lifetime" and q["metric"] == "calls"
        ),
        None,
    )
    used = int(monthly["used"]) if monthly else 0
    limit = int(monthly["limit"]) if monthly else 0
    credit_balance = await get_credit_balance(_session.tenant_id)

    sub = await get_active_subscription(_session.tenant_id)
    subscription = (
        {
            "plan_code": sub.plan_code,
            "doc_allowance": sub.doc_allowance,
            "docs_used": sub.docs_used,
            "docs_remaining": max(0, sub.doc_allowance - sub.docs_used),
            "period_start": sub.period_start.isoformat() if sub.period_start else None,
            "period_end": sub.period_end.isoformat() if sub.period_end else None,
            "billing_period": sub.billing_period,
            "status": sub.status.value if hasattr(sub.status, "value") else sub.status,
        }
        if sub is not None
        else None
    )

    return {
        "usage": {
            "monthly_calls": used,
            "max_monthly_calls": limit,
            "remaining_calls": max(0, limit - used),
            "credit_balance": credit_balance,
            "subscription": subscription,
        }
    }
