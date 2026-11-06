"""Decision-log #43, #51 — deriving Carmen's PMS posting config (services/pms/carmen_config.py).

`INTERFACES` is what dev Carmen's `interfaceThirdParties` answered on 2026-11-03, and `DAY`
the shape of a real Comanche Data Bank day. Nothing here computes a side or a total: those
are Carmen's engine's.
"""

import json

import pytest

from app.services.pms import carmen_config as cfg

INTERFACES = [
    {
        "InterfaceType": "PMS",
        "InterfaceName": "Comanche",
        "PostToModule": "GL",
        "DocType": "REVENUE",
        "PostType": "Json",
        "From": "CarmenApi",
    },
    {
        "InterfaceType": "PMS",
        "InterfaceName": "Comanche",
        "PostToModule": "GL",
        "DocType": "STATISTIC",
        "PostType": "Json",
        "From": "CarmenApi",
    },
    {
        "InterfaceType": "PMS",
        "InterfaceName": "CarmenAI",
        "PostToModule": "AR",
        "DocType": "AR",
        "PostType": "Json",
        "From": None,
    },
]
# The columns of Carmen's mapping table, as its DataTable names them.
TABLE_COLUMNS = ["Code", "Description", "DeptCode", "AccCode", "AccDesc"]
COLUMNS = ["Code", "Description"]

DAY = {
    "Information": {"DocDate": "2025-10-20T00:00:00.000Z"},
    "Transaction": [
        {
            "Code": "100",
            "Description": "Room Charge",
            "TransactionType": "Revenue",
            "Amount": "149674.74",
        },
        {
            "Code": "100",
            "Description": "Room Charge - VAT",
            "TransactionType": "Revenue",
            "Amount": "11525.06",
        },
        {
            "Code": "900",
            "Description": "Cash - Advance Payment",
            "TransactionType": "Payment",
            "Amount": "-4150.00",
        },
        {
            "Code": "Guest Ledger",
            "Description": "Guest Ledger",
            "TransactionType": "Ledger",
            "Amount": "101452.80",
        },
    ],
    "Statistic": [{"Description": "TOTAL ROOM AVAILABLE", "Value": "162.00"}],
}


def test_the_hooks_interface_posting_revenue_to_gl_is_found():
    section = cfg.find_section(INTERFACES, "pms", "comanche")
    assert section == cfg.Section(
        setting_code="Comanche.PMS", interface="Comanche", post_type="REVENUE", file_type="Json"
    )


@pytest.mark.parametrize(
    "interfaces",
    [
        [],
        [i for i in INTERFACES if i["DocType"] != "REVENUE"],
        [{**INTERFACES[0], "PostToModule": "AR"}],
        [{**INTERFACES[0], "InterfaceName": "Opera"}],
        [{**INTERFACES[0], "InterfaceType": "POS"}],
        ["not a row"],
    ],
)
def test_no_section_without_that_interfaces_revenue_to_gl(interfaces):
    assert cfg.find_section(interfaces, "PMS", "Comanche") is None


def test_the_key_is_the_mapping_tables_columns_less_the_account():
    assert cfg.key_columns(TABLE_COLUMNS) == COLUMNS
    assert cfg.key_columns(["DeptCode", "AccCode", "AccDesc"]) == []


def test_the_rows_are_the_list_answering_the_most_key_columns():
    assert cfg.rows_key(DAY, COLUMNS) == "Transaction"
    assert cfg.rows_key(json.dumps(DAY), COLUMNS) == "Transaction"
    # `Statistic` answers Description too; the REVENUE rows are the list carrying Amount.
    assert cfg.rows_key(DAY, ["Description"]) == "Transaction"
    # A column no field answers is blank; the list still fits on the others.
    assert cfg.rows_key(DAY, ["Code", "Account"]) == "Transaction"
    assert cfg.rows_key(DAY, ["Account"]) is None  # nothing answers: no list
    assert cfg.rows_key({"Transaction": []}, COLUMNS) is None
    assert cfg.rows_key("not json", COLUMNS) is None
    assert cfg.rows_key(DAY, []) is None


def test_a_list_named_after_another_section_is_not_revenues():
    assert cfg.rows_key(DAY, ["Description"], frozenset({"statistic"})) == "Transaction"
    stats_only = {"Statistic": DAY["Statistic"]}
    assert cfg.rows_key(stats_only, ["Description"]) == "Statistic"
    assert cfg.rows_key(stats_only, ["Description"], frozenset({"statistic"})) is None


