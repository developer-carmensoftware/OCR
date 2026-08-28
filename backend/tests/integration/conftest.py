"""
Integration test helpers.

Uses starlette TestClient as a context manager (one persistent anyio event
loop per test).  Without the context manager, each request spawns and tears
down its own thread + event loop, which on Windows corrupts pytest's capture
state between tests.

ensure_db / fetch_openrouter_pricing are patched out so no real DB/network
calls happen when TestClient enters the ASGI lifespan.
"""

import itertools
from contextlib import contextmanager
from unittest.mock import AsyncMock, patch

import pytest

from app.auth.session import SessionInfo

FAKE_SESSION = SessionInfo(
    session_id="sess-test-001",
    carmen_token="tok",
    carmen_user_id="u-test",
    username="tester",
    tenant_id="t-test",
    carmen_uri="https://test.carmenwork.com",
    bu="BU01",
)


@pytest.fixture(autouse=True)
def _isolate_rate_limiter():
    """Give every test its own client IP, so the rate limiter cannot leak between them.

    The limiter is an in-memory sliding window keyed per IP, and every TestClient request
    arrives from the same one — so the count accumulated across the whole session and the
    `default` bucket (120 per 60s) popped once the suite grew past it. The symptom was a
    429 in whichever unrelated test happened to be running at that moment, which meant
    adding a test anywhere could break tests everywhere.

    Patched at the seam rather than by reaching into the middleware's `self._windows`:
    the window is instance state on an object built lazily inside the middleware stack,
    and a unique IP is the same isolation without depending on where it lives.
    """
    counter = itertools.count()
    with patch(
        "app.middleware.rate_limit.get_client_ip",
        side_effect=lambda _request: f"10.0.0.{next(counter) % 250}",
    ):
        yield


@contextmanager
def make_test_client(mock_db, session=None):
    """Yield a configured TestClient with auth + DB overridden.

    Patches lifespan hooks so no real DB or network connections are made.

    `session` overrides FAKE_SESSION for one test. FAKE_SESSION's tenant_id is
    deliberately not a UUID — test_carmen_proxy relies on that to exercise the
    "no card to look up" branch — so a router that parses it with uuid.UUID()
    needs its own session rather than a change to the shared one.
    """
    session = session or FAKE_SESSION
    from starlette.testclient import TestClient

    from app.auth.dependencies import get_current_session
    from app.database import get_db
    from app.main import app

    async def _db():
        yield mock_db

    async def _session():
        # async so FastAPI runs this in the event loop — context vars set here
        # propagate to route handler coroutines (sync deps run in threadpool and
        # their ContextVar writes are NOT visible to the main coroutine).
        from app.context import (
            current_carmen_token,
            current_carmen_uri,
            current_carmen_user_id,
            current_ocr_session_id,
            current_tenant_id,
            current_username,
        )

        current_tenant_id.set(session.tenant_id)
        current_carmen_user_id.set(session.carmen_user_id)
        current_username.set(session.username)
        current_ocr_session_id.set(session.session_id)
        current_carmen_token.set(session.carmen_token)
        current_carmen_uri.set(session.carmen_uri)
        return session

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_session] = _session

    with (
        patch("app.lifecycle.ensure_db", new_callable=AsyncMock),
        patch("app.services.usage_service.fetch_openrouter_pricing", new_callable=AsyncMock),
        # _perf_flush_loop drains real log buffers against the DB; with asyncio.sleep
        # mocked below it would busy-spin and flood logs, so stub it out entirely.
        patch("app.lifecycle._perf_flush_loop", new_callable=AsyncMock),
        patch("app.lifecycle.asyncio.sleep", new_callable=AsyncMock),
        TestClient(app, raise_server_exceptions=True) as client,
    ):
        yield client

    app.dependency_overrides.clear()
