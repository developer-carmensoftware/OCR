"""The Carmen boundary, against the real Carmen.

Posting a JV is not exercised here — that would write into somebody's books. What is
exercised is the half that decides *whose* books a post would reach: each BU's stored
credential is decrypted, proved against the real Carmen, and checked to resolve to that
BU's own origin and nobody else's.

These read the two live dev BUs and never write to them. If no BU has a usable token
(none stored, or the stored one has since expired), the tests skip rather than fail — a
stale credential on a shared dev box is an environment fact, not a defect in this code.
"""

import pytest
from sqlalchemy import text

from .conftest import run


def _live_bus(engine):
    """(bu_code, tenant_id, has_token) for every BU with a stored posting credential."""

    async def _go():
        async with engine.begin() as conn:
            res = await conn.execute(
                text(
                    "select t.bu_code, s.tenant_id, s.carmen_uri, t.host"
                    " from email_ingest_settings s join tenants t on t.id = s.tenant_id"
                    " where s.carmen_token_enc is not null"
                    " order by t.bu_code"
                )
            )
            return [tuple(r) for r in res]

    return run(_go())


@pytest.fixture(scope="module")
def live(real_engine):
    rows = _live_bus(real_engine)
    if not rows:
        pytest.skip("no BU on this database has a stored Carmen token")
    return rows


def test_each_bus_credential_resolves_to_that_bus_own_carmen_origin(real_engine, live):
    """`posting_target` is what auto-post and approve both re-read. A token paired with
    the wrong origin would post one customer's JV into another's Carmen."""
    from app.database import async_session
    from app.models.email_automation import EmailIngestSettings
    from app.services import email_settings_service as es

    async def _targets():
        out = []
        async with async_session() as db:
            for bu_code, tenant_id, _uri, host in live:
                row = await db.get(EmailIngestSettings, tenant_id)
                token, uri = await es.posting_target(db, row)
                out.append((bu_code, host, bool(token), uri))
        return out

    targets = run(_targets())

    for bu_code, host, has_token, uri in targets:
        assert has_token, f"{bu_code} has an encrypted token that would not decrypt"
        assert uri, f"{bu_code} resolved no Carmen origin"
        assert host in uri, f"{bu_code} would post to {uri}, which is not its own host {host}"


def test_two_bus_do_not_share_one_carmen_credential(live):
    """One token per BU is the whole point of storing it per BU: a shared credential
    means one leak posts for two customers, and Carmen cannot tell their JVs apart.

    Compared by fingerprint, never by value — this output reaches a terminal.
    """
    fingerprints = run(_fingerprints(live))
    assert len(set(fingerprints.values())) == len(fingerprints), (
        f"these BUs post under the same Carmen credential: {fingerprints}"
    )


async def _fingerprints(live):
    from app.database import async_session
    from app.models.email_automation import EmailIngestSettings
    from app.services import email_settings_service as es

    out = {}
    async with async_session() as db:
        for bu_code, tenant_id, _uri, _host in live:
            row = await db.get(EmailIngestSettings, tenant_id)
            token, _ = await es.posting_target(db, row)
            # The fingerprint, never the token itself — this output reaches a terminal.
            out[bu_code] = es.fingerprint(token) if token else ""
    return out


def test_a_stored_credential_still_opens_the_real_carmen(real_engine, live):
    """The question the wizards answer at login, asked of the machine path's credential:
    does this token still get in? A 401 here means that BU's auto-post is dead and its
    documents are parking with `carmen_unauthorized` — worth knowing loudly."""
    from app.database import async_session
    from app.models.email_automation import EmailIngestSettings
    from app.routers.auth import validate_token
    from app.services import email_settings_service as es

    async def _probe():
        results = {}
        async with async_session() as db:
            for bu_code, tenant_id, _uri, _host in live:
                row = await db.get(EmailIngestSettings, tenant_id)
                token, uri = await es.posting_target(db, row)
                if not token or not uri:
                    results[bu_code] = "no-credential"
                    continue
                try:
                    await validate_token(token, uri)
                    results[bu_code] = "ok"
                except Exception as exc:  # HTTPException(401) / (502), or a transport error
                    results[bu_code] = f"{type(exc).__name__}:{getattr(exc, 'status_code', '')}"
        return results

    verdicts = run(_probe())
    print(f"\n  Carmen login probe: {verdicts}")

    reachable = [v for v in verdicts.values() if v == "ok"]
    if not reachable and all("502" in v or "no-credential" in v for v in verdicts.values()):
        pytest.skip(f"Carmen unreachable from here: {verdicts}")

    rejected = {bu: v for bu, v in verdicts.items() if "401" in v}
    assert not rejected, (
        f"these BUs' stored Carmen credentials are rejected — their auto-post is dead "
        f"and documents will park as carmen_unauthorized: {rejected}"
    )
    assert reachable, f"no BU could authenticate against Carmen: {verdicts}"


def test_a_seeded_bu_with_no_credential_cannot_post_at_all(tenants):
    """The fail-closed half: a BU that never stored a token must resolve an empty one, so
    the pipeline parks the document instead of reaching for somebody else's."""
    from app.database import async_session
    from app.models.email_automation import EmailIngestSettings
    from app.services import email_settings_service as es

    async def _go():
        async with async_session() as db:
            row = await db.get(EmailIngestSettings, tenants.a)
            return await es.posting_target(db, row)

    token, uri = run(_go())
    assert token == "", "a BU with no stored credential resolved a token from somewhere"
    assert uri, "the origin should still resolve — only the credential is missing"
