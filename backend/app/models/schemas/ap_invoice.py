from pydantic import BaseModel


class SuggestGLItem(BaseModel):
    index: int
    category: str = ""
    description: str = ""
    unit_price: float = 0.0


class SuggestGLRequest(BaseModel):
    items: list[SuggestGLItem]
    invoice_desc: str = ""
    vn_code: str = ""
