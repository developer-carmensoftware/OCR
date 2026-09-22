# Carmen AI — OCR & Import System

Turns a photo or PDF of a credit-card statement or AP invoice into structured data,
routes the extracted GL mapping to Carmen ERP, and bills the tenant per document
processed. This file is the project's own vocabulary — pick the word listed here over
any synonym in `_Avoid_`, in code, UI copy, and conversation alike.

## Language

**Order**:
A tenant's request to purchase a subscription plan or a top-up credit pack, tracked
from creation through admin approval and (separately) admin AR-posting to Carmen.
_Avoid_: Purchase, transaction

**Paid** _(order status)_:
The order has been approved by an admin and is fully fulfilled — a top-up order has
already granted credits, a subscription order has already activated its allowance.
This is the point at which the customer's order is done.
_Avoid_: Credited — this was the customer-facing wording until 2026-09-15; it is
wrong for subscription orders, which never touch a credit balance (see **Credit**
below).

**Complete** _(order status)_:
An already-**Paid** order that has also been posted to Carmen ERP as an AR
(accounts-receivable) entry — an admin-side reconciliation step with no effect
visible to the customer. Customer-facing UI shows the same label as **Paid** on
purpose; only the admin queue distinguishes them.
_Avoid_: Posted — that word is reserved for the admin's own queue vocabulary (see
next entry), not the customer-facing status.

**to post / posted**:
The admin's own vocabulary for the **Paid** → **Complete** transition
(`CreditOrdersPage`'s `to_post` / `posted` tabs). Admin-only; never surfaced to the
customer.

**Plan**:
The customer-facing name for a **Subscription**. Backend code, the DB, and the
`TenantSubscription` model consistently say "subscription"; customer-facing copy
(`PlanCard`, the checkout flow, `#/pricing`) consistently says "plan" — same
concept, one word per audience, and the split is deliberate. Don't let "subscription"
leak into customer-facing strings, and don't rename the backend to "plan" either.
_Avoid_: nothing to avoid here — this is a resolved audience split, not a synonym
clash. (Wart, not yet worth fixing: the DB column is `plan_code` even though every
other subscription identifier says "subscription".)

**Document**:
The unit actually charged per scan: one file for a credit-card scan, one _page_
for an AP invoice (`billable_pages()`, capped at `MAX_PAGES_PER_CALL`). A single
uploaded AP invoice can therefore cost several documents. This is the canonical
word for "the thing a quantity counts" — prefer it over **Credit** wherever a
quantity is being named generically.
_Avoid_: Credit (only correct for a top-up pack's own currency, not as a general
unit word — see below), Scan, Page (implementation detail, not customer-facing)

**Credit**:
Currency of the top-up pool specifically (`tenant_credits.balance`) — purchased,
non-expiring, spent one document at a time. Correct _only_ for a top-up pack's
quantity (`PackList` — top-up packs only, by design). Never correct for a
subscription's quantity: a subscription order never touches
`tenant_credits.balance` (the same fact that made "Credited" wrong on the
order-status badge).
_Avoid_: using this for a subscription's monthly quantity — that is an
**Allowance**, not a credit.

**Allowance**:
The subscription pool's monthly quantity — use-it-or-lose-it, spent one document
at a time, reset on each billing period. Rendered as "N documents / month"
(`plan.docsPerMonthSuffix`), never as "N credits".

Resolved 2026-09-15: `pack.creditsUnit` ("credits") was rendering unconditionally
in `PackList`, `CheckoutFlow`, `PendingOrderBanner`, `OrderHistory`, and the
purchase tutorial — correct for `PackList` (top-up packs only), wrong everywhere
else once a subscription order reached that code path. Fixed by branching on
`isSubscriptionCode(code)` (`constants/billing.ts`) to pick `plan.docsPerMonthSuffix`
vs `pack.creditsUnit` per pack kind. Same bug species as the order-status badge,
in the purchase flow's line-item copy instead of a status badge.

**Fee invoice**:
A processor's own invoice for its transaction fees (KTC, GHL, PayPal, SiamPay) — one
printed line per fee, each carrying its own pre-VAT amount. The credit-card JV
builder's default branch (`grouping=None` in `cc_jv.build_jv_rows`): each line resolves
to a payment type via fold-tolerant matching against free-text transaction
descriptions, and the three fixed debit legs (commission/tax/net) sum the detail rows
themselves, because a fee invoice prints no anchor total.
_Avoid_: nothing to avoid — this was always the wizard's own document kind, not a
renamed concept.

**Settlement report**:
A bank's own report of a batch of card settlements (today: KBANK) — a BU-curated,
small vocabulary of payment-type codes rather than free text, and it prints its own
anchor row (`TOTAL BY MERCHANT ID`) carrying the commission/tax/net figures the fee
invoice has to sum by hand. Structurally the same JV as a fee invoice since 2026-09-18
(decision #28) and posted through the same builder (`total_row` + `grouping` set) —
it was ingested as a second module (`cc_ar_reconcile`) only because that was true
before decision #28, and stopped being true once the debit side collapsed. As of
2026-09-22 (decision #29) it is a document kind the credit-card flow recognizes, not a
module: `email_ingest_service` still tags its `ocr_tasks.module_id` as
`cc_ar_reconcile` for cost-reporting continuity, but `assert_module_enabled` gates on
`credit_card_ocr` like everything else, and its posting profile
(`ar_reconcile_settings`) lives beside the credit-card mapping, not behind a separate
settings screen.
_Avoid_: AR reconcile / AR reconciliation — the pre-2026-09-22 name for this whole
area, back when it was believed to need its own module, its own mapping table, and a
second offsetting JV to clear against the fee invoice's. None of those premises
survived decision #28 and #29; the words describing them shouldn't either. Code
identifiers (`ar_reconcile_service.py`, `ARSettingsIn`, `/api/v1/ar-reconcile/*`) keep
the old name deliberately (decision #29, #11) — this entry governs user-facing copy
and conversation, not identifiers.

**Credit breakdown**:
The one thing a settlement report's posting profile actually chooses: whether the
credit side of its JV prints one line per payment type as read off the report
(`Detail`, e.g. `VS INTER UP PREM`) or one line per card scheme, folding sub-types
together (`Summary`, e.g. `VS`). A fee invoice has no such choice — it always posts
one line per printed fee. Surfaced as `ar.postType`'s visible label in the merged
mapping page; the identifier and the API field (`ARSettingsIn.post_type`) keep their
old name for the same reason **Settlement report** does.
_Avoid_: Post type / post_type as user-facing copy — accurate as a database column
name, meaningless to a BU reading the settings page (what is being "posted" isn't
what the choice is about; how the credit side is broken down is).
