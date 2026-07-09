"""Pydantic schemas for in-app order notifications."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_id: str | None = None
    type: str
    payload: dict = {}
    read_at: datetime | None = None
    created_at: datetime | None = None

    @field_validator("id", "order_id", mode="before")
    @classmethod
    def _coerce_id(cls, v: object) -> object:
        return str(v) if v is not None else None


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    unread_count: int


class MarkReadRequest(BaseModel):
    ids: list[str] | None = None  # None = mark all unread
