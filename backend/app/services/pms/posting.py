"""The one place a PMS day becomes a Carmen JV.

**Provisional path (decision-log #42).** Which Carmen endpoint PMS JVs belong on is still
open with Carmen (CA-116): our `/gljv`, the same call the credit-card wizard and the email
review make, or Carmen's `interfacePostGL`. `post_day` uses `/gljv` for now and is the only
function that changes when Carmen answers.
"""

from datetime import date
from decimal import Decimal

from app.services.credit_card.jv import _jvh_date
from app.services.shared import carmen


class PostRefused(Exception):
    """Carmen answered, and the answer was no (`Code != 0`). Its own words are the message."""


def description(interface: str, doc_type: str, doc_date: date) -> str:
    """What the JV says it is: `Comanche Daily 05/09/2024`."""
    return f"{interface} {doc_type} {doc_date:%d/%m/%Y}"


def build_payload(lines: list[dict], *, doc_date: date, prefix: str, text: str) -> dict:
    """`day.jv_lines` → Carmen's GLJV body, the shape `credit_card.jv.build_gljv_payload` posts."""

    def money(v: Decimal) -> float:
        return float(abs(v))

    return {
        "JvhSeq": -1,
        "JvhDate": _jvh_date(f"{doc_date:%d/%m/%Y}"),
        "Prefix": prefix,
        "JvhNo": "Auto",
        "JvhSource": "PMS",
        "Status": "Draft",
        "Description": text,
        "Detail": [
            {
                "JvhSeq": -1,
                "JvdSeq": -1,
                "DeptCode": line["dept"],
                "AccCode": line["acc"],
                "Description": text,
                "CurCode": "THB",
                "CurRate": 1,
                "CrAmount": money(line["amount"]) if line["amount"] > 0 else 0,
                "CrBase": money(line["amount"]) if line["amount"] > 0 else 0,
                "DrAmount": money(line["amount"]) if line["amount"] < 0 else 0,
                "DrBase": money(line["amount"]) if line["amount"] < 0 else 0,
                "DimList": {},
            }
            for line in lines
        ],
        "DimHList": {"Dim": []},
        # Machine-posted, from the PMS interface — told apart from a wizard or email JV.
        "UserModified": "OCR-PMS",
    }


async def post_day(payload: dict, carmen_token: str) -> str:
    """Post the JV and return its number. Raises `PostRefused`, or `carmen.CarmenAPIError`
    when Carmen could not be reached or refused the credential."""
    result = await carmen.post_gljv(payload, carmen_token)
    if not isinstance(result, dict) or result.get("Code") != 0:
        verdict = (
            (result.get("UserMessage") or result.get("Message") or result.get("InternalMessage"))
            if isinstance(result, dict)
            else None
        )
        raise PostRefused(str(verdict or f"Carmen answered {result!r}")[:500])
    return str(result.get("InternalMessage") or "")
