from pydantic import BaseModel


class PdfInfoResponse(BaseModel):
    page_count: int
    thumbnails: list[str]  # base64 data:image/png;base64,... URLs


class FilePreviewResponse(BaseModel):
    data_url: str  # base64 data:image/jpeg;base64,... — browser-renderable preview
