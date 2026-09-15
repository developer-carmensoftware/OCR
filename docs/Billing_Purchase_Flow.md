# Billing & Purchase Flow

How tenants purchase, upgrade, and renew subscription plans.

---

## Overview

Carmen OCR offers four subscription tiers (Lite, Starter, Growth, Pro — Growth was renamed from "Standard" on 2026-06-29; Lite was added on 2026-09-09) billed monthly or annually, plus one-time top-up credit packs. A tenant can switch to any tier or billing period at any time — up, down, or between monthly and annual — for the full list price. There is no proration: whatever is left on the current plan (documents, days, prepaid months) is not carried over. The buyer is told what a given switch costs before they pay (see Step 4); whether to go through with it is their call, not something the system blocks.

---

## Purchase Process

### Step 1 — Select a Plan

The tenant opens the Pricing page and chooses a subscription tier and billing period (monthly or annual).

- **No active plan:** All tiers are available. Button reads "Choose plan".
- **Active plan, same tier and same billing period:** Button reads "Renew plan" — approval opens a fresh period from `now()`; it does not extend the current one.
- **Active plan, anything else** (a different tier, or the same tier on the other billing period): Button reads "Change plan". This covers upgrades, downgrades, and monthly↔annual switches alike — the button does not editorialize about which direction the change goes.
- **Pending order exists:** All buttons are disabled until the pending order is completed or cancelled.

Tier rank is determined by the plan's monthly document allowance — higher allowance = higher tier.

### Step 2 — Enter Billing Info

The tenant fills in buyer details (company name, tax ID, address, branch, email, contact name). These are pre-filled from the Carmen ERP company profile or the most recent invoice, and can be overridden.

### Step 3 — Order Created & Proforma Issued

The backend creates a pending order and issues a proforma invoice:

1. Look up the selected plan's list price. There is no proration credit — every purchase is
   charged the full list price, whatever plan the tenant currently holds.
2. Add 7% VAT on top of the net.
3. Issue a proforma invoice with the final amount.

The proforma is valid for 14 days. Only one pending order per tenant is allowed at a time.

### Step 4 — Payment

The tenant pays via bank transfer using the details on the proforma, then uploads a payment slip through the app.

### Step 5 — Admin Approval

An admin reviews the uploaded slip and either approves or rejects the order.

**On approval:**
- Credits are granted (top-up) or a subscription is activated — no further document is issued
  by this app; the proforma from Step 3 remains the only one, and Carmen ERP is the system of
  record for the fiscal tax invoice.
- If the tenant had an active plan, it is marked as **superseded**.
- A new subscription is activated with a fresh period starting from the approval date.
- The document usage counter resets to zero.

**On rejection:**
- The order is voided with a reason note visible to the tenant.

**On hold (automatic):**
- If the 14-day proforma window passes with no admin decision, an hourly job (`fn_hold_expired_orders`) moves the order to **on hold** — parked for the admin to contact the buyer, not force-voided (buyer-side approval chains can outlast 14 days). The admin can still approve or reject it afterwards.

---

## Pricing

### Monthly vs Annual

| Period | Price | License Window |
|--------|-------|---------------|
| Monthly | List price per month | Approval date + 1 month − 1 day |
| Annual | List price × 12 × 0.9 (10% discount) | Approval date + 1 year − 1 day |

Both periods have the same monthly document allowance. Annual plans reset the document counter every month automatically (use-it-or-lose-it per month, not cumulative).

### No Proration

Every purchase — upgrade, downgrade, renewal, or a monthly↔annual switch — is charged the plan's
full list price. Nothing is credited for time or documents left on the current plan; `activate_subscription()`
supersedes the old subscription row and opens a fresh window from the approval date regardless of
how much of the old period remained. `credit_orders.proration_credit_thb` still exists as a column
but is always written as `0.00` (`routers/credits.py`) — kept in the schema in case a future pricing
model needs it, not because anything reads it today.

Because nothing is credited, what a switch costs the buyer is entirely in what it forfeits, not in
the invoice total. That is what the plan-change warning at Step 4 exists to say plainly before the
buyer transfers — see `frontend/src/constants/billing.ts` (`planChangeLoss`) for the two cases it
flags: a smaller monthly quota, and an annual term traded for a monthly one.

### Top-up Credits

Top-up packs are one-time purchases that add document credits to the tenant's balance. They are not affected by the subscription guard — a tenant can buy top-ups regardless of their plan status. Top-up credits never expire.

### Withholding Tax (WHT 3%)

Carmen sells **services** to **Thai juristic persons**, so the buyer is legally required to withhold 3% income tax at source (ท.ป.4/2528) and remit it to the Revenue Department directly. The proforma therefore prints two extra lines below the grand total — `WHT (3%) Amount` and `Payment Amount` — so the customer knows exactly what to transfer.

Three rules govern this:

- **WHT is a deduction the buyer makes, not a charge we add.** Subtotal, VAT, grand total and `credit_orders.amount_thb` are unaffected — `amount_thb` remains the invoiced debt. The WHT figure is derived at render time from `billing_documents.subtotal`; nothing is stored.
- **The base is the ex-VAT subtotal, never the gross.** ฿990 × 3% = **฿29.70**. Using the ฿1,059.30 gross would give ฿31.78, which is wrong.
- **A slip short by exactly the WHT is a full payment.** The 3% reaches the Revenue Department in Carmen's name, so the admin approves and grants full credits. The slip-review panel shows both the invoiced amount and the WHT-deducted amount for this reason.

The proforma asks the buyer to send the Withholding Tax Certificate (or use e-Withholding Tax via their bank). Without it the withheld 3% cannot be credited against Carmen's corporate income tax. Carmen AR consequently carries a 3% open residual per invoice until the certificate arrives and finance clears it against WHT receivable.

---

## Plan Expiry

- The plan period starts on the **approval date**, not the order date.
- `period_end = approval_date + term − 1 day` (so consecutive plans tile without overlap).
- Once a plan expires, the tenant can purchase any tier freely (treated as a new purchase with no proration).
- A daily background job marks expired subscriptions for display purposes, but the actual enforcement is window-based (queries check `period_start ≤ now < period_end`).

---

## Guards & Constraints

| Rule | Where Enforced | Behavior |
|------|---------------|----------|
| One pending order at a time | Backend (router) + DB unique index (`uq_credit_orders_one_open_per_tenant`) | 409 if a second order is attempted |
| One active subscription | DB partial unique index (`uq_tenant_subscriptions_one_active`, `status = 'active'`) | Old plan superseded before new one inserted |

Downgrading and switching annual→monthly mid-term were both blocked through PR #219 (2026-09-15);
neither guard exists any more. The buyer's only gate now is the disclosure in Step 4, not a 409.

---

## Audit Trail

Every purchase leaves the following records:

- **credit_orders** — the order, with `amount_thb` (gross paid, always the full list price — see
  No Proration above), `proration_credit_thb` (always `0.00`), `billing_period`, timestamps for
  creation/slip/approval.
- **billing_documents** — proforma (at order creation), with full buyer/seller snapshots and line-item breakdown. This app never issues a tax invoice; Carmen ERP is the system of record for that document.
- **tenant_subscriptions** — the old plan row with `status = superseded`, the new one with `status = active`. Both retain `source_order_id` linking back to the order.
