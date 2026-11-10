"""PMS processing from Carmen's interface list (decision-log #51) — the data half of the
full-system E2E (`pms_third_parties_ui.mjs` drives the hooks and the browser, and calls this).

    python scripts/qa/pms_third_parties_e2e.py preflight        # P-01 Comanche listed, P-02 web JWT reads glJv
    python scripts/qa/pms_third_parties_e2e.py setup            # S-01 snapshot Comanche's table, S-02 stage it
    python scripts/qa/pms_third_parties_e2e.py state            # the E2E tenants' pms_events, payload decrypted (JSON)
    python scripts/qa/pms_third_parties_e2e.py last-attempt ID  # A-06: put a received day on its last try
    python scripts/qa/pms_third_parties_e2e.py mapping          # Comanche's mapping table now (JSON)
    python scripts/qa/pms_third_parties_e2e.py jvs              # this run's engine JVs for the two days (JSON)
    python scripts/qa/pms_third_parties_e2e.py llm              # pms_interface LLM calls of the E2E tenants
    python scripts/qa/pms_third_parties_e2e.py engine-probe     # P-03 the success path on test.PMS (posts + voids a JV)
    python scripts/qa/pms_third_parties_e2e.py seed-posted      # F-01: a posted Comanche day with P-03's JV seq
    python scripts/qa/pms_third_parties_e2e.py teardown         # T-01 restore the table, T-02 void this run's JVs

**Comanche, not test.PMS** (user, 2026-11-03): `interfaceThirdParties` is Carmen's register of
third-party integrations — it lists Comanche, and an inactive CarmenAI, but not the active
`test.PMS` — so only a Comanche day goes through our processing. Three Comanche days, all
mapped by the Comanche and test.PMS tables between them:
- 2024-07-01 (A, approved in the browser) and 2025-10-20 (B, auto-posted). No live JV covers
  them, and **Carmen refuses both** ("Line No. 30,31 has no DrCr value", Comanche.PMS's own
  config — the same data posts on test.PMS), so they are the refusal paths;
- 2024-09-01, which Carmen posted itself (JV 36): the "already posted" path.
The success path is P-03: our `post_pms_gl`, no counter, on test.PMS's 2025-10-21.

**Setup stages Carmen's real Comanche table:** the snapshot, plus test.PMS's accounts for every
other key of the three days, less 3 keys A and B both carry — so exactly those 3 come out new.
**Teardown puts the snapshot back row for row** and voids the JVs this run posted; a JV that
existed before the run (JV 36) is never touched.

**Local Supabase only** (127.0.0.1:54322): on the shared dev DB, QA's backend sweeps the same
days with the code from `main`. Carmen's menu token is `CARMEN_AUTHORIZATION`, the carmencloud
web JWT `CARMEN_ADMIN_TOKEN`.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "backend" / ".env")
os.environ["DATABASE_URL"] = (
    "postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres"
)
sys.path.insert(0, str(ROOT / "backend"))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from sqlalchemy import delete, select, text, update  # noqa: E402

from app.context import current_carmen_uri  # noqa: E402
from app.database import async_session  # noqa: E402
from app.models.identity import Tenant  # noqa: E402
from app.models.pms import PmsEvent  # noqa: E402
from app.services.pms import carmen_config as cfg  # noqa: E402
from app.services.pms import process  # noqa: E402
from app.services.shared import carmen  # noqa: E402

URI = "https://dev.carmen4.com"
API = f"{URI}/Carmen.API/api"
SETTING, POST_TYPE, NAME = "Comanche.PMS", "REVENUE", "Comanche"
FILL_FROM = "test.PMS"
# A is approved in the browser and B auto-posted: Carmen refuses both ("Line No. 30,31 has
# no DrCr value", a Comanche.PMS config matter). POSTED is the day Carmen already holds as
# JV 36, so a post of it answers "Already Posted".
DAYS = ("2024-07-01", "2025-10-20")
POSTED = "2024-09-01"
ALL_DAYS = (*DAYS, POSTED)
# P-03: the success path, on the sandbox whose day posts (Carmen fills the counter itself).
PROBE_SETTING, PROBE_NAME, PROBE_DAY, PROBE_ID = "test.PMS", "test", "2025-10-21", 169
# F-01: the day stored posted with P-03's JV, for the queue's JV column and Open JV.
SEEDED_DAY = "2024-06-30"
TENANTS = ("pms-e2e", "pms-e2e-b")
OUT = ROOT / ".playwright-mcp" / "pms-tp"
STATE = OUT / "state.json"
TOKEN = os.environ["CARMEN_AUTHORIZATION"].strip().strip('"')
_jwt = os.environ.get("CARMEN_ADMIN_TOKEN", "").strip().strip('"')
JWT = _jwt if _jwt.lower().startswith("bearer ") else f"Bearer {_jwt}"


def _state() -> dict:
    return json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}


def _save(state: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")


def _jwt_client() -> httpx.Client:
    return httpx.Client(
        headers={"Authorization": JWT}, timeout=httpx.Timeout(60, connect=20)
    )


def _engine_jvs(days: tuple[str, ...] = ALL_DAYS) -> list[dict]:
    """Every non-void JV dated one of `days` (the web JWT's view)."""
    with _jwt_client() as c:
        r = c.post(
            f"{API}/glJv/search",
            json={
                "Limit": 5000,  # every JV: Carmen's own JV 36 is among the oldest
                "Page": 1,
                "OrderBy": {"JvhSeq": "desc"},
                "WhereGroupList": [],
            },
        )
        r.raise_for_status()
    return [
        j
        for j in r.json().get("Data") or []
        if str(j.get("JvhDate"))[:10] in days and j.get("Status") != "Void"
    ]


async def _carmen(fn, *args):
    current_carmen_uri.set(URI)
    try:
        return await fn(*args)
    finally:
        await carmen.close_client()


def _key(row: dict, keys: list[str]) -> str:
    return cfg.key_id([str(row.get(c) or "") for c in keys])


def _body(rows: list[dict], keys: list[str]) -> list[dict]:
    """Rows as Carmen's PUT takes them: the key columns, DeptCode, AccCode."""
    return [
        {
            **{c: str(r.get(c) or "") for c in keys},
            "DeptCode": str(r.get("DeptCode") or ""),
            "AccCode": str(r.get("AccCode") or ""),
        }
        for r in rows
    ]


def preflight() -> int:
    ok = True
    listed = asyncio.run(_carmen(carmen.get_interfaces, TOKEN))
    row = cfg.find_section(listed, "PMS", NAME)
    print(
        f"{'PASS' if row else 'FAIL'} P-01 {NAME} × GL × REVENUE in interfaceThirdParties  ({row})"
    )
    ok &= row is not None
    try:
        live = _engine_jvs()
        on_ab = [j["JvhSeq"] for j in live if str(j["JvhDate"])[:10] in DAYS]
        on_posted = [j["JvhSeq"] for j in live if str(j["JvhDate"])[:10] == POSTED]
        good = not on_ab and bool(on_posted)
        print(
            f"{'PASS' if good else 'FAIL'} P-02 web JWT reads glJv; no live JV on {DAYS}, "
            f"Carmen's own on {POSTED}  ({on_ab} / {on_posted})"
        )
        ok &= good
    except httpx.HTTPError as exc:
        print(f"FAIL P-02 web JWT reads glJv  ({exc})")
        ok = False
    return 0 if ok else 1


async def _days_raw() -> dict[str, dict]:
    """Comanche's raw days: the staging below picks rows by `TransactionType`, which Carmen's
    preview does not carry. The app itself no longer reads FileData (decision-log #54)."""
    out = {}
    for day in ALL_DAYS:
        found = await carmen.get_databank_day("PMS", NAME, "Daily", day, TOKEN)
        if not found:
            raise SystemExit(f"[abort] Data Bank has no {NAME} {day}")
        row = max(found, key=lambda d: str(d.get("LastModified") or ""))
        data = row["FileData"]
        items = (json.loads(data) if isinstance(data, str) else data)["Transaction"]
        out[day] = {"id": row["Id"], "items": items}
    return out


async def _setup() -> None:
    state = _state()
    if state.get("snapshot"):
        raise SystemExit(
            "[abort] a snapshot exists: run `teardown` first, or delete state.json"
        )
    # A rerun starts clean: an earlier run's days would answer the hooks as duplicates.
    # Local Supabase only (DATABASE_URL is forced above), so nothing else is touched.
    async with async_session() as db:
        tenants = await _tenant_ids(db)
        await db.execute(delete(PmsEvent).where(PmsEvent.tenant_id.in_(list(tenants))))
        await db.commit()
    current_carmen_uri.set(URI)
    rows, columns = await carmen.get_pms_mapping(SETTING, POST_TYPE, TOKEN)
    keys = cfg.key_columns(columns)
    state.update(
        snapshot=rows,
        columns=columns,
        baseline_jvs=[j["JvhSeq"] for j in _engine_jvs()],
    )
    _save(state)  # before any write: teardown restores from it
    print(f"PASS S-01 snapshot of {SETTING}  ({len(rows)} rows, key {keys})")

    fill_rows, _ = await carmen.get_pms_mapping(FILL_FROM, POST_TYPE, TOKEN)
    union = {**cfg.table_of(fill_rows, keys), **cfg.table_of(rows, keys)}
    days = await _days_raw()
    day_keys = {d: [_key(i, keys) for i in v["items"]] for d, v in days.items()}
    needed = list(dict.fromkeys(k for ks in day_keys.values() for k in ks))
    if missing := [k for k in needed if k not in union]:
        raise SystemExit(
            f"[abort] no account anywhere for {[cfg.label(k) for k in missing]}"
        )
    both = set(day_keys[DAYS[0]]) & set(day_keys[DAYS[1]])

    def first(pred) -> dict:
        for i in days[DAYS[0]]["items"]:
            k = _key(i, keys)
            if k in both and pred(i):
                return {"key": k, "values": {c: str(i.get(c) or "") for c in keys}}
        raise SystemExit("[abort] no such row in both days")

    def vat(i) -> bool:
        return "VAT" in str(i.get("Description")).upper()

    trimmed = [
        first(lambda i: i.get("TransactionType") == "Revenue" and not vat(i)),
        first(vat),
        first(lambda i: i.get("TransactionType") == "Payment"),
    ]
    cut = {t["key"] for t in trimmed}
    for t in trimmed:  # the account a person picks by hand in B-06
        t["snapshot"] = {"dept": union[t["key"]]["dept"], "acc": union[t["key"]]["acc"]}

    # Carmen's rows as they are, an account filled in where the day needs one, then the
    # day's keys Carmen's table lacks — every one but the 3 cut.
    staged, seen = [], set()
    for r in rows:
        k = _key(r, keys)
        seen.add(k)
        if k in cut:
            continue
        if not r.get("AccCode") and k in needed:
            r = {**r, "DeptCode": union[k]["dept"], "AccCode": union[k]["acc"]}
        staged.append(r)
    for k in needed:
        if k not in seen and k not in cut:
            staged.append(
                dict(zip(keys, json.loads(k), strict=True))
                | {"DeptCode": union[k]["dept"], "AccCode": union[k]["acc"]}
            )
    await carmen.put_pms_mapping(SETTING, POST_TYPE, _body(staged, keys), TOKEN)
    after, _ = await carmen.get_pms_mapping(SETTING, POST_TYPE, TOKEN)
    table = cfg.table_of(after, keys)
    new = {
        d: cfg.new_keys([{"key": _key(i, keys)} for i in v["items"]], table)
        for d, v in days.items()
    }
    state.update(
        trimmed=trimmed,
        staged=after,
        days={
            d: {"id": v["id"], "rows": len(v["items"]), "keys": len(set(day_keys[d]))}
            for d, v in days.items()
        },
    )
    _save(state)
    # A and B carry all 3 cut keys; the posted day only those it has (none of anything else).
    ok = all(set(new[d]) == cut for d in DAYS) and set(new[POSTED]) <= cut
    print(
        f"{'PASS' if ok else 'FAIL'} S-02 staged: {len(after)} rows; on A and B exactly the "
        f"3 cut keys are new  ({[cfg.label(t['key']) for t in trimmed]}; "
        f"new per day {dict((d, len(n)) for d, n in new.items())})"
    )
    await carmen.close_client()
    if not ok:
        raise SystemExit(1)


async def _tenant_ids(db) -> dict:
    rows = (
        await db.execute(
            select(Tenant.id, Tenant.bu_code).where(Tenant.bu_code.in_(TENANTS))
        )
    ).all()
    return {str(t): bu for t, bu in rows}


async def _dump() -> list[dict]:
    async with async_session() as db:
        tenants = await _tenant_ids(db)
        events = (
            (
                await db.execute(
                    select(PmsEvent).where(PmsEvent.tenant_id.in_(list(tenants)))
                )
            )
            .scalars()
            .all()
        )
        return [
            {
                "id": str(e.id),
                "bu": tenants[str(e.tenant_id)],
                "event_id": e.event_id,
                "status": e.status,
                "reason_code": e.reason_code,
                "error_message": e.error_message,
                "attempts": e.attempts,
                "jv_no": e.jv_no,
                "payload": e.review_payload,
            }
            for e in events
        ]


async def _last_attempt(event_pk: str) -> None:
    async with async_session() as db:
        await db.execute(
            update(PmsEvent)
            .where(PmsEvent.id == event_pk)
            .values(attempts=2, processed_at=None)
        )
        await db.commit()


async def _llm() -> int:
    async with async_session() as db:
        tenants = await _tenant_ids(db)
        return await db.scalar(
            text(
                "select count(*) from llm_usage_logs where module_id = 'pms_interface'"
                " and tenant_id = any(:t)"
            ),
            {"t": list(tenants)},
        )


async def _restore() -> bool:
    state = _state()
    snap, columns = state.get("snapshot"), state.get("columns")
    if not snap:
        print("SKIP T-01 no snapshot to restore")
        return True
    keys = cfg.key_columns(columns)
    current_carmen_uri.set(URI)
    await carmen.put_pms_mapping(SETTING, POST_TYPE, _body(snap, keys), TOKEN)
    after, _ = await carmen.get_pms_mapping(SETTING, POST_TYPE, TOKEN)
    await carmen.close_client()
    ok = sorted(map(json.dumps, _body(after, keys))) == sorted(
        map(json.dumps, _body(snap, keys))
    )
    print(
        f"{'PASS' if ok else 'FAIL'} T-01 {SETTING}'s table restored row for row  ({len(after)} rows)"
    )
    if ok:
        state.pop("snapshot", None)
        _save(state)
    return ok


def _void() -> bool:
    baseline = set(_state().get("baseline_jvs") or [])
    made = [j for j in _engine_jvs() if j["JvhSeq"] not in baseline]
    ok = True
    with _jwt_client() as c:
        for j in made:
            r = c.delete(
                f"{API}/glJv/{j['JvhSeq']}",
                params={"user": "admin", "voidRemark": "CA-119 decision-log #51 E2E"},
            )
            good = r.status_code == 200 and (r.json() or {}).get("Code") == 0
            ok &= good
            print(
                f"{'PASS' if good else 'FAIL'} T-02 void JV {j['JvhSeq']} "
                f"({j.get('Prefix')}{j.get('JvhNo')}, {str(j.get('JvhDate'))[:10]})  "
                f"({r.status_code} {r.text[:100]})"
            )
    left = [j["JvhSeq"] for j in _engine_jvs() if j["JvhSeq"] not in baseline]
    print(
        f"{'PASS' if not left else 'FAIL'} T-02 no JV of this run left live  ({left})"
    )
    return ok and not left


async def _engine_probe() -> bool:
    """P-03, the success path: our `process.post_day` — no counter — on a day Carmen posts.

    Expects `posted`, a JV carrying the setting's counter account (which only Carmen can
    have added), and `post_day` naming that JV's seq from the answer's `Id` (ask D): the
    value `_process` and Approve store in `jv_no`. Keeps the seq for F-01; voids the JV.
    """
    day = (PROBE_DAY,)
    if before := [j["JvhSeq"] for j in _engine_jvs(day)]:
        print(f"FAIL P-03 {PROBE_SETTING} {PROBE_DAY} already has a live JV {before}")
        return False
    current_carmen_uri.set(URI)
    section = {"setting_code": PROBE_SETTING, "post_type": POST_TYPE}
    outcome, jv_no = await process.post_day(section, PROBE_DAY, PROBE_ID, TOKEN)
    await carmen.close_client()
    made = _engine_jvs(day)
    counter, voided = [], []
    with _jwt_client() as c:
        for j in made:
            jv = c.get(f"{API}/glJv/{j['JvhSeq']}").json()
            lines = (jv.get("Data") or jv).get("Detail") or []
            counter = [
                (x.get("DeptCode"), x.get("AccCode"))
                for x in lines
                if x.get("AccCode") == "1021001"
            ]
            r = c.delete(
                f"{API}/glJv/{j['JvhSeq']}",
                params={
                    "user": "admin",
                    "voidRemark": "CA-119 decision-log #51 E2E P-03",
                },
            )
            voided.append((j["JvhSeq"], r.status_code == 200))
    left = _engine_jvs(day)
    seqs = [str(j["JvhSeq"]) for j in made]
    posted_ok = outcome == "posted" and len(made) == 1 and bool(counter) and not left
    print(
        f"{'PASS' if posted_ok else 'FAIL'} P-03 our post_day, no counter, posts on {PROBE_SETTING}; "
        f"Carmen fills the counter  (outcome={outcome} jv={seqs} counter lines={counter} "
        f"voided={voided} left={[j['JvhSeq'] for j in left]})"
    )
    named_ok = jv_no is not None and seqs == [jv_no]
    print(
        f"{'PASS' if named_ok else 'FAIL'} P-03 post_day names the JV Carmen made "
        f"(ask D: the answer's Id)  (jv_no={jv_no!r} vs {seqs})"
    )
    if named_ok:
        state = _state()
        state["probe_jv"] = jv_no
        _save(state)
    return posted_ok and named_ok


async def _seed_posted() -> str | None:
    """F-01's row: a Comanche day stored posted with P-03's JV seq, as `_process` writes one.

    Comanche refuses to post (ask K), so no day of ours reaches `posted` with a JV through
    the flow yet; the row stands in for one, to check what the queue makes of `jv_no`.
    """
    jv_no = _state().get("probe_jv")
    if not jv_no:
        return None
    async with async_session() as db:
        tenants = {bu: t for t, bu in (await _tenant_ids(db)).items()}
        hook = {
            "InterfaceType": "PMS",
            "InterfaceName": NAME,
            "DocType": "Daily",
            "DocDate": SEEDED_DAY,
        }
        db.add(
            PmsEvent(
                tenant_id=tenants["pms-e2e"],
                event_id=f"PMS/{NAME}/Daily/{SEEDED_DAY}",
                type="PMS",
                payload=hook,
                status="posted",
                jv_no=jv_no,
            )
        )
        await db.commit()
    return jv_no


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "preflight":
        return preflight()
    if cmd == "setup":
        asyncio.run(_setup())
        return 0
    if cmd == "state":
        print(json.dumps(asyncio.run(_dump()), ensure_ascii=False, default=str))
        return 0
    if cmd == "last-attempt":
        asyncio.run(_last_attempt(sys.argv[2]))
        return 0
    if cmd == "mapping":
        rows, columns = asyncio.run(
            _carmen(carmen.get_pms_mapping, SETTING, POST_TYPE, TOKEN)
        )
        print(json.dumps({"rows": rows, "columns": columns}, ensure_ascii=False))
        return 0
    if cmd == "jvs":
        baseline = set(_state().get("baseline_jvs") or [])
        made = [j for j in _engine_jvs() if j["JvhSeq"] not in baseline]
        with _jwt_client() as c:
            full = [c.get(f"{API}/glJv/{j['JvhSeq']}").json() for j in made]
        print(json.dumps(full, ensure_ascii=False, default=str))
        return 0
    if cmd == "llm":
        print(asyncio.run(_llm()))
        return 0
    if cmd == "engine-probe":
        return 0 if asyncio.run(_engine_probe()) else 1
    if cmd == "seed-posted":
        print(asyncio.run(_seed_posted()) or "")
        return 0
    if cmd == "teardown":
        restored = asyncio.run(_restore())
        voided = _void()
        return 0 if restored and voided else 1
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main())
