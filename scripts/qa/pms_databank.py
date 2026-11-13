"""PMS test days on Carmen dev: save a BU's Data Bank days, and load one back under a new date.

    python scripts/qa/pms_databank.py export --out <dir> Comanche HotelTime Cloudbeds
    python scripts/qa/pms_databank.py seed Comanche <dir>/Comanche/2024-09-06.json 2026-11-12
    python scripts/qa/pms_databank.py hook Comanche 2026-11-10 --bu carmencloud --api <backend>
    python scripts/qa/pms_databank.py delete Comanche 186 187

Dev Carmen holds only old days, and our processing asks for yesterday's (decision-log #55), so a
test needs a day loaded under a recent date. Carmen's answer (2026-11-13): re-date its days
ourselves. Our code never reads `FileData` (decision-log #54): Carmen's preview does, so a day
works only once it is in Carmen's Data Bank.

- `export` saves every Data Bank row of each PMS, one file per day (`<PMS>/<DocDate>.json`,
  the body `seed` posts back), and a `manifest.json` with each day's line count and codes. It
  only reads. Keep the files outside the repo: they are a hotel's revenue figures.
- `seed` posts one file under a new date and prints the new row's Id. Every date in it moves by
  the same number of days, so each PMS keeps its own shape (HotelTime's `Information.DocDate`
  is the morning after, Comanche spells `QueryDate`, the others `QueyDate`). It also takes a
  file holding only `FileData`, as Carmen sends them. Loading yesterday's date is enough: the
  06:00 sweep opens that day and re-checks it hourly. `--dry-run` prints the dates only.
- `hook` generates a new key for the PMS through Carmen's Settings API (it replaces the live
  one; not a switch-off, decision-log #56) and sends our hook for each date, for days other
  than yesterday.
- `delete` removes rows a test added. Clean up after testing.

Token: the BU's menu token, `CARMEN_AUTHORIZATION` (backend/.env or the environment, which
wins). Carmen fires its own hook about 10 s after each Add. Nothing is printed of the token or
the key.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(os.environ.get("PROBE_ENV_FILE") or ROOT / "backend" / ".env")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DEV = "https://dev.carmen4.com"
_DATE = re.compile(r"^(\d{4}-\d{2}-\d{2})")
_STAMP = re.compile(r"(\d{8})")


def _token() -> str:
    raw = os.environ.get("CARMEN_AUTHORIZATION", "").strip().strip('"')
    if not raw:
        sys.exit("CARMEN_AUTHORIZATION is not set (the BU's menu token)")
    return raw


def _bank(uri: str, pms: str) -> str:
    return f"{uri}/Carmen.API/api/interface/PMS/{pms}/Daily"


def _day(row: dict) -> str:
    return str(row.get("DocDate"))[:10]


def shifted(body: dict, new_day: str) -> dict:
    """The day's body with every date moved by the same number of days to `new_day`."""
    if "FileData" not in body:  # a file as Carmen sends it: FileData alone
        info = body.get("Information") or {}
        old = _DATE.match(str(info.get("DocDate") or "")).group(1)
        body = {
            "Source": "Daily",
            "DocDate": old,
            "Description": "PMS Daily Transaction Summary",
            "FileData": body,
        }
    delta = date.fromisoformat(new_day) - date.fromisoformat(_day(body))

    def move(value: str) -> str:
        m = _DATE.match(value)
        if not m:
            return value
        return (date.fromisoformat(m.group(1)) + delta).isoformat() + value[10:]

    out = json.loads(json.dumps(body))
    out["DocDate"] = new_day
    info = out["FileData"].get("Information") or {}
    for k, v in info.items():
        if isinstance(v, str):
            info[k] = move(v)
    name = (out.get("FileInfo") or {}).get("FileName")
    if name and (m := _STAMP.search(name)):  # HotelTime_20261001
        stamp = date(int(m[1][:4]), int(m[1][4:6]), int(m[1][6:])) + delta
        out["FileInfo"]["FileName"] = name.replace(m[1], stamp.strftime("%Y%m%d"))
    return out


