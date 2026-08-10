import type { UsageData } from './api/auth'

export type UsageStats = UsageData['usage'] & {
  isLow: boolean
}

/**
 * Fold the tenant's pools into the header badge stats. REMAIN is the whole
 * available pool — the same one `consume_document` charges (subscription window
 * → free trial → top-up credits) — so a purchase is reflected immediately.
 *
 * Used to also return `usedPercentage` and a threshold `color` for a progress
 * bar under the badge. The bar is gone (at real plan sizes it rendered ~1px
 * wide), and with it the only consumer of those two fields — along with the
 * approximation they rested on, since credit-consumed counts are not in
 * /usage. `isLow` is the remaining signal and is exact.
 */
export function computeUsageStats(usage: UsageData['usage'] | null): UsageStats | null {
  if (!usage) return null
  const { monthly_calls, max_monthly_calls, remaining_calls, credit_balance, subscription } = usage
  const totalRemaining = (subscription?.docs_remaining ?? 0) + remaining_calls + credit_balance
  return {
    monthly_calls,
    max_monthly_calls,
    remaining_calls: totalRemaining,
    credit_balance,
    isLow: totalRemaining <= 5,
  }
}
