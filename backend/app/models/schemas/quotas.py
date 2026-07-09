from pydantic import BaseModel


class QuotaLimitUpdateRequest(BaseModel):
    limit_value: float


class ModuleToggleRequest(BaseModel):
    enabled: bool
