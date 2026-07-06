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
