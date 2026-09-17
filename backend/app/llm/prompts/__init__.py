"""
OCR prompt registry.

Usage:
    from app.llm.prompts import get_ocr_prompt
    prompt = get_ocr_prompt()          # auto-detect bank (default)
    prompt = get_ocr_prompt("SCB")     # explicit bank (backward compat)
"""

from app.llm.prompts.bay import LAYOUT as _BAY
from app.llm.prompts.bbl import LAYOUT as _BBL
from app.llm.prompts.generic import LAYOUT as _GENERIC
from app.llm.prompts.ghl import LAYOUT as _GHL
from app.llm.prompts.kbank import LAYOUT as _KBANK
from app.llm.prompts.ktc import LAYOUT as _KTC
from app.llm.prompts.paypal import LAYOUT as _PAYPAL
from app.llm.prompts.scb import LAYOUT as _SCB
from app.llm.prompts.shared import build_bank_prompt, build_combined_prompt
from app.llm.prompts.siampay import LAYOUT as _SIAMPAY

# Registry: add a new bank = new layout file + one entry here
_REGISTRY: dict[str, str] = {
    "BBL": _BBL,
    "KBANK": _KBANK,
    "SCB": _SCB,
    "BAY": _BAY,
    "KTC": _KTC,
    "GHL": _GHL,
    "PAYPAL": _PAYPAL,
    "SIAMPAY": _SIAMPAY,
}

# Bump whenever a layout changes — used by GET /api/version.
# All bumped together on 2026-09-03: the shared OUTPUT_RULES gained `bank_code`, so every
# prompt's output contract changed, not just one layout.
#
# 2026-09-17: the three plain statement layouts now MANDATE their printed TOTAL row as
# the last details[] object, and ROW_RULES' exception whitelist names them. Their JV sums
# the same rows into both sides, so it balanced whatever the model returned and a short
# reading auto-posted undetected; `_strip_noncard_rows` consumes that row and checks Σ
# against it instead. Framed as "MANDATORY FINAL ROW … N+1 objects" rather than a one-line
# "INCLUDE the summary row" (which BAY has): on KBANK_SETTLEMENT the short form was
# verified live NOT to work — the model kept generalizing the nearby skip-summary warning.
#
# **Every entry bumps, not just the three layouts that changed.** `build_bank_prompt` is
# `_BASE_INTRO + layout + ROW_RULES + OUTPUT_RULES`, so editing the shared ROW_RULES
# changed the text served for all eight banks — the same reasoning as the 2026-09-03 bump
# above. Leaving BAY and the fee invoices behind would point `/api/version` at prompt text
# those numbers never named, which is the one thing this dict exists to prevent.
_PROMPT_VERSIONS: dict[str, str] = {
    "BBL": "2.4.0",
    "KBANK": "2.4.0",
    "SCB": "2.4.0",
    "BAY": "1.5.0",
    "KTC": "1.6.0",
    "GHL": "1.6.0",
    "PAYPAL": "1.6.0",
    "SIAMPAY": "1.6.0",
    "GENERIC": "2.4.0",
    "COMBINED": "2.8.0",
}

# Pre-built at import time — no cost at request time
_BANK_PROMPTS: dict[str, str] = {
    code: build_bank_prompt(layout) for code, layout in _REGISTRY.items()
}
_COMBINED: str = build_combined_prompt(list(_REGISTRY.values()) + [_GENERIC])


def get_ocr_prompt(bank_type: str | None = None, hints: dict[str, str] | None = None) -> str:
    """Return the OCR extraction prompt.

    bank_type=None (default) → combined auto-detect prompt (recommended).
    bank_type="BBL"|"KBANK"|"SCB"|"BAY"|"KTC"|"GHL"|"PAYPAL"|"SIAMPAY" → bank-specific prompt.

    hints: {field_name: error_rate_info} from correction_service — appends a
           warning section for fields that are historically extracted incorrectly.
    """
    base = _BANK_PROMPTS.get(bank_type or "", _COMBINED)

    if not hints:
        return base

    hint_lines = "\n".join(
        f"- {field}: often extracted incorrectly — read the document carefully for this field"
        for field in hints.keys()
    )
    bank_label = bank_type or "this document type"
    return base + f"\n\n⚠️ CORRECTION NOTES (fields often wrong for {bank_label}):\n" + hint_lines
