"""Decision-log #43 — reading Carmen's PMS posting config (services/pms/carmen_config.py).

The INI below is the part of Carmen's real Comanche.PMS Revenue config that finding a day's
mapping keys depends on (dev, 2026-10-14), comments and the repeated key included. Nothing
here computes a side or a total: those are Carmen's engine's.
"""

import base64
import json

import pytest

from app.services.pms import carmen_config as cfg

COMANCHE_INI = """[System]
; Type of Journal Voucher
JvType=IC
Source=CMRV
HasHeader=false
; JsonKeys ไหน
JsonKeys=Transaction
FileType=json
JsonType=jsonobject
UseAccountMap=true
UseDimensionValue=false
UseAccountMap=true
Mapping_MapCode=[Code:Code][Description:Description]

[DrCr]
; Use -, + if value is Signed Numbers
DrValue=-
CrValue=+
JsonKeyName=Amount

[Amount]
Dec=2
Div=1
JsonKeyName=Amount
"""

# Custom's template: a fixed-column text file, keyed by column positions.
CUSTOM_INI = """[System]
JvType=IC
Source=MD
HasHeader=false
Mapping_MapCode=[2:TA][5:Descr]
[DrCr]
Pos=4
DrValue=+
CrValue=-
"""


def _b64(text: str) -> str:
    return base64.b64encode(text.encode("utf-8")).decode()


def _setting(
    code="Comanche.PMS", name="Comanche", active=True, revenue_active=True, ini=COMANCHE_INI
):
    return {
        "Code": code,
        "InterfaceType": "PMS",
        "InterfaceName": name,
        "IsActive": active,
        "Configuration": {
            "Revenue": {
                "Active": revenue_active,
                "PostType": "Summary",
                "DeptCode": "GEN",
                "AccCode": "1021001",
                "AccDesc": "A/R - Guest Ledger",
                "ConfigBase64": _b64(ini),
            },
            "Statistic": {
                "Active": True,
                "DeptCode": "GEN",
                "AccCode": "9999999",
                "ConfigBase64": _b64("[System]"),
            },
        },
    }


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


def test_ini_keeps_sections_drops_comments_and_takes_the_last_repeat():
    ini = cfg.parse_ini(COMANCHE_INI)
    assert ini["System"]["JsonKeys"] == "Transaction"
    assert ini["System"]["UseAccountMap"] == "true"
    assert ini["DrCr"] == {"DrValue": "-", "CrValue": "+", "JsonKeyName": "Amount"}
    assert not any(k.startswith(";") for s in ini.values() for k in s)


def test_the_active_revenue_section_of_the_hooks_interface_is_found():
    settings = [
        {"Code": "Blueledgers.Inventory", "InterfaceType": "Inventory", "IsActive": True},
        _setting(code="old.PMS", name="Comanche", active=False),
        _setting(),
    ]
    section = cfg.find_section(settings, "comanche")
    assert section.setting_code == "Comanche.PMS"
    assert (section.post_type, section.counter_dept, section.counter_acc) == (
        "REVENUE",
        "GEN",
        "1021001",
    )
    assert section.config["System"]["Mapping_MapCode"] == "[Code:Code][Description:Description]"


@pytest.mark.parametrize(
    "settings",
    [[], [_setting(name="Opera")], [_setting(active=False)], [_setting(revenue_active=False)]],
)
def test_no_section_without_an_active_setting_and_revenue_section(settings):
    assert cfg.find_section(settings, "Comanche") is None


def test_comanche_spec_reads_the_layout_and_the_mapping_key():
    spec = cfg.spec_of(cfg.parse_ini(COMANCHE_INI))
    assert spec.json_keys == "Transaction"
    assert spec.pairs == (("Code", "Code"), ("Description", "Description"))
    assert spec.columns == ["Code", "Description"]
    assert (spec.amount_field, spec.use_mapping) == ("Amount", True)


def test_a_file_layout_other_than_a_json_object_is_refused_not_guessed():
    with pytest.raises(cfg.UnsupportedFormat):
        cfg.spec_of(cfg.parse_ini(CUSTOM_INI))


def test_every_row_is_its_own_key_tax_rows_included():
    spec = cfg.spec_of(cfg.parse_ini(COMANCHE_INI))
    rows = cfg.rows_of(DAY, spec)
    assert [r["values"] for r in rows][:2] == [
        {"Code": "100", "Description": "Room Charge"},
        {"Code": "100", "Description": "Room Charge - VAT"},
    ]
    assert rows[2]["amount"] == "-4150.00"
    assert len({r["key"] for r in rows}) == 4
    assert cfg.label(rows[1]["key"]) == "100 · Room Charge - VAT"
    # The same rows as a JSON string, the way the Data Bank sometimes returns FileData.
    assert cfg.rows_of(json.dumps(DAY), spec) == rows


def test_rows_the_setting_does_not_describe_are_unreadable():
    spec = cfg.spec_of(cfg.parse_ini(COMANCHE_INI))
    with pytest.raises(cfg.UnreadableDay):
        cfg.rows_of({"Statistic": []}, spec)


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
    spec = cfg.spec_of(cfg.parse_ini(COMANCHE_INI))
    rows = cfg.rows_of(DAY, spec)
    table = cfg.table_of(TABLE, spec.columns)
    new = cfg.new_keys(rows, table)
    # "Cash" is mapped, "Cash - Advance Payment" is not: the description is part of the key.
    assert [cfg.label(k) for k in new] == [
        "100 · Room Charge - VAT",
        "900 · Cash - Advance Payment",
        "Guest Ledger · Guest Ledger",
    ]
    assert cfg.short_labels(new) == ["100", "900", "Guest Ledger"]
    assert cfg.new_keys(rows, table, spec_uses_mapping=False) == []


def test_the_table_to_put_is_every_row_read_plus_the_picks():
    columns = ["Code", "Description"]
    picks = {
        cfg.key_id(["Guest Ledger", "Guest Ledger"]): {"dept": "GEN", "acc": "1021001"},
        cfg.key_id(["100", "Room Charge - VAT"]): {"dept": "GEN", "acc": "2012003"},
    }
    out = cfg.merged_rows(TABLE, picks, columns)
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
    assert cfg.newest_day([old, new, junk], "Transaction")["Id"] == 2
    assert cfg.newest_day([junk], "Transaction") is None
