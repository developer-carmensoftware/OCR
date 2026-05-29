from typing import Any

from pydantic import BaseModel

from app.models.schemas.common import FieldMapping


class AccountingConfigRequest(BaseModel):
    bank_code: str | None = None
    file_prefix: str | None = None
    file_source: str | None = None
    description: str | None = None
    branch: str | None = None
    mappings: dict[str, FieldMapping] | None = None
    custom_types: list[str] | None = None


class AccountingConfigResponse(BaseModel):
    bank_code: str | None = None
    file_prefix: str | None = None
    file_source: str | None = None
    description: str | None = None
    branch: str | None = None
    mappings: dict[str, Any] = {}
    custom_types: list[str] = []
