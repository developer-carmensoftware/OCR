import logging

from fastapi import HTTPException, UploadFile

from app.config import settings
from app.utils.image_processing import is_valid_image, validate_magic_bytes

logger = logging.getLogger(__name__)


class FileService:
    """
    Centralized service for file validation and handling.
    Implements security checks for file size and types.
    """

    ALLOWED_EXTENSIONS: set[str] = {".jpg", ".jpeg", ".png", ".pdf", ".webp"}

    @staticmethod
    async def validate_and_read(file: UploadFile) -> bytes:
        """
        Validates file type and size, then reads into memory.
        Raises HTTPException on failure.
        """
        # 1. Type Validation (Extension)
        if not is_valid_image(file.filename):
            raise HTTPException(
                status_code=400,
                detail=f"ประเภทไฟล์ไม่รองรับ: {file.filename} (รองรับ JPG, PNG, PDF, WebP)",
            )

        # 2. Size Validation
        # Max size from settings (default 10MB)
        max_bytes = settings.max_file_size_mb * 1024 * 1024

        # We need to read it to check size if the content-length header is missing/unreliable
        content = await file.read()
        file_size = len(content)

        # Magic bytes check — reject disguised files (e.g. .exe renamed to .jpg)
        try:
            validate_magic_bytes(content, file.filename)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        if file_size > max_bytes:
            logger.warning(f"File size limit exceeded: {file.filename} ({file_size} bytes)")
            raise HTTPException(
                status_code=400,
                detail=f"ไฟล์ {file.filename} มีขนาดใหญ่เกินไป (จำกัด {settings.max_file_size_mb}MB)",
            )

        if file_size == 0:
            raise HTTPException(status_code=400, detail=f"ไฟล์ {file.filename} ไม่มีข้อมูล (Empty file)")

        return content

    @staticmethod
    def get_filenames_string(files: list[UploadFile]) -> str:
        """Helper to get a comma-separated string of filenames."""
        return ", ".join(f.filename for f in files)


file_service = FileService()
