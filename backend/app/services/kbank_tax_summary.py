"""KBank's per-merchant tax summary CSV — the settlement report's second factor.

`TAX_SUMMARY_BY_TAX_ID_CSV_<tax id>_<date>.csv` rides in the same zip as the settlement
report (`services/email_imap.py`'s sidecar bucket — never a document, never charged,
never ledgered). One row per merchant ID registered under that tax ID, since a BU with
several properties on one KBank account gets several rows in one file, plus a `TOTAL` row
this module skips. `email_ingest_service.py` looks up the settlement report's own
merchant ID in the result to feed the existing `foreign_tax_id` check — see decision #28
(`docs/email-automation/06-decision-log.md`) for why the settlement report's own page has
no tax ID to check in the first place.
"""

from __future__ import annotations

import csv
import io
import re

from app.models.schemas.ocr import ExtractedDetailRow, ExtractionWarning

# The bank's own export marks every text cell with a leading `'` (an Excel
# force-as-text marker) and pads several columns with trailing spaces.
_DIGITS = re.compile(r"\D")

# Tolerance (baht) for comparing the CSV's own figures against the report's — same value
# credit_card_service.py uses for the report's checks against itself.
_TOL = 0.02


def _clean(value: str | None) -> str:
    return (value or "").strip().lstrip("'").strip()


def digits_only(value: str | None) -> str:
    """`"'451005282039001  "` → `"451005282039001"`. Public: `email_ingest_service.py`
    uses this to normalise `extracted.merchant_id` the same way before looking it up in
    `parse()`'s result, so the two sides of the lookup are cleaned identically."""
    return _DIGITS.sub("", value or "")


def parse(blob: bytes) -> dict[str, dict[str, str]]:
    """`{merchant_id: {tax_id, tax_invoice_no, fee, vat, net, wht}}`, digits-only keys.

    Skips the `TOTAL` row — its `MERCHANT ID` cell reads `"TOTAL"`, which has no digits,
    so it never produces a key. Malformed bytes return an empty map rather than raising:
    a sidecar that failed to parse costs nothing on its own — the settlement report it
    rode beside still posts, only without this second factor, which
    `email_ingest_service.py` treats as `tin_unverified` rather than a hard failure.
    """
    text = None
    for encoding in ("utf-8-sig", "cp874"):
        try:
            text = blob.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        return {}

    out: dict[str, dict[str, str]] = {}
    try:
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            merchant = digits_only(row.get("MERCHANT ID"))
            if not merchant:
                continue
            out[merchant] = {
                "tax_id": digits_only(row.get("TAX ID")),
                "tax_invoice_no": _clean(row.get("TAX INVOICE NO")),
                "fee": _clean(row.get("TOTAL FEE/COMMISSION AMOUNT")),
                "vat": _clean(row.get("VAT 7%")),
                "net": _clean(row.get("NET CREDIT AMT")),
                "wht": _clean(row.get("W.H. TAX")),
            }
    except csv.Error:
        return {}
    return out


def _amt(v: str | None) -> float | None:
    if v is None:
        return None
    s = v.replace(",", "").strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def cross_check(
    csv_row: dict[str, str], doc_no: str | None, total_row: ExtractedDetailRow | None
) -> list[ExtractionWarning]:
    """Compare the CSV sidecar's own figures against what the settlement report printed.

    The two describe the same settlement independently — this file from KBank's tax
    system, `total_row` from the report's own `TOTAL BY MERCHANT ID` line — so a
    disagreement here is new information, not a repeat of
    `credit_card_service._normalize_ar_settlement`'s checks, which only ever compare the
    report against itself. Every mismatch is a warning, never a skip or a repair: a human
    resolves it, the same rule that function already follows for this document type. Only
    compares a field when both sides parse — a blank or unreadable cell stays silent
    rather than raising a false alarm.
    """
    warnings: list[ExtractionWarning] = []

    csv_doc_no = _clean(csv_row.get("tax_invoice_no"))
    if csv_doc_no and doc_no and csv_doc_no != doc_no.strip():
        warnings.append(
            ExtractionWarning(
                code="csvTaxInvoiceMismatch", params={"csv": csv_doc_no, "report": doc_no}
            )
        )

    if total_row is not None:
        for report_field, csv_key, code in (
            ("commis_amt", "fee", "csvFeeMismatch"),
            ("tax_amt", "vat", "csvVatMismatch"),
            ("total", "net", "csvNetMismatch"),
        ):
            csv_amt = _amt(csv_row.get(csv_key))
            report_amt = _amt(getattr(total_row, report_field))
            if csv_amt is not None and report_amt is not None and abs(csv_amt - report_amt) > _TOL:
                warnings.append(
                    ExtractionWarning(
                        code=code,
                        params={"csv": f"{csv_amt:,.2f}", "report": f"{report_amt:,.2f}"},
                    )
                )

    return warnings
