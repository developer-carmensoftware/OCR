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
from app.services.accounting_config_service import fill_missing_mappings

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
