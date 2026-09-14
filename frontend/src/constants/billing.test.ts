import { describe, it, expect } from 'vitest'
import { planChangeLoss } from './billing'

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
})
