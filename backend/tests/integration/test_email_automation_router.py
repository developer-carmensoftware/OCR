"""
Integration tests for /api/v1/carmen/settings — the entry point Carmen calls with
the logged-in user's own Carmen token, and our operators call with an admin JWT.

`_caller` is tested directly (its job is narrow: turn an Authorization header into a
Caller or reject it) and `_resolve` likewise, because that is where a Carmen token is
actually proven. The route-level tests then override `_caller` to prove the routes are
wired to it, plus one real 401 to prove a bad header is rejected before any handler runs.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.exceptions import RequestRateLimitExceeded
from app.routers.email_automation import Caller, _caller, _resolve
from tests.integration.conftest import make_test_client

BASE = "/api/v1/carmen"

# Carmen's real token format is "<hash>|<user_uuid>", and the value can carry a space —
# `direct <key>` is what the dev instance issues. Parsing must survive that.
CARMEN_TOKEN = "direct 9f3ac1|3fa85f64-5717-4562-b3fc-2c963f66afa6"


def _request(ip: str = "203.0.113.9"):
    """Minimal stand-in for the Request the rate limiter reads a client IP from."""
    return SimpleNamespace(client=SimpleNamespace(host=ip), headers={}, scope={})


def _tenant(host="hotelgroup.carmenwork.com", bu="hq"):
    return SimpleNamespace(id=uuid4(), host=host, bu_code=bu)


# ── _caller ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_caller_missing_header_is_401():
    with pytest.raises(HTTPException) as exc:
        await _caller(_request(), authorization=None)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_caller_unknown_scheme_is_401():
    with pytest.raises(HTTPException) as exc:
        await _caller(_request(), authorization="Basic dXNlcjpwYXNz")
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_caller_scheme_with_no_value_is_401():
    with pytest.raises(HTTPException):
        await _caller(_request(), authorization="CarmenToken   ")


@pytest.mark.asyncio
async def test_caller_keeps_a_carmen_token_that_contains_a_space():
    """The whole credential, not the first word.

    A naive split() would hand Carmen back half a token and every call would 401
    with a message blaming the customer.
    """
    caller = await _caller(_request(), authorization=f"CarmenToken {CARMEN_TOKEN}")
    assert caller.carmen_token == CARMEN_TOKEN
    assert caller.actor == "user:3fa85f64-5717-4562-b3fc-2c963f66afa6"


@pytest.mark.asyncio
async def test_caller_rate_limits_the_carmen_token_path(_fresh_limiters):
    """This path makes an outbound call before the caller is known to be genuine."""
    from app.routers import email_automation as mod

    req = _request(ip="198.51.100.7")
    with pytest.raises(RequestRateLimitExceeded):
        for _ in range(mod._settings_limiter._max + 1):
            await _caller(req, authorization=f"CarmenToken {CARMEN_TOKEN}")


# ── Keeping a junk request cheap ──────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "token",
    [
        "garbage",  # no separator — cannot be a Carmen token
        "x" * 513,  # absurd length, before we allocate anything on it
    ],
)
async def test_implausible_tokens_are_rejected_before_any_work(token):
    """The cheapest guard: no DB read, no DNS, no outbound call for random junk."""
    with pytest.raises(HTTPException) as exc:
        await _caller(_request(ip="198.51.100.20"), authorization=f"CarmenToken {token}")
    assert exc.value.status_code == 401
    assert exc.value.detail == "Malformed Carmen token"


@pytest.fixture
def _fresh_limiters():
    """The limiters are module-level and shared, so a test that fills one has to
    hand it back empty — otherwise it decides the outcome of whatever runs next."""
    from app.routers import email_automation as mod

    for limiter in (mod._settings_limiter, mod._probe_ceiling):
        limiter._calls.clear()
    yield
    for limiter in (mod._settings_limiter, mod._probe_ceiling):
        limiter._calls.clear()


@pytest.mark.asyncio
async def test_a_global_ceiling_limits_probes_regardless_of_source_ip(_fresh_limiters):
    """Per-IP is the wrong axis for distributed traffic, and the outbound call lands
    on the customer's Carmen — so there is a ceiling that ignores who is asking."""
    from app.routers import email_automation as mod

    with pytest.raises(RequestRateLimitExceeded):
        for i in range(mod._probe_ceiling._max + 1):
            # A different IP every time: only the global ceiling can stop this.
            await _caller(
                _request(ip=f"203.0.113.{i % 256}"), authorization=f"CarmenToken {CARMEN_TOKEN}"
            )


@pytest.mark.asyncio
async def test_a_rejected_token_is_remembered_so_replaying_it_is_free():
    from app.routers import email_automation as mod

    mod._rejected.clear()
    validate = AsyncMock(side_effect=HTTPException(401, "Carmen token rejected"))
    with (
        patch.object(mod.es, "resolve_tenant", new_callable=AsyncMock, return_value=_tenant()),
        patch.object(mod, "_validate_token", validate),
    ):
        for _ in range(5):
            with pytest.raises(HTTPException):
                await _resolve(AsyncMock(), Caller("user:x", CARMEN_TOKEN), "h", "b")

    assert validate.await_count == 1, "Carmen should be asked once, not five times"


