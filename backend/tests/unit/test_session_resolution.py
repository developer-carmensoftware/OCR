"""Resolving a session from the JWT's `sid` (app/auth/dependencies.py).

On a cache miss the lookup is ONE statement: `UPDATE ocr_sessions SET last_used_at = now() ... RETURNING
carmen_token_encrypted`. It used to be a SELECT in one session and, straight after, the throttled UPDATE
in another: two pool checkouts for something that happens once per cache expiry per session.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.dialects import postgresql

from app.auth import dependencies as deps


@pytest.fixture(autouse=True)
def _clean_cache():
    deps._session_cache.clear()
    yield
    deps._session_cache.clear()


def _opener(row):
    """A fake `async_session` whose one UPDATE ... RETURNING yields `row` (None = no row matched)."""
    db = AsyncMock()
    result = MagicMock()
    result.first.return_value = row
    db.execute = AsyncMock(return_value=result)
    ctx = AsyncMock()
    ctx.__aenter__.return_value = db
    ctx.__aexit__.return_value = None
    return MagicMock(return_value=ctx), db


async def test_a_miss_is_one_session_and_one_statement_and_skips_the_touch():
    row = MagicMock(carmen_token_encrypted="enc-token")
    opener, db = _opener(row)

    with patch.object(deps, "async_session", opener):
        token, persisted = await deps._resolve_session_token("sid-1")

    assert (token, persisted) == ("enc-token", True)  # True: the caller must not touch again
    assert opener.call_count == 1
    assert db.execute.await_count == 1
    db.commit.assert_awaited_once()


async def test_the_statement_is_an_update_returning_the_token_for_live_sessions_only():
    opener, db = _opener(MagicMock(carmen_token_encrypted="enc"))
    with patch.object(deps, "async_session", opener):
        await deps._resolve_session_token("sid-1")

    sql = str(db.execute.await_args.args[0].compile(dialect=postgresql.dialect()))
    assert sql.startswith("UPDATE ocr_sessions SET")
    assert "last_used_at=" in sql
    assert "RETURNING ocr_sessions.carmen_token_encrypted" in sql
    # Revoked and deleted sessions must match nothing (a 401), and must not be written to.
    assert "ocr_sessions.is_active IS true" in sql
    assert "ocr_sessions.deleted_at IS NULL" in sql


async def test_the_second_call_is_served_from_the_cache_without_the_database():
    opener, _ = _opener(MagicMock(carmen_token_encrypted="enc-token"))
    with patch.object(deps, "async_session", opener):
        await deps._resolve_session_token("sid-1")
        token, persisted = await deps._resolve_session_token("sid-1")

    assert token == "enc-token"
    assert persisted is True  # within the throttle window
    assert opener.call_count == 1  # the hit opened nothing


async def test_a_revoked_or_missing_session_is_none_and_leaves_no_cache_entry():
    opener, _ = _opener(None)
    deps._session_cache["sid-1"] = ("stale", 0.0, 0.0)  # an expired entry for the same session

    with patch.object(deps, "async_session", opener):
        token, persisted = await deps._resolve_session_token("sid-1")

    assert (token, persisted) == (None, False)
    assert "sid-1" not in deps._session_cache
