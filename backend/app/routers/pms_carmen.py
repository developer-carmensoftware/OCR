"""Carmen's PMS settings API (decision-log #44).

Carmen's PMS setting screen, one per BU and PMS, sets two things here: whether a clean day of
that PMS posts by itself, and the key that BU's hook for that PMS sends. `pms` is the hook's
InterfaceName. Contract: docs/PMS_INTEGRATION.md §6.

It authenticates exactly as the email Settings API does (`email_automation/settings_api.py`):
the user's Carmen token, proven against the Carmen the payload names, or an operator's admin
JWT with `configs:write`. Carmen decides who sees the screen; we check nothing twice.

Every write on the Carmen path offers the proven token as the BU's Carmen credential (one per
BU, shared with email, decision-log #42) and wakes the days that were waiting for one: that
is how a BU gets its credential now that #/pms is gone. A held credential that still works is
kept (#45). A BU that never opened the app is
registered by its first write, with the free trial a first login would have given it; a
read of it answers the defaults and creates nothing. PMS itself charges nothing.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.session import SessionInfo
from app.database import get_db
from app.models.identity import Tenant
from app.models.schemas.email_automation import URI_DOC
from app.models.schemas.pms import (
    PmsCarmenKeyOut,
    PmsCarmenRef,
    PmsCarmenSettingsIn,
    PmsCarmenSettingsOut,
)
from app.routers.email_automation.settings_api import (
    Caller,
    _caller,
    _resolve,
    _resolve_for_read,
    _safe_carmen_uri,
)
from app.services.email_automation import credential
from app.services.pms import process
from app.services.pms import review as pms_review
from app.services.shared import api_keys
from app.services.shared.audit import AuditAction, log_action, log_admin_action
from app.utils.client_ip import get_client_ip

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/carmen/pms", tags=["PMS"])


def _ref(
    uri: str = Query(..., description=URI_DOC),
    bu: str = Query(...),
    pms: str = Query(
        ...,
        min_length=1,
        max_length=40,
        pattern=r"^[^/]+$",
        description="The PMS: the InterfaceName this BU's hook sends, e.g. Comanche",
    ),
) -> PmsCarmenRef:
    """The query-string twin of the PUT/POST body. Validated here, so a bad value is a 422."""
    return PmsCarmenRef(uri=uri, bu=bu, pms=pms)


def _who(caller: Caller) -> str:
    """The caller as a 36-wide `revoked_by`: the Carmen user id, or the operator's."""
    return caller.admin.admin_id if caller.admin else caller.actor.removeprefix("user:")[:36]


async def _store_credential(db: AsyncSession, caller: Caller, tenant: Tenant) -> None:
    """The proven token becomes the BU's credential unless a working one is held (#45), and
    the days a credential unblocks run again.

    Commits. The operator path has no Carmen token to store.
    """
    if caller.carmen_token is None:
        return
    origin = await _safe_carmen_uri(tenant)
    await credential.adopt_token(db, tenant, caller.carmen_token, origin, caller.actor)
    woken = await process.wake_waiting(db, tenant.id)
    await db.commit()
    for day_id in woken:
        process.kick(day_id)


async def _audit(caller: Caller, tenant: Tenant, action: str, key_id: str, request: Request):
    ip = get_client_ip(request)
    if caller.admin:
        await log_admin_action(
            caller.admin.admin_id,
            action,
            resource="api_keys",
            target_type="api_key",
            target_id=key_id,
            ip_address=ip,
        )
        return
    user = _who(caller)
    await log_action(
        SessionInfo("", "", user, user, str(tenant.id)),
        action,
        resource="api_keys",
        resource_id=key_id,
        ip_address=ip,
    )


@router.get("/settings", response_model=PmsCarmenSettingsOut)
async def read_settings(
    ref: PmsCarmenRef = Depends(_ref),
    db: AsyncSession = Depends(get_db),
    caller: Caller = Depends(_caller),
):
    """This PMS's settings. A BU that never opened the app reads the defaults: a read creates
    nothing, the first write registers it."""
    tenant = await _resolve_for_read(db, caller, ref.uri, ref.bu)
    if tenant is None:
        return PmsCarmenSettingsOut(pms=ref.pms, auto_post=False, key=None, has_credential=False)
    return await pms_review.get_settings(db, tenant.id, ref.pms)


@router.put("/settings", response_model=PmsCarmenSettingsOut)
async def write_settings(
    payload: PmsCarmenSettingsIn,
    db: AsyncSession = Depends(get_db),
    caller: Caller = Depends(_caller),
):
    """Replace this PMS's auto-post switch. A day with anything to check still waits (#24)."""
    tenant = await _resolve(db, caller, payload.uri, payload.bu, create=True)
    await _store_credential(db, caller, tenant)
    await pms_review.save_settings(
        db, tenant.id, payload.pms, auto_post=payload.auto_post, actor=caller.actor[:100]
    )
    await db.commit()
    logger.info(
        "[pms] %s auto-post %s for %s/%s by %s",
        payload.pms,
        "on" if payload.auto_post else "off",
        tenant.host,
        tenant.bu_code,
        caller.actor,
    )
    return await pms_review.get_settings(db, tenant.id, payload.pms)


@router.post("/keys", status_code=201, response_model=PmsCarmenKeyOut)
async def generate_key(
    payload: PmsCarmenRef,
    request: Request,
    db: AsyncSession = Depends(get_db),
    caller: Caller = Depends(_caller),
):
    """A new hook key for this BU and PMS; the previous one stops working at once.

    `api_key` in this response is the only copy anywhere: we keep its hash.
    """
    tenant = await _resolve(db, caller, payload.uri, payload.bu, create=True)
    await _store_credential(db, caller, tenant)
    key, plaintext = await api_keys.issue(
        db, tenant.id, f"{payload.pms} hook", payload.pms, actor=caller.actor[:100]
    )
    await db.commit()
    await _audit(caller, tenant, AuditAction.API_KEY_CREATE, str(key.id), request)
    out = await pms_review.get_settings(db, tenant.id, payload.pms)
    return {**out, "api_key": plaintext}


@router.delete("/keys", status_code=204)
async def revoke_key(
    request: Request,
    ref: PmsCarmenRef = Depends(_ref),
    db: AsyncSession = Depends(get_db),
    caller: Caller = Depends(_caller),
):
    """Revoke this BU's key for this PMS: its hook is refused from now on. 404 when none."""
    tenant = await _resolve(db, caller, ref.uri, ref.bu)
    key = await api_keys.live_key(db, tenant.id, ref.pms)
    if key is None:
        raise HTTPException(status_code=404, detail="No active key for this PMS")
    await api_keys.revoke_live(
        db, tenant.id, ref.pms, by=_who(caller), reason="Revoked from Carmen's PMS setting"
    )
    await db.commit()
    await _audit(caller, tenant, AuditAction.API_KEY_REVOKE, str(key.id), request)
    return Response(status_code=204)
