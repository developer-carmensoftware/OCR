"""is_maintenance: manual + scheduled-window + per-tenant OR semantics, fail-open."""

import time
from datetime import UTC, datetime, timedelta

import pytest

from app.services import maintenance_service as ms

# Cache reset between tests is handled by the autouse `_maintenance_inactive`
# fixture in tests/conftest.py; each test here re-seeds `_cache` as it needs.


def _seed(*, enabled=False, tenants=None, message="", start=None, end=None) -> None:
    # Freeze the cache fresh so is_maintenance() doesn't try to hit the DB.
    ms._cache.update(
        {
            "ts": time.monotonic() + 1000,
            "enabled": enabled,
            "tenants": tenants or set(),
            "message": message,
            "window_start": start,
            "window_end": end,
        }
    )


@pytest.mark.asyncio
async def test_manual_global_blocks_every_tenant():
    _seed(enabled=True, message="brb")
    assert await ms.is_maintenance("tenant-a") == (True, "brb")
    assert await ms.is_maintenance(None) == (True, "brb")


@pytest.mark.asyncio
async def test_per_tenant_override_is_scoped():
    _seed(enabled=False, tenants={"tenant-a"})
    active_a, _ = await ms.is_maintenance("tenant-a")
    active_b, _ = await ms.is_maintenance("tenant-b")
    assert active_a is True
    assert active_b is False


@pytest.mark.asyncio
async def test_window_future_is_not_active():
    now = datetime.now(UTC)
    _seed(start=now + timedelta(hours=1), end=now + timedelta(hours=2))
    active, _ = await ms.is_maintenance(None)
    assert active is False


@pytest.mark.asyncio
async def test_window_current_is_active():
    now = datetime.now(UTC)
    _seed(start=now - timedelta(minutes=5), end=now + timedelta(minutes=5))
    active, _ = await ms.is_maintenance(None)
    assert active is True


@pytest.mark.asyncio
async def test_window_past_is_not_active():
    now = datetime.now(UTC)
    _seed(start=now - timedelta(hours=2), end=now - timedelta(hours=1))
    active, _ = await ms.is_maintenance(None)
    assert active is False


@pytest.mark.asyncio
async def test_fail_open_on_db_error(monkeypatch):
    # Stale cache forces a refresh; make the refresh blow up → must NOT block.
    ms._cache["ts"] = 0.0

    def _boom(*_a, **_k):
        raise RuntimeError("db down")

    monkeypatch.setattr(ms, "async_session", _boom)
    assert await ms.is_maintenance("tenant-a") == (False, "")
