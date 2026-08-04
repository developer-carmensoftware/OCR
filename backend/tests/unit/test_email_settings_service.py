"""
Unit tests for services/email_settings_service.py — the store behind
PUT/GET /api/v1/carmen/settings (CARMEN_INTEGRATION.md §2.2/§2.3).

Mocks db.execute per-call via side_effect (matching the credit_service.py test
style), since save_settings issues a small, fixed sequence of queries depending
on the scenario (conflict check → get_settings → tag allocation).
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.exceptions import ConflictError, FieldValidationError
from app.routers.email_automation import Caller, RuleIn, SettingsIn, _authorize
from app.services import email_settings_service as es


def _valid_tax_id(prefix: str = "010553600012") -> str:
    """Compute a checksum-valid 13-digit Thai tax ID from a 12-digit prefix."""
    digits = [int(c) for c in prefix]
    checksum = sum(d * (13 - i) for i, d in enumerate(digits))
    check = (11 - checksum % 11) % 10
    return prefix + str(check)


def _exec(scalars=None, scalar_one_or_none=None):
    r = MagicMock()
    r.scalars.return_value = iter(scalars if scalars is not None else [])
    r.scalar_one_or_none.return_value = scalar_one_or_none
    return r


def _tenant():
    return SimpleNamespace(id=uuid4())


def _tenant_with_host(host="hotel.carmenwork.com", bu="hq"):
    return SimpleNamespace(id=uuid4(), host=host, bu_code=bu)


# ── is_valid_thai_tax_id ───────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "value,expected",
    [
        (_valid_tax_id(), True),
        ("1234567890123", False),  # wrong check digit
        ("010553600012", False),  # 12 digits, too short
        ("01055360001234", False),  # 14 digits, too long
        ("01055360001A3", False),  # non-digit
        ("", False),
    ],
)
def test_is_valid_thai_tax_id(value, expected):
    assert es.is_valid_thai_tax_id(value) is expected


# ── save_settings — validation (no DB touched) ────────────────────────────────


@pytest.mark.asyncio
async def test_enabled_without_tax_ids_raises_field_validation_error():
    payload = SettingsIn(host="h", bu="b", enabled=True, tax_ids=[], rules=[])
    with pytest.raises(FieldValidationError) as exc:
        await es.save_settings(AsyncMock(), _tenant(), payload)
    assert exc.value.errors[0]["field"] == "tax_ids"
    assert exc.value.errors[0]["code"] == "required"


@pytest.mark.asyncio
async def test_invalid_tax_id_checksum_raises_field_validation_error():
    payload = SettingsIn(host="h", bu="b", enabled=False, tax_ids=["1234567890123"], rules=[])
    with pytest.raises(FieldValidationError) as exc:
        await es.save_settings(AsyncMock(), _tenant(), payload)
    assert exc.value.errors[0]["field"] == "tax_ids[0]"
    assert exc.value.errors[0]["code"] == "invalid_checksum"


@pytest.mark.asyncio
async def test_unsupported_bank_code_raises_field_validation_error():
    payload = SettingsIn(
        host="h", bu="b", enabled=False, tax_ids=[], rules=[RuleIn(bank_code="FAKEBANK")]
    )
    with pytest.raises(FieldValidationError) as exc:
        await es.save_settings(AsyncMock(), _tenant(), payload)
    assert exc.value.errors[0]["field"] == "rules[0].bank_code"
    assert exc.value.errors[0]["code"] == "unsupported_bank"


# ── save_settings — DB interaction ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cross_tenant_tax_id_conflict_raises_conflict_error():
    tid = _valid_tax_id()
    other = SimpleNamespace(tax_ids=[tid])
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[_exec(scalars=[other])])  # conflict check only

    payload = SettingsIn(host="h", bu="b", enabled=True, tax_ids=[tid], rules=[])
    with pytest.raises(ConflictError):
        await es.save_settings(db, _tenant(), payload)
    db.commit.assert_not_called()


@pytest.mark.asyncio
async def test_new_row_created_with_allocated_tag_and_encrypted_password():
    tid = _valid_tax_id()
    tenant = _tenant()
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _exec(scalars=[]),  # conflict check — no clash
            _exec(scalar_one_or_none=None),  # get_settings — no existing row
            _exec(scalar_one_or_none=None),  # _new_tag — first candidate free
        ]
    )
    db.add = MagicMock()

    payload = SettingsIn(
        host="h",
        bu="b",
        enabled=True,
        tax_ids=[tid],
        rules=[RuleIn(bank_code="KTC", pdf_password="1234", is_active=True)],
    )
    row = await es.save_settings(db, tenant, payload)

    db.add.assert_called_once()
    added = db.add.call_args[0][0]
    assert added is row
    assert row.tenant_id == tenant.id
    assert row.ingest_tag  # allocated, non-empty
    assert row.enabled is True
    assert row.tax_ids == [tid]
    assert row.rules[0]["bank_code"] == "KTC"
    assert row.rules[0]["pdf_password_enc"]  # encrypted, non-empty
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once()


@pytest.mark.asyncio
async def test_existing_row_rules_replace_wholesale_password_kept_or_cleared():
    tenant = _tenant()
    from app.auth.session import encrypt_carmen_token
    from app.config import settings as app_settings

    enc_ktc = encrypt_carmen_token("old-ktc-pass", app_settings.session_encryption_key)
    enc_bbl = encrypt_carmen_token("old-bbl-pass", app_settings.session_encryption_key)

    existing = SimpleNamespace(
        tenant_id=tenant.id,
        ingest_tag="abc123",
        enabled=False,
        tax_ids=[],
        rules=[
            {
                "bank_code": "KTC",
                "bank_sender_email": None,
                "filename_pattern": None,
                "is_active": True,
                "pdf_password_enc": enc_ktc,
            },
            {
                "bank_code": "BBL",
                "bank_sender_email": None,
                "filename_pattern": None,
                "is_active": True,
                "pdf_password_enc": enc_bbl,
            },
            {
                "bank_code": "SCB",
                "bank_sender_email": None,
                "filename_pattern": None,
                "is_active": True,
                "pdf_password_enc": None,
            },
        ],
        carmen_token_enc=None,
    )
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _exec(
                scalar_one_or_none=existing
            ),  # get_settings — row exists (no tax_ids -> no conflict check)
        ]
    )

    payload = SettingsIn(
        host="h",
        bu="b",
        enabled=False,
        tax_ids=[],
        rules=[
            RuleIn(bank_code="KTC", pdf_password=None, is_active=True),  # omit = keep
            RuleIn(bank_code="BBL", pdf_password="", is_active=True),  # "" = clear
        ],
    )
    row = await es.save_settings(db, tenant, payload)

    assert row is existing
    by_bank = {r["bank_code"]: r for r in row.rules}
    assert set(by_bank) == {"KTC", "BBL"}  # SCB dropped — wholesale replace, not merge
    assert by_bank["KTC"]["pdf_password_enc"] == enc_ktc  # kept
    assert by_bank["BBL"]["pdf_password_enc"] is None  # cleared


# ── to_response ────────────────────────────────────────────────────────────────


def _fake_row(**overrides):
    defaults = dict(
        tenant_id=uuid4(), ingest_tag="abc123", enabled=True, tax_ids=["1234567890123"], rules=[]
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_to_response_none_row_is_not_configured():
    body = es.to_response(None, "host", "bu")
    assert body["enabled"] is False
    assert body["status"]["blockers"] == ["not_configured"]


def test_to_response_ready_when_enabled_with_tax_id_and_active_rule(monkeypatch):
    # The mailbox is env-configured (a dev .env points it at a personal inbox), so
    # pin it here — asserting the production default made this test pass or fail
    # depending on whose machine it ran on.
    monkeypatch.setattr(es.app_settings, "email_ingest_address", "ocr@carmensoftware.com")
    row = _fake_row(rules=[{"bank_code": "KTC", "is_active": True}])
    body = es.to_response(row, "host", "bu")
    assert body["ingest_address"] == "ocr+abc123@carmensoftware.com"
    assert body["status"]["ready"] is True
    assert body["status"]["blockers"] == []


def test_to_response_blockers_for_disabled_no_tax_id_no_active_rule():
    row = _fake_row(enabled=False, tax_ids=[], rules=[{"bank_code": "KTC", "is_active": False}])
    body = es.to_response(row, "host", "bu")
    assert set(body["status"]["blockers"]) == {"no_tax_id", "no_rule", "disabled"}


def test_to_response_never_echoes_the_password_only_a_boolean():
    row = _fake_row(
        rules=[{"bank_code": "KTC", "pdf_password_enc": "encrypted-blob", "is_active": True}]
    )
    body = es.to_response(row, "host", "bu")
    assert body["rules"][0]["has_password"] is True
    assert "pdf_password_enc" not in body["rules"][0]
    assert "encrypted-blob" not in str(body)


# ── secrets: rule_passwords / posting_target ──────────────────────────────────


def _db_scalar(value):
    """AsyncMock db whose .scalar() answers the tenant-host lookup in posting_target."""
    db = AsyncMock()
    db.scalar = AsyncMock(return_value=value)
    return db


@pytest.mark.asyncio
async def test_rule_passwords_and_posting_target_round_trip():
    from app.auth.session import encrypt_carmen_token
    from app.config import settings as app_settings

    key = app_settings.session_encryption_key
    row = _fake_row(
        rules=[
            {
                "bank_code": "KTC",
                "is_active": True,
                "pdf_password_enc": encrypt_carmen_token("1234", key),
            },
            {
                "bank_code": "BBL",
                "is_active": False,
                "pdf_password_enc": encrypt_carmen_token("9999", key),
            },
        ],
        carmen_token_enc=encrypt_carmen_token("carmen-tok-abc", key),
        carmen_uri="https://hotel.carmenwork.com",
    )
    assert es.rule_passwords(row) == ["1234"]  # inactive rule's password excluded
    token, uri = await es.posting_target(_db_scalar(None), row)
    assert (token, uri) == ("carmen-tok-abc", "https://hotel.carmenwork.com")


@pytest.mark.asyncio
async def test_posting_target_falls_back_to_tenant_host_when_uri_unset():
    row = _fake_row(carmen_token_enc=None, carmen_uri=None)
    _, uri = await es.posting_target(_db_scalar("hotel.carmenwork.com"), row)
    assert uri == "https://hotel.carmenwork.com"


@pytest.mark.asyncio
async def test_posting_target_dev_token_only_in_debug(monkeypatch):
    """The shared dev credential must never post a real customer's books."""
    monkeypatch.setattr(es.app_settings, "carmen_dev_token", "dev-tok-xyz")
    row = _fake_row(carmen_token_enc=None, carmen_uri="https://hotel.carmenwork.com")

    monkeypatch.setattr(es.app_settings, "app_debug", True)
    token, _ = await es.posting_target(_db_scalar(None), row)
    assert token == "dev-tok-xyz"

    monkeypatch.setattr(es.app_settings, "app_debug", False)
    token, _ = await es.posting_target(_db_scalar(None), row)
    assert token == ""  # empty → the caller parks the document instead of guessing


