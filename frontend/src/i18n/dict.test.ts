import { describe, it, expect } from 'vitest'
import { DICT, translate } from './dict'

describe('translate', () => {
  it('looks up the current language', () => {
    expect(translate('en', 'plan.contactSales')).toBe('Contact sales')
    expect(translate('th', 'plan.contactSales')).toBe('ติดต่อฝ่ายขาย')
  })

  it('interpolates {vars}', () => {
    expect(translate('en', 'plan.choose', { name: 'Standard' })).toBe('Choose Standard')
    expect(translate('th', 'plan.choose', { name: 'Standard' })).toBe('เลือก Standard')
    expect(translate('en', 'pricing.loadError', { error: 'boom' })).toBe(
      'Failed to load plans: boom'
    )
  })

  it('leaves an unprovided placeholder intact', () => {
    expect(translate('en', 'plan.choose')).toBe('Choose {name}')
  })

  it('has a Thai string for every English key', () => {
    const missing = (Object.keys(DICT.en) as Array<keyof typeof DICT.en>).filter(k => !DICT.th[k])
    expect(missing).toEqual([])
  })
})
