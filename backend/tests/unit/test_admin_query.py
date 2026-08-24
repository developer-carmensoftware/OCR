"""`apply_list_query()` decides what Postgres is asked to sort and match.

Compiling the SQL is the check — the interesting part is which column ends up in the
ORDER BY, that a bad `sort` is refused rather than silently ignored, and that a search
term containing LIKE wildcards is treated as text.
"""

import pytest
from sqlalchemy import select
from sqlalchemy.dialects import postgresql

from app.exceptions import ValidationError
from app.models.observability import LLMUsageLog
from app.routers.admin._query import list_query
from app.utils.list_query import ListQuery, apply_list_query

SORTABLE = {
    "created_at": LLMUsageLog.created_at,
    "cost_usd": LLMUsageLog.cost_usd,
}


def _sql(stmt) -> str:
    return str(stmt.compile(dialect=postgresql.dialect())).lower()


def _apply(**kwargs):
    lq = ListQuery(
        q=kwargs.pop("q", None),
        sort=kwargs.pop("sort", None),
        dir=kwargs.pop("dir", "desc"),
        limit=50,
        offset=0,
    )
    return apply_list_query(
        select(LLMUsageLog),
        lq,
        sortable=SORTABLE,
        tiebreak=LLMUsageLog.id,
        default_sort="created_at",
        searchable=kwargs.pop("searchable", (LLMUsageLog.model,)),
    )


def test_sorts_by_the_requested_column_not_the_default():
    sql = _sql(_apply(sort="cost_usd", dir="asc"))
    order_by = sql.split("order by")[1]
    assert "cost_usd asc" in order_by
    assert "created_at" not in order_by


def test_unknown_sort_key_is_refused_rather_than_ignored():
    # A typo that quietly re-sorts a cost table is worse than a 400.
    with pytest.raises(ValidationError) as exc:
        _apply(sort="cost_usdd")
    assert "cost_usd" in str(exc.value)


def test_every_sort_carries_a_tiebreak_so_offset_pages_do_not_overlap():
    order_by = _sql(_apply(sort="cost_usd")).split("order by")[1]
    assert order_by.count(",") == 1
    assert "id desc" in order_by


def test_nulls_sort_last_in_both_directions():
    for direction in ("asc", "desc"):
        assert "nulls last" in _sql(_apply(sort="cost_usd", dir=direction))


def test_search_term_reaches_an_ilike_over_every_searchable_column():
    sql = _sql(_apply(q="gemini", searchable=(LLMUsageLog.model, LLMUsageLog.module_id)))
    assert sql.count("ilike") == 2


def test_no_search_term_adds_no_where_clause():
    assert "ilike" not in _sql(_apply(q=None))


def test_like_wildcards_in_the_search_term_are_escaped():
    # Searching "100%" must not match every row.
    stmt = _apply(q="100%")
    bound = stmt.compile(dialect=postgresql.dialect()).params
    assert any(str(v) == "%100\\%%" for v in bound.values()), bound


def test_blank_search_box_is_no_filter():
    assert list_query(q="   ", sort=None, sort_dir="desc", limit=50, offset=0).q is None


def test_search_term_keeps_its_inner_spacing():
    # "credit card" is one search, not two — only the ends are trimmed.
    assert list_query(q="  credit card ", sort=None, sort_dir="desc", limit=50, offset=0).q == (
        "credit card"
    )


def test_defaults_are_newest_first_from_page_one():
    # Called directly, so the declared defaults are still Query() objects — read them
    # off the signature the way FastAPI would.
    import inspect

    params = inspect.signature(list_query).parameters
    assert params["sort_dir"].default.default == "desc"
    assert params["offset"].default.default == 0
    assert params["sort"].default.default is None


def test_dir_is_exposed_as_dir_in_the_url_but_not_shadowed_in_code():
    # The param is `sort_dir` in Python and `?dir=` on the wire, so a filter link reads
    # naturally without the function shadowing the builtin.
    import inspect

    sig = inspect.signature(list_query)
    assert "sort_dir" in sig.parameters
    assert sig.parameters["sort_dir"].default.alias == "dir"


def test_limit_and_offset_are_bounded_at_the_dependency():
    # These reach LIMIT/OFFSET directly. A negative offset or an unbounded limit is a
    # 422 from FastAPI, not something the SQL layer has to defend against.
    import inspect

    def bounds(name):
        return {
            type(m).__name__.lower(): getattr(m, type(m).__name__.lower())
            for m in inspect.signature(list_query).parameters[name].default.metadata
        }

    assert bounds("limit") == {"ge": 1, "le": 500}
    assert bounds("offset")["ge"] == 0
