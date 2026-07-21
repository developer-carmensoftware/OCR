"""
Unit tests for storage_service (OneApp FileService client):
  - guess_ext
  - upload_slip (success, failure, unconfigured, missing fileId)
  - signed_url (success, failure, missing url)
  - StorageError exception
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.storage_service import StorageError, guess_ext, signed_url, upload_slip


def _mock_settings(url="https://host/Api/v1/External/FileService", key="fsc_key"):
    s = MagicMock()
    s.file_service_url = url
    s.file_service_api_key = key
    return s


def _mock_httpx_client(status_code=200, json_body=None):
    """Return an AsyncContextManager mock for httpx.AsyncClient (post + get)."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_body if json_body is not None else {}
    resp.text = ""

    client = MagicMock()
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=False)
    client.post = AsyncMock(return_value=resp)
    client.get = AsyncMock(return_value=resp)
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
async def test_upload_slip_returns_file_id():
    client = _mock_httpx_client(200, json_body={"data": {"fileId": "file-abc"}})
    with (
        patch("app.services.storage_service.settings", _mock_settings()),
        patch("app.services.storage_service.httpx.AsyncClient", return_value=client),
    ):
        file_id = await upload_slip("o-123", b"fake-jpeg", "image/jpeg", path="202606")

    assert file_id == "file-abc"
    # POST hits /Upload with X-Api-Key and a multipart file part.
    _, kwargs = client.post.call_args
    assert client.post.call_args[0][0].endswith("/Upload")
    assert kwargs["headers"]["X-Api-Key"] == "fsc_key"
    assert kwargs["files"]["file"][0] == "o-123.jpg"  # filename carries the extension
    assert kwargs["data"]["path"] == "202606"  # yyyymm folder, not the tenant


@pytest.mark.asyncio
async def test_upload_slip_sanitizes_filename():
    client = _mock_httpx_client(200, json_body={"data": {"fileId": "file-abc"}})
    with (
        patch("app.services.storage_service.settings", _mock_settings()),
        patch("app.services.storage_service.httpx.AsyncClient", return_value=client),
    ):
        await upload_slip("../ord er#1", b"png", "image/png", path="202606")

    # Special chars collapse to '_', path-traversal dots trimmed — safe for the multipart part.
    assert client.post.call_args[1]["files"]["file"][0] == "ord_er_1.png"


@pytest.mark.asyncio
async def test_upload_slip_success_201():
    client = _mock_httpx_client(201, json_body={"data": {"fileId": "file-xyz"}})
    with (
        patch("app.services.storage_service.settings", _mock_settings()),
        patch("app.services.storage_service.httpx.AsyncClient", return_value=client),
    ):
        assert await upload_slip("o", b"png", "image/png", path="202606") == "file-xyz"


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
            await upload_slip("o-123", b"data", "image/jpeg", path="202606")


@pytest.mark.asyncio
async def test_upload_slip_raises_when_response_has_no_file_id():
    with (
        patch("app.services.storage_service.settings", _mock_settings()),
        patch(
            "app.services.storage_service.httpx.AsyncClient",
            return_value=_mock_httpx_client(200, json_body={"data": {}}),
        ),
    ):
        with pytest.raises(StorageError, match="no fileId"):
            await upload_slip("o-123", b"data", "image/jpeg", path="202606")


@pytest.mark.asyncio
async def test_upload_slip_raises_on_unsupported_type():
    with patch("app.services.storage_service.settings", _mock_settings()):
        with pytest.raises(StorageError, match="Unsupported"):
            await upload_slip("o-123", b"data", "image/gif", path="202606")


@pytest.mark.asyncio
async def test_upload_slip_raises_when_not_configured():
    with patch("app.services.storage_service.settings", _mock_settings(url="")):
        with pytest.raises(StorageError, match="not configured"):
            await upload_slip("o-123", b"data", "image/jpeg", path="202606")


# ── signed_url ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_signed_url_returns_presigned_url():
    presigned = "https://minio.host/carmen/slips/uuid.jpg?X-Amz-Signature=abc"
    client = _mock_httpx_client(200, json_body={"data": {"url": presigned}})
    with (
        patch("app.services.storage_service.settings", _mock_settings()),
        patch("app.services.storage_service.httpx.AsyncClient", return_value=client),
    ):
        url = await signed_url("file-abc")

    assert url == presigned
    assert client.get.call_args[0][0].endswith("/Files/file-abc")
    assert client.get.call_args[1]["headers"]["X-Api-Key"] == "fsc_key"


@pytest.mark.asyncio
async def test_signed_url_raises_on_non_200():
    with (
        patch("app.services.storage_service.settings", _mock_settings()),
        patch(
            "app.services.storage_service.httpx.AsyncClient",
            return_value=_mock_httpx_client(404),
        ),
    ):
        with pytest.raises(StorageError, match="signed URL"):
            await signed_url("file-abc")


@pytest.mark.asyncio
async def test_signed_url_raises_when_response_missing_url():
    with (
        patch("app.services.storage_service.settings", _mock_settings()),
        patch(
            "app.services.storage_service.httpx.AsyncClient",
            return_value=_mock_httpx_client(200, json_body={"data": {}}),
        ),
    ):
        with pytest.raises(StorageError, match="missing url"):
            await signed_url("file-abc")
