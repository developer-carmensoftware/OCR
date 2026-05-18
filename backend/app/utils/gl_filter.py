from collections.abc import Iterable


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
