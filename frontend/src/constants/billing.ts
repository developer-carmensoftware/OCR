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
// ponytail: sub_standard alias kept until DB migration renames → sub_growth
const _growth: PackPresentation = { name: 'Growth', badge: 'Popular', highlight: true }

export const PLAN_META: Record<string, PackPresentation> = {
  sub_starter: { name: 'Starter' },
  sub_growth: _growth,
  sub_standard: _growth,
  sub_pro: { name: 'Professional' },
}

// ponytail: the per-card feature checklist was removed in a897c31 as redundant —
// FeatureFlows.tsx covers those capabilities. Don't re-add it here.

/** One-time top-up packs — credits never expire, used after the monthly quota. */
export const PACK_META: Record<string, PackPresentation> = {
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

/** Display name for any catalog code (plan, pack, or enterprise), falling back to the code. */
export function catalogName(code: string): string {
  if (code === 'enterprise') return ENTERPRISE.name
  return PLAN_META[code]?.name ?? PACK_META[code]?.name ?? code
}
