"""
Issue an API key for an external system (today: Carmen's settings screens).

Usage:
    cd backend
    python -m app.issue_api_key "Carmen staging"

The plaintext key is printed ONCE and never stored — the DB keeps only its
SHA-256 hash. Hand it to Carmen out-of-band; if it is lost, issue a new one and
revoke the old row (`update api_keys set revoked_at = now() where key_prefix = …`).
"""

import argparse
import asyncio
import hashlib
import secrets
import sys
import uuid


async def _issue(name: str, scopes: list[str]) -> None:
    from app.database import async_session
    from app.models.admin import APIKey

    raw = f"ocr_live_{secrets.token_urlsafe(32)}"
    async with async_session() as db:
        db.add(
            APIKey(
                id=uuid.uuid4(),
                name=name,
                key_prefix=raw[:12],
                key_hash=hashlib.sha256(raw.encode()).hexdigest(),
                scopes=scopes,
            )
        )
        await db.commit()

    print(f"\nAPI key for {name!r} — shown once, store it now:\n\n  {raw}\n")
    print("Carmen sends it as:  Authorization: ApiKey <key>\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Issue an external API key")
    parser.add_argument("name", help='Who the key is for, e.g. "Carmen staging"')
    parser.add_argument(
        "--scopes",
        default="carmen:settings",
        help="Comma-separated scopes (default carmen:settings)",
    )
    args = parser.parse_args()
    if not args.name.strip():
        print("ERROR: name is required", file=sys.stderr)
        sys.exit(1)
    asyncio.run(_issue(args.name.strip(), [s.strip() for s in args.scopes.split(",") if s.strip()]))


if __name__ == "__main__":
    main()
