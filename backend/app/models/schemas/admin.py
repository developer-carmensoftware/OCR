from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin_id: str
    username: str
    roles: list[str]
    tenant_scope: str
    mfa_required: bool


class MFAVerifyRequest(BaseModel):
    totp_code: str
