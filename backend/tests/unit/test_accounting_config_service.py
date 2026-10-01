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
from app.services.credit_card.accounting_config import (
    description_for,
    fill_missing_mappings,
    patch_config,
)

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
    return SimpleNamespace(field_type=field_type, dept_code=dept, acc_code=acc, source=None)


@pytest.mark.asyncio
async def test_never_overwrites_a_mapping_the_customer_set():
    mine = _entry("commission", "OPS", "5199")
    db = _db(SimpleNamespace(id=1), [mine])

    await fill_missing_mappings(
        db, TENANT_ID, {"commission": {"dept": "GEN", "acc": "5100"}}, bank_code="SCB"
    )

    assert (mine.dept_code, mine.acc_code) == ("OPS", "5199")  # untouched
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_fills_a_custom_type_row_that_exists_but_is_empty():
    """Adding a custom type in the app creates a row with no dept/acc — a gap, not a value."""
    blank = _entry("Visa")
    db = _db(SimpleNamespace(id=1), [blank])

    await fill_missing_mappings(
        db, TENANT_ID, {"Visa": {"dept": "GEN", "acc": "1130V"}}, bank_code="SCB"
    )

    assert (blank.dept_code, blank.acc_code) == ("GEN", "1130V")
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_inserts_a_type_that_has_no_row_at_all():
    db = _db(SimpleNamespace(id=7), [])

    await fill_missing_mappings(
        db, TENANT_ID, {"MCA": {"dept": "GEN", "acc": "1130M"}}, bank_code="SCB"
    )

    added = db.add.call_args[0][0]
    assert isinstance(added, BUAccountingMappingEntry)
    assert (added.field_type, added.dept_code, added.acc_code) == ("MCA", "GEN", "1130M")
    assert added.is_custom is True  # not one of commission/tax/net
    # Scoped to the bank it was filled for, not left null — a second bank must not
    # inherit this guess (the bug 20260924000000 fixes).
    assert added.bank_code == "SCB"


@pytest.mark.asyncio
async def test_a_half_filled_suggestion_is_dropped_not_written():
    """A JV line with a blank account posts garbage — better to park the document."""
    db = _db(SimpleNamespace(id=1), [])

    await fill_missing_mappings(db, TENANT_ID, {"tax": {"dept": "GEN", "acc": ""}}, bank_code="SCB")

    db.execute.assert_not_awaited()  # returns before touching the DB
    db.commit.assert_not_awaited()


# ── description_for: a bank's own wording, or nothing (no fallback since 2026-09-30) ──


class _Cfg(SimpleNamespace):
    pass


def _cfg(description=None, bank_descriptions=None):
    return _Cfg(description=description, bank_descriptions=bank_descriptions or {})


def test_a_bank_with_its_own_wording_gets_it():
    cfg = _cfg("Generic settlement", {"SCB": "SCB settlement", "KTC": "KTC fee invoice"})
    assert description_for(cfg, "SCB") == "SCB settlement"
    assert description_for(cfg, "KTC") == "KTC fee invoice"


def test_a_bank_without_one_gets_none_whatever_the_retired_column_holds():
    """The BU-wide `description` was read everywhere and editable nowhere (dev `carmen`
    sat behind "TEST ACC" on every bank). It is history now: the migration copied it into
    each bank the BU used, and a bank with no entry posts no description."""
    cfg = _cfg("Generic settlement", {"SCB": "SCB settlement"})
    assert description_for(cfg, "BBL") is None
    assert description_for(cfg, None) is None
    assert description_for(_cfg("Generic settlement"), "SCB") is None


def test_a_blank_per_bank_entry_is_no_description():
    assert description_for(_cfg("Generic", {"SCB": "   "}), "SCB") is None
    assert description_for(_cfg("Generic", {"SCB": ""}), "SCB") is None


def test_no_description_anywhere_is_none_not_a_crash():
    assert description_for(_cfg(), "SCB") is None


# ── patch_config — the review screen's writer ────────────────────────────────
#
# Third writer of this table, and the one that overwrites. What these pin is the
# difference from BOTH siblings: unlike `fill_missing_mappings` it replaces a value the
# customer set (that is what a correction is), and unlike `save_accounting_config` it
# leaves every key it was not given alone.


