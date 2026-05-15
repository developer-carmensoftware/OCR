"""
Unit tests for ap_invoice_postprocess_service.py
Pure Python — no DB, no LLM, no mocking needed.
"""

import pytest

from app.services.ap_invoice_postprocess_service import (
    _build_deposit_row,
    _compute_line_totals,
    _detect_tax_type,
    _distribute_footer_discount,
    _num,
    _r2,
    postprocess,
)

# ── _num helper ───────────────────────────────────────────────────────────────


class TestNum:
    def test_none_returns_zero(self):
        assert _num(None) == 0.0

    def test_empty_string_returns_zero(self):
        assert _num("") == 0.0

    def test_int(self):
        assert _num(42) == 42.0

    def test_float(self):
        assert _num(3.14) == 3.14

    def test_string_with_comma(self):
        assert _num("1,234.56") == 1234.56

    def test_invalid_string_returns_zero(self):
        assert _num("abc") == 0.0


# ── _r2 helper ────────────────────────────────────────────────────────────────


class TestR2:
    def test_rounds_to_2_decimals(self):
        assert _r2(1.005) == 1.01

    def test_exact_value_unchanged(self):
        assert _r2(100.0) == 100.0


# ── B2: _detect_tax_type ─────────────────────────────────────────────────────


class TestDetectTaxType:
    def _item(self, qty=1, unit_price=100.0, disc=0.0, tax_pct=7.0):
        return {"qty": qty, "unitPrice": unit_price, "discountAmt": disc, "taxPct": tax_pct}

    def test_B2_1_exclude_detected_when_items_sum_with_tax_matches_grand(self):
        # item = 100, +7% tax = 107 → grand=107 → Exclude
        items = [self._item(qty=1, unit_price=100.0, tax_pct=7.0)]
        result = _detect_tax_type(items, deposit_pct=0, doc_sub=0, doc_grand=107.0)
        assert result == "Exclude"

    def test_B2_2_include_detected_when_items_sum_equals_grand_directly(self):
        # item = 107, taxed-included → grand=107 exactly → Include
        items = [self._item(qty=1, unit_price=107.0, tax_pct=7.0)]
        result = _detect_tax_type(items, deposit_pct=0, doc_sub=0, doc_grand=107.0)
        assert result == "Include"

    def test_B2_3_deposit_doc_scales_before_compare(self):
        # item = 200, +7% = 214. deposit_pct=50 → effective=100 → collected+tax=107
        items = [self._item(qty=1, unit_price=200.0, tax_pct=7.0)]
        result = _detect_tax_type(items, deposit_pct=50, doc_sub=0, doc_grand=107.0)
        assert result == "Exclude"

    def test_B2_4_tie_break_defaults_to_exclude(self):
        # no doc_grand and no doc_sub → returns Exclude
        items = [self._item()]
        result = _detect_tax_type(items, deposit_pct=0, doc_sub=0, doc_grand=0)
        assert result == "Exclude"

    def test_empty_items_returns_exclude(self):
        assert _detect_tax_type([], 0, 0, 0) == "Exclude"

    def test_uses_doc_sub_when_doc_grand_is_zero(self):
        # item=100 net, sub=100 → Exclude fits sub directly
        items = [self._item(qty=1, unit_price=100.0, tax_pct=7.0)]
        result = _detect_tax_type(items, deposit_pct=0, doc_sub=100.0, doc_grand=0)
        assert result == "Exclude"


# ── B2: _distribute_footer_discount ──────────────────────────────────────────


class TestDistributeFooterDiscount:
    def test_B2_5_discount_distributed_proportionally(self):
        items = [
            {"qty": 1, "unitPrice": 200.0, "discountAmt": 0},
            {"qty": 1, "unitPrice": 100.0, "discountAmt": 0},
        ]
        _distribute_footer_discount(items, doc_disc=30.0)
        # 200/(200+100)=2/3 of 30=20; 100/300=1/3 of 30=10
        assert items[0]["discountAmt"] == pytest.approx(20.0, abs=0.01)
        assert items[1]["discountAmt"] == pytest.approx(10.0, abs=0.01)

    def test_B2_6_last_item_absorbs_rounding_remainder(self):
        # Use 3 items where proportion can't be exact
        items = [
            {"qty": 1, "unitPrice": 100.0, "discountAmt": 0},
            {"qty": 1, "unitPrice": 100.0, "discountAmt": 0},
            {"qty": 1, "unitPrice": 100.0, "discountAmt": 0},
        ]
        _distribute_footer_discount(items, doc_disc=10.0)
        total = sum(i["discountAmt"] for i in items)
        assert round(total, 2) == 10.0  # remainder absorbed in last item

    def test_no_discount_leaves_items_unchanged(self):
        items = [{"qty": 1, "unitPrice": 100.0, "discountAmt": 5.0}]
        _distribute_footer_discount(items, doc_disc=0)
        assert items[0]["discountAmt"] == 5.0

    def test_empty_items_no_crash(self):
        _distribute_footer_discount([], doc_disc=100.0)  # should not raise


