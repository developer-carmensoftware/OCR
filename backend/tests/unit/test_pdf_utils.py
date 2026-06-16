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
from app.utils.pdf_utils import (
    ensure_pdf_openable,
    extract_pages_as_pdf,
    get_pdf_page_count,
    normalize_pdf_for_llm,
    open_pdf,
)

_ENC = fitz.PDF_ENCRYPT_AES_256


def _make_pdf(pages: int = 1, user_pw: str = "secret", owner_pw: str = "owner") -> bytes:
    """A `pages`-page PDF encrypted with the given passwords."""
    doc = fitz.open()
    for _ in range(pages):
        doc.new_page()
    buf = doc.tobytes(encryption=_ENC, owner_pw=owner_pw, user_pw=user_pw)
    doc.close()
    return buf


def _make_text_pdf(n: int = 4) -> bytes:
    """An unencrypted `n`-page PDF whose pages carry identifiable text."""
    doc = fitz.open()
    for i in range(n):
        page = doc.new_page()
        page.insert_text((72, 72), f"PAGE {i} content")
    buf = doc.tobytes()
    doc.close()
    return buf


def _page_texts(pdf_bytes: bytes) -> list[str]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        return [doc[i].get_text().strip() for i in range(doc.page_count)]
    finally:
        doc.close()


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


# ── extract_pages_as_pdf (native page-subset for the high-quality preview/LLM path) ──


def test_extract_pages_as_pdf_selects_single_page_and_keeps_text():
    out = extract_pages_as_pdf(_make_text_pdf(4), [1])
    assert out[:4] == b"%PDF"
    assert get_pdf_page_count(out) == 1
    # Native subset, NOT rasterised → the text layer survives.
    assert _page_texts(out) == ["PAGE 1 content"]


def test_extract_pages_as_pdf_preserves_order_dedupes_and_drops_out_of_range():
    out = extract_pages_as_pdf(_make_text_pdf(4), [2, 2, 9, 0])
    assert _page_texts(out) == ["PAGE 2 content", "PAGE 0 content"]


def test_extract_pages_as_pdf_empty_selection_returns_all_pages():
    out = extract_pages_as_pdf(_make_text_pdf(3), [])
    assert get_pdf_page_count(out) == 3


def test_extract_pages_as_pdf_caps_at_max_pages():
    from app.utils.pdf_utils import MAX_PAGES_PER_CALL

    out = extract_pages_as_pdf(
        _make_text_pdf(MAX_PAGES_PER_CALL + 5), list(range(MAX_PAGES_PER_CALL + 5))
    )
    assert get_pdf_page_count(out) == MAX_PAGES_PER_CALL


def test_extract_pages_as_pdf_with_password():
    out = extract_pages_as_pdf(_make_pdf(pages=3), [2], password="secret")
    assert get_pdf_page_count(out) == 1


# ── normalize_pdf_for_llm (strip encryption before the provider rejects it) ──────


def _fitz_is_encrypted(pdf_bytes: bytes) -> bool:
    """True if fitz reports is_encrypted *before* any authenticate call."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        return doc.is_encrypted
    finally:
        doc.close()


def test_normalize_decrypts_user_password_pdf():
    # The exact bug: a user-password PDF sent raw to Gemini → "The document has no pages."
    enc = _make_pdf(pages=2)
    assert _fitz_is_encrypted(enc)  # confirm fixture is actually encrypted
    out = normalize_pdf_for_llm(enc, password="secret")
    assert not _fitz_is_encrypted(out)
    assert get_pdf_page_count(out) == 2


def test_normalize_owner_only_pdf_is_passthrough():
    # Owner-only PDFs (user_pw="") are auto-authenticated by PyMuPDF so
    # is_encrypted is False on open — Gemini can read them as-is.
    buf = _make_pdf(pages=1, user_pw="", owner_pw="owneronly")
    assert not _fitz_is_encrypted(buf)  # PyMuPDF clears this on auto-auth
    out = normalize_pdf_for_llm(buf)
    assert out is buf  # untouched passthrough


def test_normalize_passes_plain_pdf_through_untouched():
    plain = _make_text_pdf(2)
    out = normalize_pdf_for_llm(plain)
    assert out is plain  # native passthrough, no re-save
