"""PerformanceMiddleware records every request in performance_logs — 500s included.

An unhandled exception is answered by the app-level `Exception` handler, which Starlette
mounts on ServerErrorMiddleware, outside every middleware we add. Before the fix the
exception aborted `dispatch` and the 500 left no row, so #/admin/errors never counted it.
"""

import pytest
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.middleware import performance


@pytest.fixture
def client():
    app = FastAPI()
    app.add_middleware(performance.PerformanceMiddleware)

    @app.exception_handler(Exception)
    async def _unhandled(request, exc):
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    @app.get("/ok")
    async def ok():
        return {"ok": True}

    @app.get("/boom")
    async def boom():
        raise RuntimeError("column settings_saved_at does not exist")

    performance._PERF_BUFFER.clear()
    yield TestClient(app, raise_server_exceptions=False)
    performance._PERF_BUFFER.clear()


def test_an_unhandled_exception_is_recorded_as_a_500(client):
    resp = client.get("/boom")

    assert resp.status_code == 500
    assert [(r["endpoint"], r["status_code"]) for r in performance._PERF_BUFFER] == [("/boom", 500)]


def test_a_normal_request_is_recorded_with_its_status(client):
    resp = client.get("/ok")

    assert resp.status_code == 200
    assert "X-Response-Time-Ms" in resp.headers
    assert [(r["endpoint"], r["status_code"]) for r in performance._PERF_BUFFER] == [("/ok", 200)]
