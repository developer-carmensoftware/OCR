"""
Unit tests for app/utils/image_processing.resize_if_needed.

Builds test images in memory with Pillow (no fixtures on disk), covering the
passthrough path (unchanged bytes + Pillow-detected mime) and the resize path
(always re-encoded to JPEG, with mode-normalization for alpha/palette/CMYK
inputs that would otherwise crash a JPEG save).
"""

import io

import pytest
from PIL import Image

from app.utils.image_processing import resize_if_needed


def _encode(mode: str, size: tuple[int, int], fmt: str, color=0, **save_kwargs) -> bytes:
    img = Image.new(mode, size, color)
    buf = io.BytesIO()
    img.save(buf, format=fmt, **save_kwargs)
    return buf.getvalue()


def test_rgb_jpeg_under_threshold_passthrough():
    original = _encode("RGB", (800, 600), "JPEG", color=(200, 200, 200))
    result_bytes, mime = resize_if_needed(original)
    assert result_bytes == original
    assert mime == "image/jpeg"


def test_rgb_jpeg_over_threshold_resizes_to_jpeg():
    original = _encode("RGB", (3000, 2000), "JPEG", color=(200, 200, 200))
    result_bytes, mime = resize_if_needed(original)
    assert mime == "image/jpeg"
    out = Image.open(io.BytesIO(result_bytes))
    assert out.format == "JPEG"
    assert max(out.size) <= 2200


def test_rgba_png_under_threshold_passthrough_keeps_png_mime():
    original = _encode("RGBA", (800, 600), "PNG", color=(200, 200, 200, 255))
    result_bytes, mime = resize_if_needed(original)
    assert result_bytes == original
    assert mime == "image/png"


def test_rgba_png_over_threshold_does_not_crash():
    original = _encode("RGBA", (3000, 2000), "PNG", color=(200, 200, 200, 255))
    result_bytes, mime = resize_if_needed(original)
    assert mime == "image/jpeg"
    out = Image.open(io.BytesIO(result_bytes))
    assert out.format == "JPEG"
    assert out.mode == "RGB"
    assert max(out.size) <= 2200


def test_cmyk_tiff_over_threshold_does_not_crash():
    original = _encode("CMYK", (3000, 2000), "TIFF")
    result_bytes, mime = resize_if_needed(original)
    assert mime == "image/jpeg"
    out = Image.open(io.BytesIO(result_bytes))
    assert out.format == "JPEG"


def test_webp_with_alpha_over_threshold_does_not_crash():
    original = _encode("RGBA", (3000, 2000), "WEBP", color=(200, 200, 200, 255))
    result_bytes, mime = resize_if_needed(original)
    assert mime == "image/jpeg"
    out = Image.open(io.BytesIO(result_bytes))
    assert out.format == "JPEG"
    assert out.mode == "RGB"


def test_bmp_over_threshold_does_not_crash():
    original = _encode("RGB", (3000, 2000), "BMP", color=(200, 200, 200))
    result_bytes, mime = resize_if_needed(original)
    assert mime == "image/jpeg"
    out = Image.open(io.BytesIO(result_bytes))
    assert out.format == "JPEG"


def test_16bit_grayscale_tiff_over_threshold_does_not_crash():
    original = _encode("I;16", (3000, 2000), "TIFF", color=1000)
    result_bytes, mime = resize_if_needed(original)
    assert mime == "image/jpeg"
    out = Image.open(io.BytesIO(result_bytes))
    assert out.format == "JPEG"


def test_transparent_region_composites_to_white_not_source_color():
    # Underlying RGB is saturated red; alpha is fully transparent. A naive
    # `.convert("RGB")` would keep the red channel; white-compositing must not.
    img = Image.new("RGBA", (3000, 2000), (255, 0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    original = buf.getvalue()

    result_bytes, mime = resize_if_needed(original)
    assert mime == "image/jpeg"
    out = Image.open(io.BytesIO(result_bytes)).convert("RGB")
    r, g, b = out.getpixel((out.width // 2, out.height // 2))
    assert r > 240 and g > 240 and b > 240


def test_boundary_exactly_at_max_dimension_passes_through():
    original = _encode("RGB", (2200, 1500), "JPEG", color=(200, 200, 200))
    result_bytes, mime = resize_if_needed(original)
    assert result_bytes == original
    assert mime == "image/jpeg"


def test_mime_matches_actual_returned_bytes_format():
    cases = [
        _encode("RGB", (800, 600), "JPEG", color=(200, 200, 200)),
        _encode("RGB", (3000, 2000), "PNG", color=(200, 200, 200)),
    ]
    for original in cases:
        result_bytes, mime = resize_if_needed(original)
        out = Image.open(io.BytesIO(result_bytes))
        expected_mime = {"JPEG": "image/jpeg", "PNG": "image/png"}[out.format]
        assert mime == expected_mime


def test_max_dimension_override_is_honored():
    original = _encode("RGB", (500, 400), "JPEG", color=(200, 200, 200))
    result_bytes, mime = resize_if_needed(original, max_dimension=300)
    out = Image.open(io.BytesIO(result_bytes))
    assert out.format == "JPEG"
    assert max(out.size) <= 300


def test_jpeg_quality_override_changes_output_size():
    original = _encode("RGB", (3000, 2000), "JPEG", color=(120, 140, 160))
    low_q, _ = resize_if_needed(original, jpeg_quality=40)
    high_q, _ = resize_if_needed(original, jpeg_quality=95)
    assert len(low_q) < len(high_q)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
