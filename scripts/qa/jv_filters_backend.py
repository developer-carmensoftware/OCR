"""The backend `jv_filters_ui.mjs` runs against: local Supabase, port 8012.

    DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres \\
        backend/venv/Scripts/python scripts/qa/jv_filters_backend.py

**Harness only.** One IP makes thousands of requests (the matrix alone is ~6,000), and every page
load also reaches the 20-per-minute `auth` group through the usage call, so both rate-limit groups
are lifted *in this process*. The limiter itself is untouched: a real client keeps its limits, and
nothing in the app changes.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from app.middleware import rate_limit as r  # noqa: E402

r._LIMITS["default"] = (1_000_000, 60)
r._LIMITS["auth"] = (1_000_000, 60)

import uvicorn  # noqa: E402

uvicorn.run("app.main:app", port=8012)
