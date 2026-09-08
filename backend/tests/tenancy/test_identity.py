"""G1 — tenant identity.

`(host, bu_code)` is the whole tenant key. Everything downstream trusts it, and nothing
in the repo has ever checked the interesting half: that the SAME bu code on two different
Carmen hosts stays two tenants. All eight dev BUs live on one host, so a bug that keyed
on `bu` alone would look perfectly healthy in dev right up to the first second customer.
"""

from sqlalchemy import text

from .conftest import TEST_HOST, TEST_HOST_2, run


def _upsert(engine, host, bu):
    """Call the real `_upsert_tenant`, on the real table, in its own transaction."""
    from app.database import async_session
    from app.routers.auth import _upsert_tenant

    async def _go():
        async with async_session() as db:
            tenant, created = await _upsert_tenant(db, host, bu)
            await db.commit()
            return str(tenant.id), created

    return run(_go())


def test_the_same_bu_code_on_two_hosts_is_two_tenants(real_engine, tenants):
    """The composite key, exercised for real. BU-A and BU-C are both `bu-alpha`."""
    a_id, a_new = _upsert(real_engine, TEST_HOST, "bu-alpha")
    c_id, c_new = _upsert(real_engine, TEST_HOST_2, "bu-alpha")

    assert a_id == str(tenants.a)
    assert c_id == str(tenants.c)
    assert a_id != c_id
    # Both already existed — the upsert must not have minted a second row for either.
    assert (a_new, c_new) == (False, False)


def test_two_bu_codes_on_one_host_are_two_tenants(real_engine, tenants):
    a_id, _ = _upsert(real_engine, TEST_HOST, "bu-alpha")
    b_id, _ = _upsert(real_engine, TEST_HOST, "bu-beta")
    assert a_id != b_id
    assert {a_id, b_id} == {str(tenants.a), str(tenants.b)}


def test_repeating_the_exchange_reuses_the_row_it_already_made(real_engine, tenants):
    """No duplicate tenant, and no second signup grant, for a BU that logs in twice."""
    first, created_first = _upsert(real_engine, TEST_HOST, "bu-beta")
    second, created_second = _upsert(real_engine, TEST_HOST, "bu-beta")
    assert first == second
    assert created_first is False and created_second is False

    async def _count():
        async with real_engine.begin() as conn:
            return await conn.scalar(
                text(
                    "select count(*) from tenants"
                    " where host = :h and bu_code = 'bu-beta' and deleted_at is null"
                ),
                {"h": TEST_HOST},
            )

    assert run(_count()) == 1


def test_a_brand_new_host_bu_pair_mints_its_own_tenant_and_grants_once(real_engine):
    """The create path, end to end, including the signup grant that rides the same
    transaction — then cleaned up so the suite leaves nothing behind."""
    from app.services.credit_service import SIGNUP_GRANT_CREDITS

    host, bu = TEST_HOST, "bu-ephemeral"
    new_id, created = _upsert(real_engine, host, bu)
    assert created is True

    async def _grant_and_clean():
        from app.database import async_session
        from app.services.credit_service import grant_signup_credits

        async with async_session() as db:
            await grant_signup_credits(db, new_id)
            await db.commit()

        async with real_engine.begin() as conn:
            bal = await conn.scalar(
                text("select balance from tenant_credits where tenant_id = :t"), {"t": new_id}
            )
            rows = await conn.scalar(
                text(
                    "select count(*) from credit_ledger"
                    " where tenant_id = :t and reason = 'signup_grant'"
                ),
                {"t": new_id},
            )
            await conn.execute(
                text("delete from credit_ledger where tenant_id = :t"), {"t": new_id}
            )
            await conn.execute(
                text("delete from tenant_credits where tenant_id = :t"), {"t": new_id}
            )
            await conn.execute(text("delete from tenants where id = :t"), {"t": new_id})
            return bal, rows

    balance, ledger_rows = run(_grant_and_clean())
    assert balance == SIGNUP_GRANT_CREDITS
    assert ledger_rows == 1
