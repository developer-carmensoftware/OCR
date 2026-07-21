import type { UsageData } from './api/auth'

export type UsageStats = UsageData['usage'] & {
  usedPercentage: number
  color: string
  isLow: boolean
}

/**
 * Fold the tenant's pools into the header badge stats. REMAIN is the whole
 * available pool — the same one `consume_document` charges (subscription window
 * → free trial → top-up credits) — so a purchase is reflected immediately.
 */
export function computeUsageStats(usage: UsageData['usage'] | null): UsageStats | null {
  if (!usage) return null
  const { monthly_calls, max_monthly_calls, remaining_calls, credit_balance, subscription } = usage
  const planRemaining = subscription?.docs_remaining ?? 0
  const planAllowance = subscription?.doc_allowance ?? 0
  const planUsed = subscription?.docs_used ?? 0
  const totalRemaining = planRemaining + remaining_calls + credit_balance
  // Bar reflects usage against the full pool: subscription window + free monthly allowance + top-up credits.
  const totalCapacity = planAllowance + max_monthly_calls + credit_balance
  const totalUsed = planUsed + monthly_calls // ponytail: credit-consumed not in /usage; close enough for the bar
  const usedPercentage = totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0
  let color = 'var(--teal)'
  if (usedPercentage >= 90) color = 'var(--rose)'
  else if (usedPercentage >= 70) color = 'var(--amber)'
  return {
    monthly_calls,
    max_monthly_calls,
    remaining_calls: totalRemaining,
    credit_balance,
    usedPercentage,
    color,
    isLow: totalRemaining <= 5,
  }
}
