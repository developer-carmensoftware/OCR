"""Request/response schemas for Detailed Credit Card AR Reconciliation."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from app.constants import PostType


class ARMappingItem(BaseModel):
    """One payment type → credit-side GL account, within one post type."""

    payment_type_code: str
    payment_type_desc: str | None = None
    credit_dept_code: str | None = None
    credit_account_code: str | None = None
    is_active: bool = True


class ARSettingsIn(BaseModel):
    """Full replace of one (tenant, bank) configuration and both mapping sets.

    `mappings` is keyed by post type, so a save from the Detail view cannot silently
    delete the Summary rows the BU maintained — the screen sends both back.
    """

    bank_code: str
    enabled: bool = False
    post_type: str = PostType.DETAIL
    jv_description_template: str = "Credit Card AR Reconcile {Settlement_Date}"
    debit_dept_code: str | None = None
    debit_account_code: str | None = None
    mappings: dict[str, list[ARMappingItem]] = Field(default_factory=dict)

    @field_validator("post_type")
    @classmethod
    def _known_post_type(cls, v: str) -> str:
        if v not in PostType.ALL:
            raise ValueError(f"post_type must be one of {', '.join(PostType.ALL)}")
        return v

    @field_validator("mappings")
    @classmethod
    def _known_mapping_keys(
        cls, v: dict[str, list[ARMappingItem]]
    ) -> dict[str, list[ARMappingItem]]:
        unknown = sorted(set(v) - set(PostType.ALL))
        if unknown:
            raise ValueError(f"unknown post type(s) in mappings: {', '.join(unknown)}")
        return v


class ARBlocker(BaseModel):
    """One link in the chain between an arriving email and a posted JV.

    Four switches have to line up and every one of them fails silently on its own, so
    the settings screen states the whole chain rather than leaving the BU to discover
    which one is off by sending themselves test mail.
    """

    key: str
    ok: bool
    detail: str | None = None


class ARSettingsOut(ARSettingsIn):
    blockers: list[ARBlocker] = Field(default_factory=list)


class ARPreviewRow(BaseModel):
    dept: str
    acc: str
    desc: str
    debit: float
    credit: float
    # The group this leg is, as `group_key` resolved it — empty on the debit leg, which is
    # the counterpart to all of them. Carried so the review screen can put each printed
    # payment type beside the leg it became without re-deriving the grouping in the
    # browser or slicing the `Tax Inv.# … - ` prefix back off `desc`.
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
    """The unsaved state of the settings screen, so the preview tracks what is on it."""

    bank_code: str
    post_type: str = PostType.DETAIL
    jv_description_template: str = ""
    debit_dept_code: str | None = None
    debit_account_code: str | None = None
    mappings: list[ARMappingItem] = Field(default_factory=list)

    @field_validator("post_type")
    @classmethod
    def _known_post_type(cls, v: str) -> str:
        if v not in PostType.ALL:
            raise ValueError(f"post_type must be one of {', '.join(PostType.ALL)}")
        return v
