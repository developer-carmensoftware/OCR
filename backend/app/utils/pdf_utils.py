"""
PDF utilities: page counting, rendering pages to PNG, and thumbnail generation.
Uses PyMuPDF (fitz) — must be installed via: pip install pymupdf

Hardened against malicious PDFs: rendering DPI and output pixmap dimensions are
clamped, and the number of pages rendered per call is capped, so a crafted PDF
(huge mediabox / thousands of pages) cannot exhaust worker memory/CPU. Callers
should additionally wrap the (blocking) render in an asyncio timeout.
"""

import fitz  # PyMuPDF

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


def get_pdf_page_count(pdf_bytes: bytes) -> int:
    """Return the number of pages in the PDF."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
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
) -> list[bytes]:
    """
    Render specified pages (0-based indices) of a PDF to PNG bytes.
    Returns a list of PNG bytes in the same order as page_indices.
    At most MAX_PAGES_PER_CALL pages are rendered regardless of input length.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
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


def render_pdf_thumbnails(
    pdf_bytes: bytes,
    max_width: int = 300,
) -> list[bytes]:
    """
    Render pages of a PDF at low resolution for UI thumbnail display.
    Returns list of PNG bytes (one per page), capped at MAX_THUMBNAIL_PAGES.
    """
    max_width = max(1, min(max_width, MAX_PIXMAP_DIM))
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
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
