from pydantic import BaseModel

from app.models.schemas.common import FieldMapping


class CodeOption(BaseModel):
    code: str
    name: str
    type: str | None = None


class SuggestRequest(BaseModel):
    bank_code: str
    accounts: list[CodeOption]
    departments: list[CodeOption]


class SuggestPaymentTypesRequest(BaseModel):
    bank_code: str
    payment_types: list[str]
    accounts: list[CodeOption]
    departments: list[CodeOption]


class SaveHistoryRequest(BaseModel):
    bank_code: str
    mappings: dict[str, FieldMapping]
