"""Request/response schemas for a settlement report's per-bank posting profile.

Since decision #3 (2026-09-22, docs/email-automation/06-decision-log.md #29) the
payment-type mapping is not part of this feature's own schemas any more — it lives in
`bu_accounting_mapping_entries` alongside commission/tax/net, saved through
`PUT /api/v1/config/accounting` (see `AccountingConfigRequest`), the same call the
merged mapping page uses for everything else on it. What is left here is the
per-(tenant, bank) posting profile: whether it reconciles, how it groups, how it is
worded — and the JV preview, which still needs the *unsaved* form state to track
edits live.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from app.constants import PostType
from app.models.schemas.common import FieldMapping


class ARMappingItem(BaseModel):
    """One payment type this tenant's own settlement report has printed, before it has
    a GL account of its own — `GET /sample-payment-types`' only remaining job. Once a
    code has an account it is an ordinary entry in `AccountingConfigResponse.mappings`
    like any other, so this carries no dept/acc of its own to save."""

    payment_type_code: str
    payment_type_desc: str | None = None


class ARSettingsIn(BaseModel):
    """One bank's settlement JV grouping, saved from the mapping page.

    Only `post_type` since 2026-09-29: whether the bank reconciles at all is its email
    rule (`doc_type: ar_reconcile`), written by Carmen's settings API — not a field here.
    No `jv_description_template` either (Ticket D, 2026-09-22) — a settlement JV's wording
    is the fee-invoice path's own `description`/`bank_descriptions`.
    """

    bank_code: str
    post_type: str = PostType.DETAIL

    @field_validator("post_type")
    @classmethod
    def _known_post_type(cls, v: str) -> str:
        if v not in PostType.ALL:
            raise ValueError(f"post_type must be one of {', '.join(PostType.ALL)}")
        return v


class ARSettingsOut(ARSettingsIn):
    # An active `ar_reconcile` email rule exists for this bank — read-only here, the
    # switch is Carmen's.
    enabled: bool = False
    # Whether this bank has a settlement layout at all (`banks.settlement_grouping is
    # not null`) — what the mapping page reads to decide whether its Settlement card
    # renders for the currently selected bank.
    has_settlement_layout: bool = False


class ARPreviewRow(BaseModel):
    dept: str
    acc: str
    desc: str
    debit: float
    credit: float
    # The group this leg is, as `cc_jv.group_key` resolved it — empty on the debit leg,
    # which is the counterpart to all of them. Carried so the review screen can put each
    # printed payment type beside the leg it became without re-deriving the grouping in
    # the browser from `desc`.
    key: str = ""


class ARPreviewOut(BaseModel):
    """What the JV would look like for this configuration.

    Always computed from the worked example, never from a real document — hence the
    fixed `doc_no`/`doc_date`, which the panel labels as a sample. What the preview is
    for is the shape a configuration produces (how many lines, which accounts, whether
    it balances, what the description reads); the real document's own JV is shown in the
    review screen, by the reviewer who is about to approve it.
    """

    rows: list[ARPreviewRow]
    description: str
    doc_no: str
    doc_date: str
    total_debit: float
    total_credit: float
    balanced: bool
    unmapped: list[str] = Field(default_factory=list)
    # Which grouping produced these rows. The settings screen already knows — it asked for
    # it — but the reviewer does not, and Detail and Summary are the same table with
    # different arithmetic behind it.
    post_type: str = ""


class ARPreviewIn(BaseModel):
    """The unsaved state of the merged mapping page, so the preview tracks what is on
    it rather than what was last saved.

    `mappings` is the page's *whole* live mapping dict — commission/tax/net, every
    fee-invoice payment type, and this bank's settlement credit-side rows, all in the
    one flat shape `AccountingConfigResponse.mappings` already uses. Sending the same
    shape the page already holds in memory means no reshaping at the call site; only
    the keys this bank's grouping actually resolves matter to the arithmetic, so a
    fee-invoice-only key sent along for the ride is simply never looked up.

    `jv_description_template` keeps its name for minimal diff (Ticket D, 2026-09-22)
    but no longer means "the settlement-only template" — it is whatever the page's one
    merged Description field currently holds, tag or no tag, rendered the same way
    `resolve_jv_description` would (`render_description` below, directly, since this
    endpoint deliberately has no DB config read of its own — decision #3).
    """

    bank_code: str
    post_type: str = PostType.DETAIL
    jv_description_template: str = ""
    mappings: dict[str, FieldMapping] = Field(default_factory=dict)

    @field_validator("post_type")
    @classmethod
    def _known_post_type(cls, v: str) -> str:
        if v not in PostType.ALL:
            raise ValueError(f"post_type must be one of {', '.join(PostType.ALL)}")
        return v
