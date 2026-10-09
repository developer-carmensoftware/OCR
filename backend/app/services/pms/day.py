"""One PMS Data Bank day as numbers: its rows, the balance check, the JV lines it makes.

Pure: no database, no HTTP. Ported from the CA-119 prototype, which balanced every one of
the 71 real Comanche days on Carmen's dev Data Bank once mapped.

A day is `FileData.Transaction[]`. Each revenue code arrives as three rows — net,
"<desc> - SERVICE" and "<desc> - VAT" — and the two ledgers arrive keyed by `Code`
(`Guest Ledger`, `Deposit Ledger`) under a TransactionType that was not stable in early
data. The day balances when Revenue + Payment − Guest Ledger + Deposit Ledger = 0, and
the JV is every amount × +1 except Guest Ledger × −1: positive credits, negative debits.
"""

from collections import defaultdict
from decimal import Decimal, InvalidOperation

LEDGERS = ("Guest Ledger", "Deposit Ledger")
# The four kinds a day's balance is shown by, in the order the review shows them.
TERMS = ("Revenue", "Payment", "Guest Ledger", "Deposit Ledger")
# Every revenue line's tax and service rows follow one rule each, not one mapping per code.
VAT_RULE = "VAT|*"
SVC_RULE = "SVC|*"
RULES = (VAT_RULE, SVC_RULE)
CENT = Decimal("0.01")


class UnreadableDay(ValueError):
    """The Data Bank answered, but not with a day this code can read."""


def rows_of(file_data: dict) -> list[dict]:
    """`FileData` → the rows processing reads, amounts kept as exact decimal strings.

    Statistic and Information (occupancy and the like) are not read: nothing on the JV or
    the review needs them, so they are not carried into `review_payload` either.
    """
    if not isinstance(file_data, dict):
        raise UnreadableDay("FileData is not an object")
    out = []
    for t in file_data.get("Transaction") or []:
        try:
            amount = Decimal(str(t.get("Amount") or "0"))
        except (InvalidOperation, AttributeError) as exc:
            raise UnreadableDay(f"amount {t.get('Amount')!r} is not a number") from exc
        out.append(
            {
                "type": str(t.get("TransactionType") or ""),
                "code": str(t.get("Code") or ""),
                "desc": str(t.get("Description") or ""),
                "amount": str(amount),
            }
        )
    return out


def key_of(row: dict) -> str:
    """The mapping key a row posts through. Never the description, which drifts."""
    if row["code"] in LEDGERS:
        return f"Ledger|{row['code']}"
    if row["desc"].endswith(" - VAT"):
        return VAT_RULE
    if row["desc"].endswith(" - SERVICE"):
        return SVC_RULE
    return f"{row['type']}|{row['code']}"


def code_label(key: str) -> str:
    """What a reviewer calls a key: the PMS code (`103`), or the rule's suffix."""
    return {VAT_RULE: "- VAT", SVC_RULE: "- SERVICE"}.get(key) or key.split("|", 1)[1]


def _signed(row: dict) -> Decimal:
    return Decimal(row["amount"]) * (-1 if row["code"] == "Guest Ledger" else 1)


def keys(rows: list[dict]) -> list[str]:
    """Every distinct key the day uses, in first-seen order (rules included)."""
    return list(dict.fromkeys(key_of(r) for r in rows))


def terms(rows: list[dict]) -> dict[str, Decimal]:
    """Net per kind of row, signed the way the JV posts it (Guest Ledger reversed)."""
    out: dict[str, Decimal] = defaultdict(Decimal)
    for r in rows:
        out[r["code"] if r["code"] in LEDGERS else r["type"]] += _signed(r)
    return dict(out)


def off_by(rows: list[dict]) -> Decimal:
    """How far the day is from balancing; zero when debit equals credit."""
    return sum((_signed(r) for r in rows), Decimal(0)).quantize(CENT)


def jv_lines(rows: list[dict], accounts: dict[str, dict]) -> list[dict]:
    """The JV, one line per (dept, account): `{"dept", "acc", "amount"}`, + credit / − debit.

    `accounts` maps a key to `{"dept", "acc"}`; a row whose key has no account is left out,
    which is why a day with `mapping_missing` never posts.
    """
    agg: dict[tuple[str, str], Decimal] = defaultdict(Decimal)
    for r in rows:
        a = accounts.get(key_of(r)) or {}
        if a.get("dept") and a.get("acc"):
            agg[(a["dept"], a["acc"])] += _signed(r)
    lines = [
        {"dept": d, "acc": a, "amount": v.quantize(CENT)}
        for (d, a), v in agg.items()
        if v.quantize(CENT)
    ]
    # Debits first, then credits, each by account — the order a person reads a JV in.
    return sorted(lines, key=lambda line: (line["amount"] > 0, line["acc"]))


def flags(rows: list[dict], saved: dict[str, dict], guessed: dict[str, dict]) -> list[str]:
    """Why a person must look before this day posts. Empty means it may post unattended.

    The names are the email queue's (`QueueRow.reasonFor` reads them): a key with no saved
    rule and no usable AI pick is `mapping_missing`, one only the AI has picked is
    `mapping_guessed`, a day that does not balance is `unbalanced`.
    """
    out = []
    unsaved = [k for k in keys(rows) if k not in saved]
    if any(not usable(guessed.get(k)) for k in unsaved):
        out.append("mapping_missing")
    if off_by(rows):
        out.append("unbalanced")
    if any(usable(guessed.get(k)) for k in unsaved):
        out.append("mapping_guessed")
    return out


def usable(pick: dict | None) -> bool:
    """A pick a JV line can post to: both a department and an account."""
    return bool(pick and pick.get("dept") and pick.get("acc"))
