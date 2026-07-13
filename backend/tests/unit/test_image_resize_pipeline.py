"""
Service-level regression tests for the image resize/mime pipeline.

test_ocr_router.py / test_ap_invoice_router.py mock the service layer entirely
(ocr_service.extract_stateless / ap_invoice_service.extract_ap_invoice_data), so a
wiring bug in the resize_if_needed -> extract_from_image mime hand-off (forgetting to
unpack the tuple, forgetting to thread image_mime_type through) would pass every
existing test while being broken in production. These tests call the real service
functions and mock only the actual network boundary (call_vision_llm), so the mime
construction genuinely executes and the declared mime is checked against the actual
re-encoded bytes.
"""

import base64
import io
from unittest.mock import AsyncMock, patch

from PIL import Image

from app.services import ap_invoice_service, ocr_service


def _encode(mode: str, size: tuple[int, int], fmt: str, color=(200, 200, 200), **kw) -> bytes:
    img = Image.new(mode, size, color)
    buf = io.BytesIO()
    img.save(buf, format=fmt, **kw)
    return buf.getvalue()


def _data_url_parts(call_args) -> tuple[str, bytes]:
    """Extract (declared_mime, decoded_bytes) from the first image_url in user_content."""
    user_content = call_args.kwargs["user_content"]
    url = next(item["image_url"]["url"] for item in user_content if item["type"] == "image_url")
    header, b64 = url.split(",", 1)
    mime = header.removeprefix("data:").removesuffix(";base64")
    return mime, base64.b64decode(b64)


# ── Credit Card OCR ─────────────────────────────────────────────────────────────


@patch("app.services.llm_service.call_vision_llm", new_callable=AsyncMock)
async def test_credit_card_oversized_rgba_png_resized_and_mime_matches_bytes(mock_call):
    mock_call.return_value = "{}"
    original = _encode("RGBA", (3000, 2000), "PNG", color=(200, 200, 200, 255))

    await ocr_service.extract_stateless(original, "photo.png", task_id="t1")

    mime, decoded = _data_url_parts(mock_call.call_args)
    assert mime == "image/jpeg"
    out = Image.open(io.BytesIO(decoded))
    assert out.format == "JPEG"
    assert max(out.size) <= 2200


@patch("app.services.llm_service.call_vision_llm", new_callable=AsyncMock)
async def test_credit_card_small_jpeg_passthrough_unchanged(mock_call):
    mock_call.return_value = "{}"
    original = _encode("RGB", (800, 600), "JPEG")

    await ocr_service.extract_stateless(original, "photo.jpg", task_id="t1")

    mime, decoded = _data_url_parts(mock_call.call_args)
    assert mime == "image/jpeg"
    assert decoded == original


# ── AP Invoice ───────────────────────────────────────────────────────────────────


@patch("app.services.ap_invoice_service.postprocess_ap_invoice", side_effect=lambda d: d)
@patch("app.services.ap_invoice_service.call_vision_llm", new_callable=AsyncMock)
async def test_ap_invoice_oversized_jpeg_resized_and_mime_matches_bytes(mock_call, _mock_post):
    mock_call.return_value = "{}"
    original = _encode("RGB", (3000, 2000), "JPEG")

    await ap_invoice_service.extract_ap_invoice_data(original, "invoice.jpg", task_id="t1")

    mime, decoded = _data_url_parts(mock_call.call_args)
    assert mime == "image/jpeg"
    out = Image.open(io.BytesIO(decoded))
    assert out.format == "JPEG"
    assert max(out.size) <= 2200


@patch("app.services.ap_invoice_service.postprocess_ap_invoice", side_effect=lambda d: d)
@patch("app.services.ap_invoice_service.call_vision_llm", new_callable=AsyncMock)
async def test_ap_invoice_small_png_passthrough_unchanged(mock_call, _mock_post):
    mock_call.return_value = "{}"
    original = _encode("RGB", (800, 600), "PNG")

    await ap_invoice_service.extract_ap_invoice_data(original, "invoice.png", task_id="t1")

    mime, decoded = _data_url_parts(mock_call.call_args)
    assert mime == "image/png"
    assert decoded == original
