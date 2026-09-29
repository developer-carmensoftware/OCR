"""Card-brand receivables must reach the model, and a silent model must not become 1011001.

2026-09-23: a BU with many "Bank n Saving" accounts and one receivable per card brand got
every VSA/MCA type suggested onto its lowest-coded savings account. The brand accounts were
cut at 40 (sorted by code, they lose every tie to 1011xxx) and the empty-answer fallback was
"first bank account".
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.credit_card.gl_suggestion import suggest_payment_types

ACCOUNTS = [
    {"code": f"1011{i:03d}", "name": f"Bank {i} SCB Saving · บัญชีออมทรัพย์", "type": "balancesheet"}
    for i in range(60)
] + [
    {"code": "1130010", "name": "AR Credit Card · ลูกหนี้บัตร Visa", "type": "balancesheet"},
    {"code": "1130020", "name": "AR Credit Card · ลูกหนี้บัตร Master", "type": "balancesheet"},
]
DEPARTMENTS = [{"code": "GEN", "name": "General", "allowed_accounts": []}]
TYPES = ["VSA-INT-P", "VSA-INT", "MCA-INT-P", "MCA-INT", "QR-THAI"]


@pytest.mark.asyncio
async def test_brand_accounts_reach_prompt_and_fill_a_silent_model():
    with patch(
        "app.services.credit_card.gl_suggestion.call_text_llm", new_callable=AsyncMock
    ) as llm:
        llm.return_value = {}
        with patch("app.services.credit_card.gl_suggestion.settings") as cfg:
            cfg.openrouter_api_key = "sk-test"
            result = await suggest_payment_types(TYPES, ACCOUNTS, DEPARTMENTS, bank_code="SCB")

    prompt = llm.await_args.args[0]
    assert "1130010" in prompt and "1130020" in prompt

    s = result.output["suggestions"]
    assert s["VSA-INT-P"]["acc"] == s["VSA-INT"]["acc"] == "1130010"
    assert s["MCA-INT-P"]["acc"] == s["MCA-INT"]["acc"] == "1130020"
    # No QR account exists: left for the user, not guessed onto a savings account.
    assert not s["QR-THAI"]["acc"]
