import os

_MIME_MAP = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
    ".heic": "image/heic",
    ".heif": "image/heif",
}


def get_mime_type(filename: str) -> str:
    ext = os.path.splitext(filename or "")[1].lower()
    return _MIME_MAP.get(ext, "image/jpeg")
