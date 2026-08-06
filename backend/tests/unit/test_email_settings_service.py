"""
Unit tests for services/email_settings_service.py — the store behind
PUT/GET /api/v1/carmen/settings (CARMEN_INTEGRATION.md §2.2/§2.3).

Mocks db.execute per-call via side_effect (matching the credit_service.py test
style), since save_settings issues a small, fixed sequence of queries depending
on the scenario: bank TINs (only when tax_ids are sent) → active bank codes (only
when rules are sent) → cross-tenant conflict check → get_settings. Tag allocation
uses db.scalar, so it is mocked separately.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.exceptions import ConflictError, FieldValidationError
from app.models.schemas.email_automation import RuleIn, SettingsIn
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


@pytest.fixture(autouse=True)
def _entitled_by_default(monkeypatch):
    """Most tests here are about validation, not billing.

    Without this every `enabled=True` case would fail on the subscription gate for
    reasons that have nothing to do with what it is testing. The entitlement tests
    override it — their own monkeypatch is applied after this one.
    """
    monkeypatch.setattr(es, "is_entitled", AsyncMock(return_value=True))


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
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[_exec(scalars=[])])  # banks.tax_id
    with pytest.raises(FieldValidationError) as exc:
        await es.save_settings(db, _tenant(), payload)
    assert exc.value.errors[0]["field"] == "tax_ids[0]"
    assert exc.value.errors[0]["code"] == "invalid_checksum"


@pytest.mark.asyncio
async def test_unsupported_bank_code_raises_field_validation_error():
    payload = SettingsIn(
        host="h",
        bu="b",
        enabled=False,
        tax_ids=[],
        rules=[RuleIn(bank_code="FAKEBANK", filename_patterns=["MDR"])],
    )
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[_exec(scalars=["BBL", "KTC"])])  # active bank codes
    with pytest.raises(FieldValidationError) as exc:
        await es.save_settings(db, _tenant(), payload)
    assert exc.value.errors[0]["field"] == "rules[0].bank_code"
    assert exc.value.errors[0]["code"] == "unsupported_bank"


@pytest.mark.asyncio
async def test_duplicate_bank_code_in_rules_raises_field_validation_error():
    payload = SettingsIn(
        host="h",
        bu="b",
        enabled=False,
        tax_ids=[],
        rules=[
            RuleIn(bank_code="KTC", filename_patterns=["MDR"]),
            RuleIn(bank_code="KTC", filename_patterns=["MDR"]),
        ],
    )
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[_exec(scalars=["BBL", "KTC"])])  # active bank codes
    with pytest.raises(FieldValidationError) as exc:
        await es.save_settings(db, _tenant(), payload)
    assert exc.value.errors[0]["field"] == "rules[1].bank_code"
    assert exc.value.errors[0]["code"] == "duplicate_bank"


@pytest.mark.asyncio
async def test_duplicate_other_rule_raises_field_validation_error():
    """bank_code: null ("Other") can only appear once too."""
    payload = SettingsIn(
        host="h",
        bu="b",
        enabled=False,
        tax_ids=[],
        rules=[
            RuleIn(bank_code=None, filename_patterns=[".pdf"]),
            RuleIn(bank_code=None, filename_patterns=["MDR"]),
        ],
    )
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[_exec(scalars=[])])  # active bank codes
    with pytest.raises(FieldValidationError) as exc:
        await es.save_settings(db, _tenant(), payload)
    assert exc.value.errors[0]["code"] == "duplicate_bank"
    assert "Other" in exc.value.errors[0]["message"]


@pytest.mark.asyncio
async def test_list_bank_codes_returns_active_banks_ordered():
    db = AsyncMock()
    result = MagicMock()
    result.all.return_value = [("BBL", "Bangkok Bank"), ("KTC", "Krungthai Card")]
    db.execute = AsyncMock(return_value=result)
    assert await es.list_bank_codes(db) == [
        {"code": "BBL", "name": "Bangkok Bank"},
        {"code": "KTC", "name": "Krungthai Card"},
    ]


# ── save_settings — DB interaction ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cross_tenant_tax_id_conflict_raises_conflict_error():
    tid = _valid_tax_id()
    other = SimpleNamespace(tax_ids=[tid])
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _exec(scalars=[]),  # bank TINs — none reserved
            _exec(scalars=[other]),  # conflict check
        ]
    )

    payload = SettingsIn(host="h", bu="b", enabled=True, tax_ids=[tid], rules=[])
    with pytest.raises(ConflictError):
        await es.save_settings(db, _tenant(), payload)
    db.commit.assert_not_called()


@pytest.mark.asyncio
async def test_new_row_created_with_encrypted_password():
    tid = _valid_tax_id()
    tenant = _tenant()
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _exec(scalars=[]),  # bank TINs — none reserved
            _exec(scalars=["KTC"]),  # active bank codes
            _exec(scalars=[]),  # conflict check — no clash
            _exec(scalar_one_or_none=None),  # get_settings — no existing row
        ]
    )
    db.scalar = AsyncMock(return_value=None)  # the candidate tag is free
    db.add = MagicMock()

    payload = SettingsIn(
        host="h",
        bu="b",
        enabled=True,
        tax_ids=[tid],
        rules=[
            RuleIn(bank_code="KTC", filename_patterns=["MDR"], pdf_password="1234", is_active=True)
        ],
    )
    row = await es.save_settings(db, tenant, payload)

    db.add.assert_called_once()
    added = db.add.call_args[0][0]
    assert added is row
    assert row.tenant_id == tenant.id
    assert row.enabled is True
    assert row.tax_ids == [tid]
    assert row.rules[0]["bank_code"] == "KTC"
    assert row.rules[0]["filename_patterns"] == ["MDR"]
    assert row.rules[0]["pdf_password_enc"]  # encrypted, non-empty
    assert len(row.ingest_tag) == 8  # allocated on this first successful enable
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
        enabled=False,
        tax_ids=[],
        rules=[
            {
                "bank_code": "KTC",
                "bank_sender_email": None,
                "filename_patterns": ["x"],
                "is_active": True,
                "pdf_password_enc": enc_ktc,
            },
            {
                "bank_code": "BBL",
                "bank_sender_email": None,
                "filename_patterns": ["x"],
                "is_active": True,
                "pdf_password_enc": enc_bbl,
            },
            {
                "bank_code": "SCB",
                "bank_sender_email": None,
                "filename_patterns": ["x"],
                "is_active": True,
                "pdf_password_enc": None,
            },
        ],
        carmen_token_enc=None,
    )
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _exec(scalars=["KTC", "BBL"]),  # active bank codes
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
            RuleIn(
                bank_code="KTC", filename_patterns=["MDR"], pdf_password=None, is_active=True
            ),  # omit = keep
            RuleIn(
                bank_code="BBL", filename_patterns=["stmt"], pdf_password="", is_active=True
            ),  # "" = clear
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
        tenant_id=uuid4(),
        enabled=True,
        tax_ids=["1234567890123"],
        rules=[],
        ingest_tag="a1b2c3d4",
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_to_response_none_row_is_not_configured():
    body = es.to_response(None, "host", "bu")
    assert body["enabled"] is False
    assert body["status"]["blockers"] == ["not_configured"]


@pytest.fixture
def _mailbox(monkeypatch):
    """The mailbox is env-configured (a dev .env points it at a personal inbox), so
    pin it — asserting the production default made these tests pass or fail depending
    on whose machine they ran on."""
    monkeypatch.setattr(es.app_settings, "email_ingest_address", "AIAGENT@carmensoftware.com")


def test_to_response_ready_when_enabled_with_tax_id_and_active_rule(_mailbox):
    row = _fake_row(rules=[{"bank_code": "KTC", "is_active": True}])
    body = es.to_response(row, "host", "bu")
    assert body["ingest_address"] == "AIAGENT+a1b2c3d4@carmensoftware.com"
    assert body["status"]["ready"] is True
    assert body["status"]["blockers"] == []


def test_the_ingest_address_carries_this_bus_own_tag(_mailbox):
    """One mailbox, one address per BU. The tag is what identifies the owner from the
    envelope, so two BUs must never be shown the same string."""
    a = es.to_response(_fake_row(ingest_tag="a1b2c3d4"), "host", "bu")
    b = es.to_response(_fake_row(ingest_tag="ffffffff"), "host", "bu2")
    assert a["ingest_address"] == "AIAGENT+a1b2c3d4@carmensoftware.com"
    assert b["ingest_address"] == "AIAGENT+ffffffff@carmensoftware.com"


def test_the_bare_address_is_never_shown_to_anyone(_mailbox):
    """Null until a tag exists, rather than the untagged mailbox.

    Mail to the bare address cannot be attributed to a tenant, so showing it would
    hand the customer a string whose documents vanish. The `not_configured` /
    `disabled` blockers already say why there is nothing to copy yet.
    """
    assert es.to_response(None, "host", "bu")["ingest_address"] is None
    assert es.to_response(_fake_row(ingest_tag=None), "host", "bu")["ingest_address"] is None
    assert es.ingest_address(None) is None


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


# ── Readiness gates: the two ways `ready: true` used to lie ───────────────────


@pytest.mark.asyncio
async def test_enabling_without_an_active_package_is_rejected(monkeypatch):
    """The feature is sold, not free — and the gate was hardcoded open until now."""
    monkeypatch.setattr(es, "is_entitled", AsyncMock(return_value=False))
    payload = SettingsIn(host="h", bu="b", enabled=True, tax_ids=[_valid_tax_id()], rules=[])
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[_exec(scalars=[])])  # conflict check only

    with pytest.raises(FieldValidationError) as exc:
        await es.save_settings(db, _tenant_with_host(), payload)
    codes = {e["code"] for e in exc.value.errors}
    assert "not_entitled" in codes
    db.commit.assert_not_called()


@pytest.mark.asyncio
async def test_disabled_settings_may_be_saved_without_a_package():
    """Only *enabling* needs a package — a customer may still edit while lapsed."""
    payload = SettingsIn(host="h", bu="b", enabled=False, tax_ids=[], rules=[])
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[_exec(scalar_one_or_none=_fake_row())])
    await es.save_settings(db, _tenant_with_host(), payload)  # no raise
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_build_response_flags_an_unpaid_bu(monkeypatch):
    monkeypatch.setattr(es, "is_entitled", AsyncMock(return_value=False))
    monkeypatch.setattr(es, "document_counts", AsyncMock(return_value={"documents_total": 0}))
    row = _fake_row(rules=[{"bank_code": "KTC", "is_active": True}])

    body = await es.build_settings_response(AsyncMock(), _tenant_with_host(), row, "h", "b")

    assert body["entitled"] is False
    assert body["status"]["blockers"] == ["not_entitled"]
    assert body["status"]["ready"] is False


@pytest.mark.asyncio
async def test_a_bu_with_no_gl_mapping_is_still_ready(monkeypatch):
    """The ingest job AI-fills what was never mapped, so it no longer blocks.

    `no_gl_mapping` used to park every document of a BU that had not opened the
    mapping page; now the first document fills the gap and saves it.
    """
    monkeypatch.setattr(es, "is_entitled", AsyncMock(return_value=True))
    monkeypatch.setattr(es, "document_counts", AsyncMock(return_value={"documents_total": 0}))
    row = _fake_row(rules=[{"bank_code": "KTC", "is_active": True}])

    body = await es.build_settings_response(AsyncMock(), _tenant_with_host(), row, "h", "b")

    assert body["status"]["blockers"] == []
    assert body["status"]["ready"] is True


@pytest.mark.asyncio
async def test_build_response_is_ready_only_when_every_gate_passes(monkeypatch):
    monkeypatch.setattr(es, "is_entitled", AsyncMock(return_value=True))
    monkeypatch.setattr(es, "document_counts", AsyncMock(return_value={"documents_total": 3}))
    row = _fake_row(rules=[{"bank_code": "KTC", "is_active": True}])

    body = await es.build_settings_response(AsyncMock(), _tenant_with_host(), row, "h", "b")

    assert body["entitled"] is True
    assert body["status"]["blockers"] == []
    assert body["status"]["ready"] is True
    assert body["status"]["documents_total"] == 3


@pytest.mark.asyncio
async def test_unconfigured_bu_reports_only_not_configured(monkeypatch):
    """row is None: the counters and the other blockers are not meaningful yet."""
    monkeypatch.setattr(es, "is_entitled", AsyncMock(return_value=True))
    body = await es.build_settings_response(AsyncMock(), _tenant_with_host(), None, "h", "b")
    assert body["status"]["blockers"] == ["not_configured"]
    assert "documents_total" not in body["status"]


# ── SSRF: the origin we make a server-side request to ─────────────────────────


@pytest.mark.parametrize(
    "host",
    [
        "169.254.169.254",  # cloud metadata
        "127.0.0.1",  # loopback
        "10.0.0.5",  # private range
    ],
)
@pytest.mark.asyncio
async def test_carmen_origin_rejected_before_any_outbound_request(host):
    from app.routers.email_automation import _safe_carmen_uri

    with pytest.raises(FieldValidationError) as exc:
        await _safe_carmen_uri(_tenant_with_host(host))
    assert exc.value.errors[0]["field"] == "carmen_uri"


@pytest.mark.asyncio
async def test_carmen_origin_is_derived_from_the_tenant_host():
    """One value, not two: the origin a token is validated against is the one we post to."""
    from app.routers.email_automation import _safe_carmen_uri

    assert await _safe_carmen_uri(_tenant_with_host()) == "https://hotel.carmenwork.com"


# ── filename_patterns: required, and the hard gate behind it ───────────────────


def _patterns_payload(patterns):
    return SettingsIn(
        host="h",
        bu="b",
        enabled=False,
        tax_ids=[],
        rules=[RuleIn(bank_code="KTC", filename_patterns=patterns)],
    )


@pytest.mark.parametrize("patterns", [[], ["", "   "]])
@pytest.mark.asyncio
async def test_a_rule_without_a_usable_filename_pattern_is_rejected(patterns):
    """An attachment matching no pattern is never extracted, so an empty list would
    switch the BU on and silently process nothing."""
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[_exec(scalars=["KTC"])])  # active bank codes
    with pytest.raises(FieldValidationError) as exc:
        await es.save_settings(db, _tenant(), _patterns_payload(patterns))
    assert exc.value.errors[0]["field"] == "rules[0].filename_patterns"
    assert exc.value.errors[0]["code"] == "required"


@pytest.mark.asyncio
async def test_patterns_are_stripped_and_blanks_dropped_before_storing():
    existing = SimpleNamespace(tenant_id=uuid4(), enabled=False, tax_ids=[], rules=[])
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[_exec(scalars=["KTC"]), _exec(scalar_one_or_none=existing)])
    row = await es.save_settings(db, _tenant(), _patterns_payload(["  MDR ", "", "Commission"]))
    assert row.rules[0]["filename_patterns"] == ["MDR", "Commission"]


# ── Phase 4: a bank's own TIN is not a BU's ───────────────────────────────────


@pytest.mark.asyncio
async def test_registering_a_banks_own_tax_id_is_rejected():
    """The bank's TIN is printed on the same invoice the user reads to find theirs.

    Left open, one copy-paste captures every document that bank ever issues — and it
    would trip `foreign_tax_id` on all of them.
    """
    bank_tin = _valid_tax_id("010753600037")
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[_exec(scalars=[bank_tin])])  # banks.tax_id
    payload = SettingsIn(host="h", bu="b", enabled=True, tax_ids=[bank_tin], rules=[])

    with pytest.raises(FieldValidationError) as exc:
        await es.save_settings(db, _tenant(), payload)
    assert exc.value.errors[0]["field"] == "tax_ids[0]"
    assert exc.value.errors[0]["code"] == "reserved_tax_id"
    db.commit.assert_not_called()


# ── Tag lifecycle ─────────────────────────────────────────────────────────────


async def _save(db, tenant, *, enabled, row, tax_ids=None):
    """save_settings with no rules, so the query sequence is bank TINs → conflict →
    get_settings (the first two only when tax_ids are sent)."""
    tids = tax_ids if tax_ids is not None else [_valid_tax_id()]
    seq = [_exec(scalars=[]), _exec(scalars=[])] if tids else []
    db.execute = AsyncMock(side_effect=[*seq, _exec(scalar_one_or_none=row)])
    db.scalar = AsyncMock(return_value=None)
    payload = SettingsIn(host="h", bu="b", enabled=enabled, tax_ids=tids, rules=[])
    return await es.save_settings(db, tenant, payload)


@pytest.mark.asyncio
async def test_a_tag_is_not_allocated_while_the_feature_stays_off():
    """Most tenants sign in once and never buy anything — they must not consume a tag."""
    row = _fake_row(enabled=False, tax_ids=[], ingest_tag=None)
    saved = await _save(AsyncMock(), _tenant(), enabled=False, row=row, tax_ids=[])
    assert saved.ingest_tag is None
    assert es.to_response(saved, "h", "b")["ingest_address"] is None


@pytest.mark.asyncio
async def test_no_tag_is_allocated_without_an_active_package(monkeypatch):
    """The entitlement gate is what makes "only paying customers get an address" true
    with no logic of its own — allocation sits behind it."""
    monkeypatch.setattr(es, "is_entitled", AsyncMock(return_value=False))
    row = _fake_row(ingest_tag=None)
    db = AsyncMock()
    with pytest.raises(FieldValidationError):
        await _save(db, _tenant(), enabled=True, row=row)
    assert row.ingest_tag is None
    db.scalar.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_tag_survives_disable_then_re_enable():
    """Reissuing one silently breaks the customer's own mailbox rule — their documents
    would arrive at an address nobody owns, with no error anywhere."""
    row = _fake_row(ingest_tag="a1b2c3d4")
    await _save(AsyncMock(), _tenant(), enabled=False, row=row, tax_ids=[])
    assert row.ingest_tag == "a1b2c3d4"
    await _save(AsyncMock(), _tenant(), enabled=True, row=row)
    assert row.ingest_tag == "a1b2c3d4"


@pytest.mark.asyncio
async def test_the_allocator_skips_a_tag_another_bu_already_holds():
    """The partial unique index is the real guard; this keeps a collision from arriving
    as a failed commit that would take the whole save with it."""
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[_exec(scalar_one_or_none=None)])
    db.scalar = AsyncMock(side_effect=["taken", "taken", None])
    tag = await es._fresh_tag(db)
    assert len(tag) == 8 and db.scalar.await_count == 3
