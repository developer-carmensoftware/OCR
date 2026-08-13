"""`decode_admin_principal` — the one place a signed admin JWT becomes an identity.

Three call sites depend on it (`get_current_admin`, `require_maintenance_auth`,
`email_automation._caller`), and what it must not do is drop a claim on the floor:
reading a username off the raw payload while ignoring `perms` and `tenant_scope` is
literally how the Email Automation Settings API came to grant every signed token full
cross-tenant access. So the first test here is not "does it decode" — it is "does the
authorisation data survive the trip".
"""

import pytest
from fastapi import HTTPException

from app.auth.admin_session import create_admin_jwt
from app.routers.admin.deps import decode_admin_principal, require_maintenance_auth

SECRET = "unit-test-secret-not-a-real-one"


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    """`get_admin_jwt_secret()` reads settings; pin it so no env is involved."""
    monkeypatch.setattr("app.routers.admin.deps.get_admin_jwt_secret", lambda: SECRET, raising=True)


def _token(perms=("configs:write",), tenant_scope="", **kwargs):
    return create_admin_jwt(
        admin_id=kwargs.pop("admin_id", "a-1"),
        username=kwargs.pop("username", "alice"),
        roles=["admin"],
        perms=list(perms),
        secret=SECRET,
        tenant_scope=tenant_scope,
        **kwargs,
    )


def test_perms_and_tenant_scope_survive_the_decode():
    """The claims that decide *what the caller may do*, not just who they are."""
    principal = decode_admin_principal(
        _token(perms=("configs:read", "configs:write"), tenant_scope="t-42")
    )
    assert principal.perms == {"configs:read", "configs:write"}
    assert principal.tenant_scope == "t-42"
    assert principal.is_global is False
    assert principal.has_perm("configs:write")
    assert not principal.has_perm("roles:write")


def test_no_tenant_scope_claim_means_global():
    assert decode_admin_principal(_token()).is_global is True


def test_a_token_with_no_permissions_decodes_to_no_permissions():
    """Not an error — deciding is the caller's job. It just must not become 'all'."""
    principal = decode_admin_principal(_token(perms=()))
    assert principal.perms == set()
    assert not principal.has_perm("configs:write")


def test_an_expired_token_is_401():
    with pytest.raises(HTTPException) as exc:
        decode_admin_principal(_token(ttl_hours=-1))
    assert exc.value.status_code == 401


def test_a_token_signed_with_another_secret_is_401():
    forged = create_admin_jwt(
        admin_id="a-1",
        username="mallory",
        roles=["super_admin"],
        perms=["configs:write"],
        secret="not-our-secret",
    )
    with pytest.raises(HTTPException) as exc:
        decode_admin_principal(forged)
    assert exc.value.status_code == 401


def test_a_token_with_no_aid_is_401():
    """A signed token naming nobody is not an identity."""
    with pytest.raises(HTTPException) as exc:
        decode_admin_principal(_token(admin_id=""))
    assert exc.value.status_code == 401


def test_garbage_is_401_not_an_exception_from_the_jwt_library():
    with pytest.raises(HTTPException) as exc:
        decode_admin_principal("not-a-jwt")
    assert exc.value.status_code == 401


# ── The maintenance dependency still gates on configs:write ───────────────────


def test_maintenance_auth_refuses_a_signed_token_without_the_permission():
    with pytest.raises(HTTPException) as exc:
        require_maintenance_auth(authorization=f"Bearer {_token(perms=('configs:read',))}")
    assert exc.value.status_code == 403


def test_maintenance_auth_accepts_configs_write():
    admin = require_maintenance_auth(authorization=f"Bearer {_token()}")
    assert admin is not None and admin.admin_id == "a-1"
