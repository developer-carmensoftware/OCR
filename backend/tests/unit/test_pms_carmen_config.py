"""Decision-log #43, #51, #54 — deriving Carmen's PMS posting config (services/pms/carmen_config.py).

`INTERFACES` is what dev Carmen's `interfaceThirdParties` answered on 2026-11-03. `PREVIEW`
is the shape of Carmen's engine previewing a real Comanche day (2026-11-10): a DataTable named
`Mapping`, one row per line of the day. Nothing here computes a side or a total: those are
Carmen's engine's.
"""

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


def preview(columns: list[str], rows: list[dict]) -> dict:
    """Carmen's preview answer: a .NET DataTable, as `interfacePreviewPostGL` sends it."""
    return {
        "TableName": "Mapping",
        "Columns": [{"ColumnName": c, "DataType": "System.String"} for c in columns],
        "Rows": rows,
    }


# A Comanche day as the engine keys it: its first row mapped, the others not (null account).
PREVIEW = preview(
    TABLE_COLUMNS,
    [
        {
            "Code": "100",
            "Description": "Room Charge",
            "DeptCode": "103",
            "AccCode": "4010001",
            "AccDesc": "Room Revenue",
        },
        {"Code": "100", "Description": "Room Charge - VAT", "DeptCode": None, "AccCode": None},
        {"Code": "900", "Description": "Cash - Advance Payment", "DeptCode": None, "AccCode": None},
        {"Code": "Guest Ledger", "Description": "Guest Ledger", "DeptCode": None, "AccCode": None},
    ],
)
ROWS = cfg.preview_rows(PREVIEW, COLUMNS) or []


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


def test_the_days_rows_are_the_engines_preview_in_its_order():
    assert [r["values"] for r in ROWS] == [
        {"Code": "100", "Description": "Room Charge"},
        {"Code": "100", "Description": "Room Charge - VAT"},
        {"Code": "900", "Description": "Cash - Advance Payment"},
        {"Code": "Guest Ledger", "Description": "Guest Ledger"},
    ]
    assert ROWS[1]["key"] == cfg.key_id(["100", "Room Charge - VAT"])
    assert cfg.label(ROWS[1]["key"]) == "100 · Room Charge - VAT"
    # No amount: the preview carries none, and the sides are the engine's.
    assert set(ROWS[0]) == {"key", "values"}


def test_a_blank_or_null_key_value_reads_as_blank_on_both_sides():
    """HotelTime's `Department` and Cloudbeds' `Channel` come back blank or null (dev, 2026-11-10).

    Either reads `""`, as `table_of` reads Carmen's table, so a key the engine previews is
    the same key the table maps.
    """
    ht = preview(
        ["HT_Code", "HT_Description", "Department", "DeptCode", "AccCode", "AccDesc"],
        [
            {"HT_Code": "1115001", "HT_Description": "100 - ABF Revenue", "Department": ""},
            {"HT_Code": None, "HT_Description": "Rounding", "Department": None},
        ],
    )
    columns = ["HT_Code", "HT_Description", "Department"]
    rows = cfg.preview_rows(ht, columns) or []
    assert [r["values"] for r in rows] == [
        {"HT_Code": "1115001", "HT_Description": "100 - ABF Revenue", "Department": ""},
        {"HT_Code": "", "HT_Description": "Rounding", "Department": ""},
    ]
    table = [
        {
            "HT_Code": "1115001",
            "HT_Description": "100 - ABF Revenue",
            "Department": None,
            "DeptCode": "201",
            "AccCode": "4110001",
        }
    ]
    assert cfg.new_keys(rows, cfg.table_of(table, columns)) == [rows[1]["key"]]


def test_a_key_the_pms_wrote_twice_is_two_rows_and_one_new_key():
    twice = preview(TABLE_COLUMNS, [PREVIEW["Rows"][1], PREVIEW["Rows"][1]])
    rows = cfg.preview_rows(twice, COLUMNS) or []
    assert len(rows) == 2
    assert cfg.new_keys(rows, {}) == [cfg.key_id(["100", "Room Charge - VAT"])]


@pytest.mark.parametrize(
    "answer",
    [
        {"Code": -400, "UserMessage": "No Data Found on 08/11/2026 to 08/11/2026 "},
        {"Rows": "not a list"},
        None,
        "not json",
    ],
)
def test_an_answer_that_is_not_the_previews_table_has_no_rows(answer):
    assert cfg.preview_rows(answer, COLUMNS) is None


def test_a_preview_with_no_lines_has_no_rows_to_review():
    assert cfg.preview_rows(preview(TABLE_COLUMNS, []), COLUMNS) == []


def test_carmens_rows_with_no_account_are_the_keys_it_waits_for():
    current = [
        {"Code": "100", "Description": "Room Charge", "DeptCode": "103", "AccCode": "4010001"},
        {"Code": "729", "Description": "Rebate", "DeptCode": None, "AccCode": None},
        {"Code": "729", "Description": "Rebate", "DeptCode": "", "AccCode": ""},  # once
    ]
    assert cfg.blank_keys(current, COLUMNS) == [
        {"key": cfg.key_id(["729", "Rebate"]), "values": {"Code": "729", "Description": "Rebate"}}
    ]


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
    table = cfg.table_of(TABLE, COLUMNS)
    new = cfg.new_keys(ROWS, table)
    # "Cash" is mapped, "Cash - Advance Payment" is not: the description is part of the key.
    assert [cfg.label(k) for k in new] == [
        "100 · Room Charge - VAT",
        "900 · Cash - Advance Payment",
        "Guest Ledger · Guest Ledger",
    ]
    assert cfg.short_labels(new) == ["100", "900", "Guest Ledger"]


def test_the_previews_unmapped_rows_are_the_new_keys():
    """Its null accounts and our table read agree: checked on five dev days (2026-11-10)."""
    unmapped = [
        cfg.key_id([str(r.get(c) or "") for c in COLUMNS])
        for r in PREVIEW["Rows"]
        if not r.get("AccCode")
    ]
    table = [r for r in PREVIEW["Rows"] if r.get("AccCode")]
    assert cfg.new_keys(ROWS, cfg.table_of(table, COLUMNS)) == unmapped


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


def test_every_pms_posting_revenue_to_gl_is_listed_whatever_its_from():
    """Decision-log #55: our sweep opens a day for every PMS a BU posts REVENUE to GL with,
    however the day reaches Carmen. A hook only brings a day sooner."""
    listed = [
        *INTERFACES,  # Comanche: CarmenApi, a hooked PMS
        {**INTERFACES[0], "InterfaceName": "HotelTime", "From": "PartnerApi"},
        {**INTERFACES[0], "InterfaceName": "GuestLine", "From": "partnerapi"},
        {**INTERFACES[0], "InterfaceName": "Fidelio", "From": None},  # the user imports a file
        {**INTERFACES[0], "InterfaceName": "Opera", "From": "PartnerApi", "DocType": "STATISTIC"},
        {**INTERFACES[0], "InterfaceName": "Vento", "From": "PartnerApi", "PostToModule": "AR"},
        {**INTERFACES[0], "InterfaceName": "Pos", "InterfaceType": "POS"},
        "not a row",
    ]
    assert cfg.revenue_interfaces(listed) == {
        "comanche": "Comanche",
        "hoteltime": "HotelTime",
        "guestline": "GuestLine",
        "fidelio": "Fidelio",
    }
    assert cfg.revenue_interfaces(INTERFACES) == {"comanche": "Comanche"}
    assert cfg.revenue_interfaces([]) == {}
