"""Consent router — server-side record of AI-processing consent (PDPA ม.19).

Append-only proof of who consented, when, and to which consent version. The record
is org-level (keyed on tenant_id) to match the frontend's tenant-scoped consent gate.
"""

import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import SessionInfo, get_current_session
from app.database import get_db
from app.models import ConsentLog, ConsentRequest, ConsentStatusResponse
from app.utils.client_ip import get_client_ip

router = APIRouter(prefix="/api/v1/consent", tags=["consent"])
logger = logging.getLogger(__name__)


@router.post("", status_code=201)
async def record_consent(
    payload: ConsentRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
) -> ConsentStatusResponse:
    """Persist one consent record. Append-only — history is the legal evidence."""
    user_agent = (request.headers.get("User-Agent") or "")[:400] or None
    db.add(
        ConsentLog(
            tenant_id=session.tenant_id,
            carmen_user_id=session.carmen_user_id or None,
            consent_version=payload.version,
            ip_address=get_client_ip(request),
            user_agent=user_agent,
        )
    )
    await db.commit()
    logger.info("Consent recorded: tenant=%s version=%s", session.tenant_id, payload.version)
    return ConsentStatusResponse(consented=True)


@router.get("/status")
async def consent_status(
    version: str,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
) -> ConsentStatusResponse:
    """Report whether this tenant has a consent record for the given version."""
    exists = await db.scalar(
        select(ConsentLog.id)
        .where(
            ConsentLog.tenant_id == session.tenant_id,
            ConsentLog.consent_version == version,
        )
        .limit(1)
    )
    return ConsentStatusResponse(consented=exists is not None)
