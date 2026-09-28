import logging
import os

from fastapi import UploadFile

from app.config import settings
from app.exceptions import FileTooLargeError, ValidationError
from app.utils.image_processing import convert_heic_to_jpeg, is_valid_image, validate_magic_bytes

logger = logging.getLogger(__name__)

# Read in 1MB chunks so we can abort before loading a 200MB upload bomb into memory.
_READ_CHUNK_SIZE = 1024 * 1024

_HEIC_EXTENSIONS = {".heic", ".heif"}


class FileService:
    """
    Centralized service for file validation and handling.
    Implements security checks for file size and types.
    """

    @staticmethod
    async def validate_and_read(file: UploadFile) -> tuple[bytes, str]:
        """
        Validates file type and size, then reads into memory.
        Returns (content_bytes, effective_filename) — HEIC files are converted
        to JPEG and the filename is updated to .jpg accordingly.
        Raises ValidationError / FileTooLargeError on failure.

        Reads the upload in chunks so we abort early on oversize files instead
        of loading the whole body into RAM before checking size. This prevents
        a malicious or buggy client from OOM-ing the worker by sending a 1GB
        body while declaring max-allowed size in the headers.
        """
        filename = file.filename
        if not filename:
            raise ValidationError("Invalid filename")

        # 1. Type Validation (Extension)
        if not is_valid_image(filename):
            raise ValidationError(
                f"Unsupported file type: {filename} (Supported: JPG, PNG, PDF, WebP, HEIC)"
            )

        max_bytes = settings.max_file_size_mb * 1024 * 1024

        # 2. Streamed size enforcement — abort as soon as we cross the limit.
        chunks: list[bytes] = []
        total = 0
        while True:
            chunk = await file.read(_READ_CHUNK_SIZE)
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                logger.warning("File size limit exceeded: %s (%d+ bytes)", filename, total)
                # Stop draining — release the connection and reject.
                raise FileTooLargeError(
                    f"File {filename} is too large (Limit {settings.max_file_size_mb}MB)"
                )
            chunks.append(chunk)

        if total == 0:
            raise ValidationError(f"File {filename} is empty (Empty file)")

        content = b"".join(chunks)

        # 3. Magic bytes check — reject disguised files (e.g. .exe renamed to .jpg).
        try:
            validate_magic_bytes(content, filename)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

        # 4. HEIC → JPEG conversion (server-side; browser cannot render HEIC).
        ext = os.path.splitext(filename)[1].lower()
        if ext in _HEIC_EXTENSIONS:
            try:
                content = convert_heic_to_jpeg(content)
                stem = os.path.splitext(filename)[0]
                filename = f"{stem}.jpg"
            except Exception as exc:
                raise ValidationError(f"Failed to convert HEIC file: {exc}") from exc

        return content, filename

    @staticmethod
    def get_filenames_string(files: list[UploadFile]) -> str:
        """Helper to get a comma-separated string of filenames."""
        return ", ".join(f.filename for f in files if f.filename is not None)


file_service = FileService()
