"""
Audit Log Service — fire-and-forget activity logging.

Carmen end-user actions: use log_action() — sets carmen_user_id, leaves admin_user_id NULL.
Admin dashboard actions: use log_admin_action() — sets admin_user_id, supports before/after diff.

Writes are buffered and flushed every 10s (via main.py background task) so
extract/submit bursts don't translate to a 1:1 burst of DB INSERTs.
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
    QUOTA_UPDATE = "QUOTA_UPDATE"
    QUOTA_RESET = "QUOTA_RESET"
    MODULE_TOGGLE = "MODULE_TOGGLE"


# ── Buffered write queue ──────────────────────────────────────────────────────
# Every extract/submit fired 1 INSERT + commit. The buffer coalesces these into
# a single batch insert every 10s.
_AUDIT_BUFFER: list[dict] = []
_FLUSH_SIZE = 500
_BUFFER_HARD_CAP = 5000


async def flush_audit_buffer() -> None:
    """Batch-insert buffered audit log rows. Called by the background flush task."""
    if not _AUDIT_BUFFER:
        return
    batch, _AUDIT_BUFFER[:] = _AUDIT_BUFFER[:], []
    try:
        async with async_session() as db:
            db.add_all([AuditLog(**row) for row in batch])
            await db.commit()
    except Exception as exc:
        logger.error("flush_audit_buffer failed (dropped %d rows): %s", len(batch), exc)


def _enqueue(row: dict) -> None:
    _AUDIT_BUFFER.append(row)
    overflow = len(_AUDIT_BUFFER) - _BUFFER_HARD_CAP
    if overflow > 0:
        del _AUDIT_BUFFER[:overflow]
        logger.warning("audit buffer over cap — dropped %d oldest rows", overflow)
    if len(_AUDIT_BUFFER) >= _FLUSH_SIZE:
        import asyncio

        asyncio.ensure_future(flush_audit_buffer())


async def log_action(
    session: SessionInfo,
    action: str,
    resource: str | None = None,
    resource_id: str | None = None,
    ip_address: str | None = None,
) -> None:
    """Log a Carmen end-user action. Never raises."""
    try:
        _enqueue(
            {
                "tenant_id": session.tenant_id or None,
                "carmen_user_id": session.carmen_user_id or None,
                "admin_user_id": None,
                "username": session.username or None,
                "session_id": current_ocr_session_id.get() or None,
                "ip_address": ip_address,
                "action": action,
                "resource": resource,
                "resource_id": resource_id or current_document_ref.get() or None,
            }
        )
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
        _enqueue(
            {
                "admin_user_id": admin_user_id,
                "carmen_user_id": None,
                "action": action,
                "resource": resource,
                "target_type": target_type,
                "target_id": target_id,
                "before_value": before_value,
                "after_value": after_value,
                "ip_address": ip_address,
            }
        )
    except Exception as exc:
        logger.error("audit_service.log_admin_action failed: %s", exc)
