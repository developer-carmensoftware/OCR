"""Decision-log #52 — the data half of `pms_post_checks_ui.mjs` (Carmen's post checks the mapping).

    python scripts/qa/pms_post_checks_e2e.py state                 # pms-pc / pms-pc-b days, payload decrypted (JSON)
    python scripts/qa/pms_post_checks_e2e.py table SETTING [COLS]  # a PMS's mapping table: columns, rows, blank, keys (JSON)
    python scripts/qa/pms_post_checks_e2e.py snapshot SETTING      # keep that table as it is now (once, before a run)
    python scripts/qa/pms_post_checks_e2e.py restore SETTING       # put the snapshot back, row for row (empty → PUT [])
    python scripts/qa/pms_post_checks_e2e.py fill-blank SETTING DEPT ACC   # every row without an account gets one
    python scripts/qa/pms_post_checks_e2e.py day-keys PMS DATE LIST COL,COL  # a Data Bank day's distinct keys
    python scripts/qa/pms_post_checks_e2e.py jv SEQ                # one JV: date, source, status, lines, Dr/Cr (web JWT)
    python scripts/qa/pms_post_checks_e2e.py ht-table|ht-snapshot|ht-restore   # the three above for HotelTime.PMS
    python scripts/qa/pms_post_checks_e2e.py ht-stage 2026-10-06   # give that day's keys an account (GEN/1021001)
    python scripts/qa/pms_post_checks_e2e.py backdate EVENT_ID MIN HOURS   # processed_at MIN minutes ago, created_at HOURS ago
    python scripts/qa/pms_post_checks_e2e.py posts-since ISO       # interfacePostGL calls since ISO (outbound_call_logs)
    python scripts/qa/pms_post_checks_e2e.py llm                   # pms_interface LLM calls of the two tenants
    python scripts/qa/pms_post_checks_e2e.py reset                 # delete the two tenants' days (a clean run)
    python scripts/qa/pms_post_checks_e2e.py jvs DATE [DATE...]    # live engine JVs dated those days (web JWT)
    python scripts/qa/pms_post_checks_e2e.py interfaces            # Carmen's real interface list (JSON)
    python scripts/qa/pms_post_checks_e2e.py void SEQ [SEQ...]     # void JVs a run made by mistake (web JWT)

HotelTime (dev Data Bank 2026-10-01..06) is the PMS #51's reader cannot key: rows in `Revenue`,
table columns `HT_Code / HT_Description / Department` keyed from `Code / Description / ""`.
Cloudbeds (2026-10-26..29) cannot be keyed either: `Transaction` and `Statistic` both carry its
key columns `Description / MarketSegmentDesc`, and the reader takes a day only from one list.
Local Supabase only. Reuses `pms_third_parties_e2e.py` for the Carmen and DB plumbing.
"""

from __future__ import annotations

import asyncio
import json
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pms_third_parties_e2e as base  # noqa: E402
from sqlalchemy import text, update  # noqa: E402

base.TENANTS = ("pms-pc", "pms-pc-b")
SETTING, POST_TYPE = "HotelTime.PMS", "REVENUE"  # the ht-* commands' table


def _snapshot_file(setting: str) -> Path:
    # HotelTime.PMS → hoteltime_snapshot.json, the name the ht-* commands always used.
    name = f"{setting.split('.')[0].lower()}_snapshot.json"
    return base.ROOT / ".playwright-mcp" / "pms-pc" / name


async def _table(setting: str = SETTING) -> tuple[list[dict], list[str]]:
    return await base._carmen(
        base.carmen.get_pms_mapping, setting, POST_TYPE, base.TOKEN
    )


def _body(rows: list[dict], columns: list[str]) -> list[dict]:
    # Carmen's PUT takes the table's own columns, less the account name it fills in itself.
    return [{c: r.get(c) for c in columns if c != "AccDesc"} for r in rows]


def _key_text(row: dict, cols: list[str]) -> str:
    return "|".join(_norm(row.get(c)) for c in cols)


