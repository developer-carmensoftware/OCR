"""Unit tests for `fill_missing_mappings` — the additive writer the email ingest
job uses to persist what the AI guessed.

The distinction from `save_accounting_config` is the whole point and is what these
pin: that one replaces every entry, this one only ever fills a gap. The job runs
while a customer may have the same config open in the app.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.models import BUAccountingMappingEntry
from app.services.accounting_config_service import description_for, fill_missing_mappings

TENANT_ID = str(uuid4())


def _exec(*, scalar_one_or_none=None, scalars=()):
    r = MagicMock()
    r.scalar_one_or_none.return_value = scalar_one_or_none
    r.scalars.return_value.all.return_value = list(scalars)
    return r


def _db(config_row, entries):
    db = AsyncMock()
    db.add = MagicMock()
    db.execute = AsyncMock(
        side_effect=[
            _exec(scalar_one_or_none=config_row),  # _get_config
            _exec(scalars=entries),  # _get_entries
        ]
    )
    return db


def _entry(field_type, dept=None, acc=None):
    return SimpleNamespace(field_type=field_type, dept_code=dept, acc_code=acc)


@pytest.mark.asyncio
async def test_never_overwrites_a_mapping_the_customer_set():
    mine = _entry("commission", "OPS", "5199")
    db = _db(SimpleNamespace(id=1), [mine])

    await fill_missing_mappings(db, TENANT_ID, {"commission": {"dept": "GEN", "acc": "5100"}})

    assert (mine.dept_code, mine.acc_code) == ("OPS", "5199")  # untouched
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_fills_a_custom_type_row_that_exists_but_is_empty():
    """Adding a custom type in the app creates a row with no dept/acc — a gap, not a value."""
    blank = _entry("Visa")
    db = _db(SimpleNamespace(id=1), [blank])

    await fill_missing_mappings(db, TENANT_ID, {"Visa": {"dept": "GEN", "acc": "1130V"}})

    assert (blank.dept_code, blank.acc_code) == ("GEN", "1130V")
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_inserts_a_type_that_has_no_row_at_all():
    db = _db(SimpleNamespace(id=7), [])

    await fill_missing_mappings(db, TENANT_ID, {"MCA": {"dept": "GEN", "acc": "1130M"}})

    added = db.add.call_args[0][0]
    assert isinstance(added, BUAccountingMappingEntry)
    assert (added.field_type, added.dept_code, added.acc_code) == ("MCA", "GEN", "1130M")
    assert added.is_custom is True  # not one of commission/tax/net


@pytest.mark.asyncio
async def test_a_half_filled_suggestion_is_dropped_not_written():
    """A JV line with a blank account posts garbage — better to park the document."""
    db = _db(SimpleNamespace(id=1), [])

    await fill_missing_mappings(db, TENANT_ID, {"tax": {"dept": "GEN", "acc": ""}})

    db.execute.assert_not_awaited()  # returns before touching the DB
    db.commit.assert_not_awaited()


# ── description_for: per-bank wording, with the BU's single one as fallback ────


class _Cfg(SimpleNamespace):
    pass


def _cfg(description=None, bank_descriptions=None):
    return _Cfg(description=description, bank_descriptions=bank_descriptions or {})


def test_a_bank_with_its_own_wording_gets_it():
    cfg = _cfg("Generic settlement", {"SCB": "SCB settlement", "KTC": "KTC fee invoice"})
    assert description_for(cfg, "SCB") == "SCB settlement"
    assert description_for(cfg, "KTC") == "KTC fee invoice"


def test_a_bank_without_one_falls_back_to_the_bus_single_description():
    """The whole point of the fallback: nothing changes for a BU that never sets one."""
    cfg = _cfg("Generic settlement", {"SCB": "SCB settlement"})
    assert description_for(cfg, "BBL") == "Generic settlement"
    assert description_for(cfg, None) == "Generic settlement"
    assert description_for(_cfg("Generic settlement"), "SCB") == "Generic settlement"


def test_a_blank_per_bank_entry_is_not_treated_as_wording():
    """An empty string on the JV reads as a missing description, not an override."""
    assert description_for(_cfg("Generic", {"SCB": "   "}), "SCB") == "Generic"
    assert description_for(_cfg("Generic", {"SCB": ""}), "SCB") == "Generic"


def test_no_description_anywhere_is_none_not_a_crash():
    assert description_for(_cfg(), "SCB") is None
