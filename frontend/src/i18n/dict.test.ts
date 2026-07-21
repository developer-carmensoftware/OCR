import { describe, it, expect } from 'vitest'
import { DICT, translate } from './dict'

// `th` is typed as Record<TKey, string> so TS already catches missing keys at
// compile time, but a runtime test is the cheapest CI gate that survives
// copy-paste or merge mistakes where a key gets "" or is accidentally deleted.
describe('i18n dict parity', () => {
  const enKeys = Object.keys(DICT.en).sort()
  const thKeys = Object.keys(DICT.th).sort()

  it('EN and TH have the same set of keys', () => {
    expect(enKeys).toEqual(thKeys)
  })

  it('no EN value is empty string', () => {
    const empties = enKeys.filter(k => DICT.en[k as keyof typeof DICT.en] === '')
    expect(empties).toEqual([])
  })

  it('no TH value is empty string', () => {
    const empties = thKeys.filter(k => DICT.th[k as keyof typeof DICT.th] === '')
    expect(empties).toEqual([])
  })
})

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