@pytest.mark.asyncio
async def test_an_unreachable_carmen_is_not_remembered_as_a_rejection():
    """502 means we could not ask — caching that would turn an outage into a lockout."""
    from app.routers import email_automation as mod

    mod._rejected.clear()
    validate = AsyncMock(side_effect=HTTPException(502, "Cannot reach Carmen"))
    with (
        patch.object(mod.es, "resolve_tenant", new_callable=AsyncMock, return_value=_tenant()),
        patch.object(mod, "_validate_token", validate),
    ):
        for _ in range(3):
            with pytest.raises(HTTPException):
                await _resolve(AsyncMock(), Caller("user:x", CARMEN_TOKEN), "h", "b")

    assert validate.await_count == 3, "every attempt must reach Carmen again"


@pytest.mark.asyncio
async def test_a_valid_token_is_never_cached():
    """A token Carmen accepted may be revoked a minute later; a stale yes is a hole."""
    from app.routers import email_automation as mod

    validate = AsyncMock()
    with (
        patch.object(mod.es, "resolve_tenant", new_callable=AsyncMock, return_value=_tenant()),
        patch.object(mod, "_validate_token", validate),
    ):
        for _ in range(3):
            await _resolve(AsyncMock(), Caller("user:x", CARMEN_TOKEN), "h", "b")

    assert validate.await_count == 3


@pytest.mark.asyncio
async def test_caller_valid_admin_bearer_returns_actor():
    with patch(
        "app.routers.email_automation.decode_admin_jwt",
        return_value={"aid": "a-1", "username": "alice"},
    ):
        caller = await _caller(_request(), authorization="Bearer sometoken")
    assert caller.actor == "admin:alice"
    assert caller.carmen_token is None  # operator path — nothing to prove against Carmen


@pytest.mark.asyncio
async def test_caller_invalid_admin_bearer_is_401():
    with patch("app.routers.email_automation.decode_admin_jwt", side_effect=ValueError("bad")):
        with pytest.raises(HTTPException) as exc:
            await _caller(_request(), authorization="Bearer garbage")
    assert exc.value.status_code == 401


# ── _resolve — where a Carmen token is actually proven ─────────────────────────


@pytest.mark.asyncio
async def test_resolve_proves_the_token_against_the_host_in_the_payload():
    """host/bu are caller-supplied, so they are what the token is checked against."""
    from app.routers import email_automation as mod

    tenant = _tenant()
    validate = AsyncMock()
    with (
        patch.object(mod.es, "resolve_tenant", new_callable=AsyncMock, return_value=tenant),
        patch.object(mod, "_validate_token", validate),
    ):
        got = await _resolve(AsyncMock(), Caller("user:x", CARMEN_TOKEN), tenant.host, "hq")

    assert got is tenant
    token, uri = validate.await_args.args
    assert token == CARMEN_TOKEN
    assert uri == f"https://{tenant.host}"  # the claimed host, not one we chose


@pytest.mark.asyncio
async def test_resolve_rejects_a_token_carmen_does_not_accept():
    from app.routers import email_automation as mod

    with (
        patch.object(mod.es, "resolve_tenant", new_callable=AsyncMock, return_value=_tenant()),
        patch.object(
            mod,
            "_validate_token",
            AsyncMock(side_effect=HTTPException(401, "Carmen token rejected")),
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            await _resolve(AsyncMock(), Caller("user:x", "not-a-real-token"), "h", "b")
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_resolve_keeps_unreachable_carmen_distinct_from_a_bad_token():
    """502 vs 401 is the difference between 'your server is down' and 'log in again'."""
    from app.routers import email_automation as mod

    with (
        patch.object(mod.es, "resolve_tenant", new_callable=AsyncMock, return_value=_tenant()),
        patch.object(
            mod,
            "_validate_token",
            AsyncMock(side_effect=HTTPException(502, "Cannot reach Carmen")),
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            await _resolve(AsyncMock(), Caller("user:x", CARMEN_TOKEN), "h", "b")
    assert exc.value.status_code == 502


@pytest.mark.asyncio
async def test_resolve_skips_the_probe_for_the_admin_path():
    from app.routers import email_automation as mod

    validate = AsyncMock()
    with (
        patch.object(mod.es, "resolve_tenant", new_callable=AsyncMock, return_value=_tenant()),
        patch.object(mod, "_validate_token", validate),
    ):
        await _resolve(AsyncMock(), Caller("admin:root", None), "h", "b")
    validate.assert_not_awaited()


# ── Routes — wiring + the un-overridden 401 path ──────────────────────────────


def test_get_settings_401_without_authorization_header():
    with make_test_client(AsyncMock()) as client:
        resp = client.get(f"{BASE}/settings", params={"host": "h", "bu": "b"})
    assert resp.status_code == 401


def test_get_settings_reaches_handler_for_both_auth_styles():
    """Overrides `_caller` (proven independently above) to isolate route wiring."""
    from app.main import app
    from app.services import email_settings_service as es

    # make_test_client() clears dependency_overrides itself on exit, so no manual
    # cleanup is needed (and would double-clear / KeyError if attempted here).
    app.dependency_overrides[_caller] = lambda: Caller("test-actor", None)
    body = {"status": {"ready": False, "blockers": ["not_configured"]}, "entitled": True}
    with (
        patch.object(es, "resolve_tenant", new_callable=AsyncMock, return_value=MagicMock()),
        patch.object(es, "get_settings", new_callable=AsyncMock, return_value=None),
        patch.object(es, "build_settings_response", new_callable=AsyncMock, return_value=body),
    ):
        with make_test_client(AsyncMock()) as client:
            resp = client.get(f"{BASE}/settings", params={"host": "h", "bu": "b"})
    assert resp.status_code == 200
    assert resp.json()["status"]["blockers"] == ["not_configured"]
