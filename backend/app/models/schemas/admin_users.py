from pydantic import BaseModel


class AdminUserCreateRequest(BaseModel):
    email: str
    password: str
    full_name: str | None = None
    role_ids: list[str] = []


class AdminUserUpdateRequest(BaseModel):
    full_name: str | None = None
    is_active: bool | None = None


class PasswordResetRequest(BaseModel):
    new_password: str


class RoleAssignmentRequest(BaseModel):
    role_ids: list[str]
