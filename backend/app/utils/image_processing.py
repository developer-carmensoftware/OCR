"""
Image pre-processing utilities.
Enhance receipt images before sending to OCR for better accuracy.
"""

import io
import os

from PIL import Image, ImageEnhance, ImageFilter


def preprocess_image(
    image_bytes: bytes,
    *,
    grayscale: bool = True,
    contrast_factor: float = 1.5,
    sharpness_factor: float = 2.0,
    denoise: bool = True,
    max_dimension: int = 4096,
) -> bytes:
    """
    Pre-process an image to improve OCR accuracy on receipts/invoices.

    Steps:
    1. Resize if too large (prevent OOM)
    2. Convert to grayscale (reduces noise for text detection)
    3. Enhance contrast (bank receipts are often faded)
    4. Sharpen (makes text edges crisper)
    5. Light denoise
    """
    img: Image.Image = Image.open(io.BytesIO(image_bytes))

    # ── 1. Resize if too large ──
    if max(img.size) > max_dimension:
        ratio = max_dimension / max(img.size)
        new_size = (int(img.width * ratio), int(img.height * ratio))
        img = img.resize(new_size, Image.Resampling.LANCZOS)

    # ── 2. Convert to grayscale ──
    if grayscale and img.mode != "L":
        img = img.convert("L")

    # ── 3. Enhance contrast ──
    if contrast_factor != 1.0:
        contrast_enhancer = ImageEnhance.Contrast(img)
        img = contrast_enhancer.enhance(contrast_factor)

    # ── 4. Sharpen ──
    if sharpness_factor != 1.0:
        sharpness_enhancer = ImageEnhance.Sharpness(img)
        img = sharpness_enhancer.enhance(sharpness_factor)

    # ── 5. Denoise ──
    if denoise:
        img = img.filter(ImageFilter.MedianFilter(size=3))

    # Convert back to bytes
    output = io.BytesIO()
    img.save(output, format="PNG", optimize=True)
    return output.getvalue()


def resize_if_needed(image_bytes: bytes, max_dimension: int = 4096) -> bytes:
    """
    Returns original bytes unchanged if the image already fits within max_dimension.
    Only decodes and re-encodes when a resize is actually required, avoiding the
    JPEG→PNG size inflation that preprocess_image caused on every non-PDF file.
    """
    img = Image.open(io.BytesIO(image_bytes))
    if max(img.size) <= max_dimension:
        return image_bytes
    ratio = max_dimension / max(img.size)
    new_size = (int(img.width * ratio), int(img.height * ratio))
    img = img.resize(new_size, Image.Resampling.LANCZOS)
    output = io.BytesIO()
    img.save(output, format="PNG")
    return output.getvalue()


def is_valid_image(filename: str) -> bool:
    """Check if the filename has a supported image extension."""
    valid_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp", ".pdf"}
    ext = os.path.splitext(filename)[1].lower()
    return ext in valid_extensions


# (offset, bytes_to_match) — first match wins
_MAGIC_SIGNATURES: list[tuple[int, bytes]] = [
    (0, b"\xff\xd8\xff"),  # JPEG
    (0, b"\x89PNG\r\n\x1a\n"),  # PNG
    (0, b"%PDF"),  # PDF
    (0, b"BM"),  # BMP
    (0, b"II\x2a\x00"),  # TIFF little-endian
    (0, b"MM\x00\x2a"),  # TIFF big-endian
    (0, b"GIF8"),  # GIF
]
# WebP needs two separate checks (RIFF header + WEBP marker at offset 8)
_WEBP_RIFF = b"RIFF"
_WEBP_MARK = b"WEBP"


def validate_magic_bytes(content: bytes, filename: str) -> None:
    """
    Raise ValueError if file content doesn't match any known safe signature.
    Call this after reading the file to prevent disguised-file attacks.
    """
    if len(content) < 12:
        raise ValueError(f"File too small to determine type: {filename}")

    # WebP: bytes 0-3 == RIFF and bytes 8-11 == WEBP
    if content[:4] == _WEBP_RIFF and content[8:12] == _WEBP_MARK:
        return

    for offset, sig in _MAGIC_SIGNATURES:
        if content[offset : offset + len(sig)] == sig:
            return

    raise ValueError(
        f"File content does not match a supported format: {filename}. "
        "Uploading disguised files is not allowed."
    )
