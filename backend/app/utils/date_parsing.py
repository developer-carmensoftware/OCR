"""
Date parsing helpers for OCR-extracted dates.

LLM prompts (see backend/app/llm/prompts/shared.py) instruct the model to emit
dates in DD/MM/YYYY format, but real-world output is messier: some banks use
Thai Buddhist years (2567), some emit ISO format, some use dashes. These
helpers normalize all variants to a `datetime.date` for DB storage.

The DB stores `DATE`; the API serializes back to DD/MM/YYYY on output to
preserve the existing frontend contract.
"""

from __future__ import annotations

import re
from datetime import date, datetime

# Thai Buddhist Era offset: 543 BE = 0 AD. Years >= this threshold are treated
# as Buddhist and converted to Gregorian (so 2567 → 2024).
_BE_YEAR_THRESHOLD = 2400


def _to_gregorian(year: int) -> int:
    return year - 543 if year >= _BE_YEAR_THRESHOLD else year


_INPUT_FORMATS = (
    "%d/%m/%Y",  # 15/03/2024 — canonical LLM output
    "%d-%m-%Y",  # 15-03-2024
    "%Y-%m-%d",  # 2024-03-15 — ISO
    "%Y/%m/%d",  # 2024/03/15
    "%d.%m.%Y",  # 15.03.2024
    # 2-digit years — SiamPay prints "27/05/26". Tried AFTER the 4-digit forms so
    # a full year always wins. strptime %y maps 00–68→2000s, so "26"→2026 (these
    # issuers use AD 2-digit years, not Buddhist).
    "%d/%m/%y",  # 27/05/26
    "%d-%m-%y",  # 27-05-26
    "%d.%m.%y",  # 27.05.26
)

# Thai month names (full + abbreviated) → month number. Some issuers (KTC, GHL)
# print dates as "01 พฤษภาคม 2569"; strptime has no Thai locale, so we replace
# the month name with a numeric MM before parsing.
_THAI_MONTHS = {
    "มกราคม": 1,
    "ม.ค.": 1,
    "กุมภาพันธ์": 2,
    "ก.พ.": 2,
    "มีนาคม": 3,
    "มี.ค.": 3,
    "เมษายน": 4,
    "เม.ย.": 4,
    "พฤษภาคม": 5,
    "พ.ค.": 5,
    "มิถุนายน": 6,
    "มิ.ย.": 6,
    "กรกฎาคม": 7,
    "ก.ค.": 7,
    "สิงหาคม": 8,
    "ส.ค.": 8,
    "กันยายน": 9,
    "ก.ย.": 9,
    "ตุลาคม": 10,
    "ต.ค.": 10,
    "พฤศจิกายน": 11,
    "พ.ย.": 11,
    "ธันวาคม": 12,
    "ธ.ค.": 12,
}


_THAI_DATE_RE = re.compile(
    r"(\d{1,2})\s*("
    + "|".join(re.escape(m) for m in sorted(_THAI_MONTHS, key=len, reverse=True))
    + r")\s*(\d{2,4})"
)


def _normalize_thai_month(s: str) -> str:
    """Turn '01 พฤษภาคม 2569' into '01/05/2569' so _INPUT_FORMATS can parse it.

    Regex-based so it tolerates real-world Thai typography: no space after the
    abbreviation dot ('31 พ.ค.2569'), a leading 'วันที่' label, and 2-digit
    Buddhist years ('31 ม.ค. 67' → 2567 BE).
    """
    m = _THAI_DATE_RE.search(s)
    if not m:
        return s
    day, month_name, year_s = m.groups()
    year = int(year_s)
    if year < 100:  # 2-digit Thai years are Buddhist Era ('67' → 2567)
        year += 2500
    return f"{int(day):02d}/{_THAI_MONTHS[month_name]:02d}/{year}"


def parse_doc_date(value: str | date | datetime | None) -> date | None:
    """
    Parse an OCR-extracted date string into a `datetime.date`.

    Accepts the formats listed in `_INPUT_FORMATS`, plus pass-through for
    existing `date` / `datetime` instances. Returns None on any parse failure
    rather than raising — OCR is best-effort and a bad date should not block
    the whole submission.

    Thai Buddhist years are auto-converted: 15/03/2567 → date(2024, 3, 15).
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    s = str(value).strip()
    if not s:
        return None
    s = _normalize_thai_month(s)

    for fmt in _INPUT_FORMATS:
        try:
            parsed = datetime.strptime(s, fmt).date()
            return parsed.replace(year=_to_gregorian(parsed.year))
        except ValueError:
            continue
    return None


def format_doc_date(value: date | datetime | str | None) -> str | None:
    """
    Format a date back to DD/MM/YYYY for API responses.
    Returns None on None input; passes strings through unchanged for
    backward compatibility with any legacy data still in transit.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        value = value.date()
    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")
    return str(value)
