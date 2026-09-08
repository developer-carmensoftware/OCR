/**
 * G8 — the shared device.
 *
 * Two BUs on one browser is the frontend's whole multi-tenancy problem: `localStorage`
 * has no tenant column, so isolation is entirely the `t:<tenant>:` prefix that `appKey()`
 * puts on every business key, plus the wipe on tenant switch.
 *
 * `draft.test.ts` covers this for drafts. Nothing covered `storage.ts` itself, which is
 * where the accounting config, the GL mapping and the wizard state live.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { appKey, setActiveTenant, clearAppStorage, setCarmenUri, getCarmenUri } from './storage'

const A = 'tenant-aaaa'
const B = 'tenant-bbbb'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActiveTenant(null)
})

describe('appKey namespacing', () => {
  it('gives two tenants different keys for the same setting', () => {
    setActiveTenant(A)
    const aKey = appKey('accountingConfig')
    setActiveTenant(B)
    const bKey = appKey('accountingConfig')

    expect(aKey).not.toBe(bKey)
    expect(aKey).toContain(A)
    expect(bKey).toContain(B)
  })

  it('falls back to an anon namespace rather than a previous tenant', () => {
    setActiveTenant(A)
    setActiveTenant(null)
    expect(appKey('accountingConfig')).toBe('t:anon:accountingConfig')
  })

  it('keeps one tenant from reading the other through the same base name', () => {
    setActiveTenant(A)
    localStorage.setItem(appKey('accountingConfig'), JSON.stringify({ filePrefix: 'ALPHA' }))

    setActiveTenant(B)
    expect(localStorage.getItem(appKey('accountingConfig'))).toBeNull()

    localStorage.setItem(appKey('accountingConfig'), JSON.stringify({ filePrefix: 'BETA' }))
    setActiveTenant(A)
    expect(localStorage.getItem(appKey('accountingConfig'))).toContain('ALPHA')
  })
})

describe('clearAppStorage', () => {
  it('removes business keys for every tenant, not just the active one', () => {
    setActiveTenant(A)
    localStorage.setItem(appKey('accountingConfig'), 'a-config')
    localStorage.setItem(appKey('ocr_wizard_state'), 'a-wizard')
    setActiveTenant(B)
    localStorage.setItem(appKey('accountingConfig'), 'b-config')

    clearAppStorage()

    setActiveTenant(A)
    expect(localStorage.getItem(appKey('accountingConfig'))).toBeNull()
    expect(localStorage.getItem(appKey('ocr_wizard_state'))).toBeNull()
    setActiveTenant(B)
    expect(localStorage.getItem(appKey('accountingConfig'))).toBeNull()
  })

  it('also sweeps un-namespaced legacy keys left by older builds', () => {
    localStorage.setItem('accountingConfig', 'legacy')
    clearAppStorage()
    expect(localStorage.getItem('accountingConfig')).toBeNull()
  })

  it('leaves global UI preferences alone — they are not business data', () => {
    localStorage.setItem('theme', 'dark')
    localStorage.setItem('lang', 'th')
    localStorage.setItem('rowsPerPage', '50')
    clearAppStorage()
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(localStorage.getItem('lang')).toBe('th')
    expect(localStorage.getItem('rowsPerPage')).toBe('50')
  })
})

describe('per-tenant Carmen host', () => {
  it('does not let one BU overwrite the other on a shared device', () => {
    setCarmenUri(A, 'https://alpha.carmen.example')
    setCarmenUri(B, 'https://beta.carmen.example')
    expect(getCarmenUri(A)).toBe('https://alpha.carmen.example')
    expect(getCarmenUri(B)).toBe('https://beta.carmen.example')
  })

  it('survives clearAppStorage — it is a convenience link, not business data', () => {
    setCarmenUri(A, 'https://alpha.carmen.example')
    clearAppStorage()
    expect(getCarmenUri(A)).toBe('https://alpha.carmen.example')
  })
})
