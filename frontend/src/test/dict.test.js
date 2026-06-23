import { describe, it, expect } from 'vitest'
import { DICT, translate } from '../i18n/dict'

// ── EN / TH key parity ───────────────────────────────────────────────────────
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
    const empties = enKeys.filter(k => DICT.en[k] === '')
    expect(empties).toEqual([])
  })

  it('no TH value is empty string', () => {
    const empties = thKeys.filter(k => DICT.th[k] === '')
    expect(empties).toEqual([])
  })
})

// ── translate() ───────────────────────────────────────────────────────────────

describe('translate', () => {
  it('returns EN string for a known key', () => {
    expect(translate('en', 'modal.ok')).toBe('OK')
  })

  it('returns TH string for a known key', () => {
    expect(translate('th', 'modal.ok')).toBe('ตกลง')
  })

  it('fills {var} placeholders', () => {
    expect(translate('en', 'common.extractingPages', { pages: '1, 3' })).toBe(
      'Extracting pages 1, 3'
    )
  })

  it('leaves unknown placeholders untouched', () => {
    expect(translate('en', 'common.extractingPages', {})).toBe('Extracting pages {pages}')
  })
})