def test_two_lists_alike_even_on_amount_are_not_guessed_between():
    twins = {"Revenue": DAY["Transaction"], "Transaction": DAY["Transaction"]}
    assert cfg.rows_key(twins, COLUMNS) is None


def test_a_key_column_reads_its_own_field_else_the_name_without_its_prefix():
    assert cfg.field_for("Code", ["code", "Description"]) == "code"  # any case
    assert cfg.field_for("HT_Code", ["Code", "Description"]) == "Code"
    assert cfg.field_for("HT_Description", ["Code", "Description"]) == "Description"
    assert cfg.field_for("Department", ["Code", "Description"]) is None
    assert cfg.field_for("Channel", ["Code"]) is None


# HotelTime's day (dev Data Bank 171): rows in `Revenue`, keyed `HT_Code` / `HT_Description`
# from `Code` / `Description`, and `Department`, which no field answers, blank. Some rows
# have no `Code` at all. Carmen's engine wrote exactly these keys on its -500 (2026-11-06).
HT_COLUMNS = ["HT_Code", "HT_Description", "Department"]
HT_DAY = {
    "Information": {"HotelCode": "HT"},
    "Revenue": [
        {
            "Code": "4100001",
            "Description": "001 - Room Charge (Auto)",
            "AccountNature": "C",
            "SegmentName": "Room",
            "Amount": 42748.69,
        },
        {"Description": "Rounding", "AccountNature": "C", "SegmentName": "", "Amount": 0.01},
    ],
    "Statistic": [{"Description": "Rooms Occupied", "Value": 52}],
}


def test_hoteltime_keys_its_prefixed_columns_from_the_days_bare_fields():
    assert cfg.rows_key(HT_DAY, HT_COLUMNS, frozenset({"statistic"})) == "Revenue"
    rows = cfg.rows_of(HT_DAY, "Revenue", HT_COLUMNS)
    assert [r["values"] for r in rows] == [
        {"HT_Code": "4100001", "HT_Description": "001 - Room Charge (Auto)", "Department": ""},
        {"HT_Code": "", "HT_Description": "Rounding", "Department": ""},
    ]
    assert rows[0]["amount"] == "42748.69"
    assert cfg.label(rows[1]["key"]) == "Rounding"


# Cloudbeds' day (dev Data Bank 184): `Transaction` and `Statistic` both carry its key fields,
# and its table keys a `Channel` no list carries (Carmen added it on its first -500).
CB_COLUMNS = ["Description", "MarketSegmentDesc", "Channel"]
CB_DAY = {
    "Information": {},
    "Transaction": [
        {
            "Code": "RM",
            "Description": "Room Revenue",
            "MarketSegmentDesc": "OTA",
            "TransactionType": "credit",
            "Amount": 3500,
        },
        {
            "Code": "CL",
            "Description": "cityledger",
            "MarketSegmentDesc": "",
            "TransactionType": "debit",
            "Amount": -3500,
        },
    ],
    "Statistic": [
        {"Code": "RO", "Description": "Rooms Occupied", "MarketSegmentDesc": "OTA", "Value": 12}
    ],
}


def test_cloudbeds_reads_its_transaction_not_its_statistic():
    assert cfg.rows_key(CB_DAY, CB_COLUMNS, frozenset({"statistic"})) == "Transaction"
    assert cfg.rows_key(CB_DAY, CB_COLUMNS) == "Transaction"  # Amount decides, even unskipped
    rows = cfg.rows_of(CB_DAY, "Transaction", CB_COLUMNS)
    assert rows[1]["values"] == {
        "Description": "cityledger",
        "MarketSegmentDesc": "",
        "Channel": "",
    }


def test_the_interfaces_other_sections_are_its_other_doc_types():
    assert cfg.other_doc_types(INTERFACES, "pms", "comanche") == frozenset({"statistic"})
    assert cfg.other_doc_types(INTERFACES, "PMS", "Opera") == frozenset()


def test_carmens_rows_with_no_account_are_the_keys_it_waits_for():
    current = [
        {"Code": "100", "Description": "Room Charge", "DeptCode": "103", "AccCode": "4010001"},
        {"Code": "729", "Description": "Rebate", "DeptCode": None, "AccCode": None},
        {"Code": "729", "Description": "Rebate", "DeptCode": "", "AccCode": ""},  # once
    ]
    assert cfg.blank_keys(current, COLUMNS) == [
        {"key": cfg.key_id(["729", "Rebate"]), "values": {"Code": "729", "Description": "Rebate"}}
    ]


