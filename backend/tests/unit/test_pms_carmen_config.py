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


def test_the_rows_are_the_one_list_carrying_every_key_column():
    assert cfg.rows_key(DAY, COLUMNS) == "Transaction"
    assert cfg.rows_key(json.dumps(DAY), COLUMNS) == "Transaction"
    # `Statistic` carries a Description but no Code: not a candidate.
    assert cfg.rows_key(DAY, ["Description"]) is None  # both fit: ambiguous, not a guess
    assert cfg.rows_key(DAY, ["Code", "Account"]) is None  # none fits
    assert cfg.rows_key({"Transaction": []}, COLUMNS) is None
    assert cfg.rows_key("not json", COLUMNS) is None
    assert cfg.rows_key(DAY, []) is None


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
