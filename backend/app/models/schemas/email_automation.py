"""Email Automation — request payloads for the Settings API Carmen calls.

Contract: docs/CARMEN_INTEGRATION.md §2.3 (settings) and §2.6 (posting credential).
"""

from datetime import datetime

from pydantic import BaseModel, Field, SecretStr

# The tenant is still the pair (host, bu) — `uri` is how Carmen spells the host, because
# it is the value they already pass to `/auth/exchange`. We take its hostname and look
# the tenant up; see `routers/email_automation._tenant_host` for why that is all it does.
URI_DOC = "Carmen origin, e.g. https://hotelgroup.carmenwork.com — the value sent to /auth/exchange"


class RuleIn(BaseModel):
    bank_code: str | None = None
    bank_sender_email: str | None = None
    # Required, ≥1 non-empty entry — an attachment matching no pattern is never
    # extracted, so this field is the difference between a document being processed
    # and dropped. A list because the likeliest real failure is a bank alternating
    # between `MDR_…` and `Commission_…`, or an employee renaming the PDF before
    # forwarding it. `.pdf` accepts everything of that type and is the escape hatch.
    filename_patterns: list[str] = Field(default_factory=list)
    pdf_password: str | None = None  # write-only: omit = keep, "" = clear
    is_active: bool = True


class SettingsIn(BaseModel):
    uri: str = Field(description=URI_DOC)
    bu: str
    enabled: bool = False
    # The customer's own addresses. Empty accepts any sender — "start broad, narrow
    # later", the same shape as filename_patterns. A second layer over the envelope
    # tag, never a replacement for it (CARMEN_INTEGRATION.md §2.5).
    owner_emails: list[str] = Field(default_factory=list)
    tax_ids: list[str] = Field(default_factory=list)
    rules: list[RuleIn] = Field(default_factory=list)
    # False = every document waits for a human before it reaches Carmen. The BU turns
    # this on once it trusts the extraction; nothing turns it on for them.
    #
    # ponytail: absent means False, and PUT /settings is a full replace — so a Carmen
    # client that predates this field resets the switch on every unrelated settings save,
    # silently, for a customer who had deliberately turned it on. Deliberate: the failure
    # is recoverable (they flip it back) and defaulting the other way would post documents
    # nobody agreed to post. If it is ever reported, the fix is `bool | None = None` plus
    # merge-on-omit -- the idiom `_merge_rule` already uses for pdf_password_enc.
    auto_post: bool = False


class TokenIn(BaseModel):
    """The posting credential (§2.6) — its own payload, not part of a settings edit.

    Keeping it out of SettingsIn means an ordinary settings change (a new tax ID, a
    tweaked rule) never re-transmits the secret. SecretStr keeps it out of validation
    errors and Sentry breadcrumbs.
    """

    uri: str = Field(description=URI_DOC)
    bu: str
    token: SecretStr
    # ponytail: `uri` is an identity input only — we take its hostname and look the tenant
    # up by (host, bu). The origin we verify against and post to is still derived from
    # tenants.host (`_safe_carmen_uri`), never from anything in this payload. That is the
    # distinction the old `carmen_uri` field failed: it let us validate a token against one
    # origin and post it to another. Extra fields are still ignored (Pydantic default), so
    # a caller still sending `host` or `carmen_uri` alongside `uri` keeps working.


# ── Review queue (tenant-facing) ──────────────────────────────────────────────


class ReviewDocument(BaseModel):
    """One row of the review queue.

    Everything the queue needs to paint a row without opening the document: the identity
    a reviewer recognises, the amount that will hit the GL, and `flags` — the reason line
    telling them whether this one is worth opening at all.
    """

    id: str
    created_at: datetime | None = None
    attachment: str
    bank_code: str | None = None
    doc_no: str | None = None
    doc_date: str | None = None
    # Sum of the gross column, which is what lands on the credit side of the JV. Computed
    # from the stored details rather than from JV rows, which do not exist until the
    # review screen builds them against the current accounting config.
    total: float = 0.0
    line_count: int = 0
    flags: list[str] = Field(default_factory=list)


class ReviewDocumentDetail(ReviewDocument):
    """A single document, opened. Adds the payload the review screen edits.

    `extracted` is an `/extract` response verbatim, which is exactly what
    `useOcrExtraction.applyExtractedData` consumes — the review screen loads it the same
    way the wizard loads a fresh scan.
    """

    extracted: dict = Field(default_factory=dict)


class ReviewStatus(BaseModel):
    """What the automation page needs to choose which of its four states to render."""

    enabled: bool = False
    auto_post: bool = False
    entitled: bool = False
    ingest_address: str | None = None
    blockers: list[str] = Field(default_factory=list)
    pending: int = 0


class AutoPostIn(BaseModel):
    """The switch on its own, so turning review off is never a side effect of an
    unrelated settings save — the same reason `TokenIn` is separate from `SettingsIn`."""

    auto_post: bool
