"""Retention (decision-log #50) — the data half of retention_ui.mjs. LOCAL STACK ONLY.

    python scripts/qa/retention_e2e.py seed    # a 13-month-old scan + its charge, then the scrub
    python scripts/qa/retention_e2e.py check   # the scrubbed values, read back raw

Writes rows 13 months old and runs `fn_scrub_old_filenames()` — on the local Supabase stack
(127.0.0.1:54322), never the shared dev database: the function is not tenant-scoped. The
script sets DATABASE_URL itself and never reads backend/.env's.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import uuid
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]  # scripts/qa/this.py -> repo root
load_dotenv(ROOT / "backend" / ".env")
os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres"
sys.path.insert(0, str(ROOT / "backend"))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from sqlalchemy import text  # noqa: E402

from app.database import async_session  # noqa: E402

BU = "carmen"
DOC_NO = "E2E-RET-OLD"
OLD = "now() - interval '13 months'"


async def _tenant(db) -> uuid.UUID:
    tid = await db.scalar(text("select id from tenants where bu_code = :b"), {"b": BU})
    if tid is None:
        sys.exit(f"[abort] no tenant {BU!r} — sign in through the SSO link first")
    return tid


async def seed() -> None:
    async with async_session() as db:
        tid = await _tenant(db)
        task, card, charge = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        # Rerunnable: this script's own rows from an earlier run go first.
        old_tasks = (await db.execute(
            text("select task_id from credit_cards where tenant_id = :t and doc_no = :d"),
            {"t": tid, "d": DOC_NO})).scalars().all()
        await db.execute(text("delete from credit_cards where tenant_id = :t and doc_no = :d"), {"t": tid, "d": DOC_NO})
        await db.execute(text("delete from ocr_tasks where id = any(:ids)"), {"ids": list(old_tasks)})
        await db.execute(text(
            "delete from credit_ledger where tenant_id = :t and delta = -1 and balance_after = 29"
            " and created_at < now() - interval '12 months'"), {"t": tid})
        await db.execute(
            text(
                "insert into ocr_tasks (id, tenant_id, module_id, original_filename, status,"
                f" charged_docs, created_at, updated_at) values (:id, :t, 'credit_card_ocr',"
                f" 'statement_somchai_2025.pdf', 'completed', 1, {OLD}, {OLD})"
            ),
            {"id": task, "t": tid},
        )
        await db.execute(
            text(
                "insert into credit_cards (id, task_id, tenant_id, bank_code, doc_no, doc_date,"
                f" submitted_at, jv_no, created_at, updated_at) values (:id, :task, :t, 'SCB', :d,"
                f" ({OLD})::date, {OLD}, 'JV-RET-1', {OLD}, {OLD})"
            ),
            {"id": card, "task": task, "t": tid, "d": DOC_NO},
        )
        await db.execute(
            text(
                "insert into credit_ledger (id, tenant_id, delta, balance_after, reason, ref,"
                f" created_at, updated_at) values (:id, :t, -1, 29, 'consumption',"
                f" 'statement_somchai_2025.pdf', {OLD}, {OLD})"
            ),
            {"id": charge, "t": tid},
        )
        await db.execute(text("select fn_scrub_old_filenames()"))
        await db.commit()
    print(json.dumps({"tenant_id": str(tid), "task": str(task), "charge": str(charge)}))


async def check() -> int:
    async with async_session() as db:
        tid = await _tenant(db)
        task = (await db.execute(text(
            "select t.original_filename, t.error_message, t.charged_docs from ocr_tasks t"
            " join credit_cards c on c.task_id = t.id where c.tenant_id = :t and c.doc_no = :d"),
            {"t": tid, "d": DOC_NO})).one()
        ref = await db.scalar(text(
            "select ref from credit_ledger where tenant_id = :t and delta = -1 and balance_after = 29"
            " and created_at < now() - interval '12 months'"), {"t": tid})
    ok = tuple(task) == ("scrubbed", None, 1) and ref is None
    print(f"  task={tuple(task)} ledger_ref={ref} -> {'ok' if ok else 'NOT SCRUBBED'}")
    return 0 if ok else 1


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "seed":
        asyncio.run(seed())
    elif cmd == "check":
        sys.exit(asyncio.run(check()))
    else:
        sys.exit(__doc__)
