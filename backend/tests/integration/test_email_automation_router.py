"""
Integration tests for /api/v1/carmen/settings — the dual-auth entry point
Carmen (ApiKey) and our own simulated settings page (admin Bearer) both call.

`_caller` is tested directly (async, mocked db) rather than end-to-end through
every downstream service call, since its job is narrow: resolve an
Authorization header to an actor string or reject it. The route-level tests
then override `_caller` via dependency_overrides to prove the routes are wired
to it, plus one real (non-overridden) 401 case to prove a bad header is
actually rejected before reaching business logic.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.routers.email_automation import _caller
from tests.integration.conftest import make_test_client

BASE = "/api/v1/carmen"


def _exec(scalar_one_or_none=None):
    r = MagicMock()
    r.scalar_one_or_none.return_value = scalar_one_or_none
    return r


# ── _caller — unit ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_caller_missing_header_is_401():
    with pytest.raises(HTTPException) as exc:
        await _caller(db=AsyncMock(), authorization=None)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_caller_unknown_scheme_is_401():
    with pytest.raises(HTTPException) as exc:
        await _caller(db=AsyncMock(), authorization="Basic dXNlcjpwYXNz")
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_caller_valid_api_key_returns_actor():
    db = AsyncMock()
    key_row = MagicMock(name="Carmen staging")
    key_row.name = "Carmen staging"
    db.execute = AsyncMock(return_value=_exec(scalar_one_or_none=key_row))

    actor = await _caller(db=db, authorization="ApiKey ocr_live_abc123")
    assert actor == "apikey:Carmen staging"


@pytest.mark.asyncio
async def test_caller_unknown_api_key_is_401():
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_exec(scalar_one_or_none=None))
    with pytest.raises(HTTPException) as exc:
        await _caller(db=db, authorization="ApiKey not-a-real-key")
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_caller_valid_admin_bearer_returns_actor():
    with patch(
        "app.routers.email_automation.decode_admin_jwt",
        return_value={"aid": "a-1", "username": "alice"},
    ):
        actor = await _caller(db=AsyncMock(), authorization="Bearer sometoken")
    assert actor == "admin:alice"


@pytest.mark.asyncio
async def test_caller_invalid_admin_bearer_is_401():
    with patch("app.routers.email_automation.decode_admin_jwt", side_effect=ValueError("bad")):
        with pytest.raises(HTTPException) as exc:
            await _caller(db=AsyncMock(), authorization="Bearer garbage")
    assert exc.value.status_code == 401


# ── Routes — wiring + the un-overridden 401 path ──────────────────────────────


def test_get_settings_401_without_authorization_header():
    with make_test_client(AsyncMock()) as client:
        resp = client.get(f"{BASE}/settings", params={"host": "h", "bu": "b"})
    assert resp.status_code == 401


def test_get_settings_reaches_handler_for_both_auth_styles():
    """Overrides `_caller` (proven independently above) to isolate route wiring —
    both auth styles must reach the same GET handler and get the same shape back."""
    from app.main import app
    from app.services import email_ingest_service as ingest_svc
    from app.services import email_settings_service as es

    # make_test_client() clears dependency_overrides itself on exit, so no manual
    # cleanup is needed (and would double-clear / KeyError if attempted here).
    app.dependency_overrides[_caller] = lambda: "test-actor"
    with (
        patch.object(es, "resolve_tenant", new_callable=AsyncMock, return_value=MagicMock()),
        patch.object(es, "get_settings", new_callable=AsyncMock, return_value=None),
        patch.object(ingest_svc, "get_settings_status", new_callable=AsyncMock),
    ):
        with make_test_client(AsyncMock()) as client:
            resp = client.get(f"{BASE}/settings", params={"host": "h", "bu": "b"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"]["blockers"] == ["not_configured"]
    assert body["entitled"] is True
