"""
Unit tests for app/routers/auth.py

Covers:
  - _validate_uri: SSRF protection (private IPs, loopback, non-https, edge cases)
  - _carmen_base: URL construction
  - InMemoryRateLimiter: per-IP sliding window, expiry, null client
  - ExchangeRequest: schema validation, optional fields
  - extract_user_id_from_token: all token formats
  - decode_session_jwt / create_session_jwt: round-trip, expiry, wrong secret
  - encrypt_carmen_token / decrypt_carmen_token: round-trip, wrong key
  - revoke_session endpoint: header format, invalid JWT, valid flow
"""

import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

# ── _validate_uri ─────────────────────────────────────────────────────────────


class TestValidateUri:
    """SSRF protection — every case here is a security-critical boundary."""

    def _call(self, uri: str, app_debug: bool = True):
        from app.config import settings
        from app.routers.auth import _validate_uri

        with patch.object(settings, "app_debug", app_debug):
            return _validate_uri(uri)

    # ── Happy path ────────────────────────────────────────────────────────────

    def test_valid_https_returns_normalised_origin(self):
        result = self._call("https://erp.carmenwork.com/some/path")
        assert result == "https://erp.carmenwork.com"

    def test_strips_path_and_query(self):
        result = self._call("https://erp.carmenwork.com/api?foo=bar")
        assert result == "https://erp.carmenwork.com"

    def test_preserves_non_standard_port(self):
        result = self._call("https://erp.carmenwork.com:8443")
        assert result == "https://erp.carmenwork.com:8443"

    def test_strips_fragment(self):
        result = self._call("https://erp.carmenwork.com/path#section")
        assert result == "https://erp.carmenwork.com"

    # ── Scheme enforcement ────────────────────────────────────────────────────

    def test_http_raises_400(self):
        with pytest.raises(HTTPException) as exc:
            self._call("http://erp.carmenwork.com")
        assert exc.value.status_code == 400
        assert "https" in exc.value.detail

    def test_empty_uri_raises_400(self):
        with pytest.raises(HTTPException) as exc:
            self._call("")
        assert exc.value.status_code == 400

    def test_ftp_scheme_raises_400(self):
        with pytest.raises(HTTPException):
            self._call("ftp://erp.carmenwork.com")

    def test_bare_domain_no_scheme_raises_400(self):
        # urlparse("erp.carmenwork.com") → scheme="" → not "https"
        with pytest.raises(HTTPException):
            self._call("erp.carmenwork.com")

    def test_missing_hostname_raises_400(self):
        # "https://" → parsed.hostname is None → empty hostname
        with pytest.raises(HTTPException) as exc:
            self._call("https://")
        assert exc.value.status_code == 400

    # ── SSRF: loopback / private IP blocking ──────────────────────────────────

    def test_localhost_blocked(self):
        with pytest.raises(HTTPException) as exc:
            self._call("https://localhost/api")
        assert exc.value.status_code == 400

    def test_127_0_0_1_blocked(self):
        with pytest.raises(HTTPException) as exc:
            self._call("https://127.0.0.1/api")
        assert exc.value.status_code == 400

    def test_private_ip_10_blocked(self):
        with pytest.raises(HTTPException) as exc:
            self._call("https://10.0.0.1/api")
        assert exc.value.status_code == 400

    def test_private_ip_192_168_blocked(self):
        with pytest.raises(HTTPException) as exc:
            self._call("https://192.168.1.100/api")
        assert exc.value.status_code == 400

    def test_private_ip_172_16_blocked(self):
        with pytest.raises(HTTPException) as exc:
            self._call("https://172.16.0.1/api")
        assert exc.value.status_code == 400

    def test_ipv6_loopback_blocked(self):
        with pytest.raises(HTTPException):
            self._call("https://[::1]/api")

    def test_link_local_blocked(self):
        with pytest.raises(HTTPException):
            self._call("https://169.254.169.254/latest/meta-data")

    def test_multicast_ip_blocked(self):
        with pytest.raises(HTTPException):
            self._call("https://224.0.0.1/api")

    def test_ipv6_link_local_blocked(self):
        with pytest.raises(HTTPException):
            self._call("https://[fe80::1]/api")

    def test_ipv6_private_ula_blocked(self):
        # fc00::/7 is ULA — private in Python's ipaddress
        with pytest.raises(HTTPException):
            self._call("https://[fc00::1]/api")

    def test_ip6_localhost_alias_blocked(self):
        # "ip6-localhost" is in BlockedHosts.LOOPBACK
        with pytest.raises(HTTPException):
            self._call("https://ip6-localhost/api")


