from pydantic import BaseModel


class FieldMapping(BaseModel):
    dept: str | None = None
    acc: str | None = None
