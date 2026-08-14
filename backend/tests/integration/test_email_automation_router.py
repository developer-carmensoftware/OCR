"""
Integration tests for /api/v1/carmen/settings — the entry point Carmen calls with
the logged-in user's own Carmen token, and our operators call with an admin JWT.

`_caller` is tested directly (its job is narrow: turn an Authorization header into a
Caller or reject it) and `_resolve` likewise, because that is where a Carmen token is
actually proven. The route-level tests then override `_caller` to prove the routes are
wired to it, plus one real 401 to prove a bad header is rejected before any handler runs.
"""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.auth.admin_session import AdminPrincipal
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


def _admin(perms=("configs:write",), tenant_scope=""):
    """An operator principal. Defaults to what the real `admin` role carries: the
    permission this API requires, and no tenant scope (i.e. global)."""
    return AdminPrincipal(
        admin_id="a-1",
        username="alice",
        roles=["admin"],
        perms=set(perms),
        tenant_scope=tenant_scope,
    )


def _admin_caller(**kwargs):
    """What `_caller` returns for a permitted operator — the shape route tests need,
    since `_resolve` now refuses a `Caller` that carries no proven identity at all."""
    return Caller("admin:alice", None, _admin(**kwargs))


# ── _caller ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_caller_missing_header_is_401():
    with pytest.raises(HTTPException) as exc:
        await _caller(_request(), authorization=None)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_caller_takes_a_bare_carmen_token():
    """The form Carmen actually sends: `Authorization: <token>`, no scheme label.

    Every other call in their world looks like this, so requiring a label unique to
    our API would be one more thing to get wrong for something a prefix cannot prove.
    """
    caller = await _caller(_request(), authorization=CARMEN_TOKEN)
    assert caller.carmen_token == CARMEN_TOKEN
    assert caller.actor == "user:3fa85f64-5717-4562-b3fc-2c963f66afa6"


@pytest.mark.asyncio
async def test_caller_still_takes_the_labelled_form():
    """`CarmenToken <token>` keeps working, so an early integration does not break."""
    caller = await _caller(_request(), authorization=f"CarmenToken {CARMEN_TOKEN}")
    assert caller.carmen_token == CARMEN_TOKEN


@pytest.mark.asyncio
async def test_caller_rejects_a_header_that_cannot_be_a_token():
    """Anything not `Bearer …` is read as a Carmen token, so the shape check is what
    turns junk away — including another scheme's credentials."""
    with pytest.raises(HTTPException) as exc:
        await _caller(_request(), authorization="Basic dXNlcjpwYXNz")
    assert exc.value.status_code == 401
    assert exc.value.detail == "Malformed Carmen token"


@pytest.mark.asyncio
async def test_caller_empty_header_is_401():
    with pytest.raises(HTTPException):
        await _caller(_request(), authorization="   ")


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
    with patch("app.routers.email_automation.decode_admin_principal", return_value=_admin()):
        caller = await _caller(_request(), authorization="Bearer sometoken")
    assert caller.actor == "admin:alice"
    assert caller.carmen_token is None  # operator path — nothing to prove against Carmen
    assert caller.admin is not None  # …so `tenant_scope` has to travel with it


@pytest.mark.asyncio
async def test_caller_invalid_admin_bearer_is_401():
    with patch(
        "app.routers.email_automation.decode_admin_principal",
        side_effect=HTTPException(401, "Invalid or expired admin token"),
    ):
        with pytest.raises(HTTPException) as exc:
            await _caller(_request(), authorization="Bearer garbage")
    assert exc.value.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "perms",
    [
        (),  # a token with no permissions at all
        ("configs:read", "tenants:read", "audit:read"),  # the seeded `viewer` role
        ("orders:read", "orders:write"),  # `order_reviewer` — write, but not this write
    ],
)
async def test_a_signed_admin_token_authorises_nothing_on_its_own(perms):
    """Authentication is not authorisation.

    A GET here returns the BU's `ingest_address`, which *is* the capability to post a
    document into that BU's Carmen books — so `viewer`'s read-only permissions must not
    reach it either. That is why the gate is `configs:write` and not `configs:read`.
    """
    with patch(
        "app.routers.email_automation.decode_admin_principal", return_value=_admin(perms=perms)
    ):
        with pytest.raises(HTTPException) as exc:
            await _caller(_request(), authorization="Bearer sometoken")
    assert exc.value.status_code == 403
    assert "configs:write" in exc.value.detail


