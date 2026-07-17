"""
Image pre-processing utilities: shrink, format-convert, and validate uploads
before they are sent to the vision LLM.
"""

import io
import os

from PIL import Image

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
    _HEIF_AVAILABLE = True
except ImportError:
    _HEIF_AVAILABLE = False


def resize_if_needed(
    image_bytes: bytes,
    max_dimension: int = 2200,
    jpeg_quality: int = 92,
) -> tuple[bytes, str]:
    """
    Shrink an image for faster upload/LLM processing without a visible quality loss.

    Returns (bytes, mime_type) — mime_type always reflects the ACTUAL bytes returned
    (never derived from the original filename, which the caller may still use for other
    purposes but must not use for the LLM's declared MIME type):

    - If the image already fits within max_dimension: bytes are returned byte-identical
      (no re-encode), mime_type is the Pillow-detected source format.
    - Otherwise: resized (LANCZOS) and re-encoded as JPEG at jpeg_quality, mime_type is
      always "image/jpeg". Alpha/palette-transparency is flattened onto a white
      background first (matches the light background of receipts/invoices) since JPEG
      has no alpha channel and a naive mode convert can leave transparent regions black.
      Mode is normalized BEFORE resizing, not after — Pillow silently drops to NEAREST
      resampling for P/1 mode images regardless of the requested filter.
    """
    img = Image.open(io.BytesIO(image_bytes))
    if max(img.size) <= max_dimension:
        return image_bytes, img.get_format_mimetype() or "image/jpeg"

    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        img = img.convert("RGBA")
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[-1])
        img = background
    elif img.mode not in ("L", "RGB", "CMYK"):
        img = img.convert("RGB")

    ratio = max_dimension / max(img.size)
    new_size = (int(img.width * ratio), int(img.height * ratio))
    img = img.resize(new_size, Image.Resampling.LANCZOS)
    output = io.BytesIO()
    img.save(output, format="JPEG", quality=jpeg_quality)
    return output.getvalue(), "image/jpeg"


def convert_heic_to_jpeg(raw_bytes: bytes) -> bytes:
    """Convert HEIC/HEIF image bytes to JPEG. Requires pillow-heif."""
    if not _HEIF_AVAILABLE:
        raise ValueError("HEIC support is not available. Install pillow-heif.")
    img = Image.open(io.BytesIO(raw_bytes))
    # JPEG supports only L, RGB, CMYK — convert everything else (RGBA, P, LA, …) to RGB.
    if img.mode not in ("L", "RGB", "CMYK"):
        img = img.convert("RGB")
    output = io.BytesIO()
    img.save(output, format="JPEG", quality=92)
    return output.getvalue()


def is_valid_image(filename: str) -> bool:
    """Check if the filename has a supported image extension."""
    valid_extensions = {
        ".jpg",
        ".jpeg",
        ".png",
        ".bmp",
        ".tiff",
        ".tif",
        ".webp",
        ".pdf",
        ".heic",
        ".heif",
    }
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

# HEIC/HEIF: ISO Base Media File Format — "ftyp" box at bytes 4-7,
# brand code at bytes 8-11. Common brands: heic, heix, hevc, mif1, msf1
_HEIF_BRANDS = {b"heic", b"heix", b"hevc", b"mif1", b"msf1", b"avif"}


def _is_heif(content: bytes) -> bool:
    """Return True if content is a HEIC/HEIF file."""
    return len(content) >= 12 and content[4:8] == b"ftyp" and content[8:12] in _HEIF_BRANDS


def validate_magic_bytes(content: bytes, filename: str) -> None:
    """
    Raise ValueError if file content doesn't match any known safe signature.
    Call this after reading the file to prevent disguised-file attacks.
    """
    if len(content) < 12:
        raise ValueError(f"File too small to determine type: {filename}")

    if _is_heif(content):
        return

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
