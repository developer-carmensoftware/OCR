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
async def test_nothing_new_asks_nothing():
    llm = AsyncMock()
    with patch.object(mapping, "call_text_llm", llm):
        assert await mapping.suggest([], TABLE, ACCOUNTS, DEPTS, COLUMNS) == {}
    llm.assert_not_awaited()
