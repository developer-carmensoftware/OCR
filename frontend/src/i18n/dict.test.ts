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

  // Key parity and non-emptiness both pass when a translator renames a placeholder,
  // and `translate` leaves an unknown one as literal text — so the Thai reader gets
  // "{prev}" on screen while every other gate stays green. Compare the sets.
  it('EN and TH use the same {placeholders} in every key', () => {
    const names = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort()
    const mismatched = (Object.keys(DICT.en) as Array<keyof typeof DICT.en>)
      .filter(k => names(DICT.en[k]).join() !== names(DICT.th[k]).join())
      .map(k => ({ key: k, en: names(DICT.en[k]), th: names(DICT.th[k]) }))
    expect(mismatched).toEqual([])
  })
})

// Every namespace file as loaded, not through DICT — the spread that builds DICT lets a
// later file win silently, so a key defined twice is only visible from here.
const FILES = {
  ...import.meta.glob('./dict/*.ts', { eager: true }),
  ...import.meta.glob('/src/features/admin/i18n/*.ts', { eager: true }),
} as Record<string, { en?: Record<string, string> }>
const NAMESPACE_FILES = Object.entries(FILES).filter(([path]) => !path.endsWith('/index.ts'))

describe('one file per namespace', () => {
  it('no key is defined in two files', () => {
    const total = NAMESPACE_FILES.reduce((n, [, mod]) => n + Object.keys(mod.en ?? {}).length, 0)
    expect(total).toBe(Object.keys(DICT.en).length)
  })

  it("every key carries its file's namespace (admin: admin.<file>.)", () => {
    const misplaced = NAMESPACE_FILES.flatMap(([path, mod]) => {
      const ns = path.split('/').pop()!.replace(/\.ts$/, '')
      const prefix = path.includes('/features/admin/') ? `admin.${ns}.` : `${ns}.`
      return Object.keys(mod.en ?? {})
        .filter(k => !k.startsWith(prefix))
        .map(k => `${path}: ${k}`)
    })
    expect(misplaced).toEqual([])
  })
})

describe('admin copy stays out of the customer bundle', () => {
  const SOURCES = import.meta.glob('/src/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>

  // Anywhere else, an admin key would render as the raw key until the admin chunk had
  // loaded and registered its copy — i.e. always, on a customer screen.
  it('no admin.* key is used outside features/admin', () => {
    const leaks = Object.entries(SOURCES)
      .filter(
        ([path]) => !path.startsWith('/src/features/admin/') && !path.startsWith('/src/i18n/')
      )
      .filter(([path]) => !/\.test\.tsx?$/.test(path))
      .filter(([, src]) => /['"]admin\.[A-Za-z]/.test(src))
      .map(([path]) => path)
    expect(leaks).toEqual([])
  })
})
