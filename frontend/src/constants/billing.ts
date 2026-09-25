/**
 * Presentation layer for the pricing catalog.
 *
 * The backend (`GET /credits/packs`) owns the *money truth*: code, kind, credits,
 * price, sort order. This module owns the *story*: display names and which tier
 * is highlighted. Keyed by pack `code` so a price change in the DB never needs a
 * frontend edit, and copy never needs a migration.
 *
 * User-facing copy lives in `i18n/dict.ts` (the pricing surface is bilingual) —
 * do not add rendered strings here or they will be EN-only.
 */

import type { TKey } from '../i18n/dict'

export interface PackPresentation {
  /** Display name, e.g. 'Standard'. */
  name: string
  /** Optional one-liner. The catalog cards intentionally render no taglines. */
  tagline?: string
  /** Optional ribbon, e.g. 'Popular'. */
  badge?: string
  /** Visually elevate this card as the recommended choice. */
  highlight?: boolean
}

/**
 * Subscription tiers — billed per month, document allowance resets monthly.
 * The ONLY thing that differs between tiers is the monthly quota (and the
 * resulting per-document price). Exactly one tier carries a badge + highlight:
 * the anchor we want chosen.
 */
export const PLAN_META: Record<string, PackPresentation> = {
  sub_lite: { name: 'Lite' },
  sub_starter: { name: 'Starter' },
  sub_growth: { name: 'Growth', badge: 'Popular', highlight: true },
  sub_pro: { name: 'Professional' },
}

// ponytail: the per-card feature checklist was removed in a897c31 as redundant —
// FeatureFlows.tsx covers those capabilities. Don't re-add it here.

/** One-time top-up packs — credits never expire, used after the monthly quota. */
export const PACK_META: Record<string, PackPresentation> = {
  pack_micro: { name: 'Micro' },
  pack_small: { name: 'Small' },
  pack_medium: { name: 'Medium' },
  pack_large: { name: 'Large', badge: 'Best value' },
}

/**
 * Enterprise — the unlimited tier is sold through a conversation, not a cart.
 * Rendered as a full-width contact band; no order/QR is created. Only the name
 * lives here; the band's tagline and price note come from i18n
 * (`plan.enterpriseTagline`, `plan.customPricing`).
 */
export const ENTERPRISE = {
  name: 'Enterprise',
}

/**
 * Contact channels for Enterprise / sales — real values, single source for the
 * "Contact sales" modal. (The pay-to bank details on the proforma are NOT here;
 * those come from the DB via GET /api/v1/credits/payment-info.)
 */
export const SALES_CONTACT = {
  line: '@carmensoftware',
  lineUrl: 'https://line.me/R/ti/p/@carmensoftware',
  phone: '+66(0) 84 941 7198',
  email: 'rattana@carmensoftware.com',
}

/** Derived per-document baht, e.g. for "≈ ฿1.98 / doc". */
export function perDoc(priceThb: number, docs: number): number {
  if (!docs) return 0
  return priceThb / docs
}

/**
 * What an existing subscriber gives up by buying this pack now — null if nothing.
 *
 * Approval calls `activate_subscription()`, which supersedes the current row and
 * opens a fresh window from now(): remaining days never carry over, and the
 * allowance becomes the new tier's. That is a loss worth confirming in three cases —
 * a smaller monthly quota, an annual term traded for a monthly one (the prepaid
 * months are gone, which costs more than any tier drop), or both at once. An upgrade
 * resets the period too, yet buys more quota, so warning there would be noise.
 *
 * Both conditions are evaluated before returning. They are independent, and an
 * annual-to-smaller-monthly change trips both — six of the catalog's 64 transitions.
 * Returning on the first match reported only the quota drop there, i.e. the cheaper
 * half of what the buyer was actually giving up.
 */
export function planChangeLoss(
  packCode: string,
  packCredits: number,
  period: string,
  sub?: { doc_allowance: number; billing_period?: string } | null
): 'quota' | 'period' | 'both' | null {
  if (!PLAN_META[packCode] || !sub) return null
  const quota = packCredits < sub.doc_allowance
  const term = sub.billing_period === 'annual' && period !== 'annual'
  return quota && term ? 'both' : quota ? 'quota' : term ? 'period' : null
}

/**
 * The buyer-facing sentence for a `planChangeLoss` result, or undefined when there is
 * nothing to warn about.
 *
 * Takes `t` as an argument rather than importing it, so this stays a plain function
 * (no hook) callable from anywhere — and so the copy itself stays in `dict.ts`, per
 * this module's no-rendered-strings rule. Both callers reach `SlipUpload`'s single
 * `warning` string; keeping the mapping here means a new loss kind is one edit, not
 * one per call site.
 */
export function planChangeWarning(
  t: (key: TKey, vars?: Record<string, string | number>) => string,
  loss: ReturnType<typeof planChangeLoss>,
  prevAllowance: number,
  nextCredits: number
): string | undefined {
  if (!loss) return undefined
  if (loss === 'period') return t('slip.changeWarnPeriod')
  const vars = { prev: prevAllowance.toLocaleString(), next: nextCredits.toLocaleString() }
  return t(loss === 'both' ? 'slip.changeWarnBoth' : 'slip.changeWarnQuota', vars)
}

/** Display name for any catalog code (plan, pack, or enterprise), falling back to the code. */
export function catalogName(code: string): string {
  if (code === 'enterprise') return ENTERPRISE.name
  return PLAN_META[code]?.name ?? PACK_META[code]?.name ?? code
}

/**
 * True for a subscription tier's code, false for a top-up pack's. Subscription
 * quantities are a monthly *document allowance*, never a *credit* — a subscription
 * order never touches `tenant_credits.balance` (see CONTEXT.md). Callers use this to
 * pick between `plan.docsPerMonthSuffix` and `pack.creditsUnit` for a quantity label.
 */
export function isSubscriptionCode(code: string): boolean {
  return code in PLAN_META
}
