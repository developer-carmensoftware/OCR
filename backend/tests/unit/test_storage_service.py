"""
Unit tests for storage_service:
  - guess_ext
  - upload_slip (success, failure, unconfigured)
  - signed_url (relative path, absolute path, failure)
  - StorageError exception
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.storage_service import StorageError, guess_ext, signed_url, upload_slip


def _mock_settings(url="https://x.supabase.co", key="svc-key", bucket="payment-slips"):
    s = MagicMock()
    s.supabase_url = url
    s.supabase_service_key = key
    s.slip_bucket = bucket
    return s


def _mock_httpx_client(status_code=201, json_body=None):
    """Return an AsyncContextManager mock for httpx.AsyncClient."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_body or {}
    resp.text = ""

    client = MagicMock()
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=False)
    client.post = AsyncMock(return_value=resp)
    return client


# ── guess_ext ─────────────────────────────────────────────────────────────────


def test_guess_ext_jpeg():
    assert guess_ext("image/jpeg") == "jpg"


def test_guess_ext_png():
    assert guess_ext("image/png") == "png"


def test_guess_ext_pdf():
    assert guess_ext("application/pdf") == "pdf"


def test_guess_ext_unknown_returns_non_empty_string():
    ext = guess_ext("application/octet-stream")
    assert isinstance(ext, str) and len(ext) > 0


# ── upload_slip ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_upload_slip_success_201():
    with (
        patch("app.services.storage_service.settings", _mock_settings()),
        patch(
            "app.services.storage_service.httpx.AsyncClient",
            return_value=_mock_httpx_client(201),
        ),
    ):
        key = await upload_slip("t-abc", "o-123", b"fake-jpeg", "image/jpeg")
    assert key == "t-abc/o-123.jpg"


@pytest.mark.asyncio
async def test_upload_slip_success_200():
    with (
        patch("app.services.storage_service.settings", _mock_settings()),
        patch(
            "app.services.storage_service.httpx.AsyncClient",
            return_value=_mock_httpx_client(200),
        ),
    ):
        key = await upload_slip("t-abc", "o-123", b"fake-png", "image/png")
    assert key == "t-abc/o-123.png"


@pytest.mark.asyncio
async def test_upload_slip_raises_on_server_error():
    with (
        patch("app.services.storage_service.settings", _mock_settings()),
        patch(
            "app.services.storage_service.httpx.AsyncClient",
            return_value=_mock_httpx_client(500),
        ),
    ):
        with pytest.raises(StorageError, match="upload failed"):
            await upload_slip("t-abc", "o-123", b"data", "image/jpeg")


@pytest.mark.asyncio
async def test_upload_slip_raises_when_not_configured():
    with patch("app.services.storage_service.settings", _mock_settings(url="")):
        with pytest.raises(StorageError, match="not configured"):
            await upload_slip("t-abc", "o-123", b"data", "image/jpeg")


# ── signed_url ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_signed_url_prepends_base_url_for_relative_path():
    body = {"signedURL": "/storage/v1/object/sign/payment-slips/t/o.jpg?token=abc"}
    with (
        patch(
            "app.services.storage_service.settings",
            _mock_settings(url="https://x.supabase.co"),
        ),
        patch(
            "app.services.storage_service.httpx.AsyncClient",
            return_value=_mock_httpx_client(200, json_body=body),
        ),
    ):
        url = await signed_url("t/o.jpg", ttl_seconds=300)

    assert url.startswith("https://x.supabase.co")
    assert "token=abc" in url


@pytest.mark.asyncio
async def test_signed_url_returns_as_is_when_already_absolute():
    absolute = "https://x.supabase.co/storage/v1/object/sign/payment-slips/t/o.jpg?token=abc"
    body = {"signedURL": absolute}
    with (
        patch("app.services.storage_service.settings", _mock_settings()),
        patch(
            "app.services.storage_service.httpx.AsyncClient",
            return_value=_mock_httpx_client(200, json_body=body),
        ),
    ):
        url = await signed_url("t/o.jpg")

    assert url == absolute


@pytest.mark.asyncio
async def test_signed_url_raises_on_non_200():
    with (
        patch("app.services.storage_service.settings", _mock_settings()),
        patch(
            "app.services.storage_service.httpx.AsyncClient",
            return_value=_mock_httpx_client(403),
        ),
    ):
        with pytest.raises(StorageError, match="signed URL"):
            await signed_url("t/o.jpg")
