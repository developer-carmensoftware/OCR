"""Email Automation — request payloads for the Settings API Carmen calls.

Contract: docs/CARMEN_INTEGRATION.md §2.3 (settings) and §2.6 (posting credential).
"""

from datetime import datetime

from pydantic import BaseModel, Field, SecretStr

from app.models.schemas.common import Page

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
    """One row of the queue, under whichever tab it belongs to.

    Two halves, and which one is filled depends on the status. A document still waiting
    carries its payload, so it can show what it is worth and why it might need a look. A
    resolved one does not — `_finish` clears `review_payload` on every terminal transition
    — so it can only show what the ledger columns remember: the JV number it became, or
    the reason it did not.

    That asymmetry is the whole reason the row renders differently per tab. Reporting
    `total: 0.00` for a posted document would not be a missing value, it would be a wrong
    one.
    """

    id: str
    created_at: datetime | None = None
    attachment: str
    status: str
    bank_code: str | None = None
    doc_no: str | None = None

    # ── Only while pending_review (read out of review_payload) ───────────────
    doc_date: str | None = None
    # Sum of the gross column, which is what lands on the credit side of the JV. Computed
    # from the stored details rather than from JV rows, which do not exist until the
    # review screen builds them against the current accounting config.
    total: float = 0.0
    line_count: int = 0
    flags: list[str] = Field(default_factory=list)
    # Payment types nothing could map, including the AI. Present only while a document is
    # waiting: the review screen renders one empty picker per entry, and it cannot work
    # them out for itself because the config it would compare against keeps changing.
    unmapped: list[str] = Field(default_factory=list)
    # Which GL rules the AI invented on the way past. `mapping_guessed` says only THAT it
    # did; the review screen marks these for checking, and marking every rule because one
    # was guessed says the same as marking none.
    guessed: list[str] = Field(default_factory=list)

    # ── Only once resolved (plain ledger columns, kept for ever) ─────────────
    jv_no: str | None = None
    reason_code: str | None = None
    error_message: str | None = None
    reviewed_by_name: str | None = None
    reviewed_at: datetime | None = None


class ReviewDocumentDetail(ReviewDocument):
    """A single document, opened. Adds the payload the review screen edits.

    `extracted` is an `/extract` response verbatim, which is exactly what
    `useOcrExtraction.applyExtractedData` consumes — the review screen loads it the same
    way the wizard loads a fresh scan.
    """

    extracted: dict = Field(default_factory=dict)

    # What the AI proposed for each key in `guessed`, as `{key: {dept, acc}}`. On the
    # detail only: the queue lists which types were suggested, but nothing on a row needs
    # the codes, and every list response would carry them for nobody. Ingest stopped
    # writing these to the BU's config (they land there when a human approves), so this
    # is where the review screen reads them from.
    suggested: dict[str, dict[str, str]] = Field(default_factory=dict)


class ActivityRow(ReviewDocument):
    """One line of the activity table — an email document OR a manual scan.

    A subclass rather than a parallel type on purpose: every other field means the same
    thing for both sources, and the browser renders one row component. `source` is the only
    thing that differs, and it is what the Source column shows.

    A manual row's pending-only fields (`doc_date`, `total`, `line_count`, `flags`) stay at
    their defaults — a manual scan is only ever listed once it has posted, so there is
    nothing waiting on a human and no payload to summarise.
    """

    source: str  # "email" | "manual"

    # Who ran the scan, for a manual row. **Deliberately not `reviewed_by_name`**, which it
    # would otherwise fit: that is a stored ledger column on `email_documents`, written once
    # and kept for ever, and nobody reviewed a manual scan. This one is resolved at read
    # time from `ocr_sessions` via `username_map`, so it decays to None once that session
    # has been scrubbed — two different guarantees, and one field holding both is how a
    # reader ends up trusting the weaker one. None means "we no longer know", and the row
    # says so in words rather than printing a raw id.
    posted_by_name: str | None = None


