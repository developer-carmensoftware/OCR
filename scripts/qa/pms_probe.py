"""Will a PMS work for a BU? Ask Carmen what our processing would, and post nothing.

    python scripts/qa/pms_probe.py Comanche 2024-07-01
    python scripts/qa/pms_probe.py HotelTime 2026-10-06 --uri https://dev.carmen4.com

Run it before a new PMS (or a new BU) goes live. It reads, with the BU's menu token
(`CARMEN_AUTHORIZATION` in backend/.env), what `services/pms/process.py` reads:
1. the interface in `interfaceThirdParties` (REVENUE → GL), and where its days come from;
2. the mapping table: its key columns, and how many keys have no account;
3. the Data Bank day: the row a post would read;
4. Carmen's preview of the post (decision-log #54): the day's rows as the engine keys them,
   and which of them the table has no account for.

With a web JWT (`CARMEN_ADMIN_TOKEN`), it also reads the setting the menu token cannot
reach: Revenue's PostType and its balance account, and whether that account is in the BU's
chart. A balance account the chart lacks refuses every post (ask N).

Nothing here writes: the preview makes no JV and leaves the mapping table as it is.
Exit 1 when something would stop the day; WARN lines are worth a look but do not stop it.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(os.environ.get("PROBE_ENV_FILE") or ROOT / "backend" / ".env")
sys.path.insert(0, str(ROOT / "backend"))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from app.context import current_carmen_uri  # noqa: E402
from app.services.pms import carmen_config as cfg  # noqa: E402
from app.services.pms.process import _engine_body, _no_data  # noqa: E402
from app.services.shared import carmen  # noqa: E402

failed = False


def say(level: str, text: str) -> None:
    global failed
    failed |= level == "FAIL"
    print(f"{level:4} {text}")


def _jwt() -> str | None:
    raw = os.environ.get("CARMEN_ADMIN_TOKEN", "").strip().strip('"')
    if not raw:
        return None
    return raw if raw.lower().startswith("bearer ") else f"Bearer {raw}"


async def probe(name: str, day: str, uri: str, doc_type: str) -> None:
    token = os.environ.get("CARMEN_AUTHORIZATION", "").strip().strip('"')
    if not token:
        say("FAIL", "CARMEN_AUTHORIZATION (the BU's menu token) is not set")
        return
    current_carmen_uri.set(uri)
    try:
        await _probe(name, day, uri, doc_type, token)
    finally:
        await carmen.close_client()


async def _probe(name: str, day: str, uri: str, doc_type: str, token: str) -> None:
    interfaces = await carmen.get_interfaces(token)
    section = cfg.find_section(interfaces, "PMS", name)
    if section is None:
        say("FAIL", f"interfaceThirdParties has no PMS {name} posting REVENUE to GL")
        return
    row = next(
        i
        for i in interfaces
        if str(i.get("InterfaceName", "")).casefold() == name.casefold()
        and str(i.get("DocType", "")).upper() == cfg.POST_TYPE
    )
    partner = str(row.get("From") or "").casefold() == "partnerapi"
    say(
        "PASS",
        f"setting {section.setting_code}: From={row.get('From')} PostType={section.file_type}"
        + (" (no hook: our sweep opens its days)" if partner else ""),
    )

    current, columns = await carmen.get_pms_mapping(
        section.setting_code, section.post_type, token
    )
    keys = cfg.key_columns(columns)
    if not keys:
        say("FAIL", f"the mapping table names no key columns ({columns})")
        return
    table = cfg.table_of(current, keys)
    say(
        "PASS",
        f"mapping table: key {keys}, {len(current)} rows, "
        f"{len(cfg.blank_keys(current, keys))} without an account",
    )

    found = await carmen.get_databank_day("PMS", name, doc_type, day, token)
    newest = max(found or [{}], key=lambda d: str(d.get("LastModified") or ""))
    if found:
        say(
            "PASS",
            f"Data Bank {doc_type} {day}: {len(found)} row(s), the post reads Id {newest.get('Id')}",
        )
    elif partner:
        say(
            "WARN",
            f"Data Bank has no {doc_type} {day}: Carmen fetches a PartnerApi day itself",
        )
    else:
        say(
            "WARN",
            f"Data Bank has no {doc_type} {day}: the hook would wait for it (day_not_found)",
        )

    answer = await carmen.preview_pms_gl(
        section.post_type,
        _engine_body(section.setting_code, day, newest.get("Id")),
        token,
    )
    if words := _no_data(answer):
        say("WARN", f"Carmen's preview: {words} (the day waits: day_not_ready)")
        return
    rows = cfg.preview_rows(answer, keys)
    if rows is None:
        say("FAIL", f"Carmen's preview answered no table: {json.dumps(answer)[:300]}")
        return
    new = cfg.new_keys(rows, table)
    say(
        "PASS" if rows else "WARN",
        f"preview: {len(rows)} lines, {len(set(r['key'] for r in rows))} keys, "
        f"{len(new)} not in the mapping table (the review asks for those)",
    )
    for k in new[:10]:
        print(f"       new: {cfg.label(k)}")
    if len(new) > 10:
        print(f"       … and {len(new) - 10} more")

    jwt = _jwt()
    if jwt is None:
        say("WARN", "no CARMEN_ADMIN_TOKEN: Revenue's balance account not checked")
        return
    with httpx.Client(timeout=60) as c:
        r = c.get(
            f"{uri}/Carmen.API/api/interfacePost/Setting/GL",
            headers={"Authorization": jwt},
        )
    if r.status_code != 200:
        say(
            "WARN",
            f"the setting could not be read with the web JWT (HTTP {r.status_code})",
        )
        return
    settings = r.json()
    settings = (
        settings.get("Data", settings) if isinstance(settings, dict) else settings
    )
    setting = next((s for s in settings if s.get("Code") == section.setting_code), None)
    conf = (setting or {}).get("Configuration") or {}
    conf = json.loads(conf) if isinstance(conf, str) else conf
    revenue = (conf or {}).get("Revenue") or {}
    acc = revenue.get("AccCode")
    summary = str(revenue.get("PostType") or "").casefold() == "summary"
    chart = {
        a.get("AccCode")
        for a in (await carmen.get_account_codes(token)).get("Data") or []
    }
    balance = f"{revenue.get('DeptCode')}/{acc} {revenue.get('AccDesc') or ''}".strip()
    if summary and acc not in chart:
        say(
            "FAIL",
            f"Revenue posts a balance line to {balance}, which this BU's chart lacks",
        )
    else:
        say(
            "PASS",
            f"Revenue PostType={revenue.get('PostType')}, balance account {balance}"
            + ("" if acc in chart else " (not in the chart, unused while not Summary)"),
        )


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("pms", help="the hook's InterfaceName, e.g. Comanche")
    p.add_argument("day", help="a day the PMS has data for, YYYY-MM-DD")
    p.add_argument("--uri", default="https://dev.carmen4.com")
    p.add_argument("--doc-type", default="Daily", help="the Data Bank's DocType")
    a = p.parse_args()
    try:
        asyncio.run(probe(a.pms, a.day, a.uri.rstrip("/"), a.doc_type))
    except carmen.CarmenAPIError as exc:
        say("FAIL", f"Carmen refused: {exc.detail[:300]}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
