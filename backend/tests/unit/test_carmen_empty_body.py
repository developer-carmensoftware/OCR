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


def _patch_carmen(resp, method="get"):
    """Patch get_http_client + _base_url + _headers so we skip context vars."""
    client = AsyncMock()
    getattr(client, method).return_value = resp
    return [
        patch(f"{SVC}.get_http_client", return_value=client),
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


# ── post_input_tax ──────────────────────────────────────────────────────────
#
# A rejection with a JSON body used to be handed back as if it were the created record,
# so the wizard toasted "Input Tax added" over a document Carmen never filed.


@pytest.mark.asyncio
async def test_post_input_tax_rejection_with_json_body_raises():
    from app.services.carmen_service import CarmenAPIError, post_input_tax

    patches = _patch_carmen(
        _mock_resp(400, json_data={"Code": -1, "UserMessage": "TaxId required"}), method="post"
    )
    for p in patches:
        p.start()
    try:
        with pytest.raises(CarmenAPIError):
            await post_input_tax({"TaxId": ""}, "tok")
    finally:
        for p in patches:
            p.stop()


# ── every write call, not just post_input_tax ────────────────────────────────
#
# post_input_tax was fixed for the JSON-body rejection alone. Its four siblings kept
# `return resp.json()` without ever reading the status, so on 2026-08-28 a 401 answered
# with `{"Message": "Authorization has been denied…"}` reached email_ingest_service as an
# ordinary result with no `Code`, and three documents were filed as "Carmen rejected the
# JV" when the BU's posting token was simply dead. Reverting `_json_or_raise` fails here.


@pytest.mark.asyncio
@pytest.mark.parametrize("call", ["post_gljv", "put_gljv", "post_invoice", "put_input_tax"])
async def test_write_calls_raise_on_401_with_json_body(call):
    import app.services.carmen_service as svc

    resp = _mock_resp(401, json_data={"Message": "Authorization has been denied for this request."})
    resp.text = '{"Message": "Authorization has been denied for this request."}'
    patches = _patch_carmen(resp, method="put" if call.startswith("put") else "post")
    for p in patches:
        p.start()
    try:
        args = (1, {}, "tok") if call.startswith("put") else ({}, "tok")
        with pytest.raises(svc.CarmenAPIError) as exc:
            await getattr(svc, call)(*args)
        assert exc.value.status_code == 401
        # The status must survive into the message — it is what tells a reader to go fix
        # the credential instead of the document.
        assert "401" in str(exc.value)
    finally:
        for p in patches:
            p.stop()


@pytest.mark.asyncio
async def test_post_input_tax_success_returns_body():
    from app.services.carmen_service import post_input_tax

    data = {"Code": 0, "InternalMessage": "42"}
    patches = _patch_carmen(_mock_resp(json_data=data), method="post")
    for p in patches:
        p.start()
    try:
        assert await post_input_tax({"TaxId": "0107536000315"}, "tok") == data
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
        patch(f"{SVC}.get_http_client", return_value=AsyncMock(get=AsyncMock(return_value=resp))),
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
