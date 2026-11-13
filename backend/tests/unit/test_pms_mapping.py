"""Decision-log #54 — what the AI is shown for a PMS day's new rows (services/pms/mapping.py).

Every PMS keys its mapping differently, so the AI reads each key under the BU's own column
names. It sees no amounts: Carmen's preview carries none (user decision 2026-11-10).
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.pms import carmen_config as cfg
from app.services.pms import mapping

COLUMNS = ["HT_Code", "HT_Description", "Department"]
NEW = cfg.key_id(["1115001", "100 - ABF Revenue", ""])
MAPPED = cfg.key_id(["1115001", "001 - Room Charge (Auto)", ""])
TABLE = {MAPPED: {"dept": "101", "acc": "4010001", "name": "Room Revenue"}}
ACCOUNTS = [
    {"code": "4010001", "name": "Room Revenue", "type": "income"},
    {"code": "4110001", "name": "Food Revenue", "type": "income"},
]
DEPTS = [
    {"code": "101", "name": "Rooms", "allowed_accounts": []},
    {"code": "201", "name": "F&B", "allowed_accounts": []},
]


def test_a_key_reads_under_its_column_names_blank_values_left_out():
    assert mapping._line(NEW, COLUMNS) == "HT_Code: 1115001 · HT_Description: 100 - ABF Revenue"


@pytest.mark.asyncio
async def test_the_ai_sees_the_bus_columns_and_examples_and_no_amounts():
    answer = {"L1": {"dept": "201", "acc": "4110001", "confidence": "high", "why": "food"}}
    llm = AsyncMock(return_value=answer)
    with patch.object(mapping, "call_text_llm", llm):
        out = await mapping.suggest([NEW], TABLE, ACCOUNTS, DEPTS, COLUMNS)
    prompt = llm.await_args.args[0]
    assert "(HT_Code, HT_Description, Department)" in prompt
    assert "HT_Code: 1115001 · HT_Description: 001 - Room Charge (Auto) -> 101/4010001" in prompt
    assert '"line": "HT_Code: 1115001 · HT_Description: 100 - ABF Revenue"' in prompt
    assert "amount" not in prompt.lower()
    assert out[NEW]["dept"] == "201" and out[NEW]["acc"] == "4110001"


@pytest.mark.asyncio
async def test_an_unusable_answer_is_asked_once_more():
    """The model answered cut or empty now and then (2026-11-10): one more try, then none."""
    answer = {"L1": {"dept": "201", "acc": "4110001", "confidence": "high", "why": "food"}}
    llm = AsyncMock(side_effect=[None, answer])
    with patch.object(mapping, "call_text_llm", llm):
        out = await mapping.suggest([NEW], TABLE, ACCOUNTS, DEPTS, COLUMNS)
    assert out[NEW]["acc"] == "4110001" and llm.await_count == 2
    assert llm.await_args.kwargs["max_tokens"] == mapping._MAX_TOKENS

    llm = AsyncMock(return_value=None)
    with patch.object(mapping, "call_text_llm", llm):
        assert await mapping.suggest([NEW], TABLE, ACCOUNTS, DEPTS, COLUMNS) == {}
    assert llm.await_count == mapping._TRIES


@pytest.mark.asyncio
async def test_nothing_new_asks_nothing():
    llm = AsyncMock()
    with patch.object(mapping, "call_text_llm", llm):
        assert await mapping.suggest([], TABLE, ACCOUNTS, DEPTS, COLUMNS) == {}
    llm.assert_not_awaited()


# ── Decision-log #57: a pick the department forbids is repaired, then asked again ─────

OUTPUT_TAX = "2150001"
RESTRICTED = [
    {"code": "103", "name": "Front Office", "allowed_accounts": ["4010001"]},
    {"code": "201", "name": "F&B", "allowed_accounts": []},
    {"code": "GEN", "name": "General", "allowed_accounts": []},
]
WITH_TAX = [*ACCOUNTS, {"code": OUTPUT_TAX, "name": "Output Tax", "type": "balancesheet"}]
NEW_2 = cfg.key_id(["2115002", "VAT room", ""])
FORBIDDEN = {"L1": {"dept": "103", "acc": OUTPUT_TAX, "confidence": "high", "why": "vat"}}


@pytest.mark.asyncio
async def test_a_pair_the_department_forbids_moves_to_the_department_the_bu_uses_with_it():
    """QA carmencloud 2026-11-13: 31 rows came back dept 103 + a balance-sheet account 103
    does not allow, and the account was thrown away. It now follows the BU's own table."""
    table = {
        **TABLE,
        cfg.key_id(["9", "VAT a", ""]): {"dept": "201", "acc": OUTPUT_TAX, "name": "x"},
        cfg.key_id(["8", "VAT b", ""]): {"dept": "201", "acc": OUTPUT_TAX, "name": "x"},
        cfg.key_id(["7", "VAT c", ""]): {"dept": "GEN", "acc": OUTPUT_TAX, "name": "x"},
    }
    llm = AsyncMock(return_value=FORBIDDEN)
    with patch.object(mapping, "call_text_llm", llm):
        out = await mapping.suggest([NEW], table, WITH_TAX, RESTRICTED, COLUMNS)
    assert (out[NEW]["dept"], out[NEW]["acc"]) == ("201", OUTPUT_TAX)
    assert llm.await_count == 1  # nothing left blank, nothing asked again


