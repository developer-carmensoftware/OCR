"""
Regression guard for the combined-prompt contradiction that caused wrong
fee-invoice extraction (KTC/GHL/PAYPAL/SIAMPAY): the shared ROW_RULES skip-list
and OUTPUT_RULES pay_amt definition used to silently override each fee layout's
own "add a TOTAL summary row" / "line amount -> commis_amt" instructions.
"""

from app.llm.prompts import _COMBINED, _REGISTRY, get_ocr_prompt

_FEE_CODES = ("KTC", "GHL", "PAYPAL", "SIAMPAY")


def test_combined_prompt_states_layout_precedence():
    assert "OVERRIDE these general rules" in _COMBINED


def test_combined_prompt_carves_out_fee_invoice_summary_row_exception():
    assert "EXCEPTION to the skip-summary-rows rule" in _COMBINED
    assert "KTC/GHL/PAYPAL/SIAMPAY" in _COMBINED


def test_combined_prompt_carves_out_fee_invoice_pay_amt_exception():
    assert "EXCEPT on fee invoices" in _COMBINED


def test_each_fee_layout_still_instructs_a_summary_row():
    for code in _FEE_CODES:
        layout = _REGISTRY[code]
        assert "add ONE final summary row" in layout
        assert "EXCEPTION to the skip-summary-rows rule" in layout


def test_each_fee_layout_overrides_skip_blank_pay_amt_rule():
    # Regression: KTC/GHL/PAYPAL line rows always have pay_amt=null by design
    # (the fee goes in commis_amt) — without this override, general ROW_RULES
    # rule 3 ("SKIP rows where pay_amt is 0.00 or blank") lets the LLM drop the
    # only line row entirely, extracting details=[] for a single-line invoice.
    for code in _FEE_CODES:
        layout = _REGISTRY[code]
        assert "skip-rows-with-blank-pay_amt rule does NOT apply here" in layout


def test_get_ocr_prompt_default_is_combined_and_includes_fee_layouts():
    prompt = get_ocr_prompt(None)
    assert prompt == _COMBINED
    for code in _FEE_CODES:
        assert code in prompt


# ── The issuer the model matched, in every prompt's output contract ───────────


def test_every_prompt_asks_the_model_to_name_the_issuer():
    # Detection's tier 0. Without the field in BOTH the field list and the output
    # structure, the model answers Step 1 internally and never says so — which is how a
    # wrong layout's fixed `bank_name` became the strongest signal available.
    for prompt in [_COMBINED, *(get_ocr_prompt(code) for code in _REGISTRY)]:
        assert "- bank_code" in prompt
        assert '{"bank_code":' in prompt


def test_the_issuer_field_excludes_the_merchants_own_bank():
    # A fee invoice prints the merchant's settlement bank too; naming it here is the
    # difference between filing under PAYPAL and filing under whichever bank the hotel
    # happens to bank with.
    assert "never the merchant's own bank account" in _COMBINED


def test_combined_prompt_asks_for_the_bank_it_identified_in_step_1():
    assert "report the entry you matched in the bank_code field" in _COMBINED
