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
  /** One-line audience/value statement under the name. */
  tagline: string
  /** Optional ribbon, e.g. 'Popular'. */
  badge?: string
  /** Visually elevate this card as the recommended choice. */
  highlight?: boolean
}

/**
 * Subscription tiers — billed per month, document allowance resets monthly.
 * The ONLY thing that differs between tiers is the monthly quota (and the
 * resulting per-document price). The shared capabilities live in PLAN_INCLUDES
 * so they're stated once, not duplicated as fake per-tier differentiators.
 */
export const PLAN_META: Record<string, PackPresentation> = {
  sub_starter: {
    name: 'Starter',
    tagline: 'For small teams getting started',
  },
  sub_standard: {
    name: 'Standard',
    tagline: 'Best value for monthly bookkeeping',
    badge: 'Popular',
    highlight: true,
  },
  sub_pro: {
    name: 'Professional',
    tagline: 'For high-volume accounting firms',
    badge: 'Recommended',
  },
}

/** Capabilities every paid plan (and top-up) includes — stated once, below the grid. */
export const PLAN_INCLUDES = [
  'Credit-card & AP invoice OCR',
  'Auto-post to Carmen Cloud',
  'Multi-page PDF support',
  'Email support',
]

/** One-time top-up packs — credits never expire, used after the monthly quota. */
export const PACK_META: Record<string, PackPresentation> = {
  pack_small: { name: 'Small', tagline: 'Top up when your quota runs low' },
  pack_medium: { name: 'Medium', tagline: 'For busier months', badge: 'Best value' },
  pack_large: { name: 'Large', tagline: 'Lowest price per document' },
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
    'On-premise / local deployment',
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
export const VAT_NOTE = 'Prices include 7% VAT'

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
