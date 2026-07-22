"""
Unit tests for GL mapping history feature.

Covers:
  - mapping_history_service.get_confirmed_mappings  (Carmen JV-derived)
  - mapping router /suggest and /suggest-payment-types (bypass / hint / merge logic)
  - prompts/mapping.py hint_text injection
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import make_mock_db, set_context
from tests.integration.conftest import FAKE_SESSION, make_test_client

TENANT_ID = FAKE_SESSION.tenant_id
AUTH_HEADERS = {"Authorization": "Bearer dummy"}
BASE_URL = "/api/v1/credit-card/mapping"


# ── Helpers ───────────────────────────────────────────────────────────────────


def _jv(desc: str, dept: str, acc: str) -> dict:
    """One JV detail line as returned by Carmen /spGetListJvBySource."""
    return {"JvdDesc": desc, "DeptCode": dept, "AccCode": acc}


def _patch_jv_rows(rows: list[dict]):
    """Patch the Carmen JV fetch + clear the module cache for a clean read."""
    from app.services import mapping_history_service as svc

    svc._CACHE.clear()
    return patch.object(svc, "get_jv_by_source", new_callable=AsyncMock, return_value=rows)


# ═══════════════════════════════════════════════════════════════════════════════
# 1. mapping_history_service — derives confirmed mappings from Carmen JVs
# ═══════════════════════════════════════════════════════════════════════════════


class TestGetConfirmedMappings:
    """Service layer — aggregates prior Carmen JV lines into best (dept, acc) per field_type."""

    @pytest.mark.asyncio
    async def test_returns_empty_without_source_or_token(self):
        set_context(TENANT_ID)
        from app.services.mapping_history_service import get_confirmed_mappings

        assert await get_confirmed_mappings("BBL", ["Input Tax"], "", "tok") == {}
        assert await get_confirmed_mappings("BBL", ["Input Tax"], "acbb", "") == {}

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_jv_history(self):
        set_context(TENANT_ID)
        from app.services.mapping_history_service import get_confirmed_mappings

        with _patch_jv_rows([]):
            result = await get_confirmed_mappings(
                "BBL", ["Credit card commission", "Input Tax"], "acbb", "tok"
            )
        assert result == {}

    @pytest.mark.asyncio
    async def test_matches_field_type_by_label_and_counts_frequency(self):
        set_context(TENANT_ID)
        rows = [
            _jv("002205993264", "GEN", "1011001"),  # transaction line — ignored
            _jv("Credit card commission", "GEN", "6080008"),
            _jv("Input Tax", "GEN", "1022005"),
            _jv("Credit card commission", "GEN", "6080008"),
        ]
        from app.services.mapping_history_service import get_confirmed_mappings

        with _patch_jv_rows(rows):
            result = await get_confirmed_mappings(
                "BBL", ["Credit card commission", "Input Tax", "Bank Account"], "acbb", "tok"
            )

        assert result["Credit card commission"] == {
            "dept": "GEN",
            "acc": "6080008",
            "confirmed_count": 2,
        }
        assert result["Input Tax"] == {"dept": "GEN", "acc": "1022005", "confirmed_count": 1}
        assert "Bank Account" not in result  # no matching JV line

    @pytest.mark.asyncio
    async def test_picks_most_frequent_combo_for_field_type(self):
        """'Bank Account' seen with two accounts → most frequent combo wins, count = its frequency."""
        set_context(TENANT_ID)
        rows = [
            _jv("Bank Account", "GEN", "1011002"),
            _jv("Bank Account", "GEN", "1011001"),
            _jv("Bank Account", "GEN", "1011001"),
            _jv("Bank Account", "GEN", "1011001"),
        ]
        from app.services.mapping_history_service import get_confirmed_mappings

        with _patch_jv_rows(rows):
            result = await get_confirmed_mappings("BBL", ["Bank Account"], "acbb", "tok")

        assert result["Bank Account"] == {"dept": "GEN", "acc": "1011001", "confirmed_count": 3}

    @pytest.mark.asyncio
    async def test_matches_payment_type_label(self):
        set_context(TENANT_ID)
        rows = [_jv("VSA-INT-P", "GEN", "1021004")]
        from app.services.mapping_history_service import get_confirmed_mappings

        with _patch_jv_rows(rows):
            result = await get_confirmed_mappings("BBL", ["VSA-INT-P"], "acbb", "tok")

        assert result["VSA-INT-P"] == {"dept": "GEN", "acc": "1021004", "confirmed_count": 1}


# ═══════════════════════════════════════════════════════════════════════════════
# 2. BYPASS_THRESHOLD constant
# ═══════════════════════════════════════════════════════════════════════════════


def test_bypass_threshold_is_3():
    from app.services.mapping_history_service import BYPASS_THRESHOLD

    assert BYPASS_THRESHOLD == 3


# ═══════════════════════════════════════════════════════════════════════════════
# 3. POST /suggest — bypass / hint / merge logic
# ═══════════════════════════════════════════════════════════════════════════════

_ACCOUNTS = [{"code": "5100-00", "name": "Commission", "type": "income"}]
_DEPARTMENTS = [{"code": "GEN", "name": "General"}]


class TestSuggestEndpoint:
    def _suggest_body(self, bank_code="BBL"):
        return {
            "bank_code": bank_code,
            "source": "acbb",
            "accounts": _ACCOUNTS,
            "departments": _DEPARTMENTS,
        }

    # ── Full bypass (all fields confirmed >= 3) ────────────────────────────────

    def test_all_bypass_skips_llm(self):
        history_data = {
            "Credit card commission": {"dept": "GEN", "acc": "5100-00", "confirmed_count": 5},
            "Input Tax": {"dept": "GEN", "acc": "1510-01", "confirmed_count": 3},
            "Bank Account": {"dept": "GEN", "acc": "1020-01", "confirmed_count": 4},
        }
        db = make_mock_db()

        with (
            patch(
                "app.routers.mapping.get_confirmed_mappings",
                new_callable=AsyncMock,
                return_value=history_data,
            ),
            patch("app.routers.mapping.map_gl.suggest_fixed_fields") as mock_llm,
            make_test_client(db) as client,
        ):
            resp = client.post(
                f"{BASE_URL}/suggest", json=self._suggest_body(), headers=AUTH_HEADERS
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["source"] == "history"
        assert body["suggestions"]["Credit card commission"]["acc"] == "5100-00"
        mock_llm.assert_not_called()

    # ── Partial bypass + LLM for remaining ────────────────────────────────────

    def test_partial_bypass_calls_llm_for_remaining(self):
        history_data = {
            "Credit card commission": {"dept": "GEN", "acc": "5100-00", "confirmed_count": 5},
            # Input Tax and Bank Account missing
        }
        ai_return = MagicMock()
        ai_return.output = {
            "suggestions": {
                "Credit card commission": {"dept": "GEN", "acc": "5100-00"},
                "Input Tax": {"dept": "GEN", "acc": "1510-01"},
                "Bank Account": {"dept": "GEN", "acc": "1020-01"},
            }
        }
        db = make_mock_db()

        with (
            patch(
                "app.routers.mapping.get_confirmed_mappings",
                new_callable=AsyncMock,
                return_value=history_data,
            ),
            patch(
                "app.routers.mapping.map_gl.suggest_fixed_fields",
                new_callable=AsyncMock,
                return_value=ai_return,
            ) as mock_llm,
            make_test_client(db) as client,
        ):
            resp = client.post(
                f"{BASE_URL}/suggest", json=self._suggest_body(), headers=AUTH_HEADERS
            )

        assert resp.status_code == 200
        mock_llm.assert_called_once()
        # bypass result wins over AI
        body = resp.json()
        assert body["suggestions"]["Credit card commission"]["acc"] == "5100-00"

    # ── Bypass wins over AI on conflict ───────────────────────────────────────

    def test_bypass_wins_over_ai_on_same_field(self):
        history_data = {
            "Credit card commission": {"dept": "GEN", "acc": "BYPASS-ACC", "confirmed_count": 5},
        }
        ai_return = MagicMock()
        ai_return.output = {
            "suggestions": {
                "Credit card commission": {"dept": "GEN", "acc": "AI-ACC"},
                "Input Tax": {"dept": "GEN", "acc": "1510-01"},
                "Bank Account": {"dept": "GEN", "acc": "1020-01"},
            }
        }
        db = make_mock_db()

        with (
            patch(
                "app.routers.mapping.get_confirmed_mappings",
                new_callable=AsyncMock,
                return_value=history_data,
            ),
            patch(
                "app.routers.mapping.map_gl.suggest_fixed_fields",
                new_callable=AsyncMock,
                return_value=ai_return,
            ),
            make_test_client(db) as client,
        ):
            resp = client.post(
                f"{BASE_URL}/suggest", json=self._suggest_body(), headers=AUTH_HEADERS
            )

        body = resp.json()
        assert body["suggestions"]["Credit card commission"]["acc"] == "BYPASS-ACC"

    # ── No history → pure AI ──────────────────────────────────────────────────

    def test_no_history_falls_through_to_llm(self):
        ai_return = MagicMock()
        ai_return.output = {
            "suggestions": {
                "Credit card commission": {"dept": "GEN", "acc": "5100-00"},
                "Input Tax": {"dept": "GEN", "acc": "1510-01"},
                "Bank Account": {"dept": "GEN", "acc": "1020-01"},
            }
        }
        db = make_mock_db()

        with (
            patch(
                "app.routers.mapping.get_confirmed_mappings",
                new_callable=AsyncMock,
                return_value={},
            ),
            patch(
                "app.routers.mapping.map_gl.suggest_fixed_fields",
                new_callable=AsyncMock,
                return_value=ai_return,
            ) as mock_llm,
            make_test_client(db) as client,
        ):
            resp = client.post(
                f"{BASE_URL}/suggest", json=self._suggest_body(), headers=AUTH_HEADERS
            )

        assert resp.status_code == 200
        mock_llm.assert_called_once()

    # ── hint_text is built from low-count entries ──────────────────────────────

    def test_hint_text_passed_for_low_count_history(self):
        """confirmed_count < BYPASS_THRESHOLD → should appear as hint_text, not bypass."""
        history_data = {
            "Input Tax": {"dept": "ADM", "acc": "1510-01", "confirmed_count": 2},
        }
        ai_return = MagicMock()
        ai_return.output = {"suggestions": {}}
        db = make_mock_db()

        captured_hint = {}

        async def capture_suggest(accounts, departments, hint_text=""):
            captured_hint["hint"] = hint_text
            return ai_return

        with (
            patch(
                "app.routers.mapping.get_confirmed_mappings",
                new_callable=AsyncMock,
                return_value=history_data,
            ),
            patch("app.routers.mapping.map_gl.suggest_fixed_fields", side_effect=capture_suggest),
            make_test_client(db) as client,
        ):
            client.post(f"{BASE_URL}/suggest", json=self._suggest_body(), headers=AUTH_HEADERS)

        assert "Input Tax" in captured_hint.get("hint", "")
        assert "1510-01" in captured_hint.get("hint", "")


# ═══════════════════════════════════════════════════════════════════════════════
# 4. POST /suggest-payment-types — same bypass / hint / merge logic
# ═══════════════════════════════════════════════════════════════════════════════


class TestSuggestPaymentTypesEndpoint:
    def _body(self, payment_types=None):
        return {
            "bank_code": "BBL",
            "source": "acbb",
            "payment_types": payment_types or ["VSA", "MCA"],
            "accounts": _ACCOUNTS,
            "departments": _DEPARTMENTS,
        }

    def test_all_bypass_skips_llm(self):
        history_data = {
            "VSA": {"dept": "GEN", "acc": "1020-01", "confirmed_count": 4},
            "MCA": {"dept": "GEN", "acc": "1020-01", "confirmed_count": 3},
        }
        db = make_mock_db()

        with (
            patch(
                "app.routers.mapping.get_confirmed_mappings",
                new_callable=AsyncMock,
                return_value=history_data,
            ),
            patch("app.routers.mapping.map_gl.suggest_payment_types") as mock_llm,
            make_test_client(db) as client,
        ):
            resp = client.post(
                f"{BASE_URL}/suggest-payment-types", json=self._body(), headers=AUTH_HEADERS
            )

        assert resp.status_code == 200
        assert resp.json()["source"] == "history"
        mock_llm.assert_not_called()

    def test_bypass_wins_over_ai(self):
        history_data = {
            "VSA": {"dept": "GEN", "acc": "BYPASS-ACC", "confirmed_count": 5},
        }
        ai_return = MagicMock()
        ai_return.output = {
            "suggestions": {
                "VSA": {"dept": "GEN", "acc": "AI-ACC"},
                "MCA": {"dept": "GEN", "acc": "1020-01"},
            }
        }
        db = make_mock_db()

        with (
            patch(
                "app.routers.mapping.get_confirmed_mappings",
                new_callable=AsyncMock,
                return_value=history_data,
            ),
            patch(
                "app.routers.mapping.map_gl.suggest_payment_types",
                new_callable=AsyncMock,
                return_value=ai_return,
            ),
            make_test_client(db) as client,
        ):
            resp = client.post(
                f"{BASE_URL}/suggest-payment-types", json=self._body(), headers=AUTH_HEADERS
            )

        assert resp.json()["suggestions"]["VSA"]["acc"] == "BYPASS-ACC"

    def test_no_history_calls_llm_with_all_types(self):
        ai_return = MagicMock()
        ai_return.output = {
            "suggestions": {
                "VSA": {"dept": "GEN", "acc": "1020-01"},
                "MCA": {"dept": "GEN", "acc": "1020-01"},
            }
        }
        db = make_mock_db()

        with (
            patch(
                "app.routers.mapping.get_confirmed_mappings",
                new_callable=AsyncMock,
                return_value={},
            ),
            patch(
                "app.routers.mapping.map_gl.suggest_payment_types",
                new_callable=AsyncMock,
                return_value=ai_return,
            ) as mock_llm,
            make_test_client(db) as client,
        ):
            resp = client.post(
                f"{BASE_URL}/suggest-payment-types", json=self._body(), headers=AUTH_HEADERS
            )

        assert resp.status_code == 200
        mock_llm.assert_called_once()


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Prompt builders — hint_text injection
# ═══════════════════════════════════════════════════════════════════════════════


class TestPromptBuilders:
    def test_fixed_fields_prompt_no_hint(self):
        from app.llm.prompts.mapping import build_fixed_fields_prompt

        prompt = build_fixed_fields_prompt(
            dept_lines="  GEN General",
            commission_acc_lines="  5100-00 Commission",
            balance_acc_lines="  1510-01 Input Tax",
            commission_acc_count=1,
            balance_acc_count=1,
        )
        assert "Prior confirmed mappings" not in prompt

    def test_fixed_fields_prompt_with_hint(self):
        from app.llm.prompts.mapping import build_fixed_fields_prompt

        hint = '  "Credit card commission" → dept GEN, acc 5100-00  (confirmed 5×)'
        prompt = build_fixed_fields_prompt(
            dept_lines="  GEN General",
            commission_acc_lines="  5100-00 Commission",
            balance_acc_lines="  1510-01 Input Tax",
            commission_acc_count=1,
            balance_acc_count=1,
            hint_text=hint,
        )
        assert "Prior confirmed mappings" in prompt
        assert "5100-00" in prompt
        assert "confirmed 5×" in prompt

    def test_fixed_fields_prompt_whitespace_only_hint_omitted(self):
        from app.llm.prompts.mapping import build_fixed_fields_prompt

        prompt = build_fixed_fields_prompt(
            dept_lines="  GEN General",
            commission_acc_lines="  5100-00 Commission",
            balance_acc_lines="  1510-01 Input Tax",
            commission_acc_count=1,
            balance_acc_count=1,
            hint_text="   ",
        )
        assert "Prior confirmed mappings" not in prompt

    def test_payment_types_prompt_no_hint(self):
        from app.llm.prompts.mapping import build_payment_types_prompt

        prompt = build_payment_types_prompt(
            types_list="  - VSA\n  - MCA",
            dept_lines="  GEN General",
            acc_lines="  1020-01 Bank",
            b_account_count=1,
            payment_types=["VSA", "MCA"],
        )
        assert "Prior confirmed mappings" not in prompt

    def test_payment_types_prompt_with_hint(self):
        from app.llm.prompts.mapping import build_payment_types_prompt

        hint = '  "VSA" → dept GEN, acc 1020-01  (confirmed 4×)'
        prompt = build_payment_types_prompt(
            types_list="  - VSA\n  - MCA",
            dept_lines="  GEN General",
            acc_lines="  1020-01 Bank",
            b_account_count=1,
            payment_types=["VSA", "MCA"],
            hint_text=hint,
        )
        assert "Prior confirmed mappings" in prompt
        assert "1020-01" in prompt
        assert "confirmed 4×" in prompt

    def test_payment_types_prompt_contains_all_keys(self):
        from app.llm.prompts.mapping import build_payment_types_prompt

        prompt = build_payment_types_prompt(
            types_list="  - VSA\n  - MCA\n  - QR-TH",
            dept_lines="  GEN General",
            acc_lines="  1020-01 Bank",
            b_account_count=1,
            payment_types=["VSA", "MCA", "QR-TH"],
        )
        assert '"VSA"' in prompt
        assert '"MCA"' in prompt
        assert '"QR-TH"' in prompt

    def test_payment_types_prompt_group_framing(self):
        from app.llm.prompts.mapping import build_payment_types_prompt

        kwargs = dict(
            types_list="  - VSA",
            dept_lines="  GEN General",
            acc_lines="  1020-01 Bank",
            b_account_count=1,
            payment_types=["VSA"],
        )
        bank = build_payment_types_prompt(**kwargs)  # default group="bank"
        assert "money the bank owes the merchant" in bank
        assert "payment gateway" not in bank

        gateway = build_payment_types_prompt(**kwargs, group="gateway")
        assert "payment gateway" in gateway
        assert "money the bank owes the merchant" not in gateway

        unknown = build_payment_types_prompt(**kwargs, group="crypto")
        assert unknown == bank  # unknown group falls back to bank framing
