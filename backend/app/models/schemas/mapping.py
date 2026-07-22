from pydantic import BaseModel


class CodeOption(BaseModel):
    code: str
    name: str
    type: str | None = None
    # Dept-restricted AccCodes (Carmen DefaultAccount); empty/None = all allowed
    allowed_accounts: list[str] | None = None


class SuggestRequest(BaseModel):
    bank_code: str
    accounts: list[CodeOption]
    departments: list[CodeOption]
    source: str | None = None  # JV source (file_source) for Carmen history lookup


class SuggestPaymentTypesRequest(BaseModel):
    bank_code: str
    payment_types: list[str]
    accounts: list[CodeOption]
    departments: list[CodeOption]
    source: str | None = None  # JV source (file_source) for Carmen history lookup
