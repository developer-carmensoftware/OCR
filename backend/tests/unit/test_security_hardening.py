"""
Verification tests for the pre-pilot security hardening pass.

Proves the closed holes stay closed:
  - IDOR  : carmen /gljv + mark_invoice_submitted scope every lookup by tenant_id
  - SSRF  : /auth/exchange uri is allowlisted + rejects hosts resolving to internal IPs
  - CORS  : a wildcard origin regex never grants credentialed CORS
  - Config: production refuses to start with a wildcard CORS regex or a missing/shared admin secret

Mirrors the Verification section of ~/.claude/plans/pilot-test-fluffy-lampson.md.
"""

import os
import subprocess
import sys
import uuid
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from tests.conftest import make_mock_db

_BACKEND_DIR = Path(__file__).resolve().parents[2]


# ────────────────────────────────────────────────────────────────────────────
# IDOR — tenant scoping
# ────────────────────────────────────────────────────────────────────────────


class TestIDORTenantScoping:
    @pytest.mark.asyncio
    async def test_mark_invoice_submitted_query_is_tenant_scoped(self):
        """The AP-invoice lookup must filter by tenant_id AND deleted_at."""
        from app.services.ap_invoice_service import mark_invoice_submitted

        db = make_mock_db(execute_rows=[])  # scalar_one_or_none → None (not found)
        tenant = str(uuid.uuid4())
        await mark_invoice_submitted(db, str(uuid.uuid4()), tenant)

        compiled = db.execute.call_args.args[0].compile()
        sql = str(compiled)
        assert "tenant_id" in sql
        assert "deleted_at" in sql
        # The WHERE binds the *session* tenant, not anything the caller controls.
        assert uuid.UUID(tenant) in compiled.params.values()
        db.commit.assert_not_called()  # nothing matched → no write

    @pytest.mark.asyncio
    async def test_mark_invoice_submitted_rejects_bad_uuid(self):
        """A non-UUID id/tenant must short-circuit before touching the DB."""
        from app.services.ap_invoice_service import mark_invoice_submitted

        db = make_mock_db(execute_rows=[])
        await mark_invoice_submitted(db, "not-a-uuid", "also-bad")
        db.execute.assert_not_called()
        db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_credit_card_gljv_query_is_tenant_scoped(self):
        """carmen /gljv must look up the credit card scoped to the session tenant."""
        from app.auth.dependencies import get_current_session
        from app.auth.session import SessionInfo
        from app.database import get_db
        from app.main import app

        tenant = str(uuid.uuid4())
        card_id = str(uuid.uuid4())
        session = SessionInfo(
            session_id="s1",
            carmen_token="tok",
            carmen_user_id="u1",
            username="t",
            tenant_id=tenant,
            carmen_uri="https://test.carmenwork.com",
            bu="BU01",
        )
        mock_db = make_mock_db(execute_rows=[])  # card lookup → None

        async def _db():
            yield mock_db

        async def _session():
            from app.context import current_carmen_uri, current_tenant_id

            current_tenant_id.set(tenant)
            current_carmen_uri.set(session.carmen_uri)
            return session

        app.dependency_overrides[get_db] = _db
        app.dependency_overrides[get_current_session] = _session
        try:
            from starlette.testclient import TestClient

            with (
                patch("app.lifecycle.ensure_db", new_callable=AsyncMock),
                patch(
                    "app.services.usage_service.fetch_openrouter_pricing", new_callable=AsyncMock
                ),
                patch("app.services.cron_service.session_cleanup_loop", new_callable=AsyncMock),
                patch("app.services.cron_service.pricing_sync_loop", new_callable=AsyncMock),
                patch("app.lifecycle._perf_flush_loop", new_callable=AsyncMock),
                patch("app.lifecycle.asyncio.sleep", new_callable=AsyncMock),
                patch(
                    "app.routers.carmen.post_gljv",
                    new=AsyncMock(return_value={"Code": 0}),
                ),
                TestClient(app, raise_server_exceptions=True) as client,
            ):
                resp = client.post(
                    f"/api/v1/ocr/carmen/gljv?credit_card_id={card_id}",
                    json={"dummy": 1},
                )
            assert resp.status_code == 200
            compiled = mock_db.execute.call_args.args[0].compile()
            assert "tenant_id" in str(compiled)
            assert uuid.UUID(tenant) in compiled.params.values()  # filtered to session tenant
            mock_db.commit.assert_not_called()  # foreign card_id never matches → no write
        finally:
            app.dependency_overrides.clear()


# ────────────────────────────────────────────────────────────────────────────
# SSRF — Carmen uri allowlist + DNS resolution
# ────────────────────────────────────────────────────────────────────────────


