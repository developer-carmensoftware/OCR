"""Email Automation — the Settings API Carmen calls, plus the ingest job trigger.

Contract: docs/CARMEN_INTEGRATION.md §2 (settings) and §3 (outcomes).

**Carmen authenticates with the logged-in user's own Carmen token**, sent the way
every other call in their world sends it — `Authorization: <token>`, no scheme label.
There is no key for us to issue and no secret for a customer to store. Every customer
runs their own Carmen installation, so a key would have meant one per installation,
hand-delivered, forever. This is the same mechanism `/auth/exchange` has used for
every wizard user since day one.

It also removes the trusted-input problem rather than checking it: `uri`/`bu` in the
payload are not a claim we verify against a scope, they are what the token is proven
*against*. Acting on a host requires a credential that host's own Carmen accepts.
One host is always one corporate group, so that is exactly the ownership boundary.

`uri` is the full Carmen origin, the same value Carmen already sends to
`/auth/exchange`. We take its hostname and the tenant is still the pair (host, bu) —
see `_tenant_host` for why that is all it does.

The `Bearer <admin jwt>` path is ours — operators fixing a customer's settings without
asking them for a token.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from dataclasses import dataclass
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import decode_admin_jwt
from app.auth.session import extract_user_id_from_token
from app.database import get_db
from app.exceptions import FieldValidationError
from app.models.identity import Tenant
from app.models.schemas.email_automation import URI_DOC, SettingsIn, TokenIn
from app.models.schemas.notifications import NotificationListResponse, NotificationResponse
from app.routers.admin.deps import require_maintenance_auth

# ponytail: private imports across routers. _validate_uri / _validate_token raise
# HTTPException and the login path depends on those exact codes, so extracting them
# into a shared module is a real refactor, not a move — do it when something else
# needs them too.
from app.routers.auth import _validate_token, _validate_uri
from app.services import email_ingest_service as ingest
from app.services import email_settings_service as es
from app.services import notification_service
from app.services.admin_auth_service import get_admin_jwt_secret
from app.services.rate_limit_service import InMemoryRateLimiter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/carmen", tags=["Email Automation"])

# ── Guarding the outbound probe ───────────────────────────────────────────────
#
# A CarmenToken request costs us a DB read, a DNS lookup and an outbound HTTP call
# to the customer's Carmen — all *before* the caller is known to be genuine. That is
# the whole exposure, and these three keep it cheap:
#
#   1. reject anything that cannot be a Carmen token, before any of that happens
#   2. per-IP limit, then a global ceiling — per-IP alone is the wrong axis for
#      distributed traffic, and the global one also stops us being used to flood a
#      customer's own Carmen
#   3. remember rejected tokens briefly, so replaying one is free after the first
#
# None of this stops a volumetric DDoS; that belongs at the network edge. It stops
# a small amount of junk traffic from costing a large amount of work.

_settings_limiter = InMemoryRateLimiter(max_calls=20, window_seconds=60.0)
_probe_ceiling = InMemoryRateLimiter(max_calls=300, window_seconds=60.0)

_MAX_TOKEN_LEN = 512
_REJECTED_TTL = 30.0
_rejected: dict[str, float] = {}


def _token_is_plausible(token: str) -> bool:
    """Cheap shape check — no I/O, no allocation worth mentioning.

    A Carmen token is `<hash>|<user_uuid>` (see auth.session.extract_user_id_from_token,
    and the live dev instance issues exactly that). Requiring the separator is enough
    to drop random junk; the UUID itself is deliberately *not* parsed, because one
    sample is thin evidence on which to reject a real customer's credential.
    """
    return 0 < len(token) <= _MAX_TOKEN_LEN and "|" in token


def _rejection_key(token: str, uri: str) -> str:
    return hashlib.sha256(f"{uri}\x00{token}".encode()).hexdigest()


def _recently_rejected(key: str) -> bool:
    expires = _rejected.get(key)
    if expires is None:
        return False
    if expires < time.monotonic():
        _rejected.pop(key, None)
        return False
    return True


def _remember_rejection(key: str) -> None:
    """Negative results only — never cache a success.

    A token Carmen accepted today may be revoked in a minute, and a stale yes is a
    security hole. A stale *no* costs nothing: re-authenticating produces a different
    token, so a real user is never held back by it.
    """
    now = time.monotonic()
    if len(_rejected) > 10_000:  # flood of distinct junk — drop what has expired
        for k, exp in list(_rejected.items()):
            if exp < now:
                del _rejected[k]
    _rejected[key] = now + _REJECTED_TTL


# ── Auth ──────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Caller:
    actor: str  # audit trail: "user:<carmen uuid>" or "admin:<name>"
    carmen_token: str | None  # None = admin JWT, our own operator path


async def _caller(
    request: Request,
    authorization: str | None = Header(None),
) -> Caller:
    """Identify the caller.

    `Bearer <admin jwt>` is our own operator path. **Anything else is taken as a
    Carmen token, verbatim** — the same `Authorization: <token>` every other call in
    Carmen's world uses, so their developers do not have to remember a scheme that
    exists only here. Nothing is lost by dropping the label: a prefix proves nothing,
    and the token is proven against the customer's own Carmen in `_resolve` either way.

    Identification only — the proof happens there, because which Carmen to ask is not
    known until the payload has been read.
    """
    raw = (authorization or "").strip()
    if not raw:
        raise HTTPException(status_code=401, detail="Authorization required")

    if raw.startswith("Bearer "):
        try:
            payload = decode_admin_jwt(raw[7:].strip(), get_admin_jwt_secret())
        except ValueError:
            raise HTTPException(status_code=401, detail="Invalid or expired token") from None
        return Caller(
            actor=f"admin:{payload.get('username') or payload.get('aid')}", carmen_token=None
        )

    # Accepted with or without the label, so a client that already sends one keeps working.
    token = raw.removeprefix("CarmenToken ").strip()

    # Order matters: the free check first, then the limiters, and only then does
    # _resolve spend a DB read and an outbound call on this request.
    if not _token_is_plausible(token):
        raise HTTPException(status_code=401, detail="Malformed Carmen token")
    _settings_limiter.check(request)
    _probe_ceiling.check(request, key="_global_probe")
    return Caller(actor=f"user:{extract_user_id_from_token(token)}", carmen_token=token)


def _tenant_host(uri: str) -> str:
    """The tenant's hostname, out of the origin Carmen sends. A lookup key, never a
    destination.

    Carmen already passes a full origin to `/auth/exchange`, so this API takes the same
    value rather than making them derive a bare hostname for one endpoint. It is parsed
    exactly the way that endpoint parses it (`routers/auth.py` —
    `urlparse(_validate_uri(uri)).hostname`), which is where `tenants.host` came from in
    the first place. So for any `uri` that resolves to a tenant at all,
    `tenant.host == hostname(uri)`; and everything outbound still starts from
    `tenants.host` via `_safe_carmen_uri`. Nothing here ever becomes a URL we request.

    Deliberately **not** `_validate_uri`: that ends in a blocking `socket.getaddrinfo`,
    i.e. a DNS lookup driven by unauthenticated input — the exposure the limiters at the
    top of this module exist to bound. There is nothing to validate in a value we never
    call.

    A bare hostname is accepted too (`urlparse` finds no host in it and it falls through
    unchanged), which is what makes a caller still sending the old `host` value work. So
    is anything else: a value that names no tenant is already a `400`, and that is the
    only answer this function's failure mode has.
    """
    value = uri.strip()
    try:
        parsed = urlparse(value).hostname
    except ValueError:  # e.g. "https://[::1" — urlsplit raises on a bad IPv6 literal
        parsed = None
    return (parsed or value).lower()


async def _resolve(db: AsyncSession, caller: Caller, uri: str, bu: str) -> Tenant:
    """The BU this request may act on — proven, not asserted.

    The token is checked against the Carmen instance the payload names, so claiming
    another company's host means producing a credential that company's own Carmen
    validates. `_validate_token`'s 401 ("re-login") and 502 ("cannot reach Carmen")
    propagate unchanged: Carmen's screen needs to tell those two apart.

    The caller's `uri` and the `origin` below are deliberately separate names: the
    first is a lookup key that stops at `resolve_tenant`, the second is read back off
    the tenant row and is the only thing that ever leaves this process.
    """
    tenant = await es.resolve_tenant(db, _tenant_host(uri), bu)
    if caller.carmen_token is None:
        return tenant

    origin = await _safe_carmen_uri(tenant)
    key = _rejection_key(caller.carmen_token, origin)
    if _recently_rejected(key):
        raise HTTPException(
            status_code=401, detail="Carmen token rejected — please re-login to Carmen"
        )
    try:
        await _validate_token(caller.carmen_token, origin)
    except HTTPException as exc:
        if exc.status_code == 401:
            # Only a definite "no" is remembered. A 502 means we could not ask.
            _remember_rejection(key)
        raise
    return tenant


async def _safe_carmen_uri(tenant: Tenant) -> str:
    """SSRF gate. Every server-side request we make on a caller's behalf goes through it.

    The origin is derived, never taken from the payload: `tenants.host` was itself
    produced by this same check at login, so the origin we validate a token against
    is always the origin we later post with — one value, not two that can disagree.

    `_validate_uri` (routers/auth.py) is the same check `/auth/exchange` already
    applies: https only, ALLOWED_CARMEN_HOSTS allowlist, loopback/private-IP
    rejection including what a hostname resolves to. Its 400 is re-raised as the
    422 field-error shape Carmen's screen already renders inline.

    Run in a thread because that check ends in a blocking `socket.getaddrinfo`: left
    on the event loop, one hostile or merely slow DNS answer stalls every other
    request this worker is serving, not just the one that asked for it.
    """
    candidate = f"https://{tenant.host}"
    try:
        return await asyncio.to_thread(_validate_uri, candidate)
    except HTTPException as exc:
        raise FieldValidationError(
            [{"field": "carmen_uri", "code": "invalid_uri", "message": str(exc.detail)}]
        ) from exc


# ── Reference data ────────────────────────────────────────────────────────────


@router.get("/bank-codes")
async def read_bank_codes(db: AsyncSession = Depends(get_db), caller: Caller = Depends(_caller)):
    """Valid values for a rule's `bank_code` (§2.3) — not tenant-scoped, so no uri/bu.

    Backed by the same `banks` table the OCR wizard reads, so a bank added there
    (an INSERT, no redeploy) shows up here immediately rather than needing this
    list hand-maintained a second time.
    """
    return {"banks": await es.list_bank_codes(db)}


# ── Settings (§2.2 / §2.3) ────────────────────────────────────────────────────


@router.get("/settings")
async def read_settings(
    uri: str = Query(..., description=URI_DOC),
    bu: str = Query(...),
    db: AsyncSession = Depends(get_db),
    caller: Caller = Depends(_caller),
):
    tenant = await _resolve(db, caller, uri, bu)
    row = await es.get_settings(db, tenant)
    return await es.build_settings_response(db, tenant, row)


@router.get("/notifications")
async def read_notifications(
    uri: str = Query(..., description=URI_DOC),
    bu: str = Query(...),
    db: AsyncSession = Depends(get_db),
    caller: Caller = Depends(_caller),
) -> NotificationListResponse:
    """Interim poll substitute for the unbuilt §3.2/§3.3 webhook (CARMEN_INTEGRATION.md).

    Read-only — does not mark anything read, same as the in-app bell it shares
    `user_notifications` with. Includes `document_posted`/`document_failed` events
    from the email-ingest pipeline alongside the existing credit-order events.
    """
    tenant = await _resolve(db, caller, uri, bu)
    items, unread = await notification_service.list_notifications(db, tenant.id)  # type: ignore[arg-type]
    return NotificationListResponse(
        items=[NotificationResponse.model_validate(i) for i in items],
        unread_count=unread,
    )


@router.put("/settings")
async def write_settings(
    payload: SettingsIn,
    db: AsyncSession = Depends(get_db),
    caller: Caller = Depends(_caller),
):
    tenant = await _resolve(db, caller, payload.uri, payload.bu)
    row = await es.save_settings(db, tenant, payload)
    logger.info(
        "[email] Settings written for %s/%s by %s", tenant.host, tenant.bu_code, caller.actor
    )
    return await es.build_settings_response(db, tenant, row)


# ── The posting credential (§2.6) ─────────────────────────────────────────────


@router.put("/settings/token")
async def write_token(
    payload: TokenIn,
    db: AsyncSession = Depends(get_db),
    caller: Caller = Depends(_caller),
):
    """Store the credential this BU's JVs are posted with.

    Verified against Carmen before it is stored, so a token that will not work is
    rejected on the customer's own screen rather than at 3am on a real document.
    """
    tenant = await _resolve(db, caller, payload.uri, payload.bu)
    origin = await _safe_carmen_uri(tenant)
    row = await es.set_token(db, tenant, payload.token.get_secret_value(), origin, caller.actor)
    logger.info(
        "[email] Carmen token %s stored for %s/%s by %s",
        row.carmen_token_fp,
        tenant.host,
        tenant.bu_code,
        caller.actor,
    )
    return es.token_status(row)


@router.get("/settings/token")
async def read_token(
    uri: str = Query(..., description=URI_DOC),
    bu: str = Query(...),
    db: AsyncSession = Depends(get_db),
    caller: Caller = Depends(_caller),
):
    tenant = await _resolve(db, caller, uri, bu)
    return es.token_status(await es.get_settings(db, tenant))


@router.delete("/settings/token", status_code=204)
async def delete_token(
    uri: str = Query(..., description=URI_DOC),
    bu: str = Query(...),
    db: AsyncSession = Depends(get_db),
    caller: Caller = Depends(_caller),
):
    """Drop our copy of the credential.

    This does NOT revoke it — only Carmen can do that, and must, because a copy we
    deleted is still a live credential everywhere else.
    """
    tenant = await _resolve(db, caller, uri, bu)
    await es.clear_token(db, tenant, caller.actor)
    logger.info(
        "[email] Carmen token cleared for %s/%s by %s", tenant.host, tenant.bu_code, caller.actor
    )
    return Response(status_code=204)


# ── Ingest job (pg_cron / manual curl) ────────────────────────────────────────


@router.post("/email-ingest/run")
async def run_email_ingest(
    limit: int | None = Query(None, ge=1, le=100),
    _auth=Depends(require_maintenance_auth),
):
    """One mailbox poll. Same auth as every other cron-driven endpoint."""
    return await ingest.run_ingest(limit)


@router.post("/email-ingest/health")
async def check_token_health(
    db: AsyncSession = Depends(get_db),
    _auth=Depends(require_maintenance_auth),
):
    """Re-prove every BU's Carmen credential.

    Carmen's token has no expiry, so a revocation is silent until a real document
    fails. This is the substitute for an expiry date.

    ponytail: not scheduled yet — the ingest poll has no cron either, and both
    belong in one migration the day the mailbox goes live.

    **Schedule the ingest poll at 10 minutes, not 5.** Attachments are processed
    serially, so one poll of a full `imap_batch_size` batch costs roughly
    batch × (one vision call + two Carmen posts) ≈ 3-5 minutes. Some banks send
    commission daily, which for ~100 BUs is ~300 messages a day arriving mostly in
    one overnight window — well inside a 10-minute poll's 2,880/day capacity, and
    without polls routinely overlapping each other on a small instance.

    Both jobs use the same shape:

        select cron.schedule('email-token-health', '15 2 * * *', $$
        select net.http_post(
            url     := (select value #>> '{}' from system_configs
                         where key_name = 'app.base_url' limit 1)
                       || '/api/v1/carmen/email-ingest/health',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || (select decrypted_secret
                    from vault.decrypted_secrets where name = 'internal_job_token' limit 1)),
            body    := '{}'::jsonb);
        $$);

    Use `value #>> '{}'`, not `trim(both '"' …)` — see 20260715010000_fix_cron_sql_bugs.sql,
    where that exact copy-paste silently disabled every HTTP cron job for months.
    """
    return await es.sweep_token_health(db)
