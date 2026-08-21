from pydantic import BaseModel


class FieldMapping(BaseModel):
    dept: str | None = None
    acc: str | None = None


class Page[T](BaseModel):
    """One window of a list endpoint. See `app.utils.pagination.paginate`.

    `total` is the count of *all* matching rows, not `len(data)` — a pager cannot
    render "page 1 of N" without it.
    """

    total: int
    limit: int
    offset: int
    data: list[T]
