"""Carmen's own PMS posting config, read the way Carmen's engine reads it (decision-log #43).

A BU's GL interface setting (`interfacePost/Setting/GL`) carries, per section, an INI file in
base64 (`ConfigBase64`) that Carmen's engine posts a Data Bank day by: where the rows are,
which of their fields key the mapping table, how debit and credit are told apart, and the
counter account. Each PMS writes it differently — Comanche signs `Amount`, Hotelogix signs it
the other way round, GuestLine and Opera carry a D/C column — so nothing about a day's
sides is decided here. This module reads only what finding the day's mapping keys needs:
the file layout and `Mapping_MapCode`. Pure: no database, no HTTP.
"""

import base64
import json
import re
from dataclasses import dataclass

# The one section posted (user decision 2026-10-14): a day is one JV.
POST_TYPE = "REVENUE"


class UnsupportedFormat(ValueError):
    """The setting's file is not one this reader takes (only a JSON object for now)."""


class UnreadableDay(ValueError):
    """The Data Bank answered, but not with rows the setting describes."""


def parse_ini(text: str) -> dict[str, dict[str, str]]:
    """Carmen's INI: `[Section]` heads, `key=value` lines, `;` comments.

    A key written twice keeps its last value (Comanche's `[System]` has `UseAccountMap`
    twice). Lines before the first head belong to `System`.
    """
    sections: dict[str, dict[str, str]] = {}
    current = sections.setdefault("System", {})
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith(";"):
            continue
        if line.startswith("[") and line.endswith("]"):
            current = sections.setdefault(line[1:-1].strip(), {})
        elif "=" in line:
            key, value = line.split("=", 1)
            current[key.strip()] = value.strip()
    return sections


def decode(b64: str) -> str:
    raw = base64.b64decode(b64)
    for encoding in ("utf-8-sig", "utf-16"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("cp874", errors="replace")


@dataclass(frozen=True)
class Section:
    """The posted section of one setting: what the engine is asked to post with."""

    setting_code: str
    interface: str
    post_type: str
    counter_dept: str
    counter_acc: str
    counter_name: str
    config: dict


def find_section(settings: list[dict], interface: str) -> Section | None:
    """The active PMS setting for `interface`, through its active REVENUE section, or None."""
    for s in settings:
        if str(s.get("InterfaceType") or "").upper() != "PMS" or not s.get("IsActive"):
            continue
        if str(s.get("InterfaceName") or "").casefold() != interface.casefold():
            continue
        for name, sec in (s.get("Configuration") or {}).items():
            if (
                str(name).upper() == POST_TYPE
                and isinstance(sec, dict)
                and sec.get("Active")
                and sec.get("ConfigBase64")
            ):
                return Section(
                    setting_code=str(s.get("Code") or ""),
                    interface=str(s.get("InterfaceName") or interface),
                    post_type=POST_TYPE,
                    counter_dept=str(sec.get("DeptCode") or ""),
                    counter_acc=str(sec.get("AccCode") or ""),
                    counter_name=str(sec.get("AccDesc") or ""),
                    config=parse_ini(decode(sec["ConfigBase64"])),
                )
    return None


@dataclass(frozen=True)
class Spec:
    """Where a day's rows are and what keys them, as the setting says."""

    json_keys: str
    # (field in a Data Bank row, column of Carmen's mapping table), in `Mapping_MapCode` order.
    pairs: tuple[tuple[str, str], ...]
    amount_field: str
    use_mapping: bool

    @property
    def columns(self) -> list[str]:
        return [column for _, column in self.pairs]


_PAIR = re.compile(r"\[([^:\]]+):([^\]]+)\]")


def spec_of(config: dict) -> Spec:
    system = config.get("System") or {}
    file_type = system.get("FileType", "")
    if (
        file_type.lower() != "json"
        or system.get("JsonType", "").lower() != "jsonobject"
        or not system.get("JsonKeys")
    ):
        raise UnsupportedFormat(f"{file_type or 'a non-JSON'} file")
    use_mapping = system.get("UseAccountMap", "").lower() == "true"
    pairs = tuple(
        (src.strip(), col.strip())
        for src, col in _PAIR.findall(system.get("Mapping_MapCode") or "")
    )
    if use_mapping and not pairs:
        raise UnsupportedFormat("a setting that maps accounts but names no mapping key")
    return Spec(
        json_keys=system["JsonKeys"],
        pairs=pairs,
        amount_field=(config.get("Amount") or {}).get("JsonKeyName", ""),
        use_mapping=use_mapping,
    )


def key_id(values: list[str]) -> str:
    """One mapping key as a string: the key columns' values, in order, as a JSON array."""
    return json.dumps([str(v) for v in values], ensure_ascii=False)


def label(key: str) -> str:
    """What a person calls a key: its values, joined (`100 · Room Charge - VAT`)."""
    return " · ".join(v for v in json.loads(key) if v)


def short_labels(keys: list[str]) -> list[str]:
    """The first key column's values, once each — what the queue row names (`103, 729`)."""
    return list(dict.fromkeys(json.loads(k)[0] for k in keys if json.loads(k)))


def _items(file_data, json_keys: str) -> list | None:
    if isinstance(file_data, str):
        try:
            file_data = json.loads(file_data)
        except ValueError:
            return None
    items = file_data.get(json_keys) if isinstance(file_data, dict) else None
    return items if isinstance(items, list) else None


def newest_day(found: list[dict], json_keys: str) -> dict | None:
    """The Data Bank row to read: the newest one that has rows under `json_keys`.

    Carmen may hold more than one row for a day (a re-run night audit); `LastModified`
    names the current one.
    """
    days = [r for r in found if _items(r.get("FileData"), json_keys)]
    return max(days, key=lambda r: str(r.get("LastModified") or ""), default=None)


def rows_of(file_data, spec: Spec) -> list[dict]:
    """The day's rows as Carmen keys them: `[{"key", "values", "amount"}]`, in file order.

    `amount` is the field the setting names, as written, for the reviewer to read; nothing
    here adds, signs or balances it.
    """
    items = _items(file_data, spec.json_keys)
    if items is None:
        raise UnreadableDay(f"FileData has no {spec.json_keys} list")
    out = []
    for item in items:
        if not isinstance(item, dict):
            raise UnreadableDay(f"a {spec.json_keys} entry is not an object")
        values = {
            col: "" if item.get(src) is None else str(item.get(src)) for src, col in spec.pairs
        }
        out.append(
            {
                "key": key_id(list(values.values())),
                "values": values,
                "amount": ""
                if item.get(spec.amount_field) is None
                else str(item.get(spec.amount_field)),
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


def new_keys(rows: list[dict], table: dict[str, dict], spec_uses_mapping: bool = True) -> list[str]:
    """The day's keys Carmen's table has no account for, in first-seen order."""
    if not spec_uses_mapping:
        return []
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
