"""Decision-log #52 — the data half of `pms_post_checks_ui.mjs` (Carmen's post checks the mapping).

    python scripts/qa/pms_post_checks_e2e.py state                 # pms-pc / pms-pc-b days, payload decrypted (JSON)
    python scripts/qa/pms_post_checks_e2e.py ht-table              # HotelTime's mapping table on Carmen dev (JSON)
    python scripts/qa/pms_post_checks_e2e.py ht-snapshot           # keep the table as it is now (once, before a run)
    python scripts/qa/pms_post_checks_e2e.py ht-stage 2026-10-06   # give that day's keys an account (GEN/1021001)
    python scripts/qa/pms_post_checks_e2e.py ht-restore            # put the snapshot back, row for row
    python scripts/qa/pms_post_checks_e2e.py backdate EVENT_ID MIN HOURS   # processed_at MIN minutes ago, created_at HOURS ago
    python scripts/qa/pms_post_checks_e2e.py posts-since ISO       # interfacePostGL calls since ISO (outbound_call_logs)
    python scripts/qa/pms_post_checks_e2e.py llm                   # pms_interface LLM calls of the two tenants
    python scripts/qa/pms_post_checks_e2e.py reset                 # delete the two tenants' days (a clean run)
    python scripts/qa/pms_post_checks_e2e.py jvs DATE [DATE...]    # live engine JVs dated those days (web JWT)
    python scripts/qa/pms_post_checks_e2e.py interfaces            # Carmen's real interface list (JSON)
    python scripts/qa/pms_post_checks_e2e.py void SEQ [SEQ...]     # void JVs a run made by mistake (web JWT)

HotelTime (dev Data Bank 2026-10-01..06) is the PMS #51's reader cannot key: rows in `Revenue`,
table columns `HT_Code / HT_Description / Department` keyed from `Code / Description / ""`.
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
SETTING, POST_TYPE = "HotelTime.PMS", "REVENUE"
SNAPSHOT = base.ROOT / ".playwright-mcp" / "pms-pc" / "hoteltime_snapshot.json"


async def _table() -> tuple[list[dict], list[str]]:
    return await base._carmen(base.carmen.get_pms_mapping, SETTING, POST_TYPE, base.TOKEN)


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


async def _restore() -> bool:
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    body = [{c: r.get(c) for c in snap["columns"] if c != "AccDesc"} for r in snap["rows"]]
    await base._carmen(base.carmen.put_pms_mapping, SETTING, POST_TYPE, body, base.TOKEN)
    now, _ = await _table()
    seen = sorted(
        (
            _norm(r.get("HT_Code")),
            _norm(r.get("HT_Description")),
            _norm(r.get("Department")),
            _norm(r.get("DeptCode")),
            _norm(r.get("AccCode")),
        )
        for r in now
    )
    want = sorted(
        (
            _norm(r.get("HT_Code")),
            _norm(r.get("HT_Description")),
            _norm(r.get("Department")),
            _norm(r.get("DeptCode")),
            _norm(r.get("AccCode")),
        )
        for r in snap["rows"]
    )
    return seen == want


async def _backdate(event_id: str, minutes: int, hours: int) -> int:
    now = datetime.now(UTC)
    values = {"processed_at": now - timedelta(minutes=minutes)}
    if hours:
        values["created_at"] = now - timedelta(hours=hours)
    async with base.async_session() as db:
        tenants = await base._tenant_ids(db)
        result = await db.execute(
            update(base.PmsEvent)
            .where(base.PmsEvent.event_id == event_id, base.PmsEvent.tenant_id.in_(list(tenants)))
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
            text("delete from pms_events where tenant_id = any(:t)"), {"t": list(tenants)}
        )
        await db.commit()
        return result.rowcount


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "state":
        print(json.dumps(asyncio.run(base._dump()), ensure_ascii=False, default=str))
        return 0
    if cmd == "ht-table":
        rows, columns = asyncio.run(_table())
        blank = sum(1 for r in rows if not _norm(r.get("AccCode")).strip())
        print(
            json.dumps({"columns": columns, "rows": len(rows), "blank": blank}, ensure_ascii=False)
        )
        return 0
    if cmd == "ht-snapshot":
        rows, columns = asyncio.run(_table())
        SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
        SNAPSHOT.write_text(
            json.dumps({"columns": columns, "rows": rows}, ensure_ascii=False), encoding="utf-8"
        )
        print(json.dumps({"rows": len(rows)}))
        return 0
    if cmd == "ht-stage":
        print(json.dumps({"staged": asyncio.run(_stage(sys.argv[2]))}))
        return 0
    if cmd == "ht-restore":
        good = asyncio.run(_restore())
        print(json.dumps({"restored": good}))
        return 0 if good else 1
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
