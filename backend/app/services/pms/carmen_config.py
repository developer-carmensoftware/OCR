"""What Carmen's PMS posting config says, as far as the menu token can read it (decision-log #43, #51).

Carmen's engine posts a Data Bank day by the BU's GL interface setting: an INI per PMS that
says where the rows are, which fields key the mapping table, how debit and credit are told
apart, and the counter account. The menu token cannot read that setting (`interfacePost/
Setting` has no `/api/interface` twin). It can read `interfaceThirdParties` — the BU's
interfaces and their sections — and the mapping table, and the rest is derived from those
two and from the day itself (decision-log #51):

- the setting's code is `{InterfaceName}.{InterfaceType}` (Carmen's own rule);
- the mapping key is the table's own columns, less the account they map to;
- the day's rows are the one list in `FileData` whose entries carry every key column.

A PMS whose Data Bank fields are not named like its mapping columns therefore matches no
list, and its days fail as unreadable rather than being keyed by a guess. Nothing about a
day's sides is decided here — Comanche signs `Amount`, other PMSs carry a D/C column — that
stays Carmen's engine's. Pure: no database, no HTTP.
"""

import json
from dataclasses import dataclass

# The one section posted (user decision 2026-10-14): a day is one JV.
POST_TYPE = "REVENUE"
# What a mapping row maps its key to; every other column of the table is part of the key.
_TARGET_COLUMNS = ("DeptCode", "AccCode", "AccDesc")
# ponytail: Comanche's amount field. Carmen's INI names it per PMS (`[Amount] JsonKeyName`);
# read it from there if Carmen ever exposes the setting. Only the AI and the reviewer see it.
AMOUNT_FIELD = "Amount"


@dataclass(frozen=True)
class Section:
    """The posting section of one interface: what the engine is asked to post with."""

    setting_code: str
    interface: str
    post_type: str
    file_type: str


def find_section(interfaces: list, interface_type: str, interface: str) -> Section | None:
    """The hook's interface posting REVENUE to GL, in Carmen's list of the BU's interfaces."""
    for i in interfaces:
        if not isinstance(i, dict):
            continue
        itype, name = str(i.get("InterfaceType") or ""), str(i.get("InterfaceName") or "")
        if (
            itype.casefold() == interface_type.casefold()
            and name.casefold() == interface.casefold()
            and str(i.get("PostToModule") or "").upper() == "GL"
            and str(i.get("DocType") or "").upper() == POST_TYPE
        ):
            return Section(
                setting_code=f"{name}.{itype}",
                interface=name,
                post_type=POST_TYPE,
                file_type=str(i.get("PostType") or ""),
            )
    return None


def partner_interfaces(interfaces: list) -> dict[str, str]:
    """The PMSs Carmen fetches from the third party itself (`From: PartnerApi`), posting
    REVENUE to GL: `{lower-cased name: name as Carmen writes it}`. No hook comes for them,
    so their days are opened by our sweep (decision-log #52)."""
    names: dict[str, str] = {}
    for i in interfaces:
        if not isinstance(i, dict):
            continue
        name = str(i.get("InterfaceName") or "")
        if (
            name
            and str(i.get("InterfaceType") or "").casefold() == "pms"
            and str(i.get("PostToModule") or "").upper() == "GL"
            and str(i.get("DocType") or "").upper() == POST_TYPE
            and str(i.get("From") or "").casefold() == "partnerapi"
        ):
            names[name.casefold()] = name
    return names


def key_columns(columns: list[str]) -> list[str]:
    """The mapping table's key columns: all of them but the account a key maps to."""
    return [c for c in columns if c not in _TARGET_COLUMNS]


def key_id(values: list[str]) -> str:
    """One mapping key as a string: the key columns' values, in order, as a JSON array."""
    return json.dumps([str(v) for v in values], ensure_ascii=False)


def label(key: str) -> str:
    """What a person calls a key: its values, joined (`100 · Room Charge - VAT`)."""
    return " · ".join(v for v in json.loads(key) if v)


