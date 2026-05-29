"""
Mapping History Service — confirmed GL mappings for credit card, derived from Carmen.

Source: Carmen `/spGetListJvBySource/{source}` (prior JV detail lines). Each line's
`JvdDesc` is the field_type label ("Credit card commission", "Input Tax",
"Bank Account", or a payment-type code like "VSA-INT-P"), so we match by
normalized-description equality and count frequency across prior JVs.

The local `mapping_history` table is no longer used — Carmen is the source of truth.
Cache pattern mirrors `ap_vendor_history_service.py`: plain dict keyed by
(tenant_id, source) with monotonic-time TTL.
"""

import logging
import time

from app.context import current_tenant_id
from app.services.ap_vendor_history_service import normalize_description
from app.services.carmen_service import CarmenAPIError, get_jv_by_source

logger = logging.getLogger(__name__)

BYPASS_THRESHOLD = 3  # appeared in >= N prior JV lines → skip LLM entirely

_CACHE_TTL = 900.0  # 15 minutes
_CACHE: dict[tuple[str, str], tuple[list[dict], float]] = {}


async def get_confirmed_mappings(
    bank_code: str,
    field_types: list[str],
    source: str = "",
    carmen_token: str = "",
) -> dict[str, dict]:
    """Return best confirmed mapping per field_type for this tenant's JV source.

    Output: {field_type: {dept, acc, confirmed_count}}

    Derives from prior Carmen JVs: for each requested field_type, finds the
    most frequent (dept, acc) combo among JV lines whose JvdDesc matches that
    field_type. `confirmed_count` = number of matching lines for the chosen combo.
    Returns {} when source/token missing or Carmen has no history (→ cold LLM).
    """
    if not source or not carmen_token:
        return {}

    rows = await _fetch_jv_rows(source, carmen_token)
    if not rows:
        return {}

    # normalized field-type label → original field_type
    label_lookup = {normalize_description(ft): ft for ft in field_types}

    # field_type → {(dept, acc): [count, last_index]}
    tallies: dict[str, dict[tuple[str, str], list[int]]] = {}
    for idx, row in enumerate(rows):
        desc = row.get("JvdDesc") or ""
        dept = (row.get("DeptCode") or "").strip()
        acc = (row.get("AccCode") or "").strip()
        if not (desc and dept and acc):
            continue
        ft = label_lookup.get(normalize_description(desc))
        if not ft:
            continue
        combo = (dept, acc)
        bucket = tallies.setdefault(ft, {})
        entry = bucket.get(combo)
        if entry is None:
            bucket[combo] = [1, idx]
        else:
            entry[0] += 1
            entry[1] = idx

    best: dict[str, dict] = {}
    for ft, combos in tallies.items():
        # most frequent combo; tie-break = last-seen (highest index)
        (dept, acc), (count, _idx) = max(combos.items(), key=lambda kv: (kv[1][0], kv[1][1]))
        best[ft] = {"dept": dept, "acc": acc, "confirmed_count": count}

    logger.info(
        "Confirmed mappings derived from Carmen JV: bank=%s source=%s fields=%d",
        bank_code,
        source,
        len(best),
    )
    return best


async def _fetch_jv_rows(source: str, carmen_token: str) -> list[dict]:
    """Fetch (cached) JV detail rows for `source`. Returns [] on Carmen error."""
    tenant_id = current_tenant_id.get() or ""
    cache_key = (tenant_id, source)

    now = time.monotonic()
    cached = _CACHE.get(cache_key)
    if cached and now - cached[1] < _CACHE_TTL:
        return cached[0]

    try:
        raw = await get_jv_by_source(source, carmen_token)
    except CarmenAPIError as e:
        logger.warning("Carmen JV history failed for source=%s: %s", source, e.detail)
        return []

    if isinstance(raw, dict):
        rows = raw.get("Data") or []
    elif isinstance(raw, list):
        rows = raw
    else:
        rows = []

    rows = [r for r in rows if isinstance(r, dict)]
    _CACHE[cache_key] = (rows, now)
    logger.info("JV history cached: source=%s (%d rows)", source, len(rows))
    return rows


def invalidate_mapping_cache(tenant_id: str | None = None) -> None:
    """Drop cached entries. If tenant_id is None, clears the whole cache."""
    if tenant_id is None:
        _CACHE.clear()
        return
    tid = tenant_id or ""
    for k in [k for k in _CACHE if k[0] == tid]:
        _CACHE.pop(k, None)
