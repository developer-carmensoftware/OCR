"""Unit tests for app/utils/pages.py — page selection parsing and per-page pricing."""

import pytest

from app.utils.pages import MAX_SELECTED_PAGES, billable_pages, parse_selected_pages


class TestParseSelectedPages:
    def test_none_and_empty_mean_no_selection(self):
        assert parse_selected_pages(None) is None
        assert parse_selected_pages("") is None
        assert parse_selected_pages("[]") is None

    def test_dedupes_and_preserves_order(self):
        assert parse_selected_pages("[2,0,2,1]") == [2, 0, 1]

    @pytest.mark.parametrize("raw", ["not json", '{"a":1}', "[1.5]", "[true]", '["0"]', "[-1]"])
    def test_malformed_raises(self, raw):
        with pytest.raises(ValueError):
            parse_selected_pages(raw)

    def test_over_cap_raises(self):
        raw = str(list(range(MAX_SELECTED_PAGES + 1)))
        with pytest.raises(ValueError):
            parse_selected_pages(raw)


class TestBillablePages:
    def test_non_pdf_is_one_page(self):
        assert billable_pages(None, None) == 1
        assert billable_pages(None, [0, 1, 2]) == 1

    def test_no_selection_charges_every_page(self):
        assert billable_pages(1, None) == 1
        assert billable_pages(3, None) == 3

    def test_no_selection_is_capped(self):
        assert billable_pages(12, None) == MAX_SELECTED_PAGES

    def test_selection_charges_the_selected_pages(self):
        assert billable_pages(10, [0, 2]) == 2

    def test_selection_ignores_out_of_range_pages(self):
        # Page 9 does not exist in a 3-page document — it is never sent, never charged.
        assert billable_pages(3, [0, 9]) == 1

    def test_all_pages_out_of_range_still_charges_one(self):
        # extract_ap_invoice_data() raises right after; the router refunds the same 1.
        assert billable_pages(3, [7, 8]) == 1

    def test_selection_is_capped(self):
        assert billable_pages(20, list(range(10))) == MAX_SELECTED_PAGES