@pytest.mark.asyncio
async def test_without_a_house_pattern_the_account_goes_to_gen():
    llm = AsyncMock(return_value=FORBIDDEN)
    with patch.object(mapping, "call_text_llm", llm):
        out = await mapping.suggest([NEW], TABLE, WITH_TAX, RESTRICTED, COLUMNS)
    assert (out[NEW]["dept"], out[NEW]["acc"]) == ("GEN", OUTPUT_TAX)
    assert llm.await_count == 1


@pytest.mark.asyncio
async def test_rows_still_blank_are_asked_once_more_with_why_and_only_those():
    """No GEN and no house pattern: the pair cannot be repaired here. The AI is asked again
    for that row alone, told why its answer was refused; a skipped line is asked too."""
    no_gen = RESTRICTED[:2]
    first = {**FORBIDDEN}  # L2 skipped
    second = {"L1": {"dept": "201", "acc": OUTPUT_TAX, "confidence": "medium", "why": "tax"}}
    llm = AsyncMock(side_effect=[first, second])
    with patch.object(mapping, "call_text_llm", llm):
        out = await mapping.suggest([NEW, NEW_2], TABLE, WITH_TAX, no_gen, COLUMNS)
    assert llm.await_count == 2
    again = llm.await_args.args[0]
    assert f"L1: department 103 does not allow account {OUTPUT_TAX}" in again
    assert "L2: no answer" in again
    assert "103: 4010001" in again
    assert '"id": "L1"' in again and '"id": "L2"' in again
    assert (out[NEW]["dept"], out[NEW]["acc"]) == ("201", OUTPUT_TAX)
    assert out[NEW]["why"] == "tax"
    assert out[NEW_2]["acc"] is None  # asked twice, still nothing: left for the person


@pytest.mark.asyncio
async def test_the_second_ask_leaves_out_the_rows_already_picked():
    first = {
        "L1": {"dept": "103", "acc": "9999999"},  # not in the chart
        "L2": {"dept": "201", "acc": "4110001"},
    }
    llm = AsyncMock(side_effect=[first, None])
    with patch.object(mapping, "call_text_llm", llm):
        out = await mapping.suggest([NEW, NEW_2], TABLE, WITH_TAX, RESTRICTED, COLUMNS)
    again = llm.await_args.args[0]
    assert "L1: account 9999999 is not in the chart" in again
    assert '"id": "L2"' not in again
    assert out[NEW_2]["acc"] == "4110001"
    assert out[NEW]["acc"] is None  # the second ask failed: the row stays blank