# ── _resolve — where a Carmen token is actually proven ─────────────────────────


@pytest.mark.asyncio
async def test_resolve_proves_the_token_against_the_host_in_the_payload():
    """uri/bu are caller-supplied, so they are what the token is checked against."""
    from app.routers import email_automation as mod

    tenant = _tenant()
    validate = AsyncMock()
    with (
        patch.object(mod.es, "resolve_tenant", new_callable=AsyncMock, return_value=tenant),
        patch.object(mod, "_validate_token", validate),
    ):
        got = await _resolve(
            AsyncMock(), Caller("user:x", CARMEN_TOKEN), f"https://{tenant.host}", "hq"
        )

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
        await _resolve(AsyncMock(), _admin_caller(), "h", "b")
    validate.assert_not_awaited()


# ── The operator path's own boundary: tenant_scope ────────────────────────────
#
# There is no Carmen token to prove on this path, so `tenant_scope` is the whole of
# it. Skipping the check here would let a support admin scoped to one customer read
# every other customer's ingest address and rewrite their posting credential.


@pytest.mark.asyncio
async def test_resolve_refuses_a_scoped_admin_reaching_another_tenant():
    from app.routers import email_automation as mod

    tenant = _tenant()
    with patch.object(mod.es, "resolve_tenant", new_callable=AsyncMock, return_value=tenant):
        with pytest.raises(HTTPException) as exc:
            await _resolve(AsyncMock(), _admin_caller(tenant_scope=str(uuid4())), "h", "b")
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_resolve_allows_a_scoped_admin_on_its_own_tenant():
    from app.routers import email_automation as mod

    tenant = _tenant()
    with patch.object(mod.es, "resolve_tenant", new_callable=AsyncMock, return_value=tenant):
        got = await _resolve(AsyncMock(), _admin_caller(tenant_scope=str(tenant.id)), "h", "b")
    assert got is tenant


@pytest.mark.asyncio
async def test_resolve_allows_a_global_admin_anywhere():
    """`tenant_scope == ""` is what `AdminPrincipal.is_global` means — unchanged."""
    from app.routers import email_automation as mod

    tenant = _tenant()
    with patch.object(mod.es, "resolve_tenant", new_callable=AsyncMock, return_value=tenant):
        got = await _resolve(AsyncMock(), _admin_caller(), "h", "b")
    assert got is tenant


@pytest.mark.asyncio
async def test_resolve_refuses_an_admin_caller_carrying_no_principal():
    """No scope recorded must never read as "every tenant" — that is the failure mode
    the whole fix is about, so the missing-principal case is refused, not defaulted."""
    from app.routers import email_automation as mod

    with patch.object(mod.es, "resolve_tenant", new_callable=AsyncMock, return_value=_tenant()):
        with pytest.raises(HTTPException) as exc:
            await _resolve(AsyncMock(), Caller("admin:root", None), "h", "b")
    assert exc.value.status_code == 403


# ── _tenant_host — the lookup key, and only that ───────────────────────────────


@pytest.mark.parametrize(
    "value",
    [
        "https://hotelgroup.carmenwork.com",  # what Carmen actually sends
        "https://hotelgroup.carmenwork.com/",
        "https://HotelGroup.CarmenWork.com",
        "https://hotelgroup.carmenwork.com:8443/carmen?x=1",
        "  https://hotelgroup.carmenwork.com  ",
        "hotelgroup.carmenwork.com",  # a bare host, i.e. an old caller
    ],
)
def test_every_spelling_of_the_origin_gives_one_lookup_key(value):
    """Scheme, case, port, path and whitespace are all noise around one hostname.

    This is the same derivation `/auth/exchange` ran when it created the tenant row
    (`urlparse(...).hostname`), which is why the two always agree.
    """
    from app.routers.email_automation import _tenant_host

    assert _tenant_host(value) == "hotelgroup.carmenwork.com"


