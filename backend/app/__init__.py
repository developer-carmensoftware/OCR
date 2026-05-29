# AI OCR Bank Receipt Backend

# ── Windows WMI hang guard ──────────────────────────────────────────────
# Python 3.12's platform.machine()/uname() query WMI (Win32_OperatingSystem)
# at import time. SQLAlchemy calls platform.machine() on import
# (util/compat.py), so a hung/corrupt WMI repository freezes every entrypoint
# (uvicorn, pytest, reset_db). Force platform._wmi_query to raise OSError so
# stdlib falls back to sys.getwindowsversion() — the path it already takes when
# WMI is unavailable. machine() still returns the correct value (read from the
# PROCESSOR_ARCHITECTURE env var, not WMI).
import sys as _sys

if _sys.platform == "win32":
    import platform as _platform

    def _wmi_query_disabled(*_args, **_kwargs):
        raise OSError("WMI query disabled to avoid Windows WMI hang at import")

    _platform._wmi_query = _wmi_query_disabled