class TestSSRFHardening:
    def _validate(self, uri: str):
        from app.routers.auth import _validate_uri

        return _validate_uri(uri)

    def test_host_not_on_allowlist_is_rejected(self):
        from app.config import settings

        with patch.object(settings, "allowed_carmen_hosts", "erp.carmenwork.com"):
            with pytest.raises(HTTPException) as exc:
                self._validate("https://evil.attacker.com/api")
            assert exc.value.status_code == 400

    def test_host_on_allowlist_passes(self):
        from app.config import settings

        # getaddrinfo returns a public IP so the secondary DNS check also passes.
        with (
            patch.object(settings, "allowed_carmen_hosts", "erp.carmenwork.com"),
            patch("socket.getaddrinfo", return_value=[(2, 1, 6, "", ("8.8.8.8", 443))]),
        ):
            assert self._validate("https://erp.carmenwork.com/api") == "https://erp.carmenwork.com"

    def test_hostname_resolving_to_private_ip_is_rejected(self):
        from app.config import settings

        with (
            patch.object(settings, "allowed_carmen_hosts", ""),  # allowlist off → exercise DNS path
            patch("socket.getaddrinfo", return_value=[(2, 1, 6, "", ("10.0.0.5", 443))]),
        ):
            with pytest.raises(HTTPException) as exc:
                self._validate("https://internal.example.com/api")
            assert exc.value.status_code == 400

    def test_hostname_resolving_to_metadata_ip_is_rejected(self):
        from app.config import settings

        with (
            patch.object(settings, "allowed_carmen_hosts", ""),
            patch("socket.getaddrinfo", return_value=[(2, 1, 6, "", ("169.254.169.254", 80))]),
        ):
            with pytest.raises(HTTPException):
                self._validate("https://metadata.example.com/latest/meta-data")

    def test_carmen_client_does_not_follow_redirects(self):
        """A redirect must not be able to bounce the validation probe internally."""
        from app.services import carmen_service

        carmen_service._SHARED_CLIENT = None  # force fresh build
        client = carmen_service._get_client()
        assert client.follow_redirects is False


# ────────────────────────────────────────────────────────────────────────────
# CORS — wildcard regex never grants credentials
# ────────────────────────────────────────────────────────────────────────────


class TestCORSHardening:
    def test_is_wildcard_origin_regex(self):
        from app.config import is_wildcard_origin_regex

        for bad in (".*", ".+", "^.*$", "^.+$", "(.*)", " .* "):
            assert is_wildcard_origin_regex(bad) is True, bad
        for good in ("", None, r"^https://app\.example\.com$", r"^https://.+\.vercel\.app$"):
            assert is_wildcard_origin_regex(good) is False, good

    @contextmanager
    def _app_with_cors(self, origins: str, regex: str):
        from app.config import settings
        from app.factory import create_app

        with (
            patch.object(settings, "allowed_origins", origins),
            patch.object(settings, "allowed_origin_regex", regex),
        ):
            yield create_app()

    def test_wildcard_regex_does_not_grant_credentials(self):
        from starlette.testclient import TestClient

        with self._app_with_cors(origins="", regex=".*") as app:
            with TestClient(app) as client:
                r = client.options(
                    "/anything",
                    headers={
                        "Origin": "https://evil.com",
                        "Access-Control-Request-Method": "GET",
                    },
                )
            # The dangerous combination — reflected origin WITH credentials — must not happen.
            assert r.headers.get("access-control-allow-credentials") != "true"

    def test_specific_origin_grants_credentials(self):
        from starlette.testclient import TestClient

        with self._app_with_cors(origins="https://good.example.com", regex="") as app:
            with TestClient(app) as client:
                r = client.options(
                    "/anything",
                    headers={
                        "Origin": "https://good.example.com",
                        "Access-Control-Request-Method": "GET",
                    },
                )
            assert r.headers.get("access-control-allow-credentials") == "true"
            assert r.headers.get("access-control-allow-origin") == "https://good.example.com"


# ────────────────────────────────────────────────────────────────────────────
# Config — production refuses to start with insecure config
# ────────────────────────────────────────────────────────────────────────────


class TestProductionStartupGuards:
    def _import_config(self, **env_overrides) -> subprocess.CompletedProcess:
        env = dict(os.environ)
        env["APP_DEBUG"] = "false"
        env.update(env_overrides)
        return subprocess.run(
            [sys.executable, "-c", "import app.config"],
            cwd=_BACKEND_DIR,
            env=env,
            capture_output=True,
            text=True,
        )

    def test_wildcard_cors_regex_aborts_startup(self):
        result = self._import_config(ALLOWED_ORIGIN_REGEX=".*")
        assert result.returncode != 0
        assert "ALLOWED_ORIGIN_REGEX" in result.stderr

    def test_empty_admin_secret_aborts_startup(self):
        result = self._import_config(ADMIN_JWT_SECRET="")
        assert result.returncode != 0
        assert "ADMIN_JWT_SECRET" in result.stderr

    def test_admin_secret_equal_to_ocr_secret_aborts_startup(self):
        shared = "x" * 48  # strong enough to clear the weak-secret guard
        result = self._import_config(OCR_JWT_SECRET=shared, ADMIN_JWT_SECRET=shared)
        assert result.returncode != 0
        assert "ADMIN_JWT_SECRET" in result.stderr