# ── the posting credential ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_set_token_stores_encrypted_plus_fingerprint_never_plaintext(monkeypatch):
    monkeypatch.setattr(es, "verify_token", AsyncMock(return_value=None))
    row = _fake_row(
        carmen_token_enc=None,
        carmen_uri=None,
        carmen_token_fp=None,
        carmen_token_verified_at=None,
        updated_by=None,
    )
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[_exec(scalar_one_or_none=row)])

    saved = await es.set_token(db, _tenant_with_host(), "crm_svc_secret", "https://h", "apikey:x")

    assert saved.carmen_token_enc and saved.carmen_token_enc != "crm_svc_secret"
    assert saved.carmen_token_fp == es.fingerprint("crm_svc_secret")
    assert saved.carmen_token_verified_at is not None
    assert saved.updated_by == "apikey:x"


@pytest.mark.asyncio
async def test_set_token_stores_nothing_when_carmen_rejects_it(monkeypatch):
    """Strict verification: a token Carmen will not accept never reaches the DB."""
    from app.services.carmen_service import CarmenAPIError

    async def _reject(_token):
        raise CarmenAPIError(401, "Unauthorized")

    monkeypatch.setattr("app.services.carmen_service.get_departments", _reject)

    row = _fake_row(carmen_token_enc=None, carmen_uri=None)
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[_exec(scalar_one_or_none=row)])

    with pytest.raises(FieldValidationError):
        await es.set_token(db, _tenant_with_host(), "bad-token", "https://h", "apikey:x")
    assert row.carmen_token_enc is None
    db.commit.assert_not_awaited()


