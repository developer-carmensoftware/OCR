"""What a PMS day's new rows should post to: the AI's pick, until a person approves it.

The BU's mapping lives in Carmen (decision-log #43): Carmen's engine posts a day by its own
mapping table, keyed the way the BU's PMS setting says (`[Code][Description]` for Comanche),
and Carmen's own screen edits it. The LLM runs only for the rows that table has no account
for, and it is shown the rows the BU has already mapped, so a new code's tax and service
rows follow the house pattern rather than a guess. The pick travels in the day's
`review_payload` until a person approves it; Approve writes it into Carmen's table.
"""

import json
import logging

from app.constants import Module
from app.llm.client import call_text_llm
from app.services.credit_card.gl_suggestion import _dept_allowed_map, _validate_codes
from app.services.pms import carmen_config as cfg
from app.services.shared import carmen
from app.utils.gl_filter import parse_default_account

logger = logging.getLogger(__name__)

# What a suggestion may post to. Expense accounts are never a PMS line's home; when a
# chart of accounts types nothing this way, every account is offered instead.
_POSTABLE_TYPES = {"income", "balancesheet"}
# Enough of the BU's own rows to show the pattern without crowding the prompt.
_EXAMPLES = 120


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


def usable(pick: dict | None) -> bool:
    """A pick Carmen's table can take: both a department and an account."""
    return bool(pick and pick.get("dept") and pick.get("acc"))


def open_keys(new: list[str], guessed: dict[str, dict]) -> dict:
    """The new keys still waiting on a person: `missing` (no account anywhere) and `ai`
    (only the AI's). The queue row names their codes, so the reviewer knows which before
    opening."""
    return {
        "missing": [k for k in new if not usable(guessed.get(k))],
        "ai": [k for k in new if usable(guessed.get(k))],
    }


def flags(new: list[str], guessed: dict[str, dict]) -> list[str]:
    """Why a person must look before this day posts. Empty means it may post unattended.

    The names are the email queue's (`QueueRow.reasonFor` reads them). A day's balance is
    not among them: debit, credit and the counter line are Carmen's engine's to decide.
    """
    still = open_keys(new, guessed)
    return (["mapping_missing"] if still["missing"] else []) + (
        ["mapping_guessed"] if still["ai"] else []
    )


async def suggest(
    new: list[str],
    rows: list[dict],
    table: dict[str, dict],
    accounts: list[dict],
    departments: list[dict],
) -> dict[str, dict]:
    """key → {"dept", "acc", "confidence", "why"} for each new key, from one LLM call;
    {} when it fails.

    Only codes Carmen's chart of accounts actually has survive (`_validate_codes`), so a
    hallucinated account never reaches the review as if it were real.
    """
    if not new:
        return {}
    amounts: dict[str, list[str]] = {}
    for r in rows:
        amounts.setdefault(r["key"], []).append(r["amount"])
    items = [
        {"id": f"L{i}", "line": cfg.label(key), "amounts": amounts.get(key, [])}
        for i, key in enumerate(new, 1)
    ]
    examples = "\n".join(
        f"  {cfg.label(k)} -> {m['dept']}/{m['acc']} {m['name']}"
        for k, m in list(table.items())[:_EXAMPLES]
    )
    postable = [a for a in accounts if a["type"] in _POSTABLE_TYPES] or accounts
    dept_lines = "\n".join(
        f"  {d['code']} {d['name']}" for d in sorted(departments, key=lambda d: d["code"])
    )
    acc_lines = "\n".join(
        f"  {a['code']} [{a['type']}] {a['name']}"
        for a in sorted(postable, key=lambda a: a["code"])
    )
    prompt = f"""You map a hotel's PMS night-audit lines to the hotel's Carmen general ledger.

Pick, for every new line, the GL department and account it posts to. Debit/credit is decided by
Carmen, not by you. Each line is "<PMS code> · <description>"; lines ending " - VAT" and
" - SERVICE" are the tax and service charge of the line before them.

This hotel already maps these lines. Follow its pattern: the same kind of line goes to the same
kind of account and department, and tax and service lines follow the ones already mapped.
{examples or "  (none yet)"}

Departments (code name):
{dept_lines}

Accounts (code [type] name):
{acc_lines}

New lines:
{json.dumps(items, ensure_ascii=False)}

Answer ONLY a JSON object: {{"<line id>": {{"dept": "<dept code>", "acc": "<account code>", "confidence": "high|medium|low", "why": "<max 12 words>"}}, ...}} with one entry per line id. Use only codes listed above."""

    data = await call_text_llm(prompt, module_id=Module.PMS_INTERFACE, max_tokens=8000)
    if not data:
        logger.warning("[pms] No usable suggestion for %d new row(s)", len(new))
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
    for key, item_id in zip(new, ids, strict=True):
        raw = data.get(item_id) or {}
        pick = valid.get(item_id) or {}
        out[key] = {
            "dept": pick.get("dept"),
            "acc": pick.get("acc"),
            "confidence": str(raw.get("confidence") or "low")[:10],
            "why": str(raw.get("why") or "")[:120],
        }
    return out
