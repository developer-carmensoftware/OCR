"""Deterministic reader for the KBANK settlement report (REPORT NO. KB1P554V2).

Ticket 08 (`.scratch/kbank-settlement-jv/issues/08`): this is the one layout proven
(2026-09-18, decision #28) to carry a complete, machine-generated text layer — so
reading it directly costs nothing and cannot misread a digit the way a vision call
occasionally does. `ocr_service.extract_stateless` tries this ahead of the vision
call for `doc_type == AR_RECONCILE and bank_code == "KBANK"`; a `None` here falls
straight through to the unchanged vision path, so a scanned copy or a future
report-generator version still gets read.

Produces exactly the shape `llm/prompts/kbank_settlement.py` asks the model for —
including the unfiltered "TOTAL BY MERCHANT ID" row appended to `details` — so
`credit_card_service._normalize_ar_settlement` (which finds that row, verifies it,
and moves it to `extracted.total_row`) needs no change to accept either source.

**Why bucket by y instead of trusting PyMuPDF's own block/line grouping**: `words()`
returns content-stream order, not layout order. On this report the column-header row
sits in a content block that comes after the block holding its own data rows, and the
NET AMT figure on the "TOTAL BY MERCHANT ID" line is its own content block entirely —
printed on the same visual row, one block later in the stream, straight after a
page-width `---` separator. Sorting every word on the page by vertical position first,
then grouping words within a couple of points of each other, reconstructs the row a
human actually sees; reading blocks in their given order does not.
"""

from __future__ import annotations

import logging
import re

import fitz

from app.models.schemas import ExtractedCreditCardData
from app.models.schemas.ocr import ExtractedDetailRow

logger = logging.getLogger(__name__)

_REPORT_NO = "KB1P554V2"

# Points. Two words on the same printed line differ by a fraction of a point on this
# report; two different lines are 10+ points apart. Wide enough to absorb jitter,
# narrow enough to never merge adjacent lines.
_Y_TOL = 2.0

_AMOUNT = re.compile(r"^-?[\d,]+\.\d{2}$")

_Word = tuple[float, str]  # (x0, text), already sorted left to right within its row


def _rows(page: fitz.Page) -> list[list[_Word]]:
    """Every word on the page, grouped into printed rows and read left to right."""
    buckets: list[tuple[float, list[_Word]]] = []
    for x0, y0, _x1, _y1, text, *_ in sorted(page.get_text("words"), key=lambda w: w[1]):
        for y, bucket in buckets:
            if abs(y - y0) <= _Y_TOL:
                bucket.append((x0, text))
                break
        else:
            buckets.append((y0, [(x0, text)]))
    return [sorted(bucket, key=lambda w: w[0]) for _, bucket in buckets]


def _row_text(row: list[_Word]) -> str:
    return " ".join(w for _, w in row)


def _label_value_index(row: list[_Word], *label: str) -> int | None:
    """Index of the first non-`:` token after a consecutive label match, or None."""
    n = len(label)
    upper = [w.upper() for _, w in row]
    for i in range(len(row) - n + 1):
        if upper[i : i + n] == list(label):
            for j in range(i + n, len(row)):
                if row[j][1] != ":":
                    return j
            return None
    return None


def _after(row: list[_Word], *label: str, max_gap: float = 60.0) -> str | None:
    """The value right after a label on a row that may carry several label:value
    pairs side by side in columns (the header block does this) — `max_gap` keeps a
    search from wandering into the next column's value when this one is unlabelled."""
    idx = _label_value_index(row, *label)
    if idx is None:
        return None
    label_end_x = row[idx - 1][0]
    value_x, value = row[idx]
    return value if value_x - label_end_x <= max_gap else None


def _first_match(rows: list[list[_Word]], *label: str) -> str | None:
    for row in rows:
        value = _after(row, *label)
        if value:
            return value
    return None


def parse(pdf_bytes: bytes) -> ExtractedCreditCardData | None:
    """`pdf_bytes` is the settlement report's own last page, already isolated and
    decrypted by `extract_pages_as_pdf` before this runs. Returns `None` on anything
    that doesn't match this exact layout rather than guessing at a partial reading.
    """
    try:
        return _parse(pdf_bytes)
    except Exception:
        logger.exception("KBANK settlement text parse crashed — falling back to vision")
        return None


def _parse(pdf_bytes: bytes) -> ExtractedCreditCardData | None:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        if doc.needs_pass or doc.page_count < 1:
            return None
        rows = _rows(doc[0])

        if _first_match(rows, "REPORT", "NO.") != _REPORT_NO:
            return None

        doc_date = _first_match(rows, "SETTLEMENT", "DATE", ":")
        doc_no = _first_match(rows, "TAX", "INVOICE", "NUMBER", ":")
        if not doc_date or not doc_no:
            return None

        # The FIRST "SUMMARY MERCHANT ID" block only — a page can carry a TERMINAL ID
        # or SUMMARY TERMINAL ID block above it, subtotals of the same money that must
        # never be read as the merchant's own row.
        summary_idx = merchant_id = None
        for i, row in enumerate(rows):
            if _row_text(row).upper().startswith("SUMMARY MERCHANT ID"):
                idx = _label_value_index(row, "SUMMARY", "MERCHANT", "ID", ":")
                if idx is None:
                    return None
                merchant_id = row[idx][1]
                merchant_name = " ".join(w for _, w in row[idx + 1 :]) or None
                summary_idx = i
                break
        if summary_idx is None or not merchant_id:
            return None

        details: list[ExtractedDetailRow] = []
        total_row: ExtractedDetailRow | None = None
        for row in rows[summary_idx + 1 :]:
            text = _row_text(row).upper()
            if text.startswith("TOTAL BY MERCHANT ID"):
                amounts = [w for _, w in row if _AMOUNT.match(w) or w == "-"]
                # THB AMT, COMM AMT, VAT AMT, NET AMT, in that printed order. Fewer than
                # four means NET AMT never merged into this row — an unread total, not
                # one this parser recovers by guessing.
                if len(amounts) < 4:
                    return None
                pay_amt, commis_amt, tax_amt, total = amounts[:4]
                total_row = ExtractedDetailRow(
                    transaction="TOTAL BY MERCHANT ID",
                    pay_amt=pay_amt,
                    commis_amt=None if commis_amt == "-" else commis_amt,
                    tax_amt=None if tax_amt == "-" else tax_amt,
                    total=None if total == "-" else total,
                )
                break
            label_words: list[str] = []
            pay_amt = None
            for _x0, word in row:
                if _AMOUNT.match(word):
                    pay_amt = word
                    break
                if word.isdigit():
                    continue  # the NO TXN column
                label_words.append(word)
            if label_words and pay_amt:
                details.append(
                    ExtractedDetailRow(transaction=" ".join(label_words), pay_amt=pay_amt)
                )

        if not details or total_row is None:
            return None
        details.append(total_row)

        return ExtractedCreditCardData(
            doc_no=doc_no,
            doc_date=doc_date,
            bank_code="KBANK",
            bank_name="ธนาคารกสิกรไทย",
            bank_company_name="KASIKORNBANK",
            merchant_id=merchant_id,
            merchant_name=merchant_name,
            company_name=merchant_name,
            doc_name="SALE TRANSACTION REPORT",
            raw_text="",
            details=details,
        )
    finally:
        doc.close()
