/**
 * Presentation layer for the pricing catalog.
 *
 * The backend (`GET /credits/packs`) owns the *money truth*: code, kind, credits,
 * price, sort order. This module owns the *story*: display names, taglines, the
 * feature list shown on each card, and which tier is highlighted. Keyed by pack
 * `code` so a price change in the DB never needs a frontend edit, and copy never
 * needs a migration.
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
 * resulting per-document price). PLAN_INCLUDES renders identically inside
 * every card so "same features, different quota" is explicit, not implied.
 * Exactly one tier carries a badge + highlight: the anchor we want chosen.
 */
export const PLAN_META: Record<string, PackPresentation> = {
  sub_starter: {
    name: 'Starter',
  },
  sub_standard: {
    name: 'Standard',
    badge: 'Popular',
    highlight: true,
  },
  sub_pro: {
    name: 'Professional',
  },
}

/**
 * Capabilities every paid plan (and top-up) includes — rendered inside each
 * plan card. Deliberately module-agnostic (no module names: new modules must
 * not require copy edits here) and OCR-free ("AI scan" is the product term).
 */
export const PLAN_INCLUDES = [
  'AI document scan',
  'AI account mapping',
  'Auto-post to Carmen',
  'Thai & English documents',
]

/**
 * The free trial presented as a catalog card. Not a purchasable pack — the
 * 30-document trial is granted automatically to new accounts; this card just
 * makes "start free" concrete next to the paid tiers.
 */
export const FREE_PLAN = {
  name: 'Free',
  credits: 30,
  quotaUnit: 'documents',
  features: ['All features included', 'No payment needed', 'Upgrade anytime'],
  ctaLabel: 'Start scanning',
}

/** One-time top-up packs — credits never expire, used after the monthly quota. */
export const PACK_META: Record<string, PackPresentation> = {
  pack_small: { name: 'Small' },
  pack_medium: { name: 'Medium', badge: 'Best value' },
  pack_large: { name: 'Large' },
}

/**
 * Enterprise — the unlimited tier is sold through a conversation, not a cart.
 * Rendered as a full-width contact band; no order/QR is created.
 */
export const ENTERPRISE = {
  name: 'Enterprise',
  badge: 'Unlimited volume',
  tagline: 'For large firms & accounting offices',
  features: [
    'Everything in Professional',
    'SLA, onboarding & dedicated support',
    'Monthly invoicing',
  ],
  priceNote: 'Custom pricing',
}

/**
 * Contact channels for Enterprise / sales.
 * TODO(user): replace placeholders with the real LINE / phone / email before launch.
 */
export const SALES_CONTACT = {
  line: '@carmen-ai',
  lineUrl: 'https://line.me/R/ti/p/@carmen-ai',
  phone: '02-000-0000',
  email: 'sales@carmen.cloud',
}

/** VAT note shown beside every price — amounts are inclusive of 7% VAT. */
export const VAT_NOTE = 'Prices exclude 7% VAT'

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

/** True when the code is a monthly subscription tier (vs a one-time top-up). */
export function isSubscriptionCode(code: string): boolean {
  return code in PLAN_META
}