async def _table_info(setting: str, on: list[str] | None = None) -> dict:
    """`on`: key the rows by these columns only. Cloudbeds' table keys a third column, `Channel`,
    which Carmen's engine added on its first -500 and which no Data Bank list carries."""
    rows, columns = await _table(setting)
    keys = on or base.cfg.key_columns(columns)
    return {
        "columns": columns,
        "key_columns": base.cfg.key_columns(columns),
        "rows": len(rows),
        "blank": sum(1 for r in rows if not _norm(r.get("AccCode")).strip()),
        "keys": sorted({_key_text(r, keys) for r in rows}),
    }


async def _snapshot(setting: str) -> int:
    rows, columns = await _table(setting)
    f = _snapshot_file(setting)
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(
        json.dumps({"columns": columns, "rows": rows}, ensure_ascii=False),
        encoding="utf-8",
    )
    return len(rows)


async def _fill_blank(setting: str, dept: str, acc: str) -> int:
    """Map every row without an account, as a person would in Carmen's mapping screen."""
    rows, columns = await _table(setting)
    blank = [r for r in rows if not _norm(r.get("AccCode")).strip()]
    for r in blank:
        r["DeptCode"], r["AccCode"] = dept, acc
    if blank:  # Carmen's PUT replaces the table: every row goes back
        await base._carmen(
            base.carmen.put_pms_mapping,
            setting,
            POST_TYPE,
            _body(rows, columns),
            base.TOKEN,
        )
    return len(blank)


async def _day_keys(pms: str, date: str, list_name: str, cols: list[str]) -> dict:
    found = await base._carmen(
        base.carmen.get_databank_day, "PMS", pms, "Daily", date, base.TOKEN
    )
    fd = found[0]["FileData"] if found else {}
    fd = json.loads(fd) if isinstance(fd, str) else fd
    items = fd.get(list_name) or []
    return {"rows": len(items), "keys": sorted({_key_text(i, cols) for i in items})}


def _jv(seq: str) -> dict:
    with base._jwt_client() as c:
        r = c.get(f"{base.API}/glJv/{seq}")
    body = r.json() or {}
    d = body.get("Data") or body  # Carmen answers this one unwrapped (as P-03 reads it)
    lines = d.get("Detail") or []
    return {
        "seq": d.get("JvhSeq"),
        "date": str(d.get("JvhDate"))[:10],
        "source": d.get("JvhSource"),
        "status": d.get("Status"),
        "lines": len(lines),
        "dr": round(sum(float(x.get("DrBase") or 0) for x in lines), 2),
        "cr": round(sum(float(x.get("CrBase") or 0) for x in lines), 2),
        "accounts": sorted({f"{x.get('DeptCode')}/{x.get('AccCode')}" for x in lines}),
    }


async def _day(date: str) -> list[dict]:
    found = await base._carmen(
        base.carmen.get_databank_day, "PMS", "HotelTime", "Daily", date, base.TOKEN
    )
    fd = found[0]["FileData"]
    fd = json.loads(fd) if isinstance(fd, str) else fd
    return fd["Revenue"]


def _norm(v) -> str:
    return "" if v is None else str(v)


async def _stage(date: str) -> int:
    rows, columns = await _table()
    keys = base.cfg.key_columns(columns)
    picks = {}
    for r in await _day(date):
        values = [_norm(r.get("Code")), _norm(r.get("Description")), ""]
        picks[base.cfg.key_id(values)] = {"dept": "GEN", "acc": "1021001"}
    # Every row read stays; this day's keys get the account; Carmen's PUT replaces the table.
    await base._carmen(
        base.carmen.put_pms_mapping,
        SETTING,
        POST_TYPE,
        base.cfg.merged_rows(rows, picks, keys),
        base.TOKEN,
    )
    return len(picks)


async def _restore(setting: str = SETTING) -> bool:
    snap = json.loads(_snapshot_file(setting).read_text(encoding="utf-8"))
    body = _body(
        snap["rows"], snap["columns"]
    )  # an empty snapshot puts back an empty table
    await base._carmen(
        base.carmen.put_pms_mapping, setting, POST_TYPE, body, base.TOKEN
    )
    now, _ = await _table(setting)
    cols = [c for c in snap["columns"] if c != "AccDesc"]

    def row(r: dict) -> tuple[str, ...]:
        return tuple(_norm(r.get(c)) for c in cols)

    return sorted(map(row, now)) == sorted(map(row, snap["rows"]))


