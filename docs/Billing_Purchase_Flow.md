# Billing & Purchase Flow

How tenants purchase, upgrade, and renew subscription plans.

---

## Overview

Carmen OCR offers three subscription tiers (Starter, Growth, Pro — renamed from "Standard" to "Growth" on 2026-06-29) billed monthly or annually, plus one-time top-up credit packs. Tenants can upgrade to a higher tier or renew their current tier at any time — even mid-plan — with prorated credit for unused days. Downgrading is not supported.

---

## Purchase Process

### Step 1 — Select a Plan

The tenant opens the Pricing page and chooses a subscription tier and billing period (monthly or annual).

- **No active plan:** All tiers are available. Button reads "Choose X".
- **Active plan, higher tier:** Button reads "Upgrade to X".
- **Active plan, same tier:** Button reads "Renew X".
- **Active plan, lower tier:** Button is disabled (downgrade blocked).
- **Active annual plan:** Monthly billing is locked — the tenant can only buy another annual plan (upgrade or renew) until the annual term ends.
- **Pending order exists:** All buttons are disabled until the pending order is completed or cancelled.

Tier rank is determined by the plan's monthly document allowance — higher allowance = higher tier.

### Step 2 — Enter Billing Info

The tenant fills in buyer details (company name, tax ID, address, branch, email, contact name). These are pre-filled from the Carmen ERP company profile or the most recent invoice, and can be overridden.

### Step 3 — Order Created & Proforma Issued

The backend creates a pending order and issues a proforma invoice:

1. Look up the selected plan's list price.
2. If the tenant has an active plan, calculate a **proration credit** (see Pricing section below).
3. Subtract the credit from the new plan's net price (floored at zero).
4. Add 7% VAT on top of the net.
5. Issue a proforma invoice with the final amount.

The proforma is valid for 14 days. Only one pending order per tenant is allowed at a time.

### Step 4 — Payment

The tenant pays via bank transfer using the details on the proforma, then uploads a payment slip through the app.

### Step 5 — Admin Approval

An admin reviews the uploaded slip and either approves or rejects the order.

**On approval:**
- A tax invoice is issued.
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

### Proration Credit (Upgrade / Renew Mid-Plan)

When a tenant upgrades or renews while their current plan is still active, they receive a credit for the unused portion:

```
proration_credit = current_plan_net × (days_remaining / total_days)
```

- **current_plan_net** = list price of the current plan (monthly price, or annual price if billed annually) — before VAT.
- **days_remaining** = days left until the current plan's expiry.
- **total_days** = full duration of the current plan's period.

The credit is subtracted from the new plan's net price before VAT is applied. If the credit exceeds the new plan's price, the net is floored at zero (no negative invoices).

**Example:** Tenant on Starter Monthly (฿490/mo), 15 of 30 days remaining.
Upgrading to Growth Monthly (฿990/mo):
- Credit = 490 × 15/30 = ฿245
- New net = 990 − 245 = ฿745
- VAT = 745 × 0.07 = ฿52.15
- **Total = ฿797.15**

### Why Annual Plans Can't Switch to Monthly Mid-Term

The cheapest annual plan (Starter, ฿5,292) costs more than the most expensive monthly plan (Pro, ฿2,490). So an annual subscriber's proration credit always exceeds any monthly plan's price — switching annual → monthly would floor the new order to ฿0 and **forfeit the unused prepaid value** (which is not refunded). To prevent this, an annual subscriber can only move to another annual plan (upgrade or renew). To switch to monthly billing, they wait until the annual term expires. This keeps every transition fair: in all allowed cases the new plan's price is ≥ the proration credit, so no prepaid value is ever lost.

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
| One pending order at a time | Backend (router) + DB unique index | 409 if a second order is attempted |
| No downgrade | Backend (router) + Frontend (disabled button) | 409 "Downgrade is not supported." |
| Annual locked to annual | Backend (router) + Frontend (locked toggle) | 409 — annual subscriber can't buy a monthly plan mid-term |
| One active subscription | DB partial unique index (`status = 'active'`) | Old plan superseded before new one inserted |

---

## Audit Trail

Every purchase leaves the following records:

- **credit_orders** — the order with `proration_credit_thb` (how much was credited), `amount_thb` (gross paid), `billing_period`, timestamps for creation/slip/approval.
- **billing_documents** — proforma (at order creation) and tax invoice (at approval), each with full buyer/seller snapshots and line-item breakdown.
- **tenant_subscriptions** — the old plan row with `status = superseded`, the new one with `status = active`. Both retain `source_order_id` linking back to the order.