def short_labels(keys: list[str]) -> list[str]:
    """The first key column's values, once each — what the queue row names (`103, 729`)."""
    return list(dict.fromkeys(json.loads(k)[0] for k in keys if json.loads(k)))


def _parsed(file_data) -> dict | None:
    if isinstance(file_data, str):
        try:
            file_data = json.loads(file_data)
        except ValueError:
            return None
    return file_data if isinstance(file_data, dict) else None


def rows_key(file_data, columns: list[str]) -> str | None:
    """The one list in `FileData` whose entries all carry every key column, or None.

    Comanche's `Transaction` qualifies and its `Statistic` (`Description`, `Value`) does not.
    Two lists that both qualify is a layout this cannot tell apart: None, not a guess.
    """
    data = _parsed(file_data)
    if data is None or not columns:
        return None
    fits = [
        name
        for name, items in data.items()
        if isinstance(items, list)
        and items
        and all(isinstance(i, dict) and all(c in i for c in columns) for i in items)
    ]
    return fits[0] if len(fits) == 1 else None


def newest_day(found: list[dict], columns: list[str]) -> tuple[dict, str] | None:
    """The Data Bank row to read and the list its rows are in: the newest row that has one.

    Carmen may hold more than one row for a day (a re-run night audit); `LastModified`
    names the current one.
    """
    days = [(r, k) for r in found if (k := rows_key(r.get("FileData"), columns))]
    return max(days, key=lambda d: str(d[0].get("LastModified") or ""), default=None)


def rows_of(file_data, json_keys: str, columns: list[str]) -> list[dict]:
    """The day's rows as Carmen keys them: `[{"key", "values", "amount"}]`, in file order.

    `file_data` is one `newest_day` vouched for. `amount` is as written, for the reviewer
    and the AI to read; nothing here adds, signs or balances it.
    """
    out = []
    for item in (_parsed(file_data) or {})[json_keys]:
        values = {c: "" if item.get(c) is None else str(item.get(c)) for c in columns}
        amount = item.get(AMOUNT_FIELD)
        out.append(
            {
                "key": key_id(list(values.values())),
                "values": values,
                "amount": "" if amount is None else str(amount),
            }
        )
    return out


def table_of(rows: list[dict], columns: list[str]) -> dict[str, dict]:
    """Carmen's mapping rows that carry an account, by key: `{key: {"dept", "acc", "name"}}`."""
    out = {}
    for r in rows:
        if r.get("AccCode"):
            out[key_id([str(r.get(c) or "") for c in columns])] = {
                "dept": str(r.get("DeptCode") or ""),
                "acc": str(r["AccCode"]),
                "name": str(r.get("AccDesc") or ""),
            }
    return out


def new_keys(rows: list[dict], table: dict[str, dict]) -> list[str]:
    """The day's keys Carmen's table has no account for, in first-seen order."""
    return [k for k in dict.fromkeys(r["key"] for r in rows) if k not in table]


def merged_rows(current: list[dict], picks: dict[str, dict], columns: list[str]) -> list[dict]:
    """The whole table to PUT: Carmen's rows as just read, each pick filled in or added.

    The PUT replaces the table, so every row read must go back — a partial list would
    delete the BU's other mappings.
    """
    out, seen = [], set()
    for r in current:
        values = [str(r.get(c) or "") for c in columns]
        key = key_id(values)
        pick = picks.get(key)
        out.append(
            dict(zip(columns, values, strict=True))
            | {
                "DeptCode": pick["dept"] if pick else str(r.get("DeptCode") or ""),
                "AccCode": pick["acc"] if pick else str(r.get("AccCode") or ""),
            }
        )
        seen.add(key)
    for key, pick in picks.items():
        if key not in seen:
            out.append(
                dict(zip(columns, json.loads(key), strict=True))
                | {"DeptCode": pick["dept"], "AccCode": pick["acc"]}
            )
    return out
