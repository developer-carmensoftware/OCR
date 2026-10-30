"""Who may start a job that touches every BU — the same rule on each such route.

The encryption backfill, the key rotation and the mailbox purge all sit behind
`require_maintenance_auth`: the internal job token (pg_cron), or an admin JWT that holds
`configs:write` **and is global**. A BU-scoped admin with the permission is refused too
(decision-log #50) — the job would act on other BUs' data. The work itself is mocked; what
is pinned is the door.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.auth.admin_session import create_admin_jwt
from app.auth.session import create_session_jwt
from tests.integration.conftest import make_test_client

SECRET = "maintenance-auth-test-secret"
ROUTES = [
    (
        "/api/v1/admin/encryption/backfill",
        "app.services.shared.payload_encryption.encrypt_plaintext_columns",
    ),
    ("/api/v1/admin/encryption/rotate", "app.services.shared.payload_encryption.rotate_tokens"),
    ("/api/v1/carmen/email-ingest/purge", "app.services.email_automation.ingest.purge_mailbox"),
]


def _admin(perms=("configs:write",), tenant_scope=""):
    return create_admin_jwt(
        "a-1", "alice", ["admin"], list(perms), SECRET, tenant_scope=tenant_scope
    )


def _customer():
    return create_session_jwt("s-1", "t-1", "u-1", "bob", secret="any-session-secret")


def _post(url, target, token):
    job = AsyncMock(return_value={})
    with (
        patch("app.routers.admin.deps.settings.internal_job_token", "job-token"),
        patch("app.routers.admin.deps.get_admin_jwt_secret", lambda: SECRET),
        patch(target, job),
        make_test_client(MagicMock()) as client,
    ):
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        return client.post(f"{url}?dry_run=true", headers=headers).status_code, job


CALLERS = [
    ("job-token", "job-token", 200),
    ("global-admin", _admin(), 200),
    ("bu-scoped-admin", _admin(tenant_scope="t-42"), 403),
    ("admin-without-configs-write", _admin(perms=("configs:read",)), 403),
    ("customer-session", _customer(), 401),
    ("nobody", None, 401),
]


@pytest.mark.parametrize(
    ("url", "target"),
    ROUTES,
    ids=[r[0].rsplit("/", 2)[-2] + "/" + r[0].rsplit("/", 1)[-1] for r in ROUTES],
)
@pytest.mark.parametrize(("caller", "token", "status"), CALLERS, ids=[c[0] for c in CALLERS])
def test_only_the_job_token_or_a_global_admin_may_start_it(url, target, caller, token, status):
    got, job = _post(url, target, token)
    assert got == status, caller
    assert job.await_count == (1 if status == 200 else 0), caller
