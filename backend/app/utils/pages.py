"""Parse/validate the `selected_pages` form field shared by OCR + AP extract.

The field arrives as a JSON-encoded list of 0-based page indices (Form data can't
carry a list directly). We validate strictly so malformed input fails fast with a
clear error instead of being silently coerced (e.g. `int(0.9) -> 0`).
"""

import json

# Hard cap on pages sent to the vision LLM in one call (token-overflow guard).
# Single source of truth lives in pdf_utils — the service layer truncates to the
# same bound, so reject anything over it here for a clean 400 instead of silent loss.
from app.utils.pdf_utils import MAX_PAGES_PER_CALL as MAX_SELECTED_PAGES

__all__ = ["MAX_SELECTED_PAGES", "billable_pages", "parse_selected_pages"]


def parse_selected_pages(raw: str | None) -> list[int] | None:
    """Return validated 0-based page indices, or None when nothing is selected.

    Raises ValueError (caller maps to HTTP 400) on any malformed payload:
    non-JSON, not a list, non-integer/negative entries, or more than the cap.
    """
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, ValueError) as exc:
        raise ValueError("selected_pages must be a JSON array of integers") from exc

    if not isinstance(parsed, list):
        raise ValueError("selected_pages must be a JSON array of integers")
    if not parsed:
        return None

    pages: list[int] = []
    for p in parsed:
        # Reject bool/float/str — only genuine ints. (bool is an int subclass.)
        if not isinstance(p, int) or isinstance(p, bool):
            raise ValueError("selected_pages entries must be integers")
        if p < 0:
            raise ValueError("selected_pages entries must be non-negative")
        pages.append(p)

    # De-duplicate while preserving order.
    deduped = list(dict.fromkeys(pages))

    if len(deduped) > MAX_SELECTED_PAGES:
        raise ValueError(f"selected_pages cannot exceed {MAX_SELECTED_PAGES} pages")
    return deduped


def billable_pages(page_count: int | None, selected: list[int] | None) -> int:
    """How many document credits an extraction costs — one per page actually sent
    to the vision LLM. `page_count` is None for a non-PDF (a single image = 1 page).

    This mirrors the page resolution in `extract_ap_invoice_data()`: an explicit
    selection wins, otherwise the whole PDF truncated to MAX_SELECTED_PAGES. The two
    must move together, which is why this sits next to the cap it depends on.

    Floor of 1: when every selected index is out of range the service raises right
    after, and the router refunds what it charged — a 0-credit charge with a 1-credit
    refund would hand out free credits.
    """
    if page_count is None:
        return 1
    if selected:
        in_range = sum(1 for p in selected if p < page_count)
        return max(1, min(in_range, MAX_SELECTED_PAGES))
    return max(1, min(page_count, MAX_SELECTED_PAGES))
