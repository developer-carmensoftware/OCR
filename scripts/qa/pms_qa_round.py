"""A QA round of the PMS interface on carmencloud (Carmen dev): keep where Carmen stands before the
round, and put it back after.

    python scripts/qa/pms_qa_round.py baseline [--force]   # keep the 4 mapping tables + the highest JV seq
    python scripts/qa/pms_qa_round.py status               # tables vs the baseline; PMS JVs live since
    python scripts/qa/pms_qa_round.py reset [--dry-run]    # void those JVs, put the tables back

A tester's Approve writes the new rows' accounts into Carmen's mapping table and posts a JV. After
that, the same codes come back "Ready to post", so a second round needs the tables put back and the
round's JVs voided. Only JVs numbered above the baseline whose source is a PMS one (CMRV Comanche,
HTRV HotelTime, CLBS Cloudbeds, GLRV Guestline) are voided; nothing else is touched.

Tokens, from the environment or backend/.env: CARMEN_AUTHORIZATION (carmencloud's menu token: the
mapping tables) and CARMEN_ADMIN_TOKEN (a web JWT: the JVs). Nothing is printed of either. The
baseline is kept in .playwright-mcp/pms-qa-round/baseline.json (gitignored).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "backend" / ".env")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DEV = "https://dev.carmen4.com/Carmen.API/api"
SETTINGS = ("Comanche.PMS", "Hoteltime.PMS", "Cloudbeds.PMS", "GuestlinePMS.PMS")
PMS_SOURCES = {"CMRV", "HTRV", "CLBS", "GLRV"}
BASELINE = ROOT / ".playwright-mcp" / "pms-qa-round" / "baseline.json"
_SKIP = {"OriginalRow", "RowState"}


def _token(name: str) -> str:
    raw = os.environ.get(name, "").strip().strip('"')
    if not raw:
        sys.exit(f"{name} is not set")
    return raw


def _jwt() -> str:
    raw = _token("CARMEN_ADMIN_TOKEN")
    return raw if raw.lower().startswith("bearer ") else f"Bearer {raw}"


def _table(h: httpx.Client, code: str) -> list[dict]:
    r = h.get(f"{DEV}/interface/interfacePost/mapping/{code}/REVENUE/GL")
    r.raise_for_status()
    return [{k: v for k, v in row.items() if k not in _SKIP} for row in r.json().get("Rows") or []]


def _rows(rows: list[dict]) -> list[tuple]:
    """A table as compared: every column but AccDesc (Carmen fills it from the account)."""
    return sorted(
        tuple(sorted((k, str(v or "")) for k, v in r.items() if k != "AccDesc")) for r in rows
    )


def _jvs(h: httpx.Client) -> list[dict]:
    r = h.post(
        f"{DEV}/glJv/search",
        json={"Limit": 5000, "Page": 1, "OrderBy": {"JvhSeq": "desc"}, "WhereGroupList": []},
    )
    r.raise_for_status()
    return r.json().get("Data") or []


def _round_jvs(h: httpx.Client, base: dict) -> list[dict]:
    return [
        j
        for j in _jvs(h)
        if j["JvhSeq"] > base["max_seq"]
        and j.get("Status") != "Void"
        and j.get("JvhSource") in PMS_SOURCES
    ]


def _blank(rows: list[dict]) -> int:
    return sum(1 for r in rows if not str(r.get("AccCode") or "").strip())


def baseline(force: bool) -> int:
    if BASELINE.exists() and not force:
        print(f"a baseline exists ({BASELINE}); --force replaces it")
        return 1
    with (
        httpx.Client(timeout=120, headers={"Authorization": _token("CARMEN_AUTHORIZATION")}) as m,
        httpx.Client(timeout=180, headers={"Authorization": _jwt()}) as j,
    ):
        tables = {code: _table(m, code) for code in SETTINGS}
        max_seq = max((x["JvhSeq"] for x in _jvs(j)), default=0)
    BASELINE.parent.mkdir(parents=True, exist_ok=True)
    BASELINE.write_text(
        json.dumps(
            {"taken_at": datetime.now(UTC).isoformat(), "max_seq": max_seq, "tables": tables},
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    for code, rows in tables.items():
        print(f"kept {code}: {len(rows)} rows, {_blank(rows)} without an account")
    print(f"JVs above {max_seq} will count as the round's")
    return 0


def _load() -> dict:
    if not BASELINE.exists():
        sys.exit("no baseline yet: run `baseline` before the round")
    return json.loads(BASELINE.read_text(encoding="utf-8"))


def status() -> int:
    base = _load()
    with (
        httpx.Client(timeout=120, headers={"Authorization": _token("CARMEN_AUTHORIZATION")}) as m,
        httpx.Client(timeout=180, headers={"Authorization": _jwt()}) as j,
    ):
        changed = 0
        for code, kept in base["tables"].items():
            now = _table(m, code)
            same = _rows(now) == _rows(kept)
            changed += not same
            print(
                f"{'same' if same else 'CHANGED'} {code}: {len(now)} rows, {_blank(now)} without an account "
                f"(baseline {len(kept)}/{_blank(kept)})"
            )
        live = _round_jvs(j, base)
    print(f"PMS JVs live since the baseline (seq > {base['max_seq']}): {len(live)}")
    for x in live:
        print(f"  JV {x['JvhSeq']} {str(x.get('JvhDate'))[:10]} {x.get('JvhSource')}")
    return 0 if not changed and not live else 1


def reset(dry_run: bool) -> int:
    base = _load()
    ok = True
    with (
        httpx.Client(timeout=120, headers={"Authorization": _token("CARMEN_AUTHORIZATION")}) as m,
        httpx.Client(timeout=180, headers={"Authorization": _jwt()}) as j,
    ):
        for x in _round_jvs(j, base):
            label = f"JV {x['JvhSeq']} {str(x.get('JvhDate'))[:10]} {x.get('JvhSource')}"
            if dry_run:
                print(f"would void {label}")
                continue
            for attempt in (1, 2):  # Carmen dev sometimes answers a void with an error page once
                r = j.delete(
                    f"{DEV}/glJv/{x['JvhSeq']}",
                    params={"user": "admin", "voidRemark": "PMS QA round reset"},
                )
                done = r.status_code == 200 and '"Code":0' in r.text
                if done or attempt == 2:
                    break
                time.sleep(3)
            ok &= done
            print(f"{'voided' if done else 'FAILED to void'} {label}")
        for code, kept in base["tables"].items():
            if _rows(_table(m, code)) == _rows(kept):
                continue
            if dry_run:
                print(f"would put back {code} ({len(kept)} rows)")
                continue
            # The PUT replaces the whole table: the baseline's rows are the table.
            put = m.put(f"{DEV}/interface/interfacePost/mapping/{code}/REVENUE/GL", json=kept)
            back = _rows(_table(m, code)) == _rows(kept)
            ok &= back
            print(f"{'put back' if back else 'FAILED to put back'} {code} (HTTP {put.status_code})")
    return 0 if ok else 1


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("baseline")
    b.add_argument("--force", action="store_true")
    sub.add_parser("status")
    r = sub.add_parser("reset")
    r.add_argument("--dry-run", action="store_true")
    a = p.parse_args()
    if a.cmd == "baseline":
        return baseline(a.force)
    if a.cmd == "status":
        return status()
    return reset(a.dry_run)


if __name__ == "__main__":
    sys.exit(main())
