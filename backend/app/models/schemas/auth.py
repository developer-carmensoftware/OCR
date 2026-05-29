from pydantic import BaseModel


class ExchangeRequest(BaseModel):
    token: str
    bu: str
    user: str = ""
    uri: str = ""


class ExchangeResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict
