"""Email Automation — request payloads for the Settings API Carmen calls.

Contract: docs/CARMEN_INTEGRATION.md §2.3 (settings) and §2.6 (posting credential).
"""

from pydantic import BaseModel, Field, SecretStr


class RuleIn(BaseModel):
    bank_code: str | None = None
    bank_sender_email: str | None = None
    filename_pattern: str | None = None
    pdf_password: str | None = None  # write-only: omit = keep, "" = clear
    is_active: bool = True


class SettingsIn(BaseModel):
    host: str
    bu: str
    enabled: bool = False
    tax_ids: list[str] = Field(default_factory=list)
    rules: list[RuleIn] = Field(default_factory=list)


class TokenIn(BaseModel):
    """The posting credential (§2.6) — its own payload, not part of a settings edit.

    Keeping it out of SettingsIn means an ordinary settings change (a new tax ID, a
    tweaked rule) never re-transmits the secret. SecretStr keeps it out of validation
    errors and Sentry breadcrumbs.
    """

    host: str
    bu: str
    token: SecretStr
    # ponytail: no carmen_uri — the origin is always https://<host>. Accepting a
    # separate one would let us validate the token against one origin and post with
    # it to another. Extra field ignored (Pydantic default) so old callers still work.
