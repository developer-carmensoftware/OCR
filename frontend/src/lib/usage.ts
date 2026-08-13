import type { UsageData } from './api/auth'

export type UsageStats = UsageData['usage'] & {
  /** Documents still available across both pools. */
  remaining: number
  isLow: boolean
}

/**
 * Fold the tenant's pools into the header badge stats. `remaining` is the whole
 * available pool — the same one `consume_document` charges (subscription window
 * → credits) — so a purchase is reflected immediately.
 *
 * Used to also return `usedPercentage` and a threshold `color` for a progress
 * bar under the badge. The bar is gone (at real plan sizes it rendered ~1px
 * wide), and with it the only consumer of those two fields — along with the
 * approximation they rested on, since credit-consumed counts are not in
 * /usage. `isLow` is the remaining signal and is exact.
 */
export function computeUsageStats(usage: UsageData['usage'] | null): UsageStats | null {
  if (!usage) return null
  const { credit_balance, subscription } = usage
  const remaining = (subscription?.docs_remaining ?? 0) + credit_balance
  return {
    credit_balance,
    subscription,
    remaining,
    isLow: remaining <= 5,
  }
}
