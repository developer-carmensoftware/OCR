"""Email Automation — the Settings API Carmen calls, plus the ingest job trigger.

Contract: docs/CARMEN_INTEGRATION.md §2 (settings) and §3 (outcomes).

Auth is deliberately dual (`_caller`): Carmen presents the API key we issue it,
our own simulated settings page presents an admin JWT. Same handler, same payload,
same validation — so when Carmen's screens go live, our page is deleted and nothing
else changes. The key path is the one that ships; the JWT path exists so a browser
never has to hold a live API key.

An API key is bound to what it may manage (`_authorize`) — a key's own tenant, or
the hosts named in its scopes. The BU in the payload is caller-supplied, so without
that check any valid key writes any BU's tax IDs and posting credential.
"""

from __future__ import annotations

import hashlib
import logging
import uuid
from dataclasses import dataclass

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import decode_admin_jwt
from app.database import get_db
from app.exceptions import FieldValidationError
from app.models.admin import APIKey
from app.models.identity import Tenant
from app.routers.admin.deps import require_maintenance_auth
from app.routers.auth import _validate_uri
from app.services import email_ingest_service as ingest
from app.services import email_settings_service as es
from app.services.admin_auth_service import get_admin_jwt_secret

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/carmen", tags=["Email Automation"])


# ── Payload (contract §2.3) ───────────────────────────────────────────────────


class RuleIn(BaseModel):
    bank_code: str | None = None
    bank_sender_email: str | None = None
    filename_pattern: str | None = None
    pdf_password: str | None = None  # write-only: omit = keep, "" = clear
    is_active: bool = True


class SettingsIn(BaseModel):
    host: str
    bu: str
    enabled: bool = False
    tax_ids: list[str] = Field(default_factory=list)
    rules: list[RuleIn] = Field(default_factory=list)


class TokenIn(BaseModel):
    """The posting credential (§2.6) — its own payload, not part of a settings edit.

    Keeping it out of SettingsIn means an ordinary settings change (a new tax ID, a
    tweaked rule) never re-transmits the secret. SecretStr keeps it out of validation
    errors and Sentry breadcrumbs.
    """

    host: str
    bu: str
    token: SecretStr
    carmen_uri: str | None = None  # default: https://<tenant host>


# ── Auth ──────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Caller:
    actor: str  # audit trail string
    tenant_id: uuid.UUID | None  # APIKey scoped to a single BU
    hosts: frozenset[str] | None  # from `host:<hostname>` scopes; None = admin JWT


async def _caller(
    db: AsyncSession = Depends(get_db),
    authorization: str | None = Header(None),
) -> Caller:
    """Authenticate. Accepts `ApiKey …` or `Bearer <admin jwt>`.

    Authentication only — what the caller may *touch* is `_authorize`, because the
    BU is not known until the payload has been read.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")

    if authorization.startswith("ApiKey "):
        raw = authorization[7:].strip()
        key_hash = hashlib.sha256(raw.encode()).hexdigest()
        row = (
            await db.execute(
                select(APIKey).where(APIKey.key_hash == key_hash, APIKey.revoked_at.is_(None))
            )
        ).scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=401, detail="Invalid API key")
        hosts = frozenset(
            s[5:].lower()
            for s in (row.scopes or [])
            if isinstance(s, str) and s.startswith("host:")
        )
        return Caller(actor=f"apikey:{row.name}", tenant_id=row.tenant_id, hosts=hosts)

    if authorization.startswith("Bearer "):
        try:
            payload = decode_admin_jwt(authorization[7:], get_admin_jwt_secret())
        except ValueError:
            raise HTTPException(status_code=401, detail="Invalid or expired token") from None
        actor = f"admin:{payload.get('username') or payload.get('aid')}"
        return Caller(actor=actor, tenant_id=None, hosts=None)

    raise HTTPException(status_code=401, detail="Authorization must be 'ApiKey …' or 'Bearer …'")


def _authorize(caller: Caller, tenant: Tenant) -> None:
    """May this caller manage this BU?

    Fail closed: an API key with neither a tenant nor a `host:` scope manages
    nothing. The host/bu in the payload is caller-supplied, so this is the only
    thing standing between one customer's key and another customer's books.
    """
    if caller.tenant_id is None and caller.hosts is None:
        return  # admin JWT — our own RBAC already ran
    if caller.tenant_id is not None and caller.tenant_id == tenant.id:
        return
    if caller.hosts and str(tenant.host).lower() in caller.hosts:
        return
    logger.warning("[email] %s denied on %s/%s", caller.actor, tenant.host, tenant.bu_code)
    raise HTTPException(status_code=403, detail="This API key may not manage that business unit")


async def _resolve(db: AsyncSession, caller: Caller, host: str, bu: str) -> Tenant:
    tenant = await es.resolve_tenant(db, host, bu)
    _authorize(caller, tenant)
    return tenant


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
    body = es.to_response(row, host, bu)
    if row is not None:
        body["status"].update(await ingest.get_settings_status(db, row))
    # ponytail: entitlement is gated on the monthly package (§3.3) — wired when the
    # subscription webhook lands. Until then a configured BU is an entitled BU.
    body["entitled"] = True
    return body


@router.put("/settings")
async def write_settings(
    payload: SettingsIn,
    db: AsyncSession = Depends(get_db),
    caller: Caller = Depends(_caller),
):
    tenant = await _resolve(db, caller, payload.host, payload.bu)
    row = await es.save_settings(db, tenant, payload)
    logger.info("[email] Settings written for %s/%s by %s", payload.host, payload.bu, caller.actor)
    body = es.to_response(row, payload.host, payload.bu)
    body["status"].update(await ingest.get_settings_status(db, row))
    body["entitled"] = True
    return body


# ── The posting credential (§2.6) ─────────────────────────────────────────────


def _safe_carmen_uri(uri: str | None, tenant: Tenant) -> str:
    """SSRF gate. We are about to make a server-side request carrying a credential.

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
