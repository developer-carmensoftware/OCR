"""
File utilities router — stateless helpers that don't touch the DB.
"""

import asyncio
import base64
import functools
import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.auth import SessionInfo, get_current_session
from app.models.schemas.files import FilePreviewResponse, PdfInfoResponse
from app.services.file_service import file_service
from app.utils.pdf_utils import (
    PDF_RENDER_TIMEOUT_SECONDS,
    get_pdf_page_count,
    render_pdf_thumbnails,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/files", tags=["Files"])


@router.post("/pdf-info", response_model=PdfInfoResponse)
async def get_pdf_info(
    file: UploadFile = File(...),
    _session: SessionInfo = Depends(get_current_session),
) -> PdfInfoResponse:
    """Return page count + low-resolution thumbnails for a PDF.

    Used by the frontend to render the page-selector UI before calling /extract.
    The file is read into memory and discarded — nothing is persisted to disk.
    """
    filename = file.filename or ""
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported by this endpoint")

    file_bytes, _ = await file_service.validate_and_read(file)

    loop = asyncio.get_running_loop()

    page_count = await loop.run_in_executor(None, get_pdf_page_count, file_bytes)

    try:
        raw_thumbnails: list[bytes] = await asyncio.wait_for(
            loop.run_in_executor(None, functools.partial(render_pdf_thumbnails, file_bytes)),
            timeout=PDF_RENDER_TIMEOUT_SECONDS,
        )
    except TimeoutError as exc:
        raise HTTPException(
            status_code=422, detail="PDF rendering timed out — the file may be malformed."
        ) from exc

    thumbnails = [f"data:image/png;base64,{base64.b64encode(t).decode()}" for t in raw_thumbnails]

    return PdfInfoResponse(page_count=page_count, thumbnails=thumbnails)


@router.post("/preview", response_model=FilePreviewResponse)
async def get_file_preview(
    file: UploadFile = File(...),
    _session: SessionInfo = Depends(get_current_session),
) -> FilePreviewResponse:
    """Return a browser-renderable data URL for an image file.

    Exists for formats the browser can't decode in <img> (notably HEIC/HEIF):
    validate_and_read transparently converts HEIC -> JPEG, so the bytes we hand
    back are always renderable. Read into memory and discarded — never persisted.
    """
    filename = (file.filename or "").lower()
    if filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Use /pdf-info for PDF files, not /preview")

    # validate_and_read returns the (possibly converted) bytes + normalized name.
    file_bytes, out_name = await file_service.validate_and_read(file)

    # After conversion the extension is .jpg for HEIC; otherwise pass-through.
    ext = out_name.lower().rsplit(".", 1)[-1] if "." in out_name else "jpeg"
    mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"

    data_url = f"data:{mime};base64,{base64.b64encode(file_bytes).decode()}"
    return FilePreviewResponse(data_url=data_url)