# ── B2: _compute_line_totals ──────────────────────────────────────────────────


class TestComputeLineTotals:
    def _item(self, qty=1, unit_price=100.0, disc=0.0, disc_pct=0.0, tax_pct=7.0, line_amt=None):
        d = {
            "qty": qty,
            "unitPrice": unit_price,
            "discountAmt": disc,
            "discountPct": disc_pct,
            "taxPct": tax_pct,
        }
        if line_amt is not None:
            d["lineAmt"] = line_amt
        return d

    # ── Exclude tax ──

    def test_B2_7_exclude_no_discount(self):
        item = self._item(qty=1, unit_price=100.0, tax_pct=7.0)
        _compute_line_totals(item, "Exclude", has_footer_disc=False)
        assert item["lineSubTotal"] == 100.0
        assert item["taxAmt"] == pytest.approx(7.0, abs=0.01)
        assert item["lineTotal"] == pytest.approx(107.0, abs=0.01)

    def test_B2_8_exclude_per_row_discount_lineAmt_is_net(self):
        # lineAmt=90 is NET (per-row discount=10) → don't double-deduct
        item = self._item(qty=1, unit_price=100.0, disc=10.0, tax_pct=7.0, line_amt=90.0)
        _compute_line_totals(item, "Exclude", has_footer_disc=False)
        assert item["lineSubTotal"] == pytest.approx(90.0, abs=0.01)
        assert item["taxAmt"] == pytest.approx(6.30, abs=0.01)
        assert item["lineTotal"] == pytest.approx(96.30, abs=0.01)

    def test_B2_9_exclude_footer_discount_lineAmt_is_gross(self):
        # lineAmt=100 is GROSS (footer dist gave disc=10) → deduct discount
        item = self._item(qty=1, unit_price=100.0, disc=10.0, tax_pct=7.0, line_amt=100.0)
        _compute_line_totals(item, "Exclude", has_footer_disc=True)
        assert item["lineSubTotal"] == pytest.approx(90.0, abs=0.01)
        assert item["taxAmt"] == pytest.approx(6.30, abs=0.01)
        assert item["lineTotal"] == pytest.approx(96.30, abs=0.01)

    # ── Include tax ──

    def test_B2_10_include_tax_subtraction(self):
        # lineAmt=107 tax-included @ 7% → sub=100, tax=7, total=107
        item = self._item(qty=1, unit_price=107.0, tax_pct=7.0, line_amt=107.0)
        _compute_line_totals(item, "Include", has_footer_disc=False)
        assert item["lineSubTotal"] == pytest.approx(100.0, abs=0.01)
        assert item["taxAmt"] == pytest.approx(7.0, abs=0.01)
        assert item["lineTotal"] == pytest.approx(107.0, abs=0.01)

    def test_taxType_written_to_item(self):
        item = self._item()
        _compute_line_totals(item, "Exclude")
        assert item["taxType"] == "Exclude"

    def test_discount_pct_computed_when_missing(self):
        item = self._item(qty=1, unit_price=100.0, disc=20.0, disc_pct=0.0)
        _compute_line_totals(item, "Exclude")
        assert item["discountPct"] == pytest.approx(20.0, abs=0.01)


# ── B2: _build_deposit_row ────────────────────────────────────────────────────


class TestBuildDepositRow:
    def _items_with_totals(self, sub=100.0, total=107.0, tax_pct=7.0):
        return [{"lineSubTotal": sub, "lineTotal": total, "taxPct": tax_pct, "taxAmt": total - sub}]

    def test_B2_11_deposit_pct_creates_negative_row(self):
        items = self._items_with_totals(sub=100.0, total=107.0)
        row = _build_deposit_row(items, deposit_pct=50, deposit_label="", tax_type="Exclude")
        assert row is not None
        assert row["lineSubTotal"] < 0
        assert row["lineTotal"] < 0

    def test_B2_12_zero_deposit_returns_none(self):
        items = self._items_with_totals()
        assert (
            _build_deposit_row(items, deposit_pct=0, deposit_label="", tax_type="Exclude") is None
        )

    def test_hundred_percent_deposit_returns_none(self):
        items = self._items_with_totals()
        assert (
            _build_deposit_row(items, deposit_pct=100, deposit_label="", tax_type="Exclude") is None
        )

    def test_deposit_label_used_in_description(self):
        items = self._items_with_totals()
        row = _build_deposit_row(
            items, deposit_pct=30, deposit_label="มัดจำงวดแรก", tax_type="Exclude"
        )
        assert row["description"] == "มัดจำงวดแรก"

    def test_default_label_when_empty(self):
        items = self._items_with_totals()
        row = _build_deposit_row(items, deposit_pct=50, deposit_label="", tax_type="Exclude")
        assert "50%" in row["description"]

    def test_deposit_row_category_is_money_deposit(self):
        items = self._items_with_totals()
        row = _build_deposit_row(items, deposit_pct=30, deposit_label="", tax_type="Exclude")
        assert row["category"] == "เงินมัดจำ"


