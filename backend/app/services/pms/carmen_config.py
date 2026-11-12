"""What Carmen's PMS posting config says, as far as the menu token can read it (decision-log #43, #51, #54).

Carmen's engine posts a Data Bank day by the BU's GL interface setting, an INI per PMS. The
INI says:
- where the rows are;
- which fields key the mapping table;
- how debit and credit are told apart;
- which account is the counter.

The menu token cannot read that setting, because `interfacePost/Setting` has no
`/api/interface` twin. What it can read is enough:
- `interfaceThirdParties`: the BU's interfaces and their sections;
- the mapping table;
- the engine's preview of a post.

From those (decision-log #51, #54):
- **The setting's code** is `{InterfaceName}.{InterfaceType}`, Carmen's own rule.
- **The mapping key** is the table's own columns, less the account they map to.
- **The day's rows** are what the engine's preview answers. It reads the day by the INI and
  keys it exactly as a post would, for every PMS, so nothing here reads a PMS's own layout.

Nothing about a day's sides or totals is decided here: those stay Carmen's engine's.
Pure: no database, no HTTP.
"""

import json
from dataclasses import dataclass

# The one section posted (user decision 2026-10-14): a day is one JV.
POST_TYPE = "REVENUE"
# What a mapping row maps its key to; every other column of the table is part of the key.
_TARGET_COLUMNS = ("DeptCode", "AccCode", "AccDesc")


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


def revenue_interfaces(interfaces: list) -> dict[str, str]:
    """The PMSs this BU posts REVENUE to GL with: `{lower-cased name: name as Carmen writes
    it}`. Our sweep opens each one's days (decision-log #55), whatever its `From`: a hook
    (`CarmenApi`, or a user's import) only brings a day sooner, and for a PMS Carmen fetches
    itself (`PartnerApi`, decision-log #52) no hook comes at all."""
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


def preview_rows(answer, columns: list[str]) -> list[dict] | None:
    """The day's rows from the engine's preview: `[{"key", "values"}]`, in the engine's order.

    Returns None when the answer is not the preview's table, e.g. a `-400 "No Data Found"`.
    Each key column reads the preview's column of that name. A blank or null value is `""`,
    as `table_of` reads the table, so a key means the same thing on both sides. A key the
    PMS wrote twice stays twice here: `new_keys` reads each once.
    """
    if not isinstance(answer, dict) or not isinstance(answer.get("Rows"), list):
        return None
    out = []
    for r in answer["Rows"]:
        if not isinstance(r, dict):
            continue
        values = {c: str(r.get(c) or "") for c in columns}
        out.append({"key": key_id(list(values.values())), "values": values})
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
