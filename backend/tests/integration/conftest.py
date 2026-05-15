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
    business_unit_id="bu-test",
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

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_session] = lambda: FAKE_SESSION

    with (
        patch("app.main.ensure_db", new_callable=AsyncMock),
        patch("app.services.usage_service.fetch_openrouter_pricing", new_callable=AsyncMock),
        TestClient(app, raise_server_exceptions=True) as client,
    ):
        yield client

    app.dependency_overrides.clear()