def test_token_status_never_contains_the_token_value():
    from app.auth.session import encrypt_carmen_token
    from app.config import settings as app_settings

    enc = encrypt_carmen_token("crm_svc_secret", app_settings.session_encryption_key)
    row = _fake_row(
        carmen_token_enc=enc,
        carmen_uri="https://h",
        carmen_token_fp="9c1f3a2b",
        carmen_token_verified_at=None,
    )
    body = es.token_status(row)
    assert body["configured"] is True
    assert body["fingerprint"] == "9c1f3a2b"
    assert "crm_svc_secret" not in str(body)
    assert enc not in str(body)


# ── _authorize: the BU in the payload is caller-supplied ──────────────────────


def test_authorize_rejects_a_key_scoped_to_another_host():
    caller = Caller(actor="apikey:A", tenant_id=None, hosts=frozenset({"hotel-a.example.com"}))
    with pytest.raises(HTTPException) as exc:
        _authorize(caller, _tenant_with_host("hotel-b.example.com"))
    assert exc.value.status_code == 403


def test_authorize_rejects_a_key_with_no_scope_at_all():
    """Fail closed — an unscoped key is not a wildcard key."""
    caller = Caller(actor="apikey:A", tenant_id=None, hosts=frozenset())
    with pytest.raises(HTTPException):
        _authorize(caller, _tenant_with_host())