@pytest.mark.asyncio
async def test_a_correction_replaces_what_was_already_there():
    """`fill_missing_mappings` deliberately refuses this, which is why it cannot be reused:
    a reviewer fixing a wrong GL account is overwriting by definition."""
    wrong = _entry("tax", "GEN", "511200")
    db = _db(SimpleNamespace(id=1, bank_code=None), [wrong])

    await patch_config(db, TENANT_ID, mappings={"tax": {"dept": "GEN", "acc": "511300"}})

    assert (wrong.dept_code, wrong.acc_code) == ("GEN", "511300")
    db.add.assert_not_called()  # updated in place, not duplicated
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_it_leaves_every_mapping_it_was_not_given_alone():
    """The regression that matters. `save_accounting_config` DELETEs every entry and
    re-inserts, so routing the review screen through it would drop `commission` and
    `net` here — silently, and while a colleague may have the config open."""
    commission = _entry("commission", "OPS", "510300")
    net = _entry("net", "OPS", "110200")
    tax = _entry("tax", "OPS", "511200")
    db = _db(SimpleNamespace(id=1, bank_code=None), [commission, net, tax])

    await patch_config(db, TENANT_ID, mappings={"tax": {"dept": "OPS", "acc": "511300"}})

    assert (commission.dept_code, commission.acc_code) == ("OPS", "510300")
    assert (net.dept_code, net.acc_code) == ("OPS", "110200")
    assert tax.acc_code == "511300"


@pytest.mark.asyncio
async def test_a_payment_type_with_no_entry_yet_is_created_as_custom():
    db = _db(SimpleNamespace(id=1), [])

    await patch_config(
        db, TENANT_ID, mappings={"VISA": {"dept": "OPS", "acc": "110300"}}, bank_code="KBANK"
    )

    (added,) = [c.args[0] for c in db.add.call_args_list]
    assert isinstance(added, BUAccountingMappingEntry)
    assert (added.field_type, added.dept_code, added.acc_code) == ("VISA", "OPS", "110300")
    assert added.is_custom is True  # not one of commission/tax/net
    assert added.bank_code == "KBANK"  # the bank this correction was made about


@pytest.mark.asyncio
async def test_a_correction_for_one_bank_leaves_another_banks_entry_alone():
    """The row `_get_entries` returns belongs to KBANK; a correction made about SCB must
    create SCB's own row rather than overwriting KBANK's, even though both use `tax`."""
    kbank_tax = _entry("tax", "OPS", "511200")
    kbank_tax.bank_code = "KBANK"
    db = _db(SimpleNamespace(id=1, bank_code="KBANK"), [])  # SCB has no entries of its own yet

    await patch_config(
        db, TENANT_ID, mappings={"tax": {"dept": "OPS", "acc": "999999"}}, bank_code="SCB"
    )

    (added,) = [c.args[0] for c in db.add.call_args_list]
    assert (added.field_type, added.bank_code) == ("tax", "SCB")
    assert (kbank_tax.dept_code, kbank_tax.acc_code) == ("OPS", "511200")  # untouched


@pytest.mark.asyncio
async def test_a_half_filled_pair_is_ignored_rather_than_written_blank():
    """A JV line with a department and no account is worse than an unmapped one: it
    reaches Carmen and is refused there instead of here."""
    db = _db(SimpleNamespace(id=1), [])

    await patch_config(db, TENANT_ID, mappings={"tax": {"dept": "OPS", "acc": ""}})

    db.add.assert_not_called()
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_prefix_change_leaves_the_mappings_alone():
    entry = _entry("tax", "OPS", "511200")
    row = SimpleNamespace(id=1, file_prefix="JV", description=None, bank_descriptions={})
    db = _db(row, [entry])

    await patch_config(db, TENANT_ID, file_prefix="AJ")

    assert row.file_prefix == "AJ"
    assert (entry.dept_code, entry.acc_code) == ("OPS", "511200")
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_a_description_lands_on_the_bank_entry_that_actually_wins():
    """`description_for` prefers bank_descriptions[bank] over the BU-wide description, so
    writing the BU-wide one while a per-bank entry exists looks like the edit did nothing —
    the per-bank value keeps overriding it on every future document."""
    row = SimpleNamespace(
        id=1, file_prefix=None, description="Generic", bank_descriptions={"KBANK": "KBank fee"}
    )
    db = _db(row, [])

    await patch_config(db, TENANT_ID, description="KBank settlement", bank_code="KBANK")

    assert row.bank_descriptions == {"KBANK": "KBank settlement"}
    assert row.description == "Generic"  # untouched


