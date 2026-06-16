"""
Unit tests for encrypted-PDF handling in app/utils/pdf_utils.

Builds encrypted PDFs in memory with PyMuPDF (no fixtures on disk, no network)
and asserts the typed-exception contract that the password flow relies on:

  - locked PDF without / with wrong password  → PdfPasswordRequired (→ 400)
  - locked PDF with the correct password       → reads normally
  - owner-password-only PDF (no user password) → opens transparently
  - corrupt bytes                              → ExtractionError (→ 422)

`ensure_pdf_openable` is the pre-credit gate used by the /extract routers, so a
locked file fails before a document credit is consumed.
"""

import asyncio

import fitz
import pytest

from app.exceptions import ExtractionError, PdfPasswordRequired
from app.utils.pdf_utils import ensure_pdf_openable, get_pdf_page_count, open_pdf

_ENC = fitz.PDF_ENCRYPT_AES_256


def _make_pdf(pages: int = 1, user_pw: str = "secret", owner_pw: str = "owner") -> bytes:
    """A `pages`-page PDF encrypted with the given passwords."""
    doc = fitz.open()
    for _ in range(pages):
        doc.new_page()
    buf = doc.tobytes(encryption=_ENC, owner_pw=owner_pw, user_pw=user_pw)
    doc.close()
    return buf


# ── open_pdf / get_pdf_page_count ─────────────────────────────────────────────


def test_open_pdf_no_password_raises():
    with pytest.raises(PdfPasswordRequired):
        open_pdf(_make_pdf())


def test_open_pdf_wrong_password_raises():
    with pytest.raises(PdfPasswordRequired):
        open_pdf(_make_pdf(), password="wrong")


def test_open_pdf_correct_password_reads():
    doc = open_pdf(_make_pdf(pages=3), password="secret")
    try:
        assert doc.page_count == 3
    finally:
        doc.close()


def test_get_pdf_page_count_correct_password():
    assert get_pdf_page_count(_make_pdf(pages=2), password="secret") == 2


def test_owner_only_pdf_opens_without_password():
    # Restricts editing/printing but has no user password — must open with no prompt.
    buf = _make_pdf(pages=1, user_pw="", owner_pw="owneronly")
    assert get_pdf_page_count(buf) == 1


def test_corrupt_bytes_raise_extraction_error():
    with pytest.raises(ExtractionError):
        get_pdf_page_count(b"%PDF-1.4 this is not a real pdf")


def test_pdf_password_required_carries_code():
    # The frontend keys off this machine-readable code to show the password prompt.
    assert PdfPasswordRequired.code == "pdf_password_required"


# ── ensure_pdf_openable (pre-credit gate) ─────────────────────────────────────


def test_ensure_pdf_openable_noop_for_non_pdf():
    # No raise even for nonsense bytes when the filename isn't a PDF.
    asyncio.run(ensure_pdf_openable(b"\xff\xd8\xff garbage", "receipt.jpg"))


def test_ensure_pdf_openable_raises_for_locked_pdf():
    with pytest.raises(PdfPasswordRequired):
        asyncio.run(ensure_pdf_openable(_make_pdf(), "statement.pdf"))


def test_ensure_pdf_openable_passes_with_correct_password():
    # Resolves (no raise) → the router proceeds to consume a credit.
    asyncio.run(ensure_pdf_openable(_make_pdf(), "statement.PDF", password="secret"))