def test_authorize_allows_matching_host_and_matching_tenant():
    tenant = _tenant_with_host("hotel-a.example.com")
    _authorize(Caller("apikey:A", None, frozenset({"hotel-a.example.com"})), tenant)
    _authorize(Caller("apikey:A", tenant.id, frozenset()), tenant)
    _authorize(Caller("admin:root", None, None), tenant)  # admin JWT — RBAC already ran


# ── SSRF: carmen_uri is a URL we make a server-side request to ────────────────


@pytest.mark.parametrize(
    "uri",
    [
        "http://169.254.169.254/",  # cloud metadata, and not https
        "https://169.254.169.254/",  # link-local literal
        "https://127.0.0.1/",  # loopback
        "https://10.0.0.5/",  # private range
        "ftp://hotel.carmenwork.com",  # wrong scheme
    ],
)
def test_carmen_uri_rejected_before_any_outbound_request(uri):
    from app.routers.email_automation import _safe_carmen_uri

    with pytest.raises(FieldValidationError) as exc:
        _safe_carmen_uri(uri, _tenant_with_host())
    assert exc.value.errors[0]["field"] == "carmen_uri"


def test_carmen_uri_defaults_to_the_tenant_host():
    from app.routers.email_automation import _safe_carmen_uri

    assert _safe_carmen_uri(None, _tenant_with_host()) == "https://hotel.carmenwork.com"
