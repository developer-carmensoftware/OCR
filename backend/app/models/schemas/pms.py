"""PMS interface (CA-93) — the webhook Carmen sends, and the admin key payloads.

Contract: docs/PMS_INTEGRATION.md.
"""

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PmsEventIn(BaseModel):
    """Carmen's hook, in Carmen's field names: which Data Bank row is ready.

    It carries no PMS data. The four fields name a row in Carmen's Data Bank, which
    processing reads back with `GET /api/interface/PMS/{name}/{docType}/Date/{docDate}`.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    interface_type: Literal["PMS"] = Field(alias="InterfaceType")
    # No "/": it separates the parts of `key`, and two names must not make one key.
    interface_name: str = Field(
        alias="InterfaceName", min_length=1, max_length=40, pattern=r"^[^/]+$"
    )
    doc_type: str = Field(alias="DocType", min_length=1, max_length=30, pattern=r"^[^/]+$")
    doc_date: date = Field(alias="DocDate")

    @field_validator("doc_date", mode="before")
    @classmethod
    def _date_part(cls, v: object) -> object:
        # The Data Bank itself writes "2026-10-07T00:00:00"; the hook sample says "2026-10-07".
        return v[:10] if isinstance(v, str) else v

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
