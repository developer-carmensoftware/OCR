from pydantic import BaseModel


class GlobalMaintenanceRequest(BaseModel):
    enabled: bool
    message: str | None = None


class TenantMaintenanceRequest(BaseModel):
    enabled: bool


class ScheduleMaintenanceRequest(BaseModel):
    # ISO8601 (frontend sends Date.toISOString(), i.e. UTC).
    window_start: str
    window_end: str
    message: str | None = None
