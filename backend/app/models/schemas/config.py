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
    # bank_code -> description. Omitted entirely = keep what is stored; see
    # accounting_config_service.save_accounting_config.
    bank_descriptions: dict[str, str] | None = None


class MappingPatchRequest(BaseModel):
    """A correction to named GL rules, and nothing else.

    Separate from `AccountingConfigRequest` because that one is a full replace: it wipes
    every column and mapping entry it does not carry. The review screen edits one or two
    rules while someone else may have the config open, so it needs a write that names what
    it changes. See `accounting_config_service.set_mappings`.
    """

    mappings: dict[str, FieldMapping]


class AccountingConfigResponse(BaseModel):
    bank_code: str | None = None
    file_prefix: str | None = None
    file_source: str | None = None
    description: str | None = None
    branch: str | None = None
    mappings: dict[str, Any] = {}
    custom_types: list[str] = []
    bank_descriptions: dict[str, str] = {}
