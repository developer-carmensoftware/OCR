"""
Shared fixtures for all backend tests.

Sets WindowsSelectorEventLoopPolicy at import time so pytest-asyncio uses
SelectorEventLoop instead of ProactorEventLoop.  ProactorEventLoop registers
its internal handles with the Windows I/O completion port; when it closes,
it can close file handles that pytest's capture mechanism still holds open,
causing "I/O operation on closed file" between tests.
"""

import os

# ── Real-DB guard ────────────────────────────────────────────────────────────
#
# Every test outside tests/tenancy/ runs against make_mock_db() or a patched
# async_session — never the real database. But backend/.env points DATABASE_URL
# at the real dev Supabase project, and app.config.settings reads it once, at
# import time. If a future refactor moves a function without updating the test's
# patch target, the "mocked" call would fall through to the real async_session()
# and write to dev data — silently, since plenty of call sites fail open on a
# broad `except Exception` (see the do_connect guard below for why that matters).
#
# This block runs before any app.* import in the whole test session —
# tests/conftest.py is the first file pytest imports, and an env var wins over
# the .env file pydantic-settings reads — so by the time app.config.settings is
# built, it already points nowhere reachable. tests/tenancy/ needs the real URL
# (see its own conftest.py's _test_db_url) and sets TENANCY_DB_TESTS=1 before
# pytest even starts (tests/tenancy/_run.py), which is why this checks the flag
# instead of overriding unconditionally.
_TENANCY_MODE = os.getenv("TENANCY_DB_TESTS") == "1"
if not _TENANCY_MODE:
    os.environ["DATABASE_URL"] = "postgresql+asyncpg://guard:guard@127.0.0.1:1/unreachable-guard-db"

import asyncio  # noqa: E402 — must follow the DATABASE_URL guard above
import sys  # noqa: E402
import time  # noqa: E402
from unittest.mock import AsyncMock, MagicMock  # noqa: E402

import pytest  # noqa: E402

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


# ── Fail loud on a real connection attempt ───────────────────────────────────
#
# The guard above makes a leaked real connection fail on its own — but several
# call sites in app/ catch Exception broadly and fail open by design (e.g.
# `_already_pending` in email_ingest_service), so that failure can vanish into a
# log line and the test still passes. This listener records every DBAPI connect
# attempt on ANY SQLAlchemy engine built during the test, attached at the Engine
# class rather than an instance so it also catches the engine app.database
# builds lazily on first use. The autouse fixture below turns a recorded attempt
# into a hard test failure regardless of whether app code swallowed the error.
_db_connect_attempts: list[str] = []

if not _TENANCY_MODE:
    from sqlalchemy import event
    from sqlalchemy.engine import Engine

    @event.listens_for(Engine, "do_connect")
    def _record_connect_attempt(dialect, conn_rec, cargs, cparams):
        _db_connect_attempts.append(repr(cparams))


@pytest.fixture(autouse=True)
def _fail_on_real_db_attempt(request):
    """Fail any test that reaches a real DB connection instead of a mock/patch.

    Opt out with @pytest.mark.db_attempt_ok for a test that deliberately exercises
    the real connect path itself (e.g. asserting that a bad config fails to boot).
    """
    if _TENANCY_MODE:
        yield
        return
    _db_connect_attempts.clear()
    yield
    if _db_connect_attempts and "db_attempt_ok" not in {
        m.name for m in request.node.iter_markers()
    }:
        attempts = list(_db_connect_attempts)
        _db_connect_attempts.clear()
        pytest.fail(
            f"{request.node.nodeid} attempted {len(attempts)} real DB connection(s) — "
            "a patch on async_session (or the engine) is missing, or points at the "
            "wrong module after a move. Mark @pytest.mark.db_attempt_ok if this is "
            f"deliberate. Attempt(s): {attempts}"
        )


@pytest.fixture(autouse=True)
def _maintenance_inactive():
    """Force maintenance mode inactive for every test. The maintenance middleware
    reads a module-global cache; without this, a live maintenance flag in the DB
    (a real one is on right now during the pilot) or a prior test that seeded it
    would 503 unrelated router tests. A far-future ts keeps it from refreshing
    from the DB. Tests that exercise the flag re-seed the cache in their body."""
    from app.services.shared import maintenance as _maint

    _maint._cache.update(
        {
            "ts": time.monotonic() + 1_000_000,
            "enabled": False,
            "message": "",
            "window_start": None,
            "window_end": None,
            "tenants": set(),
        }
    )
    yield


# ── Mock DB session ───────────────────────────────────────────────────────────


def make_mock_db(execute_rows=None, execute_lastrowid=None):
    """Return an AsyncMock AsyncSession backed by a MagicMock execute result.

    Using MagicMock (not custom classes) for the result object means callers
    can override behaviour with .return_value / .side_effect at any nesting
    depth without AttributeError.
    """
    db = AsyncMock()

    first_row = execute_rows[0] if execute_rows else None
    result = MagicMock()
    result.scalars.return_value.first.return_value = first_row
    result.scalars.return_value.all.return_value = list(execute_rows or [])
    result.scalar_one_or_none.return_value = first_row
    result.lastrowid = execute_lastrowid or 1

    db.execute.return_value = result
    db.get.return_value = None
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.add = MagicMock()
    return db


# ── Session / context helpers ─────────────────────────────────────────────────


def set_context(tenant_id="t-001", carmen_user_id="u-001"):
    from app.context import current_carmen_user_id, current_tenant_id

    current_tenant_id.set(tenant_id)
    current_carmen_user_id.set(carmen_user_id)


@pytest.fixture(autouse=False)
def ctx():
    """Set standard context vars for unit tests that need them."""
    set_context()
    yield
    set_context("", "")


@pytest.fixture(autouse=True)
def clear_service_caches():
    """Wipe in-process caches before every test to prevent state leak between tests."""
    from app.services.shared import pricing_cache

    pricing_cache._PRICING_CACHE.clear()
    yield
