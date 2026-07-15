"""Schemas for the AI-processing consent record (PDPA ม.19)."""

from pydantic import BaseModel, Field


class ConsentRequest(BaseModel):
    version: str = Field(..., min_length=1, max_length=20)


class ConsentStatusResponse(BaseModel):
    consented: bool
