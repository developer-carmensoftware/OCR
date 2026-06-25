import { describe, it, expect } from 'vitest'
import { computeUsageStats } from '../../lib/usage'
import type { UsageData } from '../../lib/api/auth'

type Usage = UsageData['usage']

const base: Usage = {
  monthly_calls: 3,
  max_monthly_calls: 30,
  remaining_calls: 27,
  credit_balance: 0,
}

describe('computeUsageStats', () => {
  it('returns null for no usage', () => {
    expect(computeUsageStats(null)).toBeNull()
  })

  it('sums an active subscription into REMAIN (the bug: it was ignored)', () => {
    const stats = computeUsageStats({
      ...base,
      subscription: {
        plan_code: 'sub_pro',
        doc_allowance: 1500,
        docs_used: 0,
        docs_remaining: 1500,
        period_start: null,
        period_end: null,
        status: 'active',
      },
    })
    // 1500 plan + 27 free + 0 credit
    expect(stats?.remaining_calls).toBe(1527)
    expect(stats?.isLow).toBe(false)
  })

  it('free-only (no subscription) = free remaining + credits', () => {
    const stats = computeUsageStats({ ...base, credit_balance: 5 })
    expect(stats?.remaining_calls).toBe(32) // 27 + 5
  })

  it('exposes planValidUntil from subscription.period_end', () => {
    const stats = computeUsageStats({
      ...base,
      subscription: {
        plan_code: 'sub_pro',
        doc_allowance: 1500,
        docs_used: 0,
        docs_remaining: 1500,
        period_start: '2026-06-24T00:00:00Z',
        period_end: '2027-06-23T00:00:00Z',
        status: 'active',
      },
    })
    expect(stats?.planValidUntil).toBe('23/06/2027')
  })

  it('returns null planValidUntil when no subscription', () => {
    const stats = computeUsageStats(base)
    expect(stats?.planValidUntil).toBeNull()
  })

  it('flags low and colors red when the whole pool is nearly spent', () => {
    const stats = computeUsageStats({
      monthly_calls: 30,
      max_monthly_calls: 30,
      remaining_calls: 0,
      credit_balance: 2,
    })
    expect(stats?.remaining_calls).toBe(2)
    expect(stats?.isLow).toBe(true)
    expect(stats?.color).toBe('var(--rose)') // 30/32 ≈ 94% used
  })
})