# ── _carmen_base ──────────────────────────────────────────────────────────────


class TestCarmenBase:
    def _call(self, uri: str) -> str:
        from app.routers.auth import _carmen_base

        return _carmen_base(uri)

    def test_appends_api_path(self):
        assert self._call("https://erp.carmenwork.com") == (
            "https://erp.carmenwork.com/Carmen.API/api/interface"
        )

    def test_strips_trailing_slash(self):
        assert self._call("https://erp.carmenwork.com/") == (
            "https://erp.carmenwork.com/Carmen.API/api/interface"
        )

    def test_strips_multiple_trailing_slashes(self):
        assert self._call("https://erp.carmenwork.com///") == (
            "https://erp.carmenwork.com/Carmen.API/api/interface"
        )


# ── InMemoryRateLimiter ───────────────────────────────────────────────────────


class TestExchangeRateLimit:
    def _make_request(self, ip: str = "1.2.3.4"):
        req = MagicMock()
        req.client.host = ip
        return req

    def _limiter(self):
        from app.routers.auth import _exchange_limiter

        return _exchange_limiter

    def _reset(self):
        self._limiter()._calls.clear()

    def test_first_call_passes(self):
        self._reset()
        self._limiter().check(self._make_request("10.99.99.1"))

    def test_exceeding_limit_raises_429(self):
        self._reset()
        limiter = self._limiter()
        ip = "10.99.99.2"
        req = self._make_request(ip)

        for _ in range(limiter._max):
            limiter.check(req)

        from app.exceptions import RequestRateLimitExceeded

        with pytest.raises(RequestRateLimitExceeded) as exc:
            limiter.check(req)
        assert exc.value.retry_after == int(limiter._window)

    def test_different_ips_do_not_share_limit(self):
        self._reset()
        limiter = self._limiter()
        req_a = self._make_request("10.99.99.3")
        req_b = self._make_request("10.99.99.4")

        for _ in range(limiter._max):
            limiter.check(req_a)

        limiter.check(req_b)  # must not raise

    def test_calls_outside_window_do_not_count(self):
        self._reset()
        limiter = self._limiter()
        ip = "10.99.99.5"
        req = self._make_request(ip)

        # Plant stale timestamps (older than the window) — should not count
        past = time.monotonic() - limiter._window - 1.0
        limiter._calls[ip] = [past] * limiter._max

        limiter.check(req)  # must not raise — all prior calls are expired

    def test_null_client_falls_back_to_unknown_bucket(self):
        self._reset()
        limiter = self._limiter()
        req = MagicMock()
        req.client = None

        limiter.check(req)  # must not raise on first call
        assert "unknown" in limiter._calls


# ── ExchangeRequest schema ────────────────────────────────────────────────────


class TestExchangeInputValidation:
    """Schema validation — no live Carmen server needed."""

    def _schema(self):
        from app.routers.auth import ExchangeRequest

        return ExchangeRequest

    def test_requires_token(self):
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            self._schema()(bu="BU01")

    def test_requires_bu(self):
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            self._schema()(token="tok123")

    def test_valid_with_all_fields(self):
        req = self._schema()(token="tok", bu="BU01", uri="https://erp.example.com")
        assert req.token == "tok"
        assert req.bu == "BU01"
        assert req.uri == "https://erp.example.com"

    def test_uri_defaults_to_empty(self):
        req = self._schema()(token="tok", bu="BU01")
        assert req.uri == ""

    def test_user_defaults_to_empty(self):
        req = self._schema()(token="tok", bu="BU01")
        assert req.user == ""

    def test_user_field_stored_correctly(self):
        req = self._schema()(token="tok", bu="BU01", user="john.doe")
        assert req.user == "john.doe"


# ── extract_user_id_from_token ────────────────────────────────────────────────


class TestExtractUserIdEdgeCases:
    def _call(self, token: str) -> str:
        from app.auth.session import extract_user_id_from_token

        return extract_user_id_from_token(token)

    def test_real_carmen_token_format(self):
        token = "AbCdEfGhIjKlMnOpQrStUvWxYz012345|3f2504e0-4f89-11d3-9a0c-0305e82c3301"
        assert self._call(token) == "3f2504e0-4f89-11d3-9a0c-0305e82c3301"

    def test_token_without_pipe_returns_full_token(self):
        assert self._call("nopipetoken") == "nopipetoken"

    def test_empty_token_returns_empty(self):
        assert self._call("") == ""

    def test_multiple_pipes_splits_on_first_only(self):
        # split("|", 1) → ["hash", "uuid|extra"] — second segment contains the rest
        assert self._call("hash|uuid|extra") == "uuid|extra"

    def test_pipe_at_start_returns_right_segment(self):
        assert self._call("|uuid-part") == "uuid-part"


