"""Email Automation — the Settings API Carmen calls, plus the ingest job trigger.

Contract: docs/CARMEN_INTEGRATION.md §2 (settings) and §3 (outcomes).

Auth is deliberately dual (`_caller`): Carmen presents the API key we issue it,
our own simulated settings page presents an admin JWT. Same handler, same payload,
same validation — so when Carmen's screens go live, our page is deleted and nothing
else changes. The key path is the one that ships; the JWT path exists so a browser
never has to hold a live API key.
"""

from __future__ import annotations

import hashlib
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import decode_admin_jwt
from app.database import get_db
from app.models.admin import APIKey
from app.routers.admin.deps import require_maintenance_auth
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
    # Carmen's posting credential for this BU. Same write-only semantics as
    # pdf_password; until Carmen issues one, CARMEN_DEV_TOKEN in env is used.
    carmen_token: str | None = None


# ── Auth ──────────────────────────────────────────────────────────────────────


async def _caller(
    db: AsyncSession = Depends(get_db),
    authorization: str | None = Header(None),
) -> str:
    """Returns an actor string for the audit trail. Accepts `ApiKey …` or `Bearer <admin jwt>`."""
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
        return f"apikey:{row.name}"

    if authorization.startswith("Bearer "):
        try:
            payload = decode_admin_jwt(authorization[7:], get_admin_jwt_secret())
        except ValueError:
            raise HTTPException(status_code=401, detail="Invalid or expired token") from None
        return f"admin:{payload.get('username') or payload.get('aid')}"

    raise HTTPException(status_code=401, detail="Authorization must be 'ApiKey …' or 'Bearer …'")


# ── Settings (§2.2 / §2.3) ────────────────────────────────────────────────────


@router.get("/settings")
async def read_settings(
    host: str = Query(...),
    bu: str = Query(...),
    db: AsyncSession = Depends(get_db),
    _actor: str = Depends(_caller),
):
    tenant = await es.resolve_tenant(db, host, bu)
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
    actor: str = Depends(_caller),
):
    tenant = await es.resolve_tenant(db, payload.host, payload.bu)
    row = await es.save_settings(db, tenant, payload)
    logger.info("[email] Settings written for %s/%s by %s", payload.host, payload.bu, actor)
    body = es.to_response(row, payload.host, payload.bu)
    body["status"].update(await ingest.get_settings_status(db, row))
    body["entitled"] = True
    return body


# ── Ingest job (pg_cron / manual curl) ────────────────────────────────────────


@router.post("/email-ingest/run")
async def run_email_ingest(
    limit: int | None = Query(None, ge=1, le=100),
    _auth=Depends(require_maintenance_auth),
):
    """One mailbox poll. Same auth as every other cron-driven endpoint."""
    return await ingest.run_ingest(limit)