class ActivityPage(Page[ActivityRow]):
    """The activity window plus the counts behind the filter chips.

    Counts span every row, not the page — the same reason `NotificationList` carries
    `unread_count` next to its `Page` fields. Keyed by filter name, and every key is present
    even at zero: a chip that appears only when it has rows makes the strip jump as
    documents resolve.

    `attention` is the same shape and the same keys: of those rows, how many are wrong in
    some way — every failure, a document claimed and never finished, a JV that posted
    without its input-tax record. Not "what a person can fix"; see `_attention` in
    routers/credit_card_activity.py for why that was the wrong line to draw.

    `unseen` says which chips are holding an anomaly **nobody in this BU has looked at
    yet** — the same keys again, and the one that renders the dot. Two fields rather than
    one because they answer different questions: the dot asks "is there something new
    here", and the screen-reader sentence beside it reports the size of the pile.

    """

    counts: dict[str, int] = Field(default_factory=dict)
    attention: dict[str, int] = Field(default_factory=dict)
    unseen: dict[str, bool] = Field(default_factory=dict)


class ReviewStatus(BaseModel):
    """What the automation page needs to choose which of its four states to render.

    `counts` is keyed by tab, not by database status, because two of the tabs are unions —
    see `TABS` in routers/email_review.py. Every tab is present even at zero: a tab that
    appears only when it has rows makes the row of tabs jump as documents resolve.
    """

    enabled: bool = False
    auto_post: bool = False
    entitled: bool = False
    ingest_address: str | None = None
    blockers: list[str] = Field(default_factory=list)
    counts: dict[str, int] = Field(default_factory=dict)


class AutoPostIn(BaseModel):
    """The switch on its own, so turning review off is never a side effect of an
    unrelated settings save — the same reason `TokenIn` is separate from `SettingsIn`."""

    auto_post: bool


class QueueSeenIn(BaseModel):
    """Which chip somebody just opened. Its own route rather than a side effect of reading
    the list: a GET that writes would let a prefetch or a retry clear the BU's dot.

    Only the chip name. What gets stored is the anomaly count the **server** computes for
    it — a client-supplied number would let one bad value silence that BU's dot for good.
    """

    filter: str


class QueueSeenOut(BaseModel):
    """What was actually recorded, so the caller can see the server's own number."""

    filter: str
    seen: int


class InputTaxOverrides(BaseModel):
    """What the reviewer corrected on the input-tax panel.

    Only the three things the machine can get wrong and a human can see: a bank whose
    registered identity is missing or stale, and a profile resolved from a rate the
    document does not quite state. Everything else on that record is either the same
    detail lines the JV was built from or a fact about the document already editable
    above it — the tax period included, which follows the document date and is corrected
    by fixing that — so it has no field here.

    Deliberately not the whole ACTX body. `build_input_tax_payload` still assembles it,
    still sums the amounts off `details`, and still reads a named profile's rate and
    wording back from Carmen's own list — a browser may say *which* profile, never
    define one.
    """

    vendor_name: str | None = Field(None, max_length=200)
    tax_id: str | None = Field(None, max_length=20)
    profile_code: str | None = Field(None, max_length=20)


class ApproveIn(BaseModel):
    """What the reviewer approved, as it appeared on their screen.

    `rows` are the JV rows the review screen displayed, not a request to rebuild them.
    The screen derives them against the live accounting config, so rebuilding server-side
    would risk posting something other than what was on screen when the button was
    pressed. Same trust model the wizard already has, and narrower: `proxy_gljv` accepts a
    fully client-built Carmen body, where this one still builds the envelope itself.
    """

    extracted: dict
    rows: list[dict] = Field(default_factory=list)
    # Unchecked = the reviewer intends to key the VAT record by hand. Defaults on, which
    # is what the machine path does unconditionally.
    post_input_tax: bool = True
    # Absent from the auto-post path, which has nobody to correct anything.
    input_tax: InputTaxOverrides | None = None


class ApproveResult(BaseModel):
    jv_no: str = ""
    # Set when the JV posted but the input-tax record did not. The document is still
    # `posted` and gone from the queue: the JV is in Carmen's books and there is no
    # rollback, so the VAT is a separate errand, not a failure of this one.
    tax_note: str | None = None


class RejectIn(BaseModel):
    """Optional free text. A mandatory reason gets typed as "x" by day three; an optional
    one that lands on `#/admin/email` is how we learn what the extractor gets wrong."""

    reason: str | None = None
