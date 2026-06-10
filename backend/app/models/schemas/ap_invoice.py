from pydantic import BaseModel, Field

# Bounds on the GL-suggestion payload — these become part of the LLM prompt, so
# without caps a client could blow up the prompt (cost/latency/DoS) or push the
# model past its context window. Keep generous but finite.
_MAX_ITEMS = 200
_MAX_STR = 2000


class SuggestGLItem(BaseModel):
    index: int
    category: str = Field(default="", max_length=_MAX_STR)
    description: str = Field(default="", max_length=_MAX_STR)
    unit_price: float = 0.0


class SuggestGLRequest(BaseModel):
    items: list[SuggestGLItem] = Field(default_factory=list, max_length=_MAX_ITEMS)
    invoice_desc: str = Field(default="", max_length=_MAX_STR)
    vn_code: str = Field(default="", max_length=_MAX_STR)
