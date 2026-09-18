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

# The bank's own export marks every text cell with a leading `'` (an Excel
# force-as-text marker) and pads several columns with trailing spaces.
_DIGITS = re.compile(r"\D")


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
