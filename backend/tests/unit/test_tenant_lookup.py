"""tenant_name_map() must survive ids that are not UUIDs.

Observability rows carry tenant_id "system" for cluster-wide events. A mock DB cannot
reproduce the failure (asyncpg refusing to encode "system" as a uuid), so this asserts
the one property that prevents it: the ids are compared as text, never bound as UUIDs.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql

from app.services.shared.tenant_lookup import tenant_name_map


@pytest.mark.asyncio
async def test_tenant_ids_are_compared_as_text_so_system_cannot_break_the_query():
    result = MagicMock()
    result.mappings.return_value.all.return_value = []
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)

    assert await tenant_name_map(db, ["system", "af0786cd-487d-4625-95fd-f2e75718447d"]) == {}

    stmt = db.execute.await_args.args[0]
    sql = str(stmt.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
    assert "CAST(tenants.id AS VARCHAR) IN ('system'" in sql
