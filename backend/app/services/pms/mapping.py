"""What a PMS day's new rows should post to: the AI's pick, until a person approves it.

The BU's mapping lives in Carmen (decision-log #43): Carmen's engine posts a day by its own
mapping table, keyed the way the BU's PMS setting says (`Code`, `Description` for Comanche;
`HT_Code`, `HT_Description`, `Department` for HotelTime), and Carmen's own screen edits it.
The LLM runs only for the rows that table has no account for. It is shown the rows the BU has
already mapped, so a new code's tax and service rows follow the house pattern rather than a
guess. The pick travels in the day's
`review_payload` until a person approves it; Approve writes it into Carmen's table.
"""

import json
import logging
from collections import Counter

from app.constants import Module
from app.llm.client import call_text_llm
from app.services.credit_card.gl_suggestion import _dept_allowed_map, _pair_ok, _validate_codes
from app.services.shared import carmen
from app.utils.gl_filter import parse_default_account

logger = logging.getLogger(__name__)

# What a suggestion may post to. Expense accounts are never a PMS line's home; when a
# chart of accounts types nothing this way, every account is offered instead.
_POSTABLE_TYPES = {"income", "balancesheet"}
# Enough of the BU's own rows to show the pattern without crowding the prompt.
_EXAMPLES = 120
# The suggestion model thinks before it answers, and its thinking counts against max_tokens:
# on 2026-11-10 one answer used 7,579 of 8,000 and came back cut. A day's 78 keys need about
# 3,000 tokens of answer.
_MAX_TOKENS = 16000
# The same model also answered cut or empty with tokens to spare, several times that day, the
# old prompt as often as the new. A second try is cheap next to a reviewer picking 78
# accounts by hand.
_TRIES = 2


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


def _line(key: str, columns: list[str]) -> str:
    """One mapping key as the AI reads it: each non-blank value under its column's name
    (`HT_Code: 1115001 · HT_Description: 100 - ABF Revenue`). Every PMS keys differently."""
    return " · ".join(f"{c}: {v}" for c, v in zip(columns, json.loads(key), strict=False) if v)


def _raw(answer: dict, short: str, long: str):
    """One code of an answer, under either key shape the model uses (`acc` or `accountCode`)."""
    return answer.get(short) if answer.get(short) is not None else answer.get(long)


def _home_dept(acc: str, table: dict[str, dict], depts: set, allowed: dict) -> str | None:
    """The department an account in the chart goes with when the AI paired it with one that
    does not allow it, or with none (decision-log #57): the one this BU's own table uses most
    with that account, else GEN. None when neither is allowed."""
    used = Counter(
        m["dept"]
        for m in table.values()
        if m.get("acc") == acc and m.get("dept") in depts and _pair_ok(m["dept"], acc, allowed)
    )
    if used:
        return max(sorted(used), key=used.__getitem__)  # a tie goes to the lower code
    return "GEN" if "GEN" in depts and _pair_ok("GEN", acc, allowed) else None


def _checked(
    data: dict, ids: list[str], table: dict[str, dict], accs: set, depts: set, allowed: dict
) -> tuple[dict[str, dict], dict[str, tuple[str, str | None]]]:
    """The AI's answer as picks Carmen's table can take, and why each other line has none:
    `{id: (reason, the department it names)}`.

    Only codes Carmen's chart has survive (`_validate_codes`). A pair the department does not
    allow keeps its account and moves department (`_home_dept`) rather than losing it.
    """
    picks = _validate_codes(data, ids, accs, depts, allowed)
    refused: dict[str, tuple[str, str | None]] = {}
    for i in ids:
        answer = data.get(i) or {}
        acc, dept = _raw(answer, "acc", "accountCode"), _raw(answer, "dept", "deptCode")
        if not usable(picks[i]) and acc in accs:
            home = _home_dept(acc, table, depts, allowed)
            if home:
                picks[i] = {"dept": home, "acc": acc}
        if usable(picks[i]):
            continue
        if not answer:
            refused[i] = ("no answer", None)
        elif acc not in accs:
            refused[i] = (f"account {acc} is not in the chart", None)
        elif dept not in depts:
            refused[i] = (f"department {dept} is not in the list", None)
        else:
            refused[i] = (f"department {dept} does not allow account {acc}", dept)
    return picks, refused


