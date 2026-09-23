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

### Email automation

**Skipped** _(email document status)_:
The document stopped **before** a document was charged — the BU's own configuration
answered "not this file" (no matching rule, wrong PDF password, sender not registered,
unsupported attachment). Skipped always means free.
_Avoid_: using Skipped for anything that stopped after the charge, however harmless it
looks to the customer — that is **Failed** or **Pending review**.

**Failed** _(email document status)_:
The document was charged and then stopped for good — including a second copy of a
document already waiting in the review queue. A charged document that a human can still
act on is **Pending review**, not Failed.

**Owner emails**:
A BU's optional list of its own mailboxes. A message must carry one of them in From, To or
Cc, or its attachments are **Skipped**. It guards against misdirected mail, not against
someone who knows the ingest address — a forward always carries the BU's mailbox in To.
The secret ingest tag is what keeps strangers out. Empty accepts every sender.
_Avoid_: sender allow-list, sender verification — both imply an identity check it does not
perform.
