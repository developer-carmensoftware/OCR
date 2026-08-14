import json
from collections.abc import Iterable
from typing import Any


def parse_default_account(raw: Any) -> set[str]:
    """Carmen DefaultAccount is a *stringified* JSON array of {AccCode, Description}.

    Empty/absent/unparseable ⇒ empty set = no restriction (all accounts allowed).
    """
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except (ValueError, TypeError):
            return set()
    if not isinstance(raw, list):
        return set()
    return {e["AccCode"] for e in raw if isinstance(e, dict) and e.get("AccCode")}


def score_and_pad(
    items: list[dict],
    keywords: Iterable[str],
    limit: int,
    pad_threshold: int | None = None,
    name_key: str = "name",
) -> list[dict]:
    """Score items by keyword hits in name_key, return top `limit`.

    Pads with unmatched items when matched count is below pad_threshold
    (defaults to limit when not specified).
    """
    if not items:
        return []
    scored: list[tuple[int, dict]] = []
    unmatched: list[tuple[int, dict]] = []
    kws = list(keywords)
    for item in items:
        name = (item.get(name_key) or "").lower()
        score = sum(1 for kw in kws if kw in name)
        (scored if score else unmatched).append((score, item))
    scored.sort(key=lambda x: -x[0])
    result = [item for _, item in scored[:limit]]
    threshold = pad_threshold if pad_threshold is not None else limit
    if len(result) < threshold:
        result.extend(item for _, item in unmatched[: limit - len(result)])
    return result
