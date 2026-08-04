"""
Issue an API key for an external system (today: Carmen's settings screens).

Usage:
    cd backend
    python -m app.issue_api_key "Carmen staging" --host hotelgroup.carmenwork.com

`--host` is what the key is allowed to manage, and it is required: the BU in a
settings request is caller-supplied, so a key with no host scope would be a key
that can write any customer's tax IDs and posting credential. Repeat the flag for
a Carmen instance serving several hostnames.

The plaintext key is printed ONCE and never stored — the DB keeps only its
SHA-256 hash (we verify this one, never present it, so hashing is enough). Hand it
to Carmen out-of-band; if it is lost, issue a new one and revoke the old row
(`update api_keys set revoked_at = now() where key_prefix = …`).
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
    print(f"Scopes: {', '.join(scopes)}")
    print("Carmen sends it as:  Authorization: ApiKey <key>\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Issue an external API key")
    parser.add_argument("name", help='Who the key is for, e.g. "Carmen staging"')
    parser.add_argument(
        "--host",
        action="append",
        default=[],
        metavar="HOSTNAME",
        help="Carmen hostname this key may manage; repeatable. Required.",
    )
    parser.add_argument(
        "--scopes",
        default="carmen:settings",
        help="Comma-separated scopes (default carmen:settings)",
    )
    args = parser.parse_args()
    if not args.name.strip():
        print("ERROR: name is required", file=sys.stderr)
        sys.exit(1)
    hosts = [h.strip().lower() for h in args.host if h.strip()]
    if not hosts:
        print(
            "ERROR: --host is required. A key with no host scope can manage no BU at all "
            "(routers/email_automation._authorize fails closed), so issuing one is a "
            "silent dead end.\n"
            '  python -m app.issue_api_key "Carmen staging" --host hotelgroup.carmenwork.com',
            file=sys.stderr,
        )
        sys.exit(1)
    scopes = [s.strip() for s in args.scopes.split(",") if s.strip()]
    scopes += [f"host:{h}" for h in hosts]
    asyncio.run(_issue(args.name.strip(), scopes))


if __name__ == "__main__":
    main()
