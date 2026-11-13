"""The data half of pms_seeded_days_ui.mjs: Carmen dev's Data Bank seeded with re-dated real days.

    python scripts/qa/pms_seeded_days_e2e.py seed PMS SRC_DATE NEW_DATE [--again]  # → {"id": N}
    python scripts/qa/pms_seeded_days_e2e.py held PMS DATE [DATE...]   # Data Bank rows per date (JSON)
    python scripts/qa/pms_seeded_days_e2e.py unseed                    # delete every row this run seeded
    python scripts/qa/pms_seeded_days_e2e.py engine-calls              # bodies sent to Carmen's engine (JSON)
    python scripts/qa/pms_seeded_days_e2e.py engine-reset              # forget them
    python scripts/qa/pms_seeded_days_e2e.py picks                     # every parked day's picks, checked
    python scripts/qa/pms_seeded_days_e2e.py restricted                # a department that limits accounts
    python scripts/qa/pms_seeded_days_e2e.py blank-one EVENT_ID        # drop one AI pick, age the last ask
    python scripts/qa/pms_seeded_days_e2e.py <any pms_post_checks_e2e.py command>

The source days are carmencloud's own (`pms_databank.py export`), in `PMS_TEST_DATA`
(default `Documents\\bruno\\Test-Pms-Data`), never in the repo. `seed` moves every date in a day
by the same number of days (`pms_databank.shifted`) and keeps the new row's Id in a ledger, so
`unseed` removes exactly what this run added. Local Supabase only, like the suites it extends.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pms_databank as bank  # noqa: E402
import pms_post_checks_e2e as p2  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.services.pms import mapping  # noqa: E402  (importable once p2 set up the path)

base = p2.base
DATA = Path(
    os.environ.get("PMS_TEST_DATA") or Path.home() / "Documents" / "bruno" / "Test-Pms-Data"
)
OUT = base.ROOT / ".playwright-mcp" / "pms-seeded"
LEDGER = OUT / "seeded.json"
ENGINE_LOG = base.ROOT / ".playwright-mcp" / "pms-pc" / "engine_calls.jsonl"


def _ledger() -> list[dict]:
    return json.loads(LEDGER.read_text(encoding="utf-8")) if LEDGER.exists() else []


def _client():
    return bank.httpx.Client(timeout=120, headers={"Authorization": base.TOKEN})


def seed(pms: str, src: str, new: str, again: bool, keep: bool) -> int:
    """`keep`: leave the row at `unseed`. Yesterday's rows are also read by QA's own sweep
    (every tenant of this Carmen BU with a key), and deleting them would break those days."""
    body = bank.shifted(json.loads((DATA / pms / f"{src}.json").read_text(encoding="utf-8")), new)
    with _client() as h:
        new_id = bank.seed_day(h, base.URI, pms, body, again=again)
    OUT.mkdir(parents=True, exist_ok=True)
    # A seed onto a date Carmen holds replaces that row in place (same Id): one ledger entry.
    rows = [r for r in _ledger() if r["id"] != new_id]
    row = {"pms": pms, "id": new_id, "date": new, "src": src, "keep": keep}
    LEDGER.write_text(json.dumps([*rows, row]), encoding="utf-8")
    return new_id


def unseed_day(pms: str, day: str) -> list[dict]:
    """Delete one kept day of ours (HotelTime's yesterday, before a run re-uses it as the late day)."""
    out, left = [], []
    with _client() as h:
        for row in _ledger():
            if row["pms"] == pms and row["date"] == day:
                r = h.delete(f"{bank._bank(base.URI, pms)}/{row['id']}")
                out.append({**row, "status": r.status_code})
                if r.status_code == 200:
                    continue
            left.append(row)
    LEDGER.write_text(json.dumps(left), encoding="utf-8")
    return out


def unseed() -> list[dict]:
    out, left = [], []
    with _client() as h:
        for row in _ledger():
            if row.get("keep"):
                out.append({**row, "deleted": None, "status": "kept"})
                left.append(row)
                continue
            r = h.delete(f"{bank._bank(base.URI, row['pms'])}/{row['id']}")
            ok = r.status_code == 200
            # Carmen dev's DELETE fails for Comanche and Cloudbeds rows (2026-11-13: "The input
            # is not a valid Base-64 string"): the row stays, and a later seed replaces it.
            stuck = not ok and "Base-64" in r.text
            out.append(
                {**row, "deleted": ok, "status": 200 if ok else "stuck" if stuck else r.status_code}
            )
            if not ok:
                left.append(row)
    LEDGER.write_text(json.dumps(left), encoding="utf-8")
    return out


async def _masters() -> tuple[set[str], dict[str, set[str]]]:
    accounts, departments = await base._carmen(mapping.masters, base.TOKEN)
    return {a["code"] for a in accounts}, {
        d["code"]: set(d["allowed_accounts"]) for d in departments
    }


async def picks() -> list[dict]:
    """Every parked day of the test tenants: its open keys, and any AI pick Carmen would refuse
    (an account not in the chart, or a pair the department does not allow)."""
    accs, depts = await _masters()
    out = []
    for d in await base._dump():
        p = d["payload"] or {}
        if d["status"] != "pending_review":
            continue
        bad = []
        for key, g in (p.get("guessed") or {}).items():
            dept, acc = g.get("dept"), g.get("acc")
            if not (dept and acc):
                continue
            allowed = depts.get(dept)
            if acc not in accs or dept not in depts or (allowed and acc not in allowed):
                bad.append(f"{key}: {dept}/{acc}")
        out.append(
            {
                "bu": d["bu"],
                "event_id": d["event_id"],
                "missing": len(p.get("missing") or []),
                "ai": len(p.get("ai") or []),
                "bad": bad,
                "ai_retries": p.get("ai_retries"),
            }
        )
    return out


async def restricted() -> dict:
    """A department whose DefaultAccount limits it, with what it allows (the review's filter)."""
    _, depts = await _masters()
    code = next((c for c, a in sorted(depts.items()) if 0 < len(a) < 40), None)
    return {"dept": code, "allowed": sorted(depts.get(code) or [])}


async def blank_one(event_id: str) -> dict:
    """Make one AI pick unusable and the last ask two hours old, as if the AI had left a row
    blank: the next sweep asks again for it (decision-log #57)."""
    async with base.async_session() as db:
        tenants = await base._tenant_ids(db)
        e = (
            (
                await db.execute(
                    select(base.PmsEvent).where(
                        base.PmsEvent.event_id == event_id,
                        base.PmsEvent.tenant_id.in_(list(tenants)),
                    )
                )
            )
            .scalars()
            .first()
        )
        p = dict(e.review_payload or {})
        guessed = dict(p.get("guessed") or {})
        key = next(k for k in p.get("ai") or [] if guessed.get(k, {}).get("acc"))
        guessed[key] = {**guessed[key], "acc": None}
        p["guessed"] = guessed
        p["ai"] = [k for k in p["ai"] if k != key]
        p["missing"] = [*(p.get("missing") or []), key]
        p["flags"] = ["mapping_missing"] + (["mapping_guessed"] if p["ai"] else [])
        p["ai_at"] = (datetime.now(UTC) - timedelta(hours=2)).isoformat()
        p["ai_retries"] = 0
        e.review_payload = p
        await db.commit()
        return {"key": key, "missing": len(p["missing"])}


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    args = sys.argv[2:]
    if cmd == "seed":
        flags = {"--again", "--keep"}
        pms, src, new = [a for a in args if a not in flags]
        print(json.dumps({"id": seed(pms, src, new, "--again" in args, "--keep" in args)}))
        return 0
    if cmd == "held":
        with _client() as h:
            print(
                json.dumps(
                    {d: [r.get("Id") for r in bank.held(h, base.URI, args[0], d)] for d in args[1:]}
                )
            )
        return 0
    if cmd == "unseed-day":
        print(json.dumps(unseed_day(args[0], args[1])))
        return 0
    if cmd == "unseed":
        out = unseed()
        print(json.dumps(out))
        return 0 if all(r["status"] in (200, "kept", "stuck") for r in out) else 1
    if cmd == "engine-calls":
        lines = ENGINE_LOG.read_text(encoding="utf-8").splitlines() if ENGINE_LOG.exists() else []
        print(json.dumps([json.loads(x) for x in lines if x.strip()]))
        return 0
    if cmd == "engine-reset":
        ENGINE_LOG.parent.mkdir(parents=True, exist_ok=True)
        ENGINE_LOG.write_text("", encoding="utf-8")
        print("[]")
        return 0
    if cmd == "picks":
        print(json.dumps(asyncio.run(picks()), ensure_ascii=False))
        return 0
    if cmd == "restricted":
        print(json.dumps(asyncio.run(restricted())))
        return 0
    if cmd == "blank-one":
        print(json.dumps(asyncio.run(blank_one(args[0])), ensure_ascii=False))
        return 0
    return p2.main()  # state, table, snapshot, restore, jv, void, backdate, posts-since, …


if __name__ == "__main__":
    sys.exit(main())
