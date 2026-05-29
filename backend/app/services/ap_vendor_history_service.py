"""
AP Vendor History Service — fetch + use vendor's prior invoice line items
from Carmen to (a) bypass LLM for descriptions seen before and (b) inject
few-shot examples for the LLM when bypass misses.

Cache pattern mirrors `correction_service.py`: plain dict keyed by
(tenant_id, vn_code) with monotonic-time TTL.
"""

import logging
import re
import time

from app.context import current_tenant_id
from app.services.carmen_service import CarmenAPIError, get_vendor_invoices

logger = logging.getLogger(__name__)

_CACHE_TTL = 900.0  # 15 minutes
_CACHE: dict[tuple[str, str], tuple[list[dict], float]] = {}


# ── Description normalization ─────────────────────────────────────────────────

_EN_MONTHS = re.compile(
    r"\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b",
    re.IGNORECASE,
)
_TH_MONTH_ABBR = re.compile(
    r"ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\."
)
_TH_MONTHS_FULL = (
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
)
_YEAR_4D = re.compile(r"\b(?:25\d{2}|(?:19|20)\d{2})\b")  # Buddhist (25xx) or CE (19xx/20xx) years
_DATE_SLASH = re.compile(r"\b\d{1,2}/\d{1,2}(?:/\d{2,4})?\b")  # DD/MM or DD/MM/YYYY
_WHITESPACE = re.compile(r"\s+")


def normalize_description(s: str) -> str:
    """Strip month names (en/th), 4-digit years, and date patterns — keep other digits/versions.

    "Telephone Fee for Aug 2024" → "telephone fee for"
    "Internet ม.ค. 2568" → "internet"
    "Software License v1.0" → "software license v1.0"  (version kept)
    "Meeting Room B2" → "meeting room b2"  (room number kept)
    """
    if not s:
        return ""
    out = s.lower()
    out = _EN_MONTHS.sub("", out)
    out = _TH_MONTH_ABBR.sub("", out)
    for m in _TH_MONTHS_FULL:
        out = out.replace(m, "")
    out = _DATE_SLASH.sub("", out)
    out = _YEAR_4D.sub("", out)
    out = _WHITESPACE.sub(" ", out)
    return out.strip()


# ── Cache + fetch ─────────────────────────────────────────────────────────────


async def fetch_vendor_history(vn_code: str, carmen_token: str) -> list[dict]:
    """Fetch (cached) vendor history rows for `vn_code`.

    Returns trimmed dicts with only the fields we use:
    {InvdDesc, DeptCode, InvdBTaxDr, Invhseq}.
    Returns [] on missing vn_code or Carmen error — caller must fallback.
    """
    if not vn_code:
        return []

    tenant_id = current_tenant_id.get() or ""
    cache_key = (tenant_id, vn_code)

    now = time.monotonic()
    cached = _CACHE.get(cache_key)
    if cached and now - cached[1] < _CACHE_TTL:
        return cached[0]

    try:
        raw = await get_vendor_invoices(vn_code, carmen_token)
    except CarmenAPIError as e:
        logger.warning("Carmen vendor history failed for %s: %s", vn_code, e.detail)
        return []

    if isinstance(raw, dict):
        rows = raw.get("Data") or []
    elif isinstance(raw, list):
        rows = raw
    else:
        rows = []

    # New endpoint (/spGetListInvoiceByVnCode) omits Invhseq. Fall back to the
    # row's position so aggregate_history's recency tie-break still works,
    # treating Carmen's list order (oldest→newest) as a recency proxy.
    trimmed = [
        {
            "InvdDesc": r.get("InvdDesc") or "",
            "DeptCode": (r.get("DeptCode") or "").strip(),
            "InvdBTaxDr": (r.get("InvdBTaxDr") or "").strip(),
            "Invhseq": r.get("Invhseq") or idx,
        }
        for idx, r in enumerate(rows)
        if isinstance(r, dict)
    ]

    _CACHE[cache_key] = (trimmed, now)
    logger.info("Vendor history cached: %s (%d rows)", vn_code, len(trimmed))
    return trimmed