@pytest.mark.parametrize("value", ["", "   ", "not a url", "https://[::1"])
def test_a_value_that_names_no_host_is_left_to_the_lookup(value):
    """No exception here: anything that matches no tenant is already a 400, and that
    is the only honest answer — we cannot tell a typo from a BU that never signed in."""
    from app.routers.email_automation import _tenant_host

    assert _tenant_host(value) == value.strip().lower()


@pytest.mark.asyncio
async def test_the_token_is_proved_against_the_tenants_own_origin_not_the_uri_sent():
    """The caller's `uri` stops at the lookup. **This is the case commit e870788
    removed a payload field to prevent**: an origin from the request must never
    reach `_validate_token`, or a token proven against one Carmen could be posted
    to another.
    """
    from app.routers import email_automation as mod

    tenant = _tenant()
    validate = AsyncMock()
    with (
        patch.object(mod.es, "resolve_tenant", new_callable=AsyncMock, return_value=tenant),
        patch.object(mod, "_validate_token", validate),
    ):
        await _resolve(AsyncMock(), Caller("user:x", CARMEN_TOKEN), "https://evil.com", "hq")

    _, uri = validate.await_args.args
    assert uri == f"https://{tenant.host}"
    assert "evil.com" not in uri


@pytest.mark.asyncio
async def test_an_unknown_origin_never_reaches_carmen():
    """The lookup is the gate: no tenant, no outbound request at all."""
    from app.exceptions import ValidationError
    from app.routers import email_automation as mod

    validate = AsyncMock()
    with (
        patch.object(
            mod.es,
            "resolve_tenant",
            new_callable=AsyncMock,
            side_effect=ValidationError("Unknown business unit"),
        ),
        patch.object(mod, "_validate_token", validate),
    ):
        with pytest.raises(ValidationError):
            await _resolve(AsyncMock(), Caller("user:x", CARMEN_TOKEN), "https://evil.com", "hq")
    validate.assert_not_awaited()


# ── Routes — wiring + the un-overridden 401 path ──────────────────────────────


def test_get_settings_401_without_authorization_header():
    with make_test_client(AsyncMock()) as client:
        resp = client.get(f"{BASE}/settings", params={"uri": "https://h.example.com", "bu": "b"})
    assert resp.status_code == 401


def test_get_settings_reaches_handler_for_both_auth_styles():
    """Overrides `_caller` (proven independently above) to isolate route wiring."""
    from app.main import app
    from app.services import email_settings_service as es

    # make_test_client() clears dependency_overrides itself on exit, so no manual
    # cleanup is needed (and would double-clear / KeyError if attempted here).
    app.dependency_overrides[_caller] = lambda: _admin_caller()
    body = {"status": {"ready": False, "blockers": ["not_configured"]}, "entitled": True}
    with (
        patch.object(es, "resolve_tenant", new_callable=AsyncMock, return_value=MagicMock()),
        patch.object(es, "get_settings", new_callable=AsyncMock, return_value=None),
        patch.object(es, "build_settings_response", new_callable=AsyncMock, return_value=body),
    ):
        with make_test_client(AsyncMock()) as client:
            resp = client.get(
                f"{BASE}/settings", params={"uri": "https://h.example.com", "bu": "b"}
            )
    assert resp.status_code == 200
    assert resp.json()["status"]["blockers"] == ["not_configured"]


def test_get_settings_without_a_uri_is_a_422():
    """`uri` is required. FastAPI answers before the handler, which is why nothing
    downstream has to invent a "no identity" case."""
    from app.main import app

    app.dependency_overrides[_caller] = lambda: _admin_caller()
    with make_test_client(AsyncMock()) as client:
        resp = client.get(f"{BASE}/settings", params={"bu": "b"})
    assert resp.status_code == 422


# ── Notifications — interim poll substitute for the unbuilt webhook ───────────