@pytest.mark.asyncio
async def test_a_description_starts_this_banks_own_entry_when_it_had_none():
    """The edit was made about one bank's documents, so it lands on that bank.

    It used to write the BU-wide field whenever the bank had no entry yet, which took a
    correction to SCB's wording and applied it to every other bank the BU receives — and
    then read back as the field's placeholder rather than the value that was typed, because
    the review screen shows this bank's own entry (as the wizard's editor always has).
    """
    row = SimpleNamespace(id=1, file_prefix=None, description="Generic", bank_descriptions={})
    db = _db(row, [])

    await patch_config(db, TENANT_ID, description="Card settlement", bank_code="KBANK")

    assert row.bank_descriptions == {"KBANK": "Card settlement"}
    assert row.description == "Generic"  # every other bank keeps what it had


@pytest.mark.asyncio
async def test_a_description_with_no_bank_is_dropped_not_parked_in_the_retired_column():
    """There is no BU-wide description to write since 2026-09-30, and nothing would read
    it back — so with no bank named, a description alone is a no-op."""
    row = SimpleNamespace(id=1, file_prefix=None, description="Generic", bank_descriptions={})
    db = _db(row, [])

    await patch_config(db, TENANT_ID, description="Card settlement")

    assert row.description == "Generic"
    assert row.bank_descriptions == {}
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_naming_nothing_writes_nothing():
    """An approve with no corrections must not open a transaction at all."""
    db = _db(SimpleNamespace(id=1), [])

    await patch_config(db, TENANT_ID)

    db.commit.assert_not_awaited()


# ── get_accounting_config: a bank reads its own entries ─────────────────────────


def _config_row(bank_code=None):
    return SimpleNamespace(
        id=1,
        bank_code=bank_code,
        file_prefix="JV",
        file_source=None,
        description=None,
        branch=None,
        bank_descriptions={},
    )


def _typed(field_type, dept, acc, *, custom=False):
    return SimpleNamespace(
        field_type=field_type, dept_code=dept, acc_code=acc, is_custom=custom, source=None
    )


def _reads(config_row, *entry_batches):
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[_exec(scalar_one_or_none=config_row)]
        + [_exec(scalars=batch) for batch in entry_batches]
    )
    return db


@pytest.mark.asyncio
async def test_a_bank_read_is_that_banks_own_entries_and_borrows_nothing():
    """A bank-less entry used to answer for every bank that lacked the field (F-8,
    2026-09-25), which the mapping page could not clear: a payment type deleted there came
    back. 20261001000000 copied them to the banks that used them, so a bank's entries are
    its own — and one read, no second query for the bank-less."""
    from app.services.credit_card.accounting_config import get_accounting_config

    kbank_own = [_typed("commission", "OPS", "5199")]
    db = _reads(_config_row(), kbank_own)

    cfg = await get_accounting_config(db, TENANT_ID, "KBANK")

    assert cfg.mappings == {"commission": {"dept": "OPS", "acc": "5199", "source": None}}
    assert cfg.custom_types == []
    assert db.execute.await_count == 2  # config row + this bank's entries


@pytest.mark.asyncio
async def test_an_unscoped_read_asks_for_the_bankless_entries_once():
    """No bank named and none on the row: the one read is for entries with no bank."""
    from app.services.credit_card.accounting_config import get_accounting_config

    db = _reads(_config_row(), [_typed("tax", "GEN", "1022005")])

    cfg = await get_accounting_config(db, TENANT_ID)

    assert cfg.mappings == {"tax": {"dept": "GEN", "acc": "1022005", "source": None}}
    assert db.execute.await_count == 2  # config row + one entries read