# ── decode_session_jwt / create_session_jwt ───────────────────────────────────


class TestSessionJwt:
    _SECRET = "test-secret-32-bytes-long-enough!"

    def _make_token(self, ttl_hours: float = 8.0, secret: str = _SECRET) -> str:
        from app.auth.session import create_session_jwt

        return create_session_jwt(
            session_id="sid-123",
            tenant_id="tid-456",
            carmen_user_id="cuid-789",
            username="testuser",
            bu="BU01",
            carmen_uri="https://erp.example.com",
            secret=secret,
            ttl_hours=ttl_hours,
        )

    def test_round_trip_decodes_all_claims(self):
        from app.auth.session import decode_session_jwt

        payload = decode_session_jwt(self._make_token(), self._SECRET)
        assert payload["sid"] == "sid-123"
        assert payload["tid"] == "tid-456"
        assert payload["cuid"] == "cuid-789"
        assert payload["username"] == "testuser"
        assert payload["bu"] == "BU01"
        assert payload["carmen_uri"] == "https://erp.example.com"

    def test_wrong_secret_raises_value_error(self):
        from app.auth.session import decode_session_jwt

        with pytest.raises(ValueError):
            decode_session_jwt(self._make_token(), "wrong-secret")

    def test_expired_token_raises_value_error(self):
        from app.auth.session import decode_session_jwt

        with pytest.raises(ValueError):
            decode_session_jwt(self._make_token(ttl_hours=-1), self._SECRET)

    def test_garbage_token_raises_value_error(self):
        from app.auth.session import decode_session_jwt

        with pytest.raises(ValueError):
            decode_session_jwt("not.a.valid.jwt", self._SECRET)

    def test_empty_token_raises_value_error(self):
        from app.auth.session import decode_session_jwt

        with pytest.raises(ValueError):
            decode_session_jwt("", self._SECRET)


# ── encrypt_carmen_token / decrypt_carmen_token ───────────────────────────────


class TestCarmenTokenEncryption:
    def _key(self) -> str:
        from cryptography.fernet import Fernet

        return Fernet.generate_key().decode()

    def test_round_trip(self):
        from app.auth.session import decrypt_carmen_token, encrypt_carmen_token

        key = self._key()
        plaintext = "direct abc123|3f2504e0-4f89-11d3-9a0c-0305e82c3301"
        assert decrypt_carmen_token(encrypt_carmen_token(plaintext, key), key) == plaintext

    def test_ciphertext_differs_from_plaintext(self):
        from app.auth.session import encrypt_carmen_token

        key = self._key()
        assert encrypt_carmen_token("my-token", key) != "my-token"

    def test_wrong_key_raises_value_error(self):
        from app.auth.session import decrypt_carmen_token, encrypt_carmen_token

        key_a, key_b = self._key(), self._key()
        with pytest.raises(ValueError):
            decrypt_carmen_token(encrypt_carmen_token("my-token", key_a), key_b)

    def test_tampered_ciphertext_raises_value_error(self):
        from app.auth.session import decrypt_carmen_token, encrypt_carmen_token

        key = self._key()
        ciphertext = encrypt_carmen_token("my-token", key)
        tampered = ciphertext[:-4] + "XXXX"
        with pytest.raises(ValueError):
            decrypt_carmen_token(tampered, key)


# ── revoke_session endpoint ───────────────────────────────────────────────────


