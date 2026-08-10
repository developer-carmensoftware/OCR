"""The ACTX (input-tax) payload email automation posts after the JV.

Pins it against InputTaxReconciliation.tsx, which is where the same arithmetic runs
when a human is watching. The refusal cases matter as much as the happy one: a
wrong tax period or a guessed rate is a record someone has to go and correct in
Carmen, which is worse than the record that was never created.
"""

from types import SimpleNamespace

from app.models.schemas.ocr import ExtractedDetailRow
from app.services.cc_input_tax import build_input_tax_payload, resolve_tax_profile

PROFILES = {
    "Data": [
        {"Code": "VAT07", "Description": "VAT 7%", "TaxRate": 7},
        {"Code": "VAT00", "Description": "VAT 0%", "TaxRate": 0},
        {"Code": "VAT10", "Description": "VAT 10% (retired)", "TaxRate": 10, "Active": False},
    ]
}

BANK = SimpleNamespace(
    code="KTC",
    legal_name="Krungthai Card Public Company Limited",
    tax_id="0107545000110",
    address="591 United Business Centre II, Bangkok 10110",
)


def _rows(*triples):
    return [
        ExtractedDetailRow(transaction="Visa", pay_amt=p, commis_amt=c, tax_amt=t)
        for p, c, t in triples
    ]


def _build(**over):
    details = over.pop("details", _rows(("1070", "1000", "70")))
    kwargs = dict(
        doc_no="INV-001",
        doc_date="15/01/2026",
        bank=BANK,
        branch="00000",
        description="Credit card commission",
        tax_profiles_raw=PROFILES,
    )
    kwargs.update(over)
    return build_input_tax_payload(details, **kwargs)[0]


# ── The record itself ─────────────────────────────────────────────────────────


def test_sums_the_lines_and_derives_the_tax_period_from_the_document_date():
    p, _ = build_input_tax_payload(
        _rows(("1070", "1000", "70"), ("535", "500", "35")),
        doc_no="INV-001",
        doc_date="15/01/2026",
        bank=BANK,
        branch="00000",
        description="Credit card commission",
        tax_profiles_raw=PROFILES,
    )
    assert p["BfTaxAmt"] == "1500.00"
    assert p["TaxAmt"] == 105.0
    assert p["TotalAmt"] == "1605.00"
    assert p["Prefix"] == "vat202601"
    assert (p["FrDate"], p["ToDate"]) == ("2026-01-01", "2026-01-31")
    assert p["InvhTInvDt"] == "2026-01-15T00:00:00.000Z"
    assert p["Source"] == "ACTX"


def test_carries_the_issuers_registered_identity_not_the_hotels():
    """ACTX records the party that issued the tax invoice — the bank."""
    p = _build()
    assert p["VnName"] == BANK.legal_name
    assert p["TaxId"] == BANK.tax_id
    assert p["Address"] == BANK.address
    assert p["BranchNo"] == "00000"  # the BU's own branch, from its accounting config


def test_february_in_a_leap_year_ends_on_the_29th():
    p = _build(doc_date="03/02/2028")
    assert (p["FrDate"], p["ToDate"]) == ("2028-02-01", "2028-02-29")


def test_a_buddhist_era_date_is_converted():
    p = _build(doc_date="15/01/2569")
    assert p["Prefix"] == "vat202601"
    assert p["InvhTInvDt"].startswith("2026-01-15")


def test_posts_the_profiles_canonical_rate_but_the_documents_own_vat_amount():
    """70.10 on 1000 is 7.01% — the badge says 7%, the claim stays 70.10."""
    p = _build(details=_rows(("1070.10", "1000", "70.10")))
    assert p["TaxRate"] == 7
    assert p["TaxProfileCode"] == "VAT07"
    assert p["TaxAmt"] == 70.10  # not recomputed as 7% of net


# ── When no record is better than a wrong one ─────────────────────────────────


def test_no_record_when_the_document_carries_no_vat():
    assert _build(details=_rows(("1000", "1000", "0"))) is None


def test_no_record_when_the_date_cannot_be_read():
    """The tax period comes from the date; a guess files the claim in the wrong month."""
    assert _build(doc_date="not-a-date") is None
    assert _build(doc_date=None) is None
    assert _build(doc_date="31/02/2026") is None  # not a real day


def test_no_record_when_no_profile_matches_the_documents_rate():
    assert _build(details=_rows(("1030", "1000", "30"))) is None  # 3% — no such profile


def test_no_record_when_the_bank_has_no_registered_identity():
    """Nullable on purpose: a bank nobody has filled in yet just gets no ACTX record."""
    assert _build(bank=SimpleNamespace(code="XXX", legal_name=None)) is None
    assert _build(bank=None) is None


# ── resolve_tax_profile ───────────────────────────────────────────────────────


def test_an_inactive_profile_is_never_selected():
    """Filing against a retired profile is invisible until the VAT return."""
    assert _build(details=_rows(("1100", "1000", "100"))) is None  # 10% exists but is Active:false


def test_resolve_matches_within_a_hair_and_otherwise_refuses():
    profiles = [
        {"code": "VAT07", "desc": "VAT 7%", "rate": 7.0},
        {"code": "X", "desc": "", "rate": None},
    ]
    assert resolve_tax_profile(7.001, profiles)["code"] == "VAT07"
    assert resolve_tax_profile(7.5, profiles) is None


def test_a_skip_that_loses_a_claim_says_why_so_the_ledger_can_show_it():
    """A silently skipped record is a VAT claim nobody ever finds out was lost."""
    _, why = build_input_tax_payload(
        _rows(("1070", "1000", "70")),
        doc_no="INV-001",
        doc_date="02/2026",  # a monthly statement — month and year, no day
        bank=BANK,
        branch="00000",
        description="d",
        tax_profiles_raw=PROFILES,
    )
    assert why and "no readable day" in why


def test_a_document_with_no_vat_is_skipped_without_a_complaint():
    """Nothing was lost, so nothing needs announcing."""
    payload, why = build_input_tax_payload(
        _rows(("1000", "1000", "0")),
        doc_no="INV-001",
        doc_date="15/01/2026",
        bank=BANK,
        branch="00000",
        description="d",
        tax_profiles_raw=PROFILES,
    )
    assert (payload, why) == (None, None)
