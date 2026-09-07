"""The suggester must ask the same question however Carmen orders its master.

Everything between the Carmen response and the prompt preserves input order and then
truncates — `score_and_pad` sorts by keyword score alone (stable, so equal scores keep the
order they arrived in) and cuts at `limit`; `_filter_by_type` filters without reordering; the
department list is sliced at 50. So the candidates the model was shown, and the order it saw
them in, were whatever order Carmen happened to answer in, and nothing guarantees that to be
stable between two calls.

Measured consequence (2026-09-07): seven documents asked against one master returned
`commission → GEN/6080008` six times and `307/6080008` once. `commission` is BU-wide, so the
odd answer became the rule for every bank the moment that document was approved.

These tests pin the property rather than the wording: same inputs in a different order must
build a byte-identical prompt. No LLM call — the prompt is captured on the way out.
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.gl_suggestion_service import suggest_fixed_fields, suggest_payment_types

# Enough accounts to be cut by the 40-item commission limit and the 30-item balance one, so
# a reordering changes *membership* and not merely position — the sharper failure.
ACCOUNTS = [
    {"code": f"6{i:06d}", "name": f"Bank charge {i}", "type": "expense"} for i in range(60)
] + [
    {"code": f"1{i:06d}", "name": f"Bank current account {i}", "type": "balancesheet"}
    for i in range(60)
]

DEPARTMENTS = [
    {"code": f"D{i:03d}", "name": f"Dept {i}", "allowed_accounts": []} for i in range(70)
]


def _shuffled(items: list[dict]) -> list[dict]:
    """Reversed, not randomised: a deterministic 'some other order Carmen might answer in',
    so a failure here is reproducible rather than flaky."""
    return list(reversed(items))


async def _prompt_from(fn, **kwargs) -> str:
    with patch("app.services.gl_suggestion_service.call_text_llm", new_callable=AsyncMock) as llm:
        llm.return_value = {"suggestions": {}}
        with patch("app.services.gl_suggestion_service.settings") as cfg:
            cfg.openrouter_api_key = "sk-test"
            await fn(**kwargs)
    assert llm.await_count == 1
    return llm.await_args.args[0]


@pytest.mark.asyncio
async def test_fixed_fields_prompt_does_not_depend_on_carmen_order():
    first = await _prompt_from(suggest_fixed_fields, accounts=ACCOUNTS, departments=DEPARTMENTS)
    second = await _prompt_from(
        suggest_fixed_fields, accounts=_shuffled(ACCOUNTS), departments=_shuffled(DEPARTMENTS)
    )
    assert first == second


@pytest.mark.asyncio
async def test_payment_type_prompt_does_not_depend_on_carmen_order():
    first = await _prompt_from(
        suggest_payment_types,
        payment_types=["VISA", "MASTERCARD"],
        accounts=ACCOUNTS,
        departments=DEPARTMENTS,
        bank_code="KBANK",
    )
    second = await _prompt_from(
        suggest_payment_types,
        payment_types=["VISA", "MASTERCARD"],
        accounts=_shuffled(ACCOUNTS),
        departments=_shuffled(DEPARTMENTS),
        bank_code="KBANK",
    )
    assert first == second