def test_every_row_is_its_own_key_tax_rows_included():
    rows = cfg.rows_of(DAY, "Transaction", COLUMNS)
    assert [r["values"] for r in rows][:2] == [
        {"Code": "100", "Description": "Room Charge"},
        {"Code": "100", "Description": "Room Charge - VAT"},
    ]
    assert rows[2]["amount"] == "-4150.00"
    assert len({r["key"] for r in rows}) == 4
    assert cfg.label(rows[1]["key"]) == "100 · Room Charge - VAT"
    # The same rows as a JSON string, the way the Data Bank sometimes returns FileData.
    assert cfg.rows_of(json.dumps(DAY), "Transaction", COLUMNS) == rows


TABLE = [
    {
        "Code": "100",
        "Description": "Room Charge",
        "DeptCode": "103",
        "AccCode": "4010001",
        "AccDesc": "Room Revenue",
    },
    {
        "Code": "900",
        "Description": "Cash",
        "DeptCode": "GEN",
        "AccCode": "1010001",
        "AccDesc": "CASH ON HAND",
    },
    {
        "Code": "Guest Ledger",
        "Description": "Guest Ledger",
        "DeptCode": "GEN",
        "AccCode": "",
        "AccDesc": "",
    },
]


def test_new_keys_are_the_rows_carmens_table_has_no_account_for():
    rows = cfg.rows_of(DAY, "Transaction", COLUMNS)
    table = cfg.table_of(TABLE, COLUMNS)
    new = cfg.new_keys(rows, table)
    # "Cash" is mapped, "Cash - Advance Payment" is not: the description is part of the key.
    assert [cfg.label(k) for k in new] == [
        "100 · Room Charge - VAT",
        "900 · Cash - Advance Payment",
        "Guest Ledger · Guest Ledger",
    ]
    assert cfg.short_labels(new) == ["100", "900", "Guest Ledger"]


def test_the_table_to_put_is_every_row_read_plus_the_picks():
    picks = {
        cfg.key_id(["Guest Ledger", "Guest Ledger"]): {"dept": "GEN", "acc": "1021001"},
        cfg.key_id(["100", "Room Charge - VAT"]): {"dept": "GEN", "acc": "2012003"},
    }
    out = cfg.merged_rows(TABLE, picks, COLUMNS)
    assert out == [
        {"Code": "100", "Description": "Room Charge", "DeptCode": "103", "AccCode": "4010001"},
        {"Code": "900", "Description": "Cash", "DeptCode": "GEN", "AccCode": "1010001"},
        {
            "Code": "Guest Ledger",
            "Description": "Guest Ledger",
            "DeptCode": "GEN",
            "AccCode": "1021001",
        },
        {
            "Code": "100",
            "Description": "Room Charge - VAT",
            "DeptCode": "GEN",
            "AccCode": "2012003",
        },
    ]


def test_the_newest_readable_data_bank_row_wins():
    old = {"Id": 1, "LastModified": "2024-09-05T23:00:00", "FileData": DAY}
    new = {"Id": 2, "LastModified": "2024-09-06T01:00:00", "FileData": json.dumps(DAY)}
    junk = {"Id": 3, "LastModified": "2024-09-07T00:00:00", "FileData": "not json"}
    assert cfg.newest_day([old, new, junk], COLUMNS) == (new, "Transaction")
    assert cfg.newest_day([junk], COLUMNS) is None


def test_the_pmss_carmen_fetches_itself_are_its_partner_interfaces():
    """`From: PartnerApi` means no hook comes: our sweep opens those days (decision-log #52)."""
    listed = [
        *INTERFACES,
        {**INTERFACES[0], "InterfaceName": "HotelTime", "From": "PartnerApi"},
        {**INTERFACES[0], "InterfaceName": "GuestLine", "From": "partnerapi"},
        {**INTERFACES[0], "InterfaceName": "Opera", "From": "PartnerApi", "DocType": "STATISTIC"},
        {**INTERFACES[0], "InterfaceName": "Vento", "From": "PartnerApi", "PostToModule": "AR"},
        "not a row",
    ]
    assert cfg.partner_interfaces(listed) == {"hoteltime": "HotelTime", "guestline": "GuestLine"}
    assert cfg.partner_interfaces(INTERFACES) == {}
