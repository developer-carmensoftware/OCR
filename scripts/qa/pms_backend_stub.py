"""The branch backend for the PMS E2E suites, with Carmen's interface list switchable from a file.

    backend/venv/Scripts/python.exe scripts/qa/pms_backend_stub.py > %TEMP%/be8011.log 2>&1

Runs `app.main:app` on 127.0.0.1:8011 against LOCAL Supabase (127.0.0.1:54322), with
`carmen.get_interfaces` read from `.playwright-mcp/pms-pc/interfaces.json` on every call:

    missing, or {"mode": "real"}      Carmen's own answer (the default)
    {"mode": "list", "rows": [...]}   these rows, e.g. a PMS listed as `From: PartnerApi`
    {"mode": "500"}                   CarmenAPIError(500), as Carmen dev answered 2026-11-05

Dev Carmen lists no PMS as PartnerApi, so `pms_post_checks_ui.mjs` lists HotelTime as one to
exercise the sweep that opens such days (decision-log #52). Every other Carmen call is real.
Never use this outside a local test run: it replaces a function of the running app.
"""

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SWITCH = ROOT / ".playwright-mcp" / "pms-pc" / "interfaces.json"
sys.path.insert(0, str(ROOT / "backend"))
os.chdir(ROOT / "backend")
os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres"
os.environ["IMAP_HOST"] = ""

from app.services.shared import carmen  # noqa: E402

_real = carmen.get_interfaces


async def _switchable(token):
    mode = json.loads(SWITCH.read_text(encoding="utf-8")) if SWITCH.exists() else {}
    if mode.get("mode") == "list":
        return mode.get("rows") or []
    if mode.get("mode") == "500":
        raise carmen.CarmenAPIError(500, "HTTP 500: stubbed outage of interfaceThirdParties")
    return await _real(token)


carmen.get_interfaces = _switchable

import uvicorn  # noqa: E402

uvicorn.run("app.main:app", host="127.0.0.1", port=8011)
