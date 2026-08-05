"""Email Automation — the Settings API Carmen calls, plus the ingest job trigger.

Contract: docs/CARMEN_INTEGRATION.md §2 (settings) and §3 (outcomes).

**Carmen authenticates with the logged-in user's own Carmen token**, which its
settings screen already holds — there is no key for us to issue and no secret for a
customer to store. Every customer runs their own Carmen installation, so a key would
have meant one per installation, hand-delivered, forever. This is the same mechanism
`/auth/exchange` has used for every wizard user since day one.

It also removes the trusted-input problem rather than checking it: `host`/`bu` in the
payload are not a claim we verify against a scope, they are what the token is proven
*against*. Acting on a host requires a credential that host's own Carmen accepts.
One host is always one corporate group, so that is exactly the ownership boundary.

The `Bearer <admin jwt>` path is ours — operators fixing a customer's settings without
asking them for a token.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import decode_admin_jwt
from app.auth.session import extract_user_id_from_token
from app.database import get_db
from app.exceptions import FieldValidationError
from app.models.identity import Tenant
from app.models.schemas.email_automation import SettingsIn, TokenIn
from app.routers.admin.deps import require_maintenance_auth

# ponytail: private imports across routers. _validate_uri / _validate_token raise
# HTTPException and the login path depends on those exact codes, so extracting them
# into a shared module is a real refactor, not a move — do it when something else
# needs them too.
from app.routers.auth import _validate_token, _validate_uri
from app.services import email_ingest_service as ingest
from app.services import email_settings_service as es
from app.services.admin_auth_service import get_admin_jwt_secret
from app.services.rate_limit_service import InMemoryRateLimiter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/carmen", tags=["Email Automation"])

# Every CarmenToken request makes an outbound call to the customer's Carmen before
# the caller is known to be genuine. Same reason /auth/exchange is limited, same tool.
_settings_limiter = InMemoryRateLimiter(max_calls=20, window_seconds=60.0)


# ── Auth ──────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Caller:
    actor: str  # audit trail: "user:<carmen uuid>" or "admin:<name>"
    carmen_token: str | None  # None = admin JWT, our own operator path


async def _caller(
    request: Request,
    authorization: str | None = Header(None),
) -> Caller:
    """Identify the caller. Accepts `CarmenToken …` or `Bearer <admin jwt>`.

    Identification only — a Carmen token is *proven* in `_resolve`, because which
    Carmen to prove it against is not known until the payload has been read.
    """
    scheme, _, rest = (authorization or "").partition(" ")
    rest = rest.strip()

    if scheme == "CarmenToken" and rest:
        # Fire the limiter while the request is still cheap, i.e. before _resolve
        # turns it into an outbound HTTP call to an arbitrary host.
        _settings_limiter.check(request)
        # partition() splits once on purpose: a Carmen token is "<hash>|<uuid>" and
        # the value may itself contain spaces. split() would truncate the credential.
        return Caller(actor=f"user:{extract_user_id_from_token(rest)}", carmen_token=rest)

    if scheme == "Bearer" and rest:
        try:
            payload = decode_admin_jwt(rest, get_admin_jwt_secret())
        except ValueError:
            raise HTTPException(status_code=401, detail="Invalid or expired token") from None
        return Caller(
            actor=f"admin:{payload.get('username') or payload.get('aid')}", carmen_token=None
        )

    raise HTTPException(
        status_code=401,
        detail="Authorization must be 'CarmenToken <carmen token>' or 'Bearer <admin jwt>'",
    )


async def _resolve(db: AsyncSession, caller: Caller, host: str, bu: str) -> Tenant:
    """The BU this request may act on — proven, not asserted.

    The token is checked against the Carmen instance the payload names, so claiming
    another company's host means producing a credential that company's own Carmen
    validates. `_validate_token`'s 401 ("re-login") and 502 ("cannot reach Carmen")
    propagate unchanged: Carmen's screen needs to tell those two apart.
    """
    tenant = await es.resolve_tenant(db, host, bu)
    if caller.carmen_token is not None:
        await _validate_token(caller.carmen_token, _safe_carmen_uri(None, tenant))
    return tenant


def _safe_carmen_uri(uri: str | None, tenant: Tenant) -> str:
    """SSRF gate. Every server-side request we make on a caller's behalf goes through it.

    `_validate_uri` (routers/auth.py) is the same check `/auth/exchange` already
    applies: https only, ALLOWED_CARMEN_HOSTS allowlist, loopback/private-IP
    rejection including what a hostname resolves to. Its 400 is re-raised as the
    422 field-error shape Carmen's screen already renders inline.
    """
    candidate = (uri or f"https://{tenant.host}").strip()
    try:
        return _validate_uri(candidate)
    except HTTPException as exc:
        raise FieldValidationError(
            [{"field": "carmen_uri", "code": "invalid_uri", "message": str(exc.detail)}]
        ) from exc


# ── Settings (§2.2 / §2.3) ────────────────────────────────────────────────────


@router.get("/settings")
async def read_settings(
    host: str = Query(...),
    bu: str = Query(...),
    db: AsyncSession = Depends(get_db),
    caller: Caller = Depends(_caller),
):
    tenant = await _resolve(db, caller, host, bu)
    row = await es.get_settings(db, tenant)
    return await es.build_settings_response(db, tenant, row, host, bu)


@router.put("/settings")
async def write_settings(
    payload: SettingsIn,
    db: AsyncSession = Depends(get_db),
    caller: Caller = Depends(_caller),
):
    tenant = await _resolve(db, caller, payload.host, payload.bu)
    row = await es.save_settings(db, tenant, payload)
    logger.info("[email] Settings written for %s/%s by %s", payload.host, payload.bu, caller.actor)
    return await es.build_settings_response(db, tenant, row, payload.host, payload.bu)


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
    tenant = await _resolve(db, caller, payload.host, payload.bu)
    uri = _safe_carmen_uri(payload.carmen_uri, tenant)
    row = await es.set_token(db, tenant, payload.token.get_secret_value(), uri, caller.actor)
    logger.info(
        "[email] Carmen token %s stored for %s/%s by %s",
        row.carmen_token_fp,
        payload.host,
        payload.bu,
        caller.actor,
    )
    return es.token_status(row)


@router.get("/settings/token")
async def read_token(
    host: str = Query(...),
    bu: str = Query(...),
    db: AsyncSession = Depends(get_db),
    caller: Caller = Depends(_caller),
):
    tenant = await _resolve(db, caller, host, bu)
    return es.token_status(await es.get_settings(db, tenant))


@router.delete("/settings/token", status_code=204)
async def delete_token(
    host: str = Query(...),
    bu: str = Query(...),
    db: AsyncSession = Depends(get_db),
    caller: Caller = Depends(_caller),
):
    """Drop our copy of the credential.

    This does NOT revoke it — only Carmen can do that, and must, because a copy we
    deleted is still a live credential everywhere else.
    """
    tenant = await _resolve(db, caller, host, bu)
    await es.clear_token(db, tenant, caller.actor)
    logger.info("[email] Carmen token cleared for %s/%s by %s", host, bu, caller.actor)
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
    belong in one migration the day the mailbox goes live. That migration is:

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
