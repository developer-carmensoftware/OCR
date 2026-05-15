"""
Audit Log Service — fire-and-forget activity logging.

Carmen end-user actions: use log_action() — sets carmen_user_id, leaves admin_user_id NULL.
Admin dashboard actions: use log_admin_action() — sets admin_user_id, supports before/after diff.
"""

import logging
from typing import Any

from app.auth.session import SessionInfo
from app.context import current_document_ref, current_ocr_session_id
from app.database import async_session
from app.models.orm import AuditLog

logger = logging.getLogger(__name__)


class AuditAction:
    EXTRACT = "EXTRACT"
    SUBMIT = "SUBMIT"
    SUGGEST_GL = "SUGGEST_GL"
    EXPORT = "EXPORT"
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    CONFIG_UPDATE = "CONFIG_UPDATE"
    BANK_CREATE = "BANK_CREATE"
    BANK_UPDATE = "BANK_UPDATE"
    PROMPT_PUBLISH = "PROMPT_PUBLISH"
    API_KEY_REVOKE = "API_KEY_REVOKE"


async def log_action(
    session: SessionInfo,
    action: str,
    resource: str | None = None,
    resource_id: str | None = None,
    ip_address: str | None = None,
) -> None:
    """Log a Carmen end-user action. Never raises."""
    try:
        async with async_session() as db:
            db.add(
                AuditLog(
                    tenant_id=session.tenant_id or None,
                    business_unit_id=session.business_unit_id or None,
                    carmen_user_id=session.carmen_user_id or None,
                    admin_user_id=None,
                    username=session.username or None,
                    session_id=current_ocr_session_id.get() or None,
                    ip_address=ip_address,
                    action=action,
                    resource=resource,
                    resource_id=resource_id or current_document_ref.get() or None,
                )
            )
            await db.commit()
    except Exception as exc:
        logger.error("audit_service.log_action failed: %s", exc)


async def log_admin_action(
    admin_user_id: str,
    action: str,
    resource: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    before_value: Any | None = None,
    after_value: Any | None = None,
    ip_address: str | None = None,
) -> None:
    """Log an admin dashboard action with optional before/after diff. Never raises."""
    try:
        async with async_session() as db:
            db.add(
                AuditLog(
                    admin_user_id=admin_user_id,
                    carmen_user_id=None,
                    action=action,
                    resource=resource,
                    target_type=target_type,
                    target_id=target_id,
                    before_value=before_value,
                    after_value=after_value,
                    ip_address=ip_address,
                )
            )
            await db.commit()
    except Exception as exc:
        logger.error("audit_service.log_admin_action failed: %s", exc)
