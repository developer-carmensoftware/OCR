"""Tests for Carmen empty-body resilience (JSON decode bug fix).

Covers:
- get_vendor_invoices / get_jv_by_source returning [] on empty body
- get_vendor_invoices / get_jv_by_source still parsing valid JSON
- fetch_vendor_history graceful fallback on unexpected errors
"""

from json import JSONDecodeError
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.carmen_service import get_jv_by_source, get_vendor_invoices

SVC = "app.services.carmen_service"


# ── Helpers ──────────────────────────────────────────────────────────────────


def _mock_resp(status=200, body=b"", json_data=None):
    resp = MagicMock()
    resp.status_code = status
    resp.content = body
    resp.text = body.decode() if isinstance(body, bytes) else body
    if json_data is not None:
        resp.json.return_value = json_data
        resp.content = b"has-content"
    elif body:
        import json

        try:
            resp.json.return_value = json.loads(body)
        except (ValueError, JSONDecodeError):
            resp.json.side_effect = JSONDecodeError("Expecting value", body.decode(), 0)
    else:
        resp.json.side_effect = JSONDecodeError("Expecting value", "", 0)
    return resp


def _patch_carmen(resp):
    """Patch _get_client + _base_url + _headers so we skip context vars."""
    client = AsyncMock()
    client.get.return_value = resp
    return [
        patch(f"{SVC}._get_client", return_value=client),
        patch(f"{SVC}._base_url", return_value="http://fake"),
        patch(f"{SVC}._headers", return_value={"Authorization": "Bearer tok"}),
    ]


# ── get_vendor_invoices ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_vendor_invoices_empty_body_returns_empty_list():
    patches = _patch_carmen(_mock_resp(200, b""))
    for p in patches:
        p.start()
    try:
        assert await get_vendor_invoices("VN001", "tok") == []
    finally:
        for p in patches:
            p.stop()


@pytest.mark.asyncio
async def test_vendor_invoices_valid_json():
    data = [{"InvdDesc": "Paper", "DeptCode": "FIN"}]
    patches = _patch_carmen(_mock_resp(json_data=data))
    for p in patches:
        p.start()
    try:
        assert await get_vendor_invoices("VN001", "tok") == data
    finally:
        for p in patches:
            p.stop()


@pytest.mark.asyncio
async def test_vendor_invoices_404_returns_empty_list():
    patches = _patch_carmen(_mock_resp(404))
    for p in patches:
        p.start()
    try:
        assert await get_vendor_invoices("VN001", "tok") == []
    finally:
        for p in patches:
            p.stop()


@pytest.mark.asyncio
async def test_vendor_invoices_500_raises():
    from app.services.carmen_service import CarmenAPIError

    patches = _patch_carmen(_mock_resp(500, b"Internal Server Error"))
    for p in patches:
        p.start()
    try:
        with pytest.raises(CarmenAPIError):
            await get_vendor_invoices("VN001", "tok")
    finally:
        for p in patches:
            p.stop()


# ── get_jv_by_source ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_jv_by_source_empty_body_returns_empty_list():
    patches = _patch_carmen(_mock_resp(200, b""))
    for p in patches:
        p.start()
    try:
        assert await get_jv_by_source("SRC001", "tok") == []
    finally:
        for p in patches:
            p.stop()


@pytest.mark.asyncio
async def test_jv_by_source_valid_json():
    data = [{"JvdDesc": "Transfer", "DeptCode": "ACC"}]
    patches = _patch_carmen(_mock_resp(json_data=data))
    for p in patches:
        p.start()
    try:
        assert await get_jv_by_source("SRC001", "tok") == data
    finally:
        for p in patches:
            p.stop()


# ── fetch_vendor_history ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_fetch_vendor_history_empty_body_graceful(ctx):
    from app.services.ap_vendor_history_service import _CACHE, fetch_vendor_history

    _CACHE.clear()
    patches = _patch_carmen(_mock_resp(200, b""))
    for p in patches:
        p.start()
    try:
        assert await fetch_vendor_history("VN001", "tok") == []
    finally:
        for p in patches:
            p.stop()


@pytest.mark.asyncio
async def test_fetch_vendor_history_invalid_json_graceful(ctx):
    from app.services.ap_vendor_history_service import _CACHE, fetch_vendor_history

    _CACHE.clear()
    resp = MagicMock()
    resp.status_code = 200
    resp.content = b"not-json"
    resp.text = "not-json"
    resp.json.side_effect = JSONDecodeError("Expecting value", "not-json", 0)
    patches = [
        patch(f"{SVC}._get_client", return_value=AsyncMock(get=AsyncMock(return_value=resp))),
        patch(f"{SVC}._base_url", return_value="http://fake"),
        patch(f"{SVC}._headers", return_value={}),
    ]
    for p in patches:
        p.start()
    try:
        assert await fetch_vendor_history("VN001", "tok") == []
    finally:
        for p in patches:
            p.stop()
