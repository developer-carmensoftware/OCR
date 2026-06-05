"""
PDF utilities: page counting, rendering pages to PNG, and thumbnail generation.
Uses PyMuPDF (fitz) — must be installed via: pip install pymupdf
"""

import fitz  # PyMuPDF

MAX_PAGES_PER_CALL = 10


def get_pdf_page_count(pdf_bytes: bytes) -> int:
    """Return the number of pages in the PDF."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        return doc.page_count
    finally:
        doc.close()


def render_pdf_pages(
    pdf_bytes: bytes,
    page_indices: list[int],
    dpi: int = 200,
) -> list[bytes]:
    """
    Render specified pages (0-based indices) of a PDF to PNG bytes.
    Returns a list of PNG bytes in the same order as page_indices.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        results: list[bytes] = []
        matrix = fitz.Matrix(dpi / 72, dpi / 72)
        for idx in page_indices:
            if idx < 0 or idx >= doc.page_count:
                continue
            page = doc[idx]
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            results.append(pixmap.tobytes("png"))
        return results
    finally:
        doc.close()


def render_pdf_thumbnails(
    pdf_bytes: bytes,
    max_width: int = 300,
) -> list[bytes]:
    """
    Render all pages of a PDF at low resolution for UI thumbnail display.
    Returns list of PNG bytes (one per page).
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        thumbnails: list[bytes] = []
        for page in doc:
            # Scale to fit max_width
            scale = max_width / page.rect.width
            matrix = fitz.Matrix(scale, scale)
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            thumbnails.append(pixmap.tobytes("png"))
        return thumbnails
    finally:
        doc.close()
