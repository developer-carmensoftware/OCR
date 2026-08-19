"""
Unit tests for assert_module_enabled — the extract-time gate behind the admin
Credit Card OCR / AP Invoice toggles.

Opt-out semantics are the whole point: enforcement must block ONLY on an explicit
enabled=False row, never on a missing row, or turning it on would lock out every
tenant that has never had a tenant_modules row written (most of them).
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.exceptions import ModuleDisabled
from app.services import module_gate
from tests.conftest import set_context


def _db_returning(scalar):
    """Mock async_session() whose one execute() resolves scalar_one_or_none()."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = scalar
    db = AsyncMock()
    db.execute.return_value = result
    ctx = AsyncMock()
    ctx.__aenter__.return_value = db
    ctx.__aexit__.return_value = None
    return ctx, db


class TestAssertModuleEnabled:
    async def test_explicit_disabled_row_blocks(self):
        set_context("t-1")
        ctx, _ = _db_returning(False)  # a row exists, enabled=False
        with patch.object(module_gate, "async_session", return_value=ctx):
            with pytest.raises(ModuleDisabled) as exc:
                await module_gate.assert_module_enabled("credit_card_ocr")
        assert exc.value.module_id == "credit_card_ocr"

    async def test_no_row_allows(self):
        # The common case — most tenants have never had a tenant_modules row. Absence
        # must NOT block, or enabling enforcement locks everyone out.
        set_context("t-1")
        ctx, _ = _db_returning(None)
        with patch.object(module_gate, "async_session", return_value=ctx):
            await module_gate.assert_module_enabled("credit_card_ocr")  # no raise

    async def test_enabled_row_allows(self):
        set_context("t-1")
        ctx, _ = _db_returning(True)
        with patch.object(module_gate, "async_session", return_value=ctx):
            await module_gate.assert_module_enabled("ap_invoice")  # no raise

    async def test_no_tenant_context_is_noop(self):
        set_context("")  # no tenant → nothing to gate, don't even query
        db_called = MagicMock()
        with patch.object(module_gate, "async_session", db_called):
            await module_gate.assert_module_enabled("credit_card_ocr")
        db_called.assert_not_called()

    async def test_db_error_fails_open(self):
        # A transient DB failure must not block a scan — same fail-open stance as
        # consume_document. Only an explicit disabled row raises.
        set_context("t-1")
        ctx = AsyncMock()
        ctx.__aenter__.side_effect = RuntimeError("db down")
        with patch.object(module_gate, "async_session", return_value=ctx):
            await module_gate.assert_module_enabled("credit_card_ocr")  # no raise
