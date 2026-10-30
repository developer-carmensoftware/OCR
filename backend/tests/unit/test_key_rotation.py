"""Key rotation (decision-log #50): one MultiFernet, and the rewrite that re-encrypts.

`app/utils/crypto.py` encrypts under SESSION_ENCRYPTION_KEY and decrypts under it or any key
in SESSION_ENCRYPTION_KEYS_OLD; `payload_encryption._rewrite` re-encrypts what an old key
wrote. The end-to-end run against Postgres is in tests/tenancy/test_key_rotation.py.
"""

import pytest
from cryptography.fernet import Fernet

from app.auth.session import decrypt_carmen_token, encrypt_carmen_token
from app.config import settings
from app.services.shared import payload_encryption as pe
from app.utils import crypto

OLD, NEW, STRANGER = (Fernet.generate_key().decode() for _ in range(3))


@pytest.fixture
def rotating(monkeypatch):
    """Mid-rotation: NEW is the key, OLD is still listed."""
    monkeypatch.setattr(settings, "session_encryption_key", NEW)
    monkeypatch.setattr(settings, "session_encryption_keys_old", f" {OLD} ,")


def _under(key: str, text: str = "secret") -> str:
    return Fernet(key.encode()).encrypt(text.encode()).decode()


def test_new_tokens_are_written_under_the_primary_key_alone(rotating):
    token = encrypt_carmen_token("carmen-token")
    assert Fernet(NEW.encode()).decrypt(token.encode()) == b"carmen-token"


def test_a_token_an_old_key_wrote_still_reads(rotating):
    assert decrypt_carmen_token(_under(OLD)) == "secret"
    with pytest.raises(ValueError):
        decrypt_carmen_token(_under(STRANGER))


def test_once_the_old_key_is_dropped_its_tokens_no_longer_read(rotating, monkeypatch):
    monkeypatch.setattr(settings, "session_encryption_keys_old", "")
    assert crypto.old_keys() == []
    with pytest.raises(ValueError):
        decrypt_carmen_token(_under(OLD))


def test_a_key_passed_explicitly_is_that_key_alone(rotating):
    """Tests and scripts that hand a key in keep their meaning."""
    with pytest.raises(ValueError):
        decrypt_carmen_token(_under(OLD), NEW)


def test_rewrite_rotates_only_what_the_primary_cannot_open(rotating):
    rotated, bad = pe._rewrite("text", _under(OLD))
    assert bad == 0 and Fernet(NEW.encode()).decrypt(rotated.encode()) == b"secret"
    assert pe._rewrite("text", _under(NEW)) == (None, 0)  # already current
    assert pe._rewrite("text", _under(STRANGER)) == (None, 1)  # no key opens it: counted, left
    assert pe._rewrite("text", "plain value") == (None, 0)  # plaintext is the backfill's job
    assert pe._rewrite("text", None) == (None, 0)


def test_rewrite_keeps_the_readable_keys_of_a_json_payload(rotating):
    stored = {"enc": _under(OLD), "doc_type": "ar_reconcile"}
    new, bad = pe._rewrite("json", stored)
    assert bad == 0 and new["doc_type"] == "ar_reconcile"
    assert Fernet(NEW.encode()).decrypt(new["enc"].encode()) == b"secret"
    assert pe._rewrite("json", {"enc": _under(NEW)}) == (None, 0)
    assert pe._rewrite("json", ["a@b.co"]) == (None, 0)  # a plaintext list


def test_rewrite_rotates_each_pdf_password_in_the_rules(rotating):
    rules = [
        {"bank": "KTC", "pdf_password_enc": _under(OLD, "1234")},
        {"bank": "BBL", "pdf_password_enc": _under(NEW, "9999")},
        {"bank": "SCB"},
    ]
    new, bad = pe._rewrite("rules", rules)
    assert bad == 0
    assert [r["bank"] for r in new] == ["KTC", "BBL", "SCB"]
    assert Fernet(NEW.encode()).decrypt(new[0]["pdf_password_enc"].encode()) == b"1234"
    assert new[1]["pdf_password_enc"] == rules[1]["pdf_password_enc"]  # current: untouched
    assert pe._rewrite("rules", rules[1:]) == (None, 0)  # nothing stale: no write
