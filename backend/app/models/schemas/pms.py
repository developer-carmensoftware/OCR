"""PMS interface (CA-93) — the webhook Carmen sends, and the admin key payloads.

Contract: docs/PMS_INTEGRATION.md.
"""

import re
from datetime import date
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator, model_validator

_HOOK_FIELDS = {f.lower(): f for f in ("InterfaceType", "InterfaceName", "DocType", "DocDate")}
_ISO_DATE = re.compile(r"\d{4}-\d{2}-\d{2}(?:[T ].*)?")


class PmsEventIn(BaseModel):
    """Carmen's hook, in Carmen's field names: which Data Bank row is ready.

    It carries no PMS data. The four fields name a row in Carmen's Data Bank, which
    processing reads back with `GET /api/interface/PMS/{name}/{docType}/Date/{docDate}`.

    Lenient where a sender's defaults differ and the meaning cannot: field names in any case
    (.NET's `PostAsJsonAsync` writes camelCase), `"pms"`, a datetime for the date. Strict
    where a guess could post the wrong day: `DocDate` must be an ISO date string.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    interface_type: Literal["PMS"] = Field(alias="InterfaceType")
    # No "/": it separates the parts of `key`, and two names must not make one key.
    interface_name: str = Field(
        alias="InterfaceName", min_length=1, max_length=40, pattern=r"^[^/]+$"
    )
    doc_type: str = Field(alias="DocType", min_length=1, max_length=30, pattern=r"^[^/]+$")
    doc_date: date = Field(alias="DocDate")

    @model_validator(mode="before")
    @classmethod
    def _names_in_any_case(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        return {
            _HOOK_FIELDS.get(k.lower(), k) if isinstance(k, str) else k: v for k, v in data.items()
        }

    @field_validator("interface_type", mode="before")
    @classmethod
    def _upper(cls, v: object) -> object:
        return v.strip().upper() if isinstance(v, str) else v

    @field_validator("doc_date", mode="before")
    @classmethod
    def _date_part(cls, v: object) -> object:
        # A string in ISO form only. Pydantic would read 20261007 or "1791331200" as unix
        # seconds and invent a day. The Data Bank writes "2026-10-07T00:00:00": the date
        # part is the day, whatever the time or offset after it.
        if not isinstance(v, str) or not _ISO_DATE.fullmatch(v.strip()):
            raise ValueError('DocDate must be an ISO date string, e.g. "2026-10-07"')
        return v.strip()[:10]

    @property
    def key(self) -> str:
        """One row per BU and Data Bank day: `PMS/Comanche/Daily/2026-10-07` (≤ 93 chars)."""
        return "/".join(
            (self.interface_type, self.interface_name, self.doc_type, self.doc_date.isoformat())
        )


class PmsEventOut(BaseModel):
    id: UUID
    duplicate: bool


class PmsKeyCreateIn(BaseModel):
    """A BU creating its own key on `#/pms`: the business unit comes from the session."""

    name: str = Field("PMS webhook", min_length=1, max_length=100)


class ApiKeyCreateIn(BaseModel):
    tenant_id: UUID
    name: str = Field("PMS webhook", min_length=1, max_length=100)


# ── Processing and review (CA-119) ─────────────────────────────────────────────────


class PmsPick(BaseModel):
    """The account a reviewer gave one of the day's new codes."""

    dept: str = Field(..., min_length=1, max_length=20)
    acc: str = Field(..., min_length=1, max_length=20)


class PmsNewCode(BaseModel):
    key: str
    code: str
    description: str
    type: str
    amount: str
    # The AI's pick, when it made a usable one.
    dept: str | None = None
    acc: str | None = None
    confidence: str | None = None
    why: str | None = None


class PmsTerm(BaseModel):
    type: str
    amount: str


class PmsDayOut(BaseModel):
    """One parked day, as the review modal reads it. Amounts are exact decimal strings,
    signed the way the JV posts them: + credit, − debit."""

    id: UUID
    interface: str
    doc_type: str
    doc_date: str
    reason_code: str | None = None
    error_message: str | None = None
    terms: list[PmsTerm]
    off: str
    codes: int
    # The BU's saved rules for the keys this day uses: key → {"dept", "acc"}.
    accounts: dict[str, dict[str, str]]
    new_codes: list[PmsNewCode]
    rows: list[dict[str, str]]


class PmsApproveIn(BaseModel):
    # key → the account for each of the day's new codes.
    mappings: dict[str, PmsPick] = Field(default_factory=dict)


class PmsApproveOut(BaseModel):
    jv_no: str


class PmsRejectIn(BaseModel):
    reason: str | None = Field(None, max_length=500)


class PmsSettingsIn(BaseModel):
    jv_prefix: str | None = Field(None, max_length=20)
    auto_post: bool = False


class PmsSettingsOut(BaseModel):
    jv_prefix: str | None
    auto_post: bool
    # Whether this BU has a Carmen credential stored; nothing can be read or posted without.
    has_credential: bool


class PmsCredentialIn(BaseModel):
    """The Carmen token #/pms was opened with — stored as this BU's posting credential."""

    token: SecretStr = Field(..., min_length=1, max_length=4096)
