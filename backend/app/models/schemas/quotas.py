from pydantic import BaseModel


class ModuleToggleRequest(BaseModel):
    enabled: bool
