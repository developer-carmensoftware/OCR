"""
Unit tests for app/auth/session.py

Covers:
  - JWT creation / decoding / expiry
  - Fernet encrypt / decrypt / tamper detection
  - extract_user_id_from_token
"""

from datetime import UTC

import pytest
from cryptography.fernet import Fernet

from app.auth.session import (
    create_session_jwt,
    decode_session_jwt,
    decrypt_carmen_token,
    encrypt_carmen_token,
    extract_user_id_from_token,
)

SECRET = "test-jwt-secret-strong-enough-for-tests"
FERNET_KEY = Fernet.generate_key().decode()


# ── JWT ───────────────────────────────────────────────────────────────────────


def _make_jwt(**kwargs) -> str:
    defaults = dict(
        session_id="sid-001",
        tenant_id="tid-001",
        carmen_user_id="cuid-001",
        username="tester",
        secret=SECRET,
        ttl_hours=8,
        carmen_uri="https://erp.example.com",
        bu="BU01",
    )
    defaults.update(kwargs)
    return create_session_jwt(**defaults)


class TestCreateSessionJwt:
    def test_returns_non_empty_string(self):
        token = _make_jwt()
        assert isinstance(token, str)
        assert len(token) > 20

    def test_payload_claims_present(self):
        token = _make_jwt()
        payload = decode_session_jwt(token, SECRET)
        assert payload["sid"] == "sid-001"
        assert payload["tid"] == "tid-001"
        assert "bid" not in payload
        assert payload["cuid"] == "cuid-001"
        assert payload["username"] == "tester"
        assert payload["bu"] == "BU01"
        assert payload["carmen_uri"] == "https://erp.example.com"

    def test_exp_claim_set_correctly(self):
        import time

        token = _make_jwt(ttl_hours=2)
        payload = decode_session_jwt(token, SECRET)
        now = time.time()  # correct Unix timestamp regardless of local timezone
        assert payload["exp"] > now
        assert payload["exp"] <= now + 2 * 3600 + 10  # 10s tolerance


class TestDecodeSessionJwt:
    def test_valid_token_decoded(self):
        token = _make_jwt()
        payload = decode_session_jwt(token, SECRET)
        assert payload["sid"] == "sid-001"

    def test_wrong_secret_raises_value_error(self):
        token = _make_jwt()
        with pytest.raises(ValueError):
            decode_session_jwt(token, "wrong-secret")

    def test_tampered_token_raises_value_error(self):
        token = _make_jwt()
        tampered = token[:-5] + "XXXXX"
        with pytest.raises(ValueError):
            decode_session_jwt(tampered, SECRET)

    def test_expired_token_raises_value_error(self):
        # ttl_hours=0 produces a token that expires immediately
        # Use negative offset to force expiry
        from datetime import datetime, timedelta
        from unittest.mock import patch

        past = datetime.now(UTC) - timedelta(hours=2)
        with patch("app.auth.session.datetime") as mock_dt:
            mock_dt.now.return_value = past
            token = _make_jwt(ttl_hours=1)  # expired 1h ago

        with pytest.raises(ValueError, match=".*"):
            decode_session_jwt(token, SECRET)

    def test_empty_token_raises_value_error(self):
        with pytest.raises(ValueError):
            decode_session_jwt("", SECRET)

    def test_garbage_token_raises_value_error(self):
        with pytest.raises(ValueError):
            decode_session_jwt("not.a.jwt", SECRET)


# ── Fernet ────────────────────────────────────────────────────────────────────


class TestEncryptDecryptCarmenToken:
    def test_roundtrip(self):
        plaintext = "abc123|user-uuid-here"
        cipher = encrypt_carmen_token(plaintext, FERNET_KEY)
        result = decrypt_carmen_token(cipher, FERNET_KEY)
        assert result == plaintext

    def test_encrypted_differs_from_plaintext(self):
        plaintext = "abc123|user-uuid-here"
        cipher = encrypt_carmen_token(plaintext, FERNET_KEY)
        assert cipher != plaintext

    def test_wrong_key_raises_value_error(self):
        plaintext = "abc123|user-uuid-here"
        cipher = encrypt_carmen_token(plaintext, FERNET_KEY)
        wrong_key = Fernet.generate_key().decode()
        with pytest.raises(ValueError, match="decryption failed"):
            decrypt_carmen_token(cipher, wrong_key)

    def test_tampered_ciphertext_raises_value_error(self):
        plaintext = "abc123|user-uuid-here"
        cipher = encrypt_carmen_token(plaintext, FERNET_KEY)
        tampered = cipher[:-4] + "XXXX"
        with pytest.raises(ValueError, match="decryption failed"):
            decrypt_carmen_token(tampered, FERNET_KEY)

    def test_encrypts_empty_string(self):
        cipher = encrypt_carmen_token("", FERNET_KEY)
        assert decrypt_carmen_token(cipher, FERNET_KEY) == ""

    def test_encrypts_unicode(self):
        plaintext = "token|uuid-ไทย"
        cipher = encrypt_carmen_token(plaintext, FERNET_KEY)
        assert decrypt_carmen_token(cipher, FERNET_KEY) == plaintext


# ── extract_user_id_from_token ────────────────────────────────────────────────


class TestExtractUserIdFromToken:
    def test_pipe_delimited_returns_uuid_part(self):
        token = "hash-abc|user-uuid-123"
        assert extract_user_id_from_token(token) == "user-uuid-123"

    def test_no_pipe_returns_full_token(self):
        token = "justaplaintoken"
        assert extract_user_id_from_token(token) == "justaplaintoken"

    def test_multiple_pipes_splits_on_first_only(self):
        token = "hash|uuid|extra"
        assert extract_user_id_from_token(token) == "uuid|extra"

    def test_empty_string_returns_empty(self):
        assert extract_user_id_from_token("") == ""

    def test_pipe_at_start(self):
        assert extract_user_id_from_token("|uuid") == "uuid"