def _prompt(
    items: list[dict],
    table: dict[str, dict],
    accounts: list[dict],
    departments: list[dict],
    columns: list[str],
    notes: str = "",
) -> str:
    examples = "\n".join(
        f"  {_line(k, columns)} -> {m['dept']}/{m['acc']} {m['name']}"
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
    return f"""You map a hotel's PMS night-audit lines to the hotel's Carmen general ledger.

Pick, for every new line, the GL department and account it posts to. Debit/credit is decided by
Carmen, not by you. Each line is one key of the hotel's PMS mapping: its values, each under the
column it belongs to ({", ".join(columns)}). Each PMS names and fills these columns its own way.

This hotel already maps these lines. Follow its pattern: the same kind of line goes to the same
kind of account and department, and a line's tax or service charge goes where the hotel sends
those of lines like it.
{examples or "  (none yet)"}

Departments (code name):
{dept_lines}

Accounts (code [type] name):
{acc_lines}
{notes}
New lines:
{json.dumps(items, ensure_ascii=False)}

Answer ONLY a JSON object: {{"<line id>": {{"dept": "<dept code>", "acc": "<account code>", "confidence": "high|medium|low", "why": "<max 12 words>"}}, ...}} with one entry per line id. Use only codes listed above."""


def _notes(refused: dict[str, tuple[str, str | None]], allowed: dict) -> str:
    """What the second ask is told: why each earlier answer could not be used, and what the
    departments it named allow."""
    named = sorted({d for _, d in refused.values() if d})
    text = "\nYour earlier answer for these lines could not be used:\n" + "\n".join(
        f"  {i}: {why}" for i, (why, _) in refused.items()
    )
    if named:
        text += "\nDepartments that allow only some accounts:\n" + "\n".join(
            f"  {d}: {', '.join(sorted(allowed[d]))}" for d in named
        )
    return text + "\n"


async def _ask(prompt: str) -> dict | None:
    return await call_text_llm(prompt, module_id=Module.PMS_INTERFACE, max_tokens=_MAX_TOKENS)


async def suggest(
    new: list[str],
    table: dict[str, dict],
    accounts: list[dict],
    departments: list[dict],
    columns: list[str],
) -> dict[str, dict]:
    """key → {"dept", "acc", "confidence", "why"} for each new key; {} when the LLM fails.

    The AI sees each key under the BU's own column names, and the rows the BU has already
    mapped, and nothing else of the day: no amounts (user decision 2026-11-10, decision-log
    #54). Carmen's preview gives none, and the BU's own pattern is what decides a line's home.
    Only codes Carmen's chart of accounts actually has survive (`_checked`), so a
    hallucinated account never reaches the review as if it were real.

    The lines still without a pick after that are asked once more, alone, told why their
    answer was refused (decision-log #57). What is still blank is the person's to pick, and
    the sweep asks again later (`process._resuggest_blank_days`).
    """
    if not new:
        return {}
    items = [{"id": f"L{i}", "line": _line(key, columns)} for i, key in enumerate(new, 1)]
    data = None
    for _ in range(_TRIES):
        data = await _ask(_prompt(items, table, accounts, departments, columns))
        if data:
            break
    if not data:
        logger.warning("[pms] No usable suggestion for %d new row(s)", len(new))
        return {}
    ids = [it["id"] for it in items]
    accs, depts = {a["code"] for a in accounts}, {d["code"] for d in departments}
    allowed = _dept_allowed_map(departments)
    answers = dict(data)
    picks, refused = _checked(answers, ids, table, accs, depts, allowed)
    if refused:
        blank = [it for it in items if it["id"] in refused]
        again = (
            await _ask(
                _prompt(blank, table, accounts, departments, columns, _notes(refused, allowed))
            )
            or {}
        )
        more, still = _checked(again, list(refused), table, accs, depts, allowed)
        for i, pick in more.items():
            if usable(pick):
                picks[i], answers[i] = pick, again[i]
        if still:
            logger.info("[pms] %d of %d new row(s) left for a person", len(still), len(new))
    out = {}
    for key, item_id in zip(new, ids, strict=True):
        raw = answers.get(item_id) or {}
        out[key] = {
            "dept": picks[item_id].get("dept"),
            "acc": picks[item_id].get("acc"),
            "confidence": str(raw.get("confidence") or "low")[:10],
            "why": str(raw.get("why") or "")[:120],
        }
    return out
