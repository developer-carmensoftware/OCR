"""
Integration test helpers.

Uses starlette TestClient as a context manager (one persistent anyio event
loop per test).  Without the context manager, each request spawns and tears
down its own thread + event loop, which on Windows corrupts pytest's capture
state between tests.

ensure_db / fetch_openrouter_pricing are patched out so no real DB/network
calls happen when TestClient enters the ASGI lifespan.
"""

from contextlib import contextmanager
from unittest.mock import AsyncMock, patch

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


@contextmanager
def make_test_client(mock_db):
    """Yield a configured TestClient with auth + DB overridden.

    Patches lifespan hooks so no real DB or network connections are made.
    """
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

        current_tenant_id.set(FAKE_SESSION.tenant_id)
        current_carmen_user_id.set(FAKE_SESSION.carmen_user_id)
        current_username.set(FAKE_SESSION.username)
        current_ocr_session_id.set(FAKE_SESSION.session_id)
        current_carmen_token.set(FAKE_SESSION.carmen_token)
        current_carmen_uri.set(FAKE_SESSION.carmen_uri)
        return FAKE_SESSION

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
