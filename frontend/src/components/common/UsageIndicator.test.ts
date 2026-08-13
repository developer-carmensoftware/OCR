import { describe, it, expect } from 'vitest'
import { computeUsageStats } from '../../lib/usage'
import type { UsageData } from '../../lib/api/auth'

type Usage = UsageData['usage']

// A tenant on the free trial: the 30 signup credits, 3 spent.
const base: Usage = {
  credit_balance: 27,
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
    // 1500 plan + 27 credits
    expect(stats?.remaining).toBe(1527)
    expect(stats?.isLow).toBe(false)
  })

  it('credits alone carry REMAIN when there is no subscription', () => {
    expect(computeUsageStats({ credit_balance: 32 })?.remaining).toBe(32)
  })

  it('flags low when the whole pool is nearly spent', () => {
    const stats = computeUsageStats({ credit_balance: 2 })
    expect(stats?.remaining).toBe(2)
    expect(stats?.isLow).toBe(true)
  })

  it('does not flag low one credit above the threshold', () => {
    const stats = computeUsageStats({ credit_balance: 6 })
    expect(stats?.remaining).toBe(6)
    expect(stats?.isLow).toBe(false)
  })

  it('an exhausted subscription still shows the credits behind it', () => {
    const stats = computeUsageStats({
      credit_balance: 9,
      subscription: {
        plan_code: 'sub_starter',
        doc_allowance: 100,
        docs_used: 100,
        docs_remaining: 0,
        period_start: null,
        period_end: null,
        status: 'active',
      },
    })
    expect(stats?.remaining).toBe(9)
  })
})
