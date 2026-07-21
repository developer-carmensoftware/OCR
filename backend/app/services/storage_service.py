"""
OneApp FileService client for payment slip files.

Slips are the only files persisted in this project (deliberate exception to the
no-file-storage rule — needed for audit/dispute resolution). All other uploaded
files (OCR images) are read into memory and discarded without hitting disk.

Slip bytes live in the internal OneApp FileService (its own bucket, keyed by a
server-generated fileId). Postgres stores only that fileId in
credit_orders.slip_object_key. Auth is a single X-Api-Key header.

Only two endpoints are used:
  POST {base}/Upload          → { data: { fileId } }
  GET  {base}/Files/{fileId}  → { data: { url } }   (presigned, ~1h TTL)
"""

import logging
import mimetypes
import re

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_ALLOWED_SLIP_TYPES: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "application/pdf": "pdf",
}


def _safe_name(base: str) -> str:
    """Sanitize a filename base for the multipart part / Content-Disposition sent to
    FileService. Keeps [A-Za-z0-9._-], collapses the rest to '_', trims leading/trailing
    dots. (order_id is a UUID today, so this is a no-op then — defense if the source
    ever carries user input.)"""
    return re.sub(r"[^A-Za-z0-9._-]", "_", base).strip("._") or "slip"


def _base_url() -> str:
    """FileService base URL (…/Api/v1/External/FileService)."""
    return settings.file_service_url.rstrip("/")


def _headers() -> dict[str, str]:
    return {"X-Api-Key": settings.file_service_api_key}


def guess_ext(content_type: str) -> str:
    """Return file extension for the given MIME type, default 'bin'."""
    return _ALLOWED_SLIP_TYPES.get(content_type) or (
        mimetypes.guess_extension(content_type, strict=False) or ".bin"
    ).lstrip(".")


async def upload_slip(
    order_id: str,
    data: bytes,
    content_type: str,
    *,
    path: str,
) -> str:
    """
    Upload a payment slip to the OneApp FileService.

    `path` is the sub-folder to store under (e.g. "202607" — the order's creation
    month, matching the proforma running number's YYYYMM for easy manual lookup).
    Returns the server-generated fileId (stored as the slip pointer).
    Raises StorageError on failure.

    ponytail: FileService mints a fresh fileId per call and the two endpoints we
    use have no delete. Re-uploading a slip orphans the previous file (small,
    rare — the DB pointer always tracks the newest). No cleanup job.
    """
    if not settings.file_service_url or not settings.file_service_api_key:
        raise StorageError(
            "Storage not configured (FILE_SERVICE_URL / FILE_SERVICE_API_KEY missing)"
        )

    if content_type not in _ALLOWED_SLIP_TYPES:
        raise StorageError(f"Unsupported slip file type: {content_type}")

    # Filename only drives the stored object's extension + fileOriginalName metadata
    # (FileService names the object itself {uuid}.ext); sanitize since it crosses into
    # the external service's multipart/Content-Disposition.
    filename = f"{_safe_name(order_id)}.{_ALLOWED_SLIP_TYPES[content_type]}"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{_base_url()}/Upload",
            files={"file": (filename, data, content_type)},
            data={"path": path},
            headers=_headers(),
        )

    if resp.status_code not in (200, 201):
        logger.error("slip upload failed: status=%d body=%s", resp.status_code, resp.text[:200])
        raise StorageError(f"Storage upload failed ({resp.status_code})")

    try:
        file_id = resp.json()["data"]["fileId"]
    except (ValueError, KeyError, TypeError) as exc:
        logger.error("slip upload returned no fileId: body=%s", resp.text[:200])
        raise StorageError("Storage upload returned no fileId") from exc

    logger.info("slip uploaded: fileId=%s size=%d", file_id, len(data))
    return file_id


async def signed_url(key: str, ttl_seconds: int = 3600) -> str:
    """
    Fetch a presigned URL for the admin to view a slip.

    `key` is the fileId returned by upload_slip. FileService fixes the URL TTL at
    ~1 hour; `ttl_seconds` is informational only (used for the caller's expires_in).
    Returns the presigned URL string. Raises StorageError on failure.
    """
    if not settings.file_service_url or not settings.file_service_api_key:
        raise StorageError("Storage not configured")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{_base_url()}/Files/{key}", headers=_headers())

    if resp.status_code != 200:
        logger.error("signed URL failed: status=%d body=%s", resp.status_code, resp.text[:200])
        raise StorageError(f"Could not generate signed URL ({resp.status_code})")

    try:
        return resp.json()["data"]["url"]
    except (ValueError, KeyError, TypeError) as exc:
        logger.error("signed URL response missing url: body=%s", resp.text[:200])
        raise StorageError("Signed URL response missing url") from exc


class StorageError(Exception):
    """Raised when a FileService operation fails."""
