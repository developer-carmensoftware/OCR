"""Search and sort for list endpoints — the SQL half.

The FastAPI dependency that parses `?q=&sort=&dir=&limit=&offset=` lives in
`app.routers.admin._query`; this module is what services call, so they never have to
import a router.

The point is not tidiness. Before this, sorting happened in the browser over whichever
rows the endpoint happened to return, so "highest cost" meant "highest cost among the
last 200 by time" — a different question, silently. Sorting belongs where the whole
result set is.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Literal

from sqlalchemy import Select, or_

from app.exceptions import ValidationError

SortDir = Literal["asc", "desc"]


@dataclass(frozen=True)
class ListQuery:
    """What the caller asked for. Endpoint-agnostic; `sort` is validated per endpoint."""

    q: str | None
    sort: str | None
    dir: SortDir
    limit: int
    offset: int


def apply_list_query(
    stmt: Select[Any],
    lq: ListQuery,
    *,
    sortable: Mapping[str, Any],
    tiebreak: Any,
    default_sort: str,
    searchable: Sequence[Any] = (),
) -> Select[Any]:
    """Apply `q` and `sort`/`dir` to a statement. Paging stays with `paginate()`.

    `sortable` is a whitelist mapping the key the UI sends to a real column — never
    interpolate `lq.sort` into SQL, and never fall back silently to an arbitrary order
    when it doesn't match: a typo that quietly re-sorts a cost table is worse than a 400.

    `tiebreak` is not optional. Under offset paging, rows equal on the sort column have
    no defined order, so a page boundary can repeat one row and skip another. Pass the
    primary key.
    """
    key = lq.sort or default_sort
    col = sortable.get(key)
    if col is None:
        raise ValidationError(
            f"Cannot sort by '{key}' — expected one of: {', '.join(sorted(sortable))}"
        )

    if lq.q and searchable:
        pattern = f"%{escape_like(lq.q)}%"
        stmt = stmt.where(or_(*(c.ilike(pattern, escape="\\") for c in searchable)))

    ordered = col.desc() if lq.dir == "desc" else col.asc()
    # Nulls last in both directions: an empty cell is not an answer to "who cost the
    # most", and Postgres would otherwise float them to the top of every DESC sort.
    return stmt.order_by(ordered.nullslast(), tiebreak.desc())


def escape_like(term: str) -> str:
    """`%` and `_` are wildcards in LIKE. A user searching for `100%` means the literal."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
