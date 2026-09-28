"""CORSLogMiddleware warns only about requests a browser will actually block.

A same-origin request (the Vite dev proxy, or a frontend served from the API's own host)
needs no Access-Control-Allow-Origin at all, so its missing header is not a block. The
warning used to fire for every same-origin POST/PUT, which buried the real ones.
"""

import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware.cors_log import CORSLogMiddleware


def _client() -> TestClient:
    app = FastAPI()
    app.add_middleware(CORSLogMiddleware)

    @app.post("/ping")
    def ping():
        return {"ok": True}

    return TestClient(app)  # Host header: "testserver"


def _cors_warnings(caplog) -> list[str]:
    return [r.getMessage() for r in caplog.records if "CORS blocked" in r.getMessage()]


def test_a_same_origin_request_is_not_reported_as_blocked(caplog):
    with caplog.at_level(logging.WARNING, logger="app.middleware.cors_log"):
        resp = _client().post("/ping", headers={"Origin": "http://testserver"})
    assert resp.status_code == 200
    assert _cors_warnings(caplog) == []


def test_the_vite_proxy_same_origin_request_is_not_reported_as_blocked(caplog):
    """The dev proxy's shorthand config rewrites Host to the backend's own
    (changeOrigin), so Origin and Host disagree — but the browser's own
    Sec-Fetch-Site still says same-origin, and that is the request a browser never
    checks against CORS. Headers as captured from a real login POST through the proxy."""
    with caplog.at_level(logging.WARNING, logger="app.middleware.cors_log"):
        _client().post(
            "/ping",
            headers={"Origin": "http://localhost:3010", "Sec-Fetch-Site": "same-origin"},
        )
    assert _cors_warnings(caplog) == []


def test_a_cross_origin_request_without_the_header_is_still_reported(caplog):
    with caplog.at_level(logging.WARNING, logger="app.middleware.cors_log"):
        _client().post(
            "/ping", headers={"Origin": "http://other.test", "Sec-Fetch-Site": "cross-site"}
        )
    assert len(_cors_warnings(caplog)) == 1


def test_a_cross_origin_request_from_a_client_without_fetch_metadata_is_reported(caplog):
    with caplog.at_level(logging.WARNING, logger="app.middleware.cors_log"):
        _client().post("/ping", headers={"Origin": "http://other.test"})
    assert len(_cors_warnings(caplog)) == 1
