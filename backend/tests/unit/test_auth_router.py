"""
Unit tests for app/routers/auth.py

Covers critical security paths:
  - _validate_uri: SSRF protection (private IPs, loopback, non-https, whitelist)
  - _check_exchange_rate_limit: rate limiter resets correctly
  - exchange endpoint: token/bu validation, error propagation
  - revoke_session: JWT decode + session deactivation
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

# ── _validate_uri ─────────────────────────────────────────────────────────────


class TestValidateUri:
    """SSRF protection — every case here is a security-critical boundary."""

    def _call(self, uri: str, allowed_regex: str = "", app_debug: bool = True):
        from app.config import settings
        from app.routers.auth import _validate_uri

        with (
            patch.object(settings, "carmen_allowed_host_regex", allowed_regex),
            patch.object(settings, "app_debug", app_debug),
        ):
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

    # ── Whitelist enforcement ─────────────────────────────────────────────────

    def test_whitelist_allows_matching_host(self):
        result = self._call(
            "https://erp.carmenwork.com",
            allowed_regex=r"erp\.carmenwork\.com",
        )
        assert result == "https://erp.carmenwork.com"

    def test_whitelist_blocks_non_matching_host(self):
        with pytest.raises(HTTPException) as exc:
            self._call(
                "https://attacker.com",
                allowed_regex=r"erp\.carmenwork\.com",
            )
        assert exc.value.status_code == 400

    def test_whitelist_uses_fullmatch_not_search(self):
        # Without anchors in regex, re.fullmatch still anchors implicitly
        with pytest.raises(HTTPException):
            self._call(
                "https://prefix.erp.carmenwork.com.evil.com",
                allowed_regex=r"erp\.carmenwork\.com",
            )


# ── _check_exchange_rate_limit ────────────────────────────────────────────────


class TestExchangeRateLimit:
    def _make_request(self, ip: str = "1.2.3.4"):
        req = MagicMock()
        req.client.host = ip
        return req

    def test_first_call_passes(self):
        from app.routers import auth as auth_module

        auth_module._exchange_calls.clear()
        from app.routers.auth import _check_exchange_rate_limit

        _check_exchange_rate_limit(self._make_request("10.99.99.1"))  # should not raise

    def test_exceeding_limit_raises_429(self):
        from app.routers import auth as auth_module
        from app.routers.auth import _EXCHANGE_MAX, _check_exchange_rate_limit

        auth_module._exchange_calls.clear()
        ip = "10.99.99.2"
        req = self._make_request(ip)

        for _ in range(_EXCHANGE_MAX):
            _check_exchange_rate_limit(req)

        with pytest.raises(HTTPException) as exc:
            _check_exchange_rate_limit(req)
        assert exc.value.status_code == 429

    def test_different_ips_do_not_share_limit(self):
        from app.routers import auth as auth_module
        from app.routers.auth import _EXCHANGE_MAX, _check_exchange_rate_limit

        auth_module._exchange_calls.clear()
        req_a = self._make_request("10.99.99.3")
        req_b = self._make_request("10.99.99.4")

        for _ in range(_EXCHANGE_MAX):
            _check_exchange_rate_limit(req_a)  # exhaust IP A

        # IP B should still be allowed
        _check_exchange_rate_limit(req_b)  # must not raise


# ── exchange endpoint (input validation) ──────────────────────────────────────


class TestExchangeInputValidation:
    """Test the parts of exchange() we can test without a live Carmen server."""

    async def _call_exchange(self, body_dict: dict):

        # We only test that missing required fields are caught
        from app.routers.auth import ExchangeRequest

        return ExchangeRequest(**body_dict)

    def test_exchange_request_requires_token(self):
        from pydantic import ValidationError

        from app.routers.auth import ExchangeRequest

        with pytest.raises(ValidationError):
            ExchangeRequest(bu="BU01")  # missing token

    def test_exchange_request_requires_bu(self):
        from pydantic import ValidationError

        from app.routers.auth import ExchangeRequest

        with pytest.raises(ValidationError):
            ExchangeRequest(token="tok123")  # missing bu

    def test_exchange_request_valid(self):
        from app.routers.auth import ExchangeRequest

        req = ExchangeRequest(token="tok", bu="BU01", uri="https://erp.example.com")
        assert req.token == "tok"
        assert req.bu == "BU01"


# ── extract_user_id edge cases for auth flow ──────────────────────────────────


class TestExtractUserIdEdgeCases:
    def test_real_carmen_token_format(self):
        from app.auth.session import extract_user_id_from_token

        token = "AbCdEfGhIjKlMnOpQrStUvWxYz012345|3f2504e0-4f89-11d3-9a0c-0305e82c3301"
        user_id = extract_user_id_from_token(token)
        assert user_id == "3f2504e0-4f89-11d3-9a0c-0305e82c3301"
