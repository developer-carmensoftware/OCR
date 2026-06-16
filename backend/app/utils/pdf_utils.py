"""
PDF utilities: page counting, rendering pages to PNG, and thumbnail generation.
Uses PyMuPDF (fitz) — must be installed via: pip install pymupdf

Hardened against malicious PDFs: rendering DPI and output pixmap dimensions are
clamped, and the number of pages rendered per call is capped, so a crafted PDF
(huge mediabox / thousands of pages) cannot exhaust worker memory/CPU. Callers
should additionally wrap the (blocking) render in an asyncio timeout.
"""

import asyncio
import functools

import fitz  # PyMuPDF

from app.exceptions import ExtractionError, PdfPasswordRequired

MAX_PAGES_PER_CALL = 10
# Upper bounds for rasterisation. A malicious PDF can declare an enormous page
# size; without clamping, get_pixmap() would allocate width*height*3 bytes and
# OOM the worker. Cap both the DPI and the absolute pixel dimensions.
MAX_RENDER_DPI = 300
MAX_PIXMAP_DIM = 5000  # px per side
# Thumbnails render every page; cap so a many-thousand-page PDF can't stall a worker.
MAX_THUMBNAIL_PAGES = 30
# Suggested ceiling for callers wrapping the blocking render in asyncio.wait_for.
PDF_RENDER_TIMEOUT_SECONDS = 30.0


def open_pdf(pdf_bytes: bytes, password: str | None = None) -> "fitz.Document":
    """Open a PDF, raising typed exceptions instead of leaking PyMuPDF errors.

    - Corrupted / unreadable bytes → ExtractionError (→ 422).
    - Encrypted PDF without the correct password → PdfPasswordRequired (→ 400).
      PyMuPDF auto-authenticates an empty password on open, so PDFs carrying only
      an owner password (restrict editing/printing, but open freely) are read
      transparently; only a real user password triggers the prompt.

    The caller owns the returned document and must close() it.
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise ExtractionError("Unable to read PDF — the file may be corrupted.") from exc
    if doc.needs_pass:
        if not doc.authenticate(password or ""):
            doc.close()
            raise PdfPasswordRequired()
    return doc


def get_pdf_page_count(pdf_bytes: bytes, password: str | None = None) -> int:
    """Return the number of pages in the PDF."""
    doc = open_pdf(pdf_bytes, password)
    try:
        return doc.page_count
    finally:
        doc.close()


def _clamped_matrix(page: "fitz.Page", dpi: int) -> "fitz.Matrix":
    """Build a render matrix whose output stays within MAX_PIXMAP_DIM per side."""
    dpi = max(1, min(dpi, MAX_RENDER_DPI))
    scale = dpi / 72
    rect = page.rect
    width = max(1.0, rect.width)
    height = max(1.0, rect.height)
    longest = max(width, height) * scale
    if longest > MAX_PIXMAP_DIM:
        scale *= MAX_PIXMAP_DIM / longest
    return fitz.Matrix(scale, scale)


def render_pdf_pages(
    pdf_bytes: bytes,
    page_indices: list[int],
    dpi: int = 200,
    password: str | None = None,
) -> list[bytes]:
    """
    Render specified pages (0-based indices) of a PDF to PNG bytes.
    Returns a list of PNG bytes in the same order as page_indices.
    At most MAX_PAGES_PER_CALL pages are rendered regardless of input length.
    """
    doc = open_pdf(pdf_bytes, password)
    try:
        results: list[bytes] = []
        for idx in page_indices[:MAX_PAGES_PER_CALL]:
            if idx < 0 or idx >= doc.page_count:
                continue
            page = doc[idx]
            pixmap = page.get_pixmap(matrix=_clamped_matrix(page, dpi), alpha=False)
            results.append(pixmap.tobytes("png"))
        return results
    finally:
        doc.close()


def extract_pages_as_pdf(
    pdf_bytes: bytes,
    page_indices: list[int],
    password: str | None = None,
) -> bytes:
    """
    Build a new PDF containing only the given 0-based pages, preserving the
    source's native vector/text fidelity (NO rasterisation).

    This is the high-quality path for page selection: the vision LLM receives a
    real PDF (application/pdf) — identical in fidelity to sending the original
    document — instead of a rasterised PNG that degrades dense tables. Pages are
    kept in the requested order, de-duplicated, bounds-checked, and capped at
    MAX_PAGES_PER_CALL. Encrypted PDFs are unlocked then saved decrypted.
    """
    src = open_pdf(pdf_bytes, password)
    try:
        seen: set[int] = set()
        keep: list[int] = []
        for idx in page_indices:
            if 0 <= idx < src.page_count and idx not in seen:
                seen.add(idx)
                keep.append(idx)
            if len(keep) >= MAX_PAGES_PER_CALL:
                break
        if not keep:
            keep = list(range(min(src.page_count, MAX_PAGES_PER_CALL)))
        src.select(keep)
        return src.tobytes(garbage=3, deflate=True)
    finally:
        src.close()


def normalize_pdf_for_llm(pdf_bytes: bytes, password: str | None = None) -> bytes:
    """Return PDF bytes safe to send to the vision LLM, decrypting only if needed.

    Gemini's PDF parser rejects encrypted documents with "The document has no pages."
    PyMuPDF clears ``is_encrypted`` *after* a successful ``authenticate()``, so we
    must sample the flag before authenticating. Unencrypted PDFs return the original
    object untouched to preserve the proven native-fidelity passthrough.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        if not doc.is_encrypted:  # ponytail: fast-path, no re-save needed
            return pdf_bytes
        if not doc.authenticate(password or ""):
            raise PdfPasswordRequired()
        return doc.tobytes(garbage=3, deflate=True)
    finally:
        doc.close()


def render_pdf_thumbnails(
    pdf_bytes: bytes,
    max_width: int = 300,
    password: str | None = None,
) -> list[bytes]:
    """
    Render pages of a PDF at low resolution for UI thumbnail display.
    Returns list of PNG bytes (one per page), capped at MAX_THUMBNAIL_PAGES.
    """
    max_width = max(1, min(max_width, MAX_PIXMAP_DIM))
    doc = open_pdf(pdf_bytes, password)
    try:
        thumbnails: list[bytes] = []
        for page in doc:
            if len(thumbnails) >= MAX_THUMBNAIL_PAGES:
                break
            # Scale to fit max_width (guard against zero-width pages).
            scale = max_width / max(1.0, page.rect.width)
            pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
            thumbnails.append(pixmap.tobytes("png"))
        return thumbnails
    finally:
        doc.close()


async def ensure_pdf_openable(
    file_bytes: bytes, filename: str, password: str | None = None
) -> None:
    """For a PDF file, open it once off-thread so an encrypted/corrupt PDF raises
    PdfPasswordRequired / ExtractionError *before* the caller commits side effects
    (e.g. consuming a document credit). No-op for non-PDF files."""
    if not filename.lower().endswith(".pdf"):
        return
    await asyncio.get_running_loop().run_in_executor(
        None, functools.partial(get_pdf_page_count, file_bytes, password)
    )