async def _backdate(event_id: str, minutes: int, hours: int) -> int:
    now = datetime.now(UTC)
    values = {"processed_at": now - timedelta(minutes=minutes)}
    if hours:
        values["created_at"] = now - timedelta(hours=hours)
    async with base.async_session() as db:
        tenants = await base._tenant_ids(db)
        result = await db.execute(
            update(base.PmsEvent)
            .where(
                base.PmsEvent.event_id == event_id,
                base.PmsEvent.tenant_id.in_(list(tenants)),
            )
            .values(**values)
        )
        await db.commit()
        return result.rowcount


async def _posts_since(iso: str) -> int:
    # Outbound rows are buffered and written every 10 s (`outbound_log`): read after that.
    since = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    async with base.async_session() as db:
        return await db.scalar(
            text(
                "select count(*) from outbound_call_logs where url like '%interfacePostGL%'"
                " and created_at > :t"
            ),
            {"t": since},
        )


async def _reset() -> int:
    """Forget the two test tenants' days (local Supabase only), so a run starts clean."""
    async with base.async_session() as db:
        tenants = await base._tenant_ids(db)
        if not tenants:
            return 0
        result = await db.execute(
            text("delete from pms_events where tenant_id = any(:t)"),
            {"t": list(tenants)},
        )
        await db.commit()
        return result.rowcount


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "state":
        print(json.dumps(asyncio.run(base._dump()), ensure_ascii=False, default=str))
        return 0
    # The ht-* names are the generic table commands for HotelTime.PMS.
    setting = (
        SETTING if cmd.startswith("ht-") else (sys.argv[2] if len(sys.argv) > 2 else "")
    )
    if cmd in ("table", "ht-table"):
        on = sys.argv[3].split(",") if cmd == "table" and len(sys.argv) > 3 else None
        print(json.dumps(asyncio.run(_table_info(setting, on)), ensure_ascii=False))
        return 0
    if cmd in ("snapshot", "ht-snapshot"):
        print(json.dumps({"rows": asyncio.run(_snapshot(setting))}))
        return 0
    if cmd in ("restore", "ht-restore"):
        good = asyncio.run(_restore(setting))
        print(json.dumps({"restored": good}))
        return 0 if good else 1
    if cmd == "fill-blank":
        print(
            json.dumps(
                {"filled": asyncio.run(_fill_blank(setting, sys.argv[3], sys.argv[4]))}
            )
        )
        return 0
    if cmd == "day-keys":
        pms, date, list_name, cols = (
            sys.argv[2],
            sys.argv[3],
            sys.argv[4],
            sys.argv[5].split(","),
        )
        print(
            json.dumps(
                asyncio.run(_day_keys(pms, date, list_name, cols)), ensure_ascii=False
            )
        )
        return 0
    if cmd == "jv":
        print(json.dumps(_jv(sys.argv[2]), ensure_ascii=False))
        return 0
    if cmd == "ht-stage":
        print(json.dumps({"staged": asyncio.run(_stage(sys.argv[2]))}))
        return 0
    if cmd == "backdate":
        print(asyncio.run(_backdate(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))))
        return 0
    if cmd == "reset":
        print(asyncio.run(_reset()))
        return 0
    if cmd == "posts-since":
        print(asyncio.run(_posts_since(sys.argv[2])))
        return 0
    if cmd == "llm":
        print(asyncio.run(base._llm()))
        return 0
    if cmd == "jvs":
        days = tuple(sys.argv[2:])
        print(json.dumps([j["JvhSeq"] for j in base._engine_jvs(days)]))
        return 0
    if cmd == "interfaces":
        print(
            json.dumps(
                asyncio.run(base._carmen(base.carmen.get_interfaces, base.TOKEN)),
                ensure_ascii=False,
            )
        )
        return 0
    if cmd == "void":
        ok = True
        with base._jwt_client() as c:
            for seq in sys.argv[2:]:
                r = c.delete(
                    f"{base.API}/glJv/{seq}",
                    params={"user": "admin", "voidRemark": "decision-log #52 E2E"},
                )
                print(json.dumps({"void": seq, "status": r.status_code}))
                ok &= r.status_code == 200
        return 0 if ok else 1
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main())
