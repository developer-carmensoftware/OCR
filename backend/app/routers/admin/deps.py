"""Shared dependency for all admin endpoints."""

from fastapi import Header, HTTPException

from app.config import settings


def require_admin(x_admin_key: str = Header(..., alias="X-Admin-Key")) -> None:
    """Require a valid master API key for all admin endpoints."""
    if not settings.master_api_key:
        raise HTTPException(status_code=503, detail="Admin access not configured")
    if x_admin_key != settings.master_api_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")
