"""
Shared fixtures for all backend tests.

Sets WindowsSelectorEventLoopPolicy at import time so pytest-asyncio uses
SelectorEventLoop instead of ProactorEventLoop.  ProactorEventLoop registers
its internal handles with the Windows I/O completion port; when it closes,
it can close file handles that pytest's capture mechanism still holds open,
causing "I/O operation on closed file" between tests.
"""

import asyncio
import sys
import time
from unittest.mock import AsyncMock, MagicMock

import pytest

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


@pytest.fixture(autouse=True)
def _maintenance_inactive():
    """Force maintenance mode inactive for every test. The maintenance middleware
    reads a module-global cache; without this, a live maintenance flag in the DB
    (a real one is on right now during the pilot) or a prior test that seeded it
    would 503 unrelated router tests. A far-future ts keeps it from refreshing
    from the DB. Tests that exercise the flag re-seed the cache in their body."""
    from app.services import maintenance_service as _maint

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
    from app.services import usage_service

    usage_service._QUOTA_RULES_CACHE.clear()
    usage_service._PRICING_CACHE.clear()
    yield
