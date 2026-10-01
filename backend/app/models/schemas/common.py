from pydantic import BaseModel


class FieldMapping(BaseModel):
    dept: str | None = None
    acc: str | None = None
    # Which layout this key came from — `None` (usable on any layout: the three fixed
    # types and every pre-existing fee-invoice payment type), `settlement_detail` or
    # `settlement_summary`. Informational only: the JV builder resolves a key by plain
    # string lookup and never reads this — see BUAccountingMappingEntry.source and
    # decision #3 (docs/email-automation/06-decision-log.md #29). Display-only on the
    # merged mapping table, which is the only reason it round-trips through the wire
    # shape at all.
    source: str | None = None


class Page[T](BaseModel):
    """One window of a list endpoint. See `app.utils.pagination.paginate`.

    `total` is the count of *all* matching rows, not `len(data)` — a pager cannot
    render "page 1 of N" without it.
    """

    total: int
    limit: int
    offset: int
    data: list[T]