# ── B2: postprocess() top-level ───────────────────────────────────────────────


class TestPostprocess:
    def _raw(self, **kwargs):
        base = {
            "vendorName": "Test Co",
            "vendorTaxId": "1234567890123",
            "vendorBranch": "HQ",
            "documentName": "Invoice",
            "documentDate": "2024-01-15",
            "documentNumber": "INV-001",
            "items": [],
            "docSubTotal": 0,
            "docDiscount": 0,
            "docTaxAmount": 0,
            "docGrandTotal": 0,
            "depositPct": 0,
            "depositLabel": "",
        }
        base.update(kwargs)
        return base

    def test_empty_input_returns_valid_structure(self):
        result = postprocess({})
        assert "vendorName" in result
        assert "items" in result
        assert "grandTotal" in result

    def test_none_input_does_not_crash(self):
        result = postprocess(None)
        assert result["items"] == []

    def test_vendor_fields_passed_through(self):
        raw = self._raw(vendorName="ACME", vendorTaxId="000111222333444")
        result = postprocess(raw)
        assert result["vendorName"] == "ACME"
        assert result["vendorTaxId"] == "000111222333444"

    def test_tax_type_in_result(self):
        raw = self._raw(
            items=[{"qty": 1, "unitPrice": 100.0, "discountAmt": 0, "taxPct": 7}],
            docGrandTotal=107.0,
        )
        result = postprocess(raw)
        assert result["taxType"] in ("Include", "Exclude")

    def test_B2_13_penny_rounding_absorbed_in_last_item(self):
        # Construct a case where float rounding causes 0.01 diff
        raw = self._raw(
            items=[{"qty": 3, "unitPrice": 33.33, "discountAmt": 0, "taxPct": 7}],
            docGrandTotal=107.0,
        )
        result = postprocess(raw)
        # After reconciliation, sum of lineTotal should == docGrandTotal
        computed = round(sum(i["lineTotal"] for i in result["items"]), 2)
        assert abs(computed - result["grandTotal"]) <= 0.02

    def test_grand_total_snapped_to_doc_value_within_tolerance(self):
        # doc_grand=107.0, computed might be 107.01 due to rounding
        raw = self._raw(
            items=[{"qty": 1, "unitPrice": 100.0, "discountAmt": 0, "taxPct": 7}],
            docGrandTotal=107.0,
        )
        result = postprocess(raw)
        assert result["grandTotal"] == 107.0

    def test_deposit_row_appended_to_items(self):
        raw = self._raw(
            items=[{"qty": 1, "unitPrice": 200.0, "discountAmt": 0, "taxPct": 7}],
            depositPct=50,
            docGrandTotal=107.0,
        )
        result = postprocess(raw)
        # Last item should be deposit row
        assert result["items"][-1]["category"] == "เงินมัดจำ"
        assert len(result["items"]) == 2  # 1 original + 1 deposit

    def test_no_deposit_when_deposit_pct_zero(self):
        raw = self._raw(
            items=[{"qty": 1, "unitPrice": 100.0, "discountAmt": 0, "taxPct": 7}],
            depositPct=0,
        )
        result = postprocess(raw)
        assert all(i.get("category") != "เงินมัดจำ" for i in result["items"])

    def test_footer_discount_distributed_before_tax(self):
        # doc_disc=20 across 2 items of equal value → each gets 10
        raw = self._raw(
            items=[
                {"qty": 1, "unitPrice": 100.0, "discountAmt": 0, "taxPct": 7},
                {"qty": 1, "unitPrice": 100.0, "discountAmt": 0, "taxPct": 7},
            ],
            docDiscount=20.0,
            docGrandTotal=192.60,
        )
        result = postprocess(raw)
        assert result["totalDiscount"] == pytest.approx(20.0, abs=0.01)
