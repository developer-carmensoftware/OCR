"""What each PMS code posts to, for one BU: the saved rules and the AI's picks for new codes.

Rules are written by the review's Approve and read by every later day, so the LLM runs
only when a day brings a code this BU has never approved (CA-119 comment 11861). The pick
travels in the day's `review_payload` until a person approves it — the same contract as
the email review's GL rules, where pressing Approve is what makes the machine's guess the
BU's rule.
"""

import json
import logging
import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import Module
from app.llm.client import call_text_llm
from app.models.pms import PmsCodeMapping
from app.services.credit_card.gl_suggestion import _dept_allowed_map, _validate_codes
from app.services.pms import day as pms_day
from app.services.shared import carmen
from app.utils.gl_filter import parse_default_account

logger = logging.getLogger(__name__)

# What a suggestion may post to. Expense accounts are never a PMS line's home; when a
# chart of accounts types nothing this way, every account is offered instead.
_POSTABLE_TYPES = {"income", "balancesheet"}


async def saved(db: AsyncSession, tenant_id: uuid.UUID, interface: str) -> dict[str, dict]:
    """key → {"dept", "acc"} for every rule this BU has approved for this interface."""
    result = await db.execute(
        select(PmsCodeMapping).where(
            PmsCodeMapping.tenant_id == tenant_id,
            PmsCodeMapping.interface_name == interface,
            PmsCodeMapping.deleted_at.is_(None),
        )
    )
    return {m.code_key: {"dept": m.dept_code, "acc": m.acc_code} for m in result.scalars().all()}


async def save(
    db: AsyncSession, tenant_id: uuid.UUID, interface: str, picks: dict[str, dict]
) -> None:
    """Write approved picks (`{key: {"dept", "acc", "source"}}`), replacing any old rule.

    The caller commits. A replaced rule is soft-deleted rather than edited in place, so the
    unique key stays one live row per code and the old answer stays on record.
    """
    if not picks:
        return
    result = await db.execute(
        select(PmsCodeMapping).where(
            PmsCodeMapping.tenant_id == tenant_id,
            PmsCodeMapping.interface_name == interface,
            PmsCodeMapping.code_key.in_(list(picks)),
            PmsCodeMapping.deleted_at.is_(None),
        )
    )
    now = datetime.now(UTC)
    for old in result.scalars().all():
        old.deleted_at = now
    await db.flush()
    for key, p in picks.items():
        db.add(
            PmsCodeMapping(
                tenant_id=tenant_id,
                interface_name=interface,
                code_key=key,
                dept_code=p["dept"],
                acc_code=p["acc"],
                source=p.get("source") or "user",
            )
        )


async def masters(carmen_token: str) -> tuple[list[dict], list[dict]]:
    """This BU's Carmen accounts and departments, in the shape the GL suggesters take."""
    accounts_raw = await carmen.get_account_codes(carmen_token)
    depts_raw = await carmen.get_departments(carmen_token)
    accounts = [
        {
            "code": a["AccCode"],
            "name": " · ".join(filter(None, (a.get("Description"), a.get("Description2")))),
            "type": (a.get("Type") or "").lower(),
        }
        for a in (accounts_raw.get("Data") or [])
        if a.get("AccCode") and a.get("AccCode") != "AccCode"
    ]
    departments = [
        {
            "code": d["DeptCode"],
            "name": d.get("Description") or "",
            "allowed_accounts": sorted(parse_default_account(d.get("DefaultAccount"))),
        }
        for d in (depts_raw.get("Data") or [])
        if d.get("DeptCode") and d.get("DeptCode") != "CodeDep"
    ]
    return accounts, departments


def _items(new_keys: list[str], rows: list[dict]) -> list[dict]:
    """One prompt line per key: what kind of line it is and how it usually behaves."""
    out = []
    for i, key in enumerate(new_keys, 1):
        if key == pms_day.VAT_RULE:
            out.append(
                {"id": f"L{i}", "type": "Tax", "description": "Output VAT on every revenue line"}
            )
            continue
        if key == pms_day.SVC_RULE:
            out.append(
                {
                    "id": f"L{i}",
                    "type": "Service",
                    "description": "Service charge on every revenue line",
                }
            )
            continue
        mine = [r for r in rows if pms_day.key_of(r) == key]
        amounts = [Decimal(r["amount"]) for r in mine]
        out.append(
            {
                "id": f"L{i}",
                "type": key.split("|", 1)[0],
                "code": pms_day.code_label(key),
                "description": mine[0]["desc"] if mine else "",
                "usually_negative": sum(1 for a in amounts if a < 0) > len(amounts) / 2,
            }
        )
    return out


async def suggest(
    new_keys: list[str], rows: list[dict], accounts: list[dict], departments: list[dict]
) -> dict[str, dict]:
    """key → {"dept", "acc", "confidence", "why"} from one LLM call; {} when it fails.

    Only codes Carmen's chart of accounts actually has survive (`_validate_codes`), so a
    hallucinated account never reaches the review as if it were real.
    """
    if not new_keys:
        return {}
    items = _items(new_keys, rows)
    postable = [a for a in accounts if a["type"] in _POSTABLE_TYPES] or accounts
    dept_lines = "\n".join(
        f"  {d['code']} {d['name']}" for d in sorted(departments, key=lambda d: d["code"])
    )
    acc_lines = "\n".join(
        f"  {a['code']} [{a['type']}] {a['name']}"
        for a in sorted(postable, key=lambda a: a["code"])
    )
    prompt = f"""You map a hotel's PMS night-audit lines (one JV per day) to the hotel's Carmen general ledger.

Pick, for every line, the GL department and account it should post to. Debit/credit is decided elsewhere.
Line types: Revenue = income charged to guests; Payment = how guests settled (cash, cards, transfer, city ledger, refunds);
Ledger = the guest-ledger and deposit-ledger control balances; Tax = output VAT; Service = service charge.

Departments (code name):
{dept_lines}

Accounts (code [type] name):
{acc_lines}

Lines:
{json.dumps(items, ensure_ascii=False)}

Answer ONLY a JSON object: {{"<line id>": {{"dept": "<dept code>", "acc": "<account code>", "confidence": "high|medium|low", "why": "<max 12 words>"}}, ...}} with one entry per line id. Use only codes listed above."""

    data = await call_text_llm(prompt, module_id=Module.PMS_INTERFACE, max_tokens=8000)
    if not data:
        logger.warning("[pms] No usable suggestion for %d new code(s)", len(new_keys))
        return {}
    ids = [it["id"] for it in items]
    valid = _validate_codes(
        data,
        ids,
        {a["code"] for a in accounts},
        {d["code"] for d in departments},
        _dept_allowed_map(departments),
    )
    out = {}
    for key, item_id in zip(new_keys, ids, strict=True):
        raw = data.get(item_id) or {}
        pick = valid.get(item_id) or {}
        out[key] = {
            "dept": pick.get("dept"),
            "acc": pick.get("acc"),
            "confidence": str(raw.get("confidence") or "low")[:10],
            "why": str(raw.get("why") or "")[:120],
        }
    return out