class TestRevokeSessionEndpoint:
    """Header format + JWT decode validation without a live DB."""

    _SECRET = "test-secret-32-bytes-long-enough!"

    def _valid_token(self) -> str:
        from app.auth.session import create_session_jwt

        return create_session_jwt(
            session_id="sid-abc",
            tenant_id="tid-xyz",
            carmen_user_id="cuid-000",
            username="user",
            bu="BU01",
            carmen_uri="https://erp.example.com",
            secret=self._SECRET,
        )

    async def test_missing_bearer_prefix_raises_401(self):
        from app.config import settings
        from app.routers.auth import revoke_session

        with patch.object(settings, "ocr_jwt_secret", self._SECRET):
            with pytest.raises(HTTPException) as exc:
                await revoke_session(authorization="Token abc", db=MagicMock())
        assert exc.value.status_code == 401

    async def test_no_authorization_value_raises_401(self):
        from app.config import settings
        from app.routers.auth import revoke_session

        with patch.object(settings, "ocr_jwt_secret", self._SECRET):
            with pytest.raises(HTTPException) as exc:
                await revoke_session(authorization="notbearer", db=MagicMock())
        assert exc.value.status_code == 401

    async def test_invalid_jwt_raises_401(self):
        from app.config import settings
        from app.routers.auth import revoke_session

        with patch.object(settings, "ocr_jwt_secret", self._SECRET):
            with pytest.raises(HTTPException) as exc:
                await revoke_session(authorization="Bearer garbage.token.here", db=MagicMock())
        assert exc.value.status_code == 401

    async def test_expired_jwt_raises_401(self):
        from app.auth.session import create_session_jwt
        from app.config import settings
        from app.routers.auth import revoke_session

        expired = create_session_jwt(
            session_id="sid-exp",
            tenant_id="tid-exp",
            carmen_user_id="cuid-exp",
            username="user",
            bu="BU01",
            carmen_uri="https://erp.example.com",
            secret=self._SECRET,
            ttl_hours=-1,
        )
        with patch.object(settings, "ocr_jwt_secret", self._SECRET):
            with pytest.raises(HTTPException) as exc:
                await revoke_session(authorization=f"Bearer {expired}", db=MagicMock())
        assert exc.value.status_code == 401

    async def test_valid_jwt_calls_revoke_and_returns_ok(self):
        from app.config import settings
        from app.routers.auth import revoke_session

        token = self._valid_token()
        with (
            patch.object(settings, "ocr_jwt_secret", self._SECRET),
            patch("app.routers.auth.revoke_session_by_id", new=AsyncMock(return_value=True)),
            patch("app.auth.dependencies.invalidate_session_cache"),
        ):
            result = await revoke_session(authorization=f"Bearer {token}", db=MagicMock())

        assert result == {"ok": True}

    async def test_valid_jwt_session_not_found_still_returns_ok(self):
        from app.config import settings
        from app.routers.auth import revoke_session

        token = self._valid_token()
        with (
            patch.object(settings, "ocr_jwt_secret", self._SECRET),
            patch("app.routers.auth.revoke_session_by_id", new=AsyncMock(return_value=False)),
        ):
            result = await revoke_session(authorization=f"Bearer {token}", db=MagicMock())

        assert result == {"ok": True}


# ── _upsert_tenant (race-safe create) ─────────────────────────────────────────


class TestUpsertTenant:
    """_upsert_tenant returns an existing tenant or creates one via INSERT … ON
    CONFLICT DO NOTHING, then re-selects so concurrent first-logins can't duplicate
    or 500 the /exchange."""

    async def test_existing_tenant_returns_without_insert(self):
        from app.routers.auth import _upsert_tenant

        existing = MagicMock()
        sel = MagicMock()
        sel.scalar_one_or_none.return_value = existing
        db = AsyncMock()
        db.execute = AsyncMock(return_value=sel)

        result = await _upsert_tenant(db, "host.example.com", "BU01")

        assert result is existing
        db.execute.assert_called_once()  # SELECT only — no INSERT path

    async def test_new_tenant_inserts_then_reselects(self):
        from app.routers.auth import _upsert_tenant

        created = MagicMock()  # the tenant returned by the post-insert re-SELECT
        sel_miss = MagicMock()
        sel_miss.scalar_one_or_none.return_value = None
        ins = MagicMock()
        ins.first.return_value = ("00000000-0000-0000-0000-000000000001",)
        sel_hit = MagicMock()
        sel_hit.scalar_one.return_value = created

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[sel_miss, ins, sel_hit])

        result = await _upsert_tenant(db, "new.example.com", "BU02")

        assert result is created
        assert db.execute.call_count == 3  # SELECT(miss) → INSERT → SELECT(re-fetch)

    async def test_concurrent_insert_conflict_still_resolves_to_one_row(self):
        from app.routers.auth import _upsert_tenant

        # A concurrent txn won the race: our INSERT hits ON CONFLICT (no RETURNING row),
        # but the re-SELECT still returns the single committed tenant.
        winner = MagicMock()
        sel_miss = MagicMock()
        sel_miss.scalar_one_or_none.return_value = None
        ins_conflict = MagicMock()
        ins_conflict.first.return_value = None
        sel_hit = MagicMock()
        sel_hit.scalar_one.return_value = winner

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[sel_miss, ins_conflict, sel_hit])

        result = await _upsert_tenant(db, "race.example.com", "BU03")

        assert result is winner
        assert db.execute.call_count == 3
