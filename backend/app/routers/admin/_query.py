"""The `?q=&sort=&dir=&limit=&offset=` dependency shared by the admin list endpoints.

The SQL half — `ListQuery` and `apply_list_query()` — lives in `app.utils.list_query`
so services can use it without importing a router. Re-exported here because the routers
read better naming both from one place.
"""

from fastapi import Query

from app.utils.list_query import ListQuery, SortDir, apply_list_query

__all__ = ["ListQuery", "SortDir", "apply_list_query", "list_query"]


def list_query(
    q: str | None = Query(None, description="Case-insensitive substring match"),
    sort: str | None = Query(None, description="Column key — see the endpoint's whitelist"),
    # Aliased so the URL reads `?dir=desc` without shadowing the builtin in code.
    sort_dir: SortDir = Query("desc", alias="dir"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> ListQuery:
    return ListQuery(
        # An empty search box must mean "no filter", not "match rows containing ''".
        q=(q or "").strip() or None,
        sort=sort,
        dir=sort_dir,
        limit=limit,
        offset=offset,
    )
