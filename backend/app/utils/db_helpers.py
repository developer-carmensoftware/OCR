from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def has_submitted_doc(db: AsyncSession, model, **kwargs: object) -> bool:
    """Return True if a non-deleted, already-submitted record matches all kwargs."""
    conditions = [getattr(model, k) == v for k, v in kwargs.items()]
    conditions += [model.submitted_at.isnot(None), model.deleted_at.is_(None)]
    result = await db.execute(select(model).where(*conditions))
    return result.scalars().first() is not None
