"""
Supabase Storage service for payment slip files.

Slips are the only files persisted in this project (deliberate exception to the
no-file-storage rule — needed for audit/dispute resolution). All other uploaded
files (OCR images) are read into memory and discarded without hitting disk.

Storage layout: {slip_bucket}/{tenant_id}/{order_id}.{ext}
Bucket must be private (no public read).
"""

import logging
import mimetypes

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_ALLOWED_SLIP_TYPES: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "application/pdf": "pdf",
}


def _base_url() -> str:
    """Supabase Storage REST base URL."""
    return f"{settings.supabase_url.rstrip('/')}/storage/v1"


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.supabase_service_key}",
        "apikey": settings.supabase_service_key,
    }


def _object_key(tenant_id: str, order_id: str, ext: str) -> str:
    return f"{tenant_id}/{order_id}.{ext}"


def guess_ext(content_type: str) -> str:
    """Return file extension for the given MIME type, default 'bin'."""
    return _ALLOWED_SLIP_TYPES.get(content_type) or (
        mimetypes.guess_extension(content_type, strict=False) or ".bin"
    ).lstrip(".")


async def upload_slip(
    tenant_id: str,
    order_id: str,
    data: bytes,
    content_type: str,
) -> str:
    """
    Upload a payment slip to Supabase Storage.

    Returns the object key (relative path within the bucket).
    Raises StorageError on failure.
    """
    if not settings.supabase_url or not settings.supabase_service_key:
        raise StorageError("Storage not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY missing)")

    if content_type not in _ALLOWED_SLIP_TYPES:
        raise StorageError(f"Unsupported slip file type: {content_type}")

    ext = _ALLOWED_SLIP_TYPES[content_type]
    key = _object_key(tenant_id, order_id, ext)
    url = f"{_base_url()}/object/{settings.slip_bucket}/{key}"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            url,
            content=data,
            headers={**_headers(), "Content-Type": content_type},
        )

    if resp.status_code not in (200, 201):
        logger.error("slip upload failed: status=%d body=%s", resp.status_code, resp.text[:200])
        raise StorageError(f"Storage upload failed ({resp.status_code})")

    logger.info("slip uploaded: key=%s size=%d", key, len(data))
    return key


async def signed_url(key: str, ttl_seconds: int = 300) -> str:
    """
    Generate a short-lived signed URL for admin to view a slip.

    Returns the signed URL string.
    """
    if not settings.supabase_url or not settings.supabase_service_key:
        raise StorageError("Storage not configured")

    url = f"{_base_url()}/object/sign/{settings.slip_bucket}/{key}"

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            url,
            json={"expiresIn": ttl_seconds},
            headers={**_headers(), "Content-Type": "application/json"},
        )

    if resp.status_code != 200:
        logger.error("signed URL failed: status=%d body=%s", resp.status_code, resp.text[:200])
        raise StorageError(f"Could not generate signed URL ({resp.status_code})")

    signed_path: str = resp.json()["signedURL"]
    # signedURL is a relative path like /storage/v1/object/sign/...?token=...
    if signed_path.startswith("/"):
        return f"{settings.supabase_url.rstrip('/')}{signed_path}"
    return signed_path


class StorageError(Exception):
    """Raised when a Supabase Storage operation fails."""
