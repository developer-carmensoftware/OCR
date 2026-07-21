"""
Admin JWT issuance/verification — separate from Carmen-user session tokens.

Claims:
  aid           — AdminUser UUID
  username      — admin username (for display)
  roles         — list of role ids the admin holds (e.g. ["super_admin"])
  perms         — flattened permission ids ("{resource}:{action}")
  tenant_scope  — "" = global (cross-tenant); else a tenant UUID the admin is scoped to
  mfa_passed    — True if MFA step completed (or admin has no mfa_secret)
  iat / exp     — standard claims
"""

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt

_ALGORITHM = "HS256"


@dataclass
class AdminPrincipal:
    """Resolved admin identity passed to route handlers via Depends(get_current_admin)."""

    admin_id: str
    username: str
    roles: list[str] = field(default_factory=list)
    perms: set[str] = field(default_factory=set)
    tenant_scope: str = ""  # "" = global
    mfa_passed: bool = True

    def has_perm(self, perm_id: str) -> bool:
        return perm_id in self.perms

    @property
    def is_global(self) -> bool:
        return self.tenant_scope == ""


def create_admin_jwt(
    admin_id: str,
    username: str,
    roles: list[str],
    perms: list[str],
    secret: str,
    ttl_hours: int = 8,
    tenant_scope: str = "",
    mfa_passed: bool = True,
) -> str:
    now = datetime.now(UTC)
    payload = {
        "aid": admin_id,
        "username": username,
        "roles": roles,
        "perms": perms,
        "tenant_scope": tenant_scope,
        "mfa_passed": mfa_passed,
        "iat": now,
        "exp": now + timedelta(hours=ttl_hours),
    }
    return jwt.encode(payload, secret, algorithm=_ALGORITHM)


def decode_admin_jwt(token: str, secret: str) -> dict:
    """Raises ValueError on invalid/expired token."""
    try:
        decoded = jwt.decode(token, secret, algorithms=[_ALGORITHM])
        return decoded if isinstance(decoded, dict) else {}
    except JWTError as exc:
        raise ValueError(str(exc)) from exc
