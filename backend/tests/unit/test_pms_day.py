"""CA-119 — the arithmetic of one PMS day (services/pms/day.py).

A small synthetic day with every shape a real Comanche day has: a revenue code's net,
service and VAT rows, a rebate (negative revenue), a payment, and the guest ledger. It
balances: 1,127 of revenue = 500 paid + 627 left on guests' folios.
"""

from decimal import Decimal

import pytest

from app.services.pms import day

FILE_DATA = {
    "Transaction": [
        {
            "TransactionType": "Revenue",
            "Code": "100",
            "Description": "Room Charge",
            "Amount": "1000.00",
        },
        {
            "TransactionType": "Revenue",
            "Code": "100",
            "Description": "Room Charge - SERVICE",
            "Amount": "100.00",
        },
        {
            "TransactionType": "Revenue",
            "Code": "100",
            "Description": "Room Charge - VAT",
            "Amount": "77.00",
        },
        {
            "TransactionType": "Revenue",
            "Code": "729",
            "Description": "Rebate - Misc. (VAT)",
            "Amount": "-50.00",
        },
        {"TransactionType": "Payment", "Code": "900", "Description": "Cash", "Amount": "-500.00"},
        {
            "TransactionType": "Guest Ledger",
            "Code": "Guest Ledger",
            "Description": "Guest Ledger",
            "Amount": "627.00",
        },
    ],
    "Statistic": [{"Occupancy": "81"}],
}
RULES = {
    "Revenue|100": {"dept": "101", "acc": "4010001"},
    "VAT|*": {"dept": "GEN", "acc": "2012002"},
    "SVC|*": {"dept": "GEN", "acc": "2013002"},
    "Revenue|729": {"dept": "304", "acc": "4240011"},
    "Payment|900": {"dept": "101", "acc": "1010001"},
    "Ledger|Guest Ledger": {"dept": "101", "acc": "1021001"},
}


@pytest.fixture
def rows():
    return day.rows_of(FILE_DATA)


def test_rows_keep_only_what_processing_reads(rows):
    assert len(rows) == 6
    assert rows[0] == {"type": "Revenue", "code": "100", "desc": "Room Charge", "amount": "1000.00"}


def test_a_non_number_amount_is_an_unreadable_day():
    with pytest.raises(day.UnreadableDay):
        day.rows_of({"Transaction": [{"TransactionType": "Revenue", "Code": "1", "Amount": "n/a"}]})
    with pytest.raises(day.UnreadableDay):
        day.rows_of("not an object")


def test_keys_follow_the_code_and_the_two_rules(rows):
    assert day.keys(rows) == [
        "Revenue|100",
        "SVC|*",
        "VAT|*",
        "Revenue|729",
        "Payment|900",
        "Ledger|Guest Ledger",
    ]
    # A ledger keys on its Code whatever TransactionType early data gave it.
    assert day.key_of({"type": "Ledger", "code": "Deposit Ledger", "desc": "x", "amount": "1"}) == (
        "Ledger|Deposit Ledger"
    )


def test_code_label_is_what_a_reviewer_calls_the_key():
    assert day.code_label("Revenue|103") == "103"
    assert day.code_label("Ledger|Guest Ledger") == "Guest Ledger"
    assert day.code_label("VAT|*") == "- VAT"


def test_terms_and_balance(rows):
    assert day.terms(rows) == {
        "Revenue": Decimal("1127.00"),
        "Payment": Decimal("-500.00"),
        "Guest Ledger": Decimal("-627.00"),
    }
    assert day.off_by(rows) == 0
    rows[0]["amount"] = "1120.00"
    assert day.off_by(rows) == Decimal("120.00")


def test_jv_lines_debits_first_and_balanced(rows):
    lines = day.jv_lines(rows, RULES)
    assert [(line["acc"], line["amount"]) for line in lines] == [
        ("1010001", Decimal("-500.00")),
        ("1021001", Decimal("-627.00")),
        ("4240011", Decimal("-50.00")),
        ("2012002", Decimal("77.00")),
        ("2013002", Decimal("100.00")),
        ("4010001", Decimal("1000.00")),
    ]
    assert sum(line["amount"] for line in lines) == 0


def test_jv_lines_leave_out_an_unmapped_key(rows):
    partial = {k: v for k, v in RULES.items() if k != "Revenue|729"}
    assert "4240011" not in [line["acc"] for line in day.jv_lines(rows, partial)]


def test_flags(rows):
    assert day.flags(rows, RULES, {}) == []
    partial = {k: v for k, v in RULES.items() if k != "Revenue|729"}
    assert day.flags(rows, partial, {}) == ["mapping_missing"]
    guess = {"Revenue|729": {"dept": "304", "acc": "4240011", "confidence": "medium"}}
    assert day.flags(rows, partial, guess) == ["mapping_guessed"]
    # A pick with no department cannot post either.
    assert day.flags(rows, partial, {"Revenue|729": {"dept": None, "acc": "4240011"}}) == [
        "mapping_missing"
    ]
    rows[0]["amount"] = "1120.00"
    assert day.flags(rows, RULES, {}) == ["unbalanced"]
