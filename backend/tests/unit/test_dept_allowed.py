"""Department-scoped account codes (Carmen DefaultAccount) enforcement."""

from unittest.mock import AsyncMock, MagicMock, patch

from app.services.ap_invoice_service import _parse_default_account
from app.services.gl_suggestion_service import _dept_allowed_map, _pair_ok, _validate_codes
from tests.conftest import make_mock_db
from tests.integration.conftest import make_test_client


class TestParseDefaultAccount:
    def test_stringified_json(self):
        raw = '[{"AccCode":"4010001","Description":"Room Revenue"},{"AccCode":"4010002","Description":"Extra"}]'
        assert _parse_default_account(raw) == {"4010001", "4010002"}

    def test_empty_string_array_is_wildcard(self):
        assert _parse_default_account("[]") == set()

    def test_garbage_and_none_are_wildcard(self):
        assert _parse_default_account("not json") == set()
        assert _parse_default_account(None) == set()
        assert _parse_default_account(42) == set()

    def test_native_list_also_accepted(self):
        assert _parse_default_account([{"AccCode": "1"}, {"nope": True}]) == {"1"}


class TestDeptAllowedMap:
    def test_only_restricted_depts_kept(self):
        depts = [
            {"code": "101", "name": "Rooms", "allowed_accounts": []},
            {"code": "103", "name": "Front Office", "allowed_accounts": ["4010001"]},
            {"code": "104", "name": "Housekeeping"},  # key absent
        ]
        assert _dept_allowed_map(depts) == {"103": {"4010001"}}


class TestPairOk:
    ALLOWED = {"103": {"4010001", "4010002"}}

    def test_wildcard_dept(self):
        assert _pair_ok("101", "9999999", self.ALLOWED)

    def test_restricted_dept_allows_listed(self):
        assert _pair_ok("103", "4010001", self.ALLOWED)

    def test_restricted_dept_rejects_unlisted(self):
        assert not _pair_ok("103", "9999999", self.ALLOWED)

    def test_missing_dept_or_acc_is_ok(self):
        assert _pair_ok(None, "4010001", self.ALLOWED)
        assert _pair_ok("103", None, self.ALLOWED)


class TestValidateCodesDeptAllowed:
    VALID_ACC = {"4010001", "9999999"}
    VALID_DEPT = {"103", "GEN"}

    def test_illegal_pair_blanks_account(self):
        data = {"f": {"dept": "103", "acc": "9999999"}}
        out = _validate_codes(data, ["f"], self.VALID_ACC, self.VALID_DEPT, {"103": {"4010001"}})
        assert out["f"] == {"dept": "103", "acc": None}

    def test_legal_pair_kept(self):
        data = {"f": {"dept": "103", "acc": "4010001"}}
        out = _validate_codes(data, ["f"], self.VALID_ACC, self.VALID_DEPT, {"103": {"4010001"}})
        assert out["f"] == {"dept": "103", "acc": "4010001"}

    def test_wildcard_dept_keeps_any_account(self):
        data = {"f": {"dept": "103", "acc": "9999999"}}
        out = _validate_codes(data, ["f"], self.VALID_ACC, self.VALID_DEPT, {})
        assert out["f"] == {"dept": "103", "acc": "9999999"}

    def test_gen_default_respects_gen_restriction(self):
        # acc valid but dept missing → GEN default only if GEN's list allows the acc
        data = {"f": {"acc": "9999999"}}
        out = _validate_codes(data, ["f"], self.VALID_ACC, self.VALID_DEPT, {"GEN": {"4010001"}})
        assert out["f"] == {"dept": None, "acc": "9999999"}

    def test_no_map_backward_compatible(self):
        data = {"f": {"dept": "103", "acc": "4010001"}}
        out = _validate_codes(data, ["f"], self.VALID_ACC, self.VALID_DEPT)
        assert out["f"] == {"dept": "103", "acc": "4010001"}


class TestRouterHistoryBypassEnforcement:
    """History-bypass entries in the mapping router must respect DefaultAccount too."""

    def test_illegal_history_pair_falls_through_to_ai(self):
        history_data = {
            # dept 103 restricts to 4010001 — this historical acc is now illegal
            "Credit card commission": {"dept": "103", "acc": "9999999", "confirmed_count": 5},
        }
        ai_return = MagicMock()
        ai_return.output = {"suggestions": {}}
        db = make_mock_db()

        body = {
            "bank_code": "BBL",
            "source": "acbb",
            "accounts": [{"code": "9999999", "name": "X"}],
            "departments": [
                {"code": "103", "name": "Front Office", "allowed_accounts": ["4010001"]}
            ],
        }

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
                "/api/v1/credit-card/mapping/suggest",
                json=body,
                headers={"Authorization": "Bearer dummy"},
            )

        assert resp.status_code == 200
        # illegal pair neither bypassed nor hinted — AI (enforced) covers the field
        assert "Credit card commission" not in resp.json()["suggestions"]
        mock_llm.assert_called_once()

    def test_legal_history_pair_still_bypasses(self):
        history_data = {
            "Credit card commission": {"dept": "103", "acc": "4010001", "confirmed_count": 5},
            "Input Tax": {"dept": "GEN", "acc": "1022005", "confirmed_count": 4},
            "Bank Account": {"dept": "GEN", "acc": "1011001", "confirmed_count": 3},
        }
        db = make_mock_db()

        body = {
            "bank_code": "BBL",
            "source": "acbb",
            "accounts": [{"code": "4010001", "name": "X"}],
            "departments": [
                {"code": "103", "name": "Front Office", "allowed_accounts": ["4010001"]},
                {"code": "GEN", "name": "General"},
            ],
        }

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
                "/api/v1/credit-card/mapping/suggest",
                json=body,
                headers={"Authorization": "Bearer dummy"},
            )

        assert resp.status_code == 200
        assert resp.json()["suggestions"]["Credit card commission"]["acc"] == "4010001"
        mock_llm.assert_not_called()