def export(args, h: httpx.Client) -> None:
    out = Path(args.out)
    manifest: dict[str, dict] = {}
    for pms in args.pms:
        r = h.get(_bank(args.uri, pms))
        r.raise_for_status()
        rows = (r.json() if r.content.strip() else []) or []
        newest: dict[str, dict] = {}
        for row in rows if isinstance(rows, list) else [rows]:
            day = _day(row)
            if day not in newest or str(row.get("LastModified")) > str(
                newest[day].get("LastModified")
            ):
                newest[day] = row
        (out / pms).mkdir(parents=True, exist_ok=True)
        manifest[pms] = {}
        for day, row in sorted(newest.items()):
            body = {
                k: row[k]
                for k in ("Source", "DocDate", "Description", "FileInfo", "FileData")
                if k in row
            }
            body["DocDate"] = day
            (out / pms / f"{day}.json").write_text(
                json.dumps(body, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            data = row.get("FileData") or {}
            lines = next(
                (v for v in data.values() if isinstance(v, list) and v and "Amount" in v[0]), []
            )
            manifest[pms][day] = {
                "id": row.get("Id"),
                "lines": len(lines),
                "codes": sorted(
                    Counter(str(x.get("Code") or x.get("HT_Code") or "") for x in lines)
                ),
            }
        print(f"{pms}: {len(newest)} day(s) -> {out / pms}")
    (out / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def seed(args, h: httpx.Client) -> None:
    body = shifted(json.loads(Path(args.file).read_text(encoding="utf-8")), args.date)
    if args.dry_run:
        print(
            json.dumps(
                {
                    "DocDate": body["DocDate"],
                    "Information": body["FileData"].get("Information"),
                    "FileInfo": body.get("FileInfo"),
                },
                ensure_ascii=False,
            )
        )
        return
    have = h.get(f"{_bank(args.uri, args.pms)}/Date/{args.date}")
    if have.status_code == 200 and have.content.strip() and have.json():
        sys.exit(f"{args.pms} {args.date}: the Data Bank already holds this day; delete it first")
    r = h.post(_bank(args.uri, args.pms), json=body)
    b = r.json() if r.content.strip() else {}
    print(
        f"{args.pms} {args.date}: HTTP {r.status_code} Code={b.get('Code')} Id={b.get('InternalMessage')} {b.get('UserMessage') or ''}"
    )


def hook(args, h: httpx.Client) -> None:
    k = h.post(
        f"{args.api}/api/v1/carmen/pms/keys",
        json={"uri": args.uri, "bu": args.bu, "pms": args.pms.lower()},
    )
    key = (k.json() or {}).get("api_key") if k.status_code == 200 else None
    if not key:
        sys.exit(f"key: HTTP {k.status_code} {k.text[:200]}")
    for day in args.dates:
        r = h.post(
            f"{args.api}/api/v1/pms/events",
            headers={"Authorization": f"Bearer {key}"},
            json={
                "InterfaceType": "PMS",
                "InterfaceName": args.pms,
                "DocType": "Daily",
                "DocDate": day,
            },
        )
        print(f"hook {args.pms} {day}: HTTP {r.status_code} {r.text[:200]}")


def delete(args, h: httpx.Client) -> None:
    for i in args.ids:
        r = h.delete(f"{_bank(args.uri, args.pms)}/{i}")
        print(f"delete {args.pms} {i}: HTTP {r.status_code} {r.text[:200]}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--uri", default=DEV, help="Carmen host (default: dev)")
    sub = p.add_subparsers(dest="mode", required=True)
    e = sub.add_parser("export")
    e.add_argument("--out", required=True)
    e.add_argument("pms", nargs="+")
    s = sub.add_parser("seed")
    s.add_argument("pms")
    s.add_argument("file")
    s.add_argument("date")
    s.add_argument("--dry-run", action="store_true")
    k = sub.add_parser("hook")
    k.add_argument("pms")
    k.add_argument("dates", nargs="+")
    k.add_argument("--bu", required=True)
    k.add_argument("--api", required=True, help="our backend, e.g. the QA one")
    d = sub.add_parser("delete")
    d.add_argument("pms")
    d.add_argument("ids", nargs="+")
    args = p.parse_args()
    with httpx.Client(timeout=120, headers={"Authorization": _token()}) as h:
        {"export": export, "seed": seed, "hook": hook, "delete": delete}[args.mode](args, h)


if __name__ == "__main__":
    main()