def invalidate_vendor_history_cache(tenant_id: str | None = None) -> None:
    """Drop cached entries. If tenant_id is None, clears the whole cache."""
    if tenant_id is None:
        _CACHE.clear()
        return
    tid = tenant_id or ""
    dead = [k for k in _CACHE if k[0] == tid]
    for k in dead:
        _CACHE.pop(k, None)


# ── Aggregation ───────────────────────────────────────────────────────────────


def aggregate_history(rows: list[dict]) -> dict[str, dict]:
    """For each normalized InvdDesc, keep the (dept, acc) from the most recent
    invoice (highest Invhseq). Tie-break = most-recent-only (per user decision).

    Returns: {normalized_desc: {dept, acc, last_seq, sample_desc}}.
    """
    agg: dict[str, dict] = {}
    for row in rows:
        desc = row.get("InvdDesc") or ""
        dept = (row.get("DeptCode") or "").strip()
        acc = (row.get("InvdBTaxDr") or "").strip()
        seq = row.get("Invhseq") or 0
        if not (desc and dept and acc):
            continue
        key = normalize_description(desc)
        if not key:
            continue
        existing = agg.get(key)
        if existing is None or seq > existing["last_seq"]:
            agg[key] = {
                "dept": dept,
                "acc": acc,
                "last_seq": seq,
                "sample_desc": desc.strip(),
            }
    return agg


# ── Bypass + example selection ────────────────────────────────────────────────


def match_bypass(
    items: list[dict],
    aggregate: dict[str, dict],
    valid_dept_codes: set[str],
    expense_acc_codes: set[str],
) -> tuple[dict[int, dict], list[dict]]:
    """Split items by exact normalized-description match against aggregate.

    Only bypasses when the historical acc is an expense account (not input tax /
    balance-sheet). Uses expense_acc_codes — the pre-filtered set from
    ExpenseAccounts.VALID_TYPES + CODE_PREFIXES — as the gate.
    """
    bypassed: dict[int, dict] = {}
    remaining: list[dict] = []
    for item in items:
        desc = item.get("description") or ""
        key = normalize_description(desc)
        match = aggregate.get(key) if key else None
        if match and match["dept"] in valid_dept_codes and match["acc"] in expense_acc_codes:
            bypassed[item["index"]] = {
                "deptCode": match["dept"],
                "accountCode": match["acc"],
            }
        else:
            remaining.append(item)
    return bypassed, remaining


def select_examples(
    remaining_items: list[dict],
    aggregate: dict[str, dict],
    expense_acc_codes: set[str],
    per_item: int = 5,
    overall_limit: int = 20,
) -> list[dict]:
    """Per-item top-N union of aggregate entries by token-overlap score,
    deduped, capped at overall_limit. Used as few-shot examples for LLM.

    Only includes entries whose acc is in expense_acc_codes — prevents
    input-tax / balance-sheet accounts from appearing as LLM hints.
    """
    if not aggregate or not remaining_items:
        return []

    # Filter aggregate to expense accounts only before scoring
    entries = [(k, info) for k, info in aggregate.items() if info["acc"] in expense_acc_codes]
    if not entries:
        return []

    picked: dict[str, dict] = {}

    for item in remaining_items:
        desc = (item.get("description") or "").lower()
        cat = (item.get("category") or "").lower()
        tokens = {t for t in (desc + " " + cat).split() if len(t) >= 3}

        if not tokens:
            for k, info in entries[:per_item]:
                picked.setdefault(k, info)
            continue

        scored: list[tuple[int, str, dict]] = []
        for k, info in entries:
            score = sum(1 for tok in tokens if tok in k)
            if score > 0:
                scored.append((score, k, info))
        scored.sort(key=lambda x: -x[0])
        for _, k, info in scored[:per_item]:
            picked.setdefault(k, info)

        if len(picked) >= overall_limit:
            break

    result = []
    for _, info in picked.items():
        result.append(info)
        if len(result) >= overall_limit:
            break
    return result


def format_history_for_prompt(examples: list[dict]) -> str:
    """Render selected aggregate entries as prompt lines."""
    if not examples:
        return ""
    return "\n".join(f'  "{e["sample_desc"]}" → dept {e["dept"]}, acc {e["acc"]}' for e in examples)
