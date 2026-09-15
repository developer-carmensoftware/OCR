import { describe, it, expect } from 'vitest'
import { planChangeLoss, planChangeWarning } from './billing'

const ANNUAL_GROWTH = { doc_allowance: 1000, billing_period: 'annual' }
const MONTHLY_GROWTH = { doc_allowance: 1000, billing_period: 'monthly' }

describe('planChangeLoss', () => {
  it('flags a smaller monthly quota', () => {
    expect(planChangeLoss('sub_lite', 100, 'monthly', MONTHLY_GROWTH)).toBe('quota')
  })

  it('flags an annual term traded for a monthly one at the same tier', () => {
    // Quota is unchanged, but the prepaid months are forfeited — the costlier loss
    // of the two, and invisible to a credits-only comparison.
    expect(planChangeLoss('sub_growth', 1000, 'monthly', ANNUAL_GROWTH)).toBe('period')
  })

  it('stays quiet on an upgrade', () => {
    expect(planChangeLoss('sub_pro', 5000, 'monthly', MONTHLY_GROWTH)).toBeNull()
  })

  it('stays quiet on a top-up pack, whatever its credit count', () => {
    // A pack adds non-expiring credits and never touches the subscription row.
    expect(planChangeLoss('pack_small', 50, 'monthly', MONTHLY_GROWTH)).toBeNull()
  })

  it('stays quiet when there is no subscription to lose', () => {
    expect(planChangeLoss('sub_lite', 100, 'monthly', null)).toBeNull()
  })

  it('reports both when an annual plan is traded for a SMALLER monthly one', () => {
    // The two losses are independent and this hits both: the quota drops AND the
    // prepaid months are forfeited. Reporting only the quota (the cheaper half) is
    // what this covers — 6 of the catalog's 64 transitions land here.
    expect(planChangeLoss('sub_lite', 100, 'monthly', ANNUAL_GROWTH)).toBe('both')
  })
})

describe('planChangeWarning', () => {
  // Records the key and vars instead of translating, so these assert the mapping
  // rather than the copy — the wording itself is dict.ts's business.
  const t = (k: string, v?: Record<string, string | number>) => `${k}|${JSON.stringify(v ?? {})}`

  it('says nothing when there is no loss', () => {
    expect(planChangeWarning(t, null, 1000, 5000)).toBeUndefined()
  })

  it('passes the real allowances through for a quota drop', () => {
    expect(planChangeWarning(t, 'quota', 1000, 100)).toBe(
      'slip.changeWarnQuota|{"prev":"1,000","next":"100"}'
    )
  })

  it('needs no numbers for a term-only change', () => {
    expect(planChangeWarning(t, 'period', 1000, 1000)).toBe('slip.changeWarnPeriod|{}')
  })

  it('uses the combined copy when both losses apply', () => {
    expect(planChangeWarning(t, 'both', 1500, 100)).toBe(
      'slip.changeWarnBoth|{"prev":"1,500","next":"100"}'
    )
  })
})
