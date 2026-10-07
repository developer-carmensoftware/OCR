"""PMS interface (CA-93) — the webhook envelope Carmen sends, and the admin key payloads.

Contract: docs/PMS_INTEGRATION.md.
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PmsEventIn(BaseModel):
    """The envelope is ours; `data` is Carmen's and stays opaque until processing is built."""

    model_config = ConfigDict(str_strip_whitespace=True)

    # Unique within the BU. A retry must resend the same one — that is the dedupe key.
    event_id: str = Field(min_length=1, max_length=100)
    type: str = Field(min_length=1, max_length=50)
    data: dict[str, Any]


class PmsEventOut(BaseModel):
    id: UUID
    duplicate: bool


class ApiKeyCreateIn(BaseModel):
    tenant_id: UUID
    name: str = Field("PMS webhook", min_length=1, max_length=100)