def test_get_notifications_401_without_authorization_header():
    with make_test_client(AsyncMock()) as client:
        resp = client.get(
            f"{BASE}/notifications", params={"uri": "https://h.example.com", "bu": "b"}
        )
    assert resp.status_code == 401


def test_get_notifications_reaches_handler_and_answers_a_bare_bool():
    """A badge, not a feed — the full list stays the in-app bell's endpoint."""
    from app.main import app
    from app.services import email_settings_service as es
    from app.services import notification_service

    app.dependency_overrides[_caller] = lambda: _admin_caller()
    with (
        patch.object(es, "resolve_tenant", new_callable=AsyncMock, return_value=_tenant()),
        patch.object(
            notification_service, "has_notification", new_callable=AsyncMock, return_value=True
        ),
    ):
        with make_test_client(AsyncMock()) as client:
            resp = client.get(
                f"{BASE}/notifications", params={"uri": "https://h.example.com", "bu": "b"}
            )
    assert resp.status_code == 200
    assert resp.json() == {"has_notification": True}


def test_get_notifications_passes_since_through_to_the_service():
    """The cursor is the caller's, so it has to survive the route unchanged —
    without it the answer is 'has unread', which never clears for an unattended BU."""
    from app.main import app
    from app.services import email_settings_service as es
    from app.services import notification_service

    app.dependency_overrides[_caller] = lambda: _admin_caller()
    has_notification = AsyncMock(return_value=False)
    with (
        patch.object(es, "resolve_tenant", new_callable=AsyncMock, return_value=_tenant()),
        patch.object(notification_service, "has_notification", has_notification),
    ):
        with make_test_client(AsyncMock()) as client:
            resp = client.get(
                f"{BASE}/notifications",
                params={
                    "uri": "https://h.example.com",
                    "bu": "b",
                    "since": "2026-08-13T03:15:00Z",
                },
            )
    assert resp.status_code == 200
    assert resp.json() == {"has_notification": False}
    assert has_notification.await_args.args[2] == datetime(2026, 8, 13, 3, 15, tzinfo=UTC)


def test_storing_a_token_targets_only_the_tenants_own_origin():
    """The credential-bearing path, end to end: whatever origin the body claims, the
    one handed to `set_token` — and therefore stored and later posted with — is the
    tenant's own."""
    from app.main import app
    from app.routers import email_automation as mod
    from app.services import email_settings_service as es

    app.dependency_overrides[_caller] = lambda: _admin_caller()
    tenant = _tenant()
    set_token = AsyncMock(return_value=SimpleNamespace(carmen_token_fp="abc12345"))
    with (
        patch.object(es, "resolve_tenant", new_callable=AsyncMock, return_value=tenant),
        # Patched off so the assertion is about the value, not the SSRF allowlist.
        patch.object(mod, "_validate_uri", lambda uri: uri),
        patch.object(es, "set_token", set_token),
        patch.object(es, "token_status", lambda row: {"configured": True}),
    ):
        with make_test_client(AsyncMock()) as client:
            resp = client.put(
                f"{BASE}/settings/token",
                json={"uri": "https://evil.com", "bu": "hq", "token": CARMEN_TOKEN},
            )

    assert resp.status_code == 200
    assert set_token.await_args.args[3] == f"https://{tenant.host}"


# ── Bank codes — reference data, not tenant-scoped ─────────────────────────────


def test_bank_codes_401_without_authorization_header():
    with make_test_client(AsyncMock()) as client:
        resp = client.get(f"{BASE}/bank-codes")
    assert resp.status_code == 401


def test_bank_codes_reaches_handler_and_returns_the_service_list():
    from app.main import app
    from app.services import email_settings_service as es

    app.dependency_overrides[_caller] = lambda: _admin_caller()
    banks = [{"code": "BBL", "name": "Bangkok Bank"}, {"code": "KTC", "name": "Krungthai Card"}]
    with patch.object(es, "list_bank_codes", new_callable=AsyncMock, return_value=banks):
        with make_test_client(AsyncMock()) as client:
            resp = client.get(f"{BASE}/bank-codes")
    assert resp.status_code == 200
    assert resp.json() == {"banks": banks}
