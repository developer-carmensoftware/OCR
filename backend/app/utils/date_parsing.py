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
)


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
