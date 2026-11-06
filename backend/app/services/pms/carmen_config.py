"""What Carmen's PMS posting config says, as far as the menu token can read it (decision-log #43, #51).

Carmen's engine posts a Data Bank day by the BU's GL interface setting: an INI per PMS that
says where the rows are, which fields key the mapping table, how debit and credit are told
apart, and the counter account. The menu token cannot read that setting (`interfacePost/
Setting` has no `/api/interface` twin). It can read `interfaceThirdParties` — the BU's
interfaces and their sections — and the mapping table, and the rest is derived from those
two and from the day itself (decision-log #51):

- the setting's code is `{InterfaceName}.{InterfaceType}` (Carmen's own rule);
- the mapping key is the table's own columns, less the account they map to;
- the day's rows are the list in `FileData` whose fields answer the most key columns, a key
  column reading the field of its own name, else that name without a `PREFIX_` (HotelTime's
  `HT_Code` ← `Code`), else nothing, its value then blank as Carmen's engine writes it
  (decision-log #53). A list named after another of the PMS's sections (`Statistic`) is not
  REVENUE's.

Checked against the keys Carmen's engine itself writes on a `-500` (HotelTime 46 of 46,
Cloudbeds 78 of 78, 2026-11-06). A day no list fits has no preview, and Carmen's `-500` then
names the keys it lacks. Nothing about a day's sides is decided here — Comanche signs `Amount`,
other PMSs carry a D/C column — that stays Carmen's engine's. Pure: no database, no HTTP.
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


def other_doc_types(interfaces: list, interface_type: str, interface: str) -> frozenset[str]:
    """This interface's other sections in Carmen's list (`statistic`), lower-cased.

    A Data Bank list named after one of them is that section's, not REVENUE's: Cloudbeds'
    `Statistic` carries the same key fields as its `Transaction`.
    """
    out = set()
    for i in interfaces:
        if not isinstance(i, dict):
            continue
        doc = str(i.get("DocType") or "")
        if (
            doc
            and doc.upper() != POST_TYPE
            and str(i.get("InterfaceType") or "").casefold() == interface_type.casefold()
            and str(i.get("InterfaceName") or "").casefold() == interface.casefold()
        ):
            out.add(doc.casefold())
    return frozenset(out)


def key_columns(columns: list[str]) -> list[str]:
    """The mapping table's key columns: all of them but the account a key maps to."""
    return [c for c in columns if c not in _TARGET_COLUMNS]


def field_for(column: str, fields) -> str | None:
    """The Data Bank field a key column reads, or None when the day has none for it.

    The field of the column's own name (any case), else the name without a `PREFIX_`
    (HotelTime's `HT_Code` ← `Code`). None leaves the key's value blank, which is what Carmen's
    engine writes for such a column (HotelTime's `Department`, Cloudbeds' `Channel`).
    """
    by_name = {str(f).casefold(): f for f in fields}
    name = column.casefold()
    if name in by_name:
        return by_name[name]
    _, sep, bare = name.partition("_")
    return by_name.get(bare) if sep and bare else None


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


def _fields(items: list) -> set[str]:
    """Every field any entry of a list carries: a row may lack one (HotelTime's no-`Code` rows)."""
    return {k for i in items if isinstance(i, dict) for k in i}


def rows_key(file_data, columns: list[str], skip: frozenset[str] = frozenset()) -> str | None:
    """The list in `FileData` the day's rows are in, or None.

    Of the lists not named after another of this PMS's sections (`skip`), the one whose fields
    answer the most key columns (`field_for`). A tie goes to the one carrying `Amount`: the
    REVENUE rows have it, a `Statistic` (`Description`, `Value`) does not. A tie even then is
    a layout this cannot tell apart: None, not a guess.
    """
    data = _parsed(file_data)
    if data is None or not columns:
        return None
    scored = []
    for name, items in data.items():
        if not (isinstance(items, list) and items and all(isinstance(i, dict) for i in items)):
            continue
        if name.casefold() in skip:
            continue
        fields = _fields(items)
        answered = sum(1 for c in columns if field_for(c, fields))
        if answered:
            scored.append(((answered, AMOUNT_FIELD in fields), name))
    if not scored:
        return None
    best = max(score for score, _ in scored)
    top = [name for score, name in scored if score == best]
    return top[0] if len(top) == 1 else None


def newest_day(
    found: list[dict], columns: list[str], skip: frozenset[str] = frozenset()
) -> tuple[dict, str] | None:
    """The Data Bank row to read and the list its rows are in: the newest row that has one.

    Carmen may hold more than one row for a day (a re-run night audit); `LastModified`
    names the current one.
    """
    days = [(r, k) for r in found if (k := rows_key(r.get("FileData"), columns, skip))]
    return max(days, key=lambda d: str(d[0].get("LastModified") or ""), default=None)


def rows_of(file_data, json_keys: str, columns: list[str]) -> list[dict]:
    """The day's rows as Carmen keys them: `[{"key", "values", "amount"}]`, in file order.

    `file_data` is one `newest_day` vouched for. Each key column reads its `field_for`, and
    a column with none (or a row without it) is blank. `amount` is as written, for the
    reviewer and the AI to read; nothing here adds, signs or balances it.
    """
    items = (_parsed(file_data) or {})[json_keys]
    source = {c: field_for(c, _fields(items)) for c in columns}
    out = []
    for item in items:
        values = {
            c: "" if source[c] is None or item.get(source[c]) is None else str(item[source[c]])
            for c in columns
        }
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


def blank_keys(rows: list[dict], columns: list[str]) -> list[dict]:
    """Carmen's mapping rows with no account, once each: `[{"key", "values"}]`.

    Carmen's engine writes there every key a post found unmapped (its `-500`), so these are
    the keys Carmen is waiting for a person to map, this day's and any earlier day's.
    """
    out, seen = [], set()
    for r in rows:
        if r.get("AccCode"):
            continue
        values = {c: str(r.get(c) or "") for c in columns}
        key = key_id(list(values.values()))
        if key not in seen:
            seen.add(key)
            out.append({"key": key, "values": values})
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
