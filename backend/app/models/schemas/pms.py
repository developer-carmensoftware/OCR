"""PMS interface (CA-93) — the admin key payloads.

Contract: docs/PMS_INTEGRATION.md.
"""

from uuid import UUID

from pydantic import BaseModel, Field


class ApiKeyCreateIn(BaseModel):
    tenant_id: UUID
    name: str = Field("PMS webhook", min_length=1, max_length=100)
