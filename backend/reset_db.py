"""One-shot script: drop + recreate carmen_ai, then run ensure_db() to create schema."""

import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

ROOT_URL = "mysql+aiomysql://root:123456@localhost:3306"
DB_NAME = "carmen_ai"


async def reset():
    engine = create_async_engine(ROOT_URL, echo=False)
    async with engine.begin() as conn:
        await conn.execute(text(f"DROP DATABASE IF EXISTS {DB_NAME}"))
        print(f"Dropped {DB_NAME}")
        await conn.execute(
            text(f"CREATE DATABASE {DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        )
        print(f"Created {DB_NAME}")
    await engine.dispose()

    # Now run the full startup to create tables + run migrations
    from app.database import ensure_db

    await ensure_db()
    print("Schema created + migrations applied + seed data inserted.")


if __name__ == "__main__":
    asyncio.run(reset())
