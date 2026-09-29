import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getCarmenUrl } from './url'
import { setCarmenUri } from './storage'

const TENANT_A = 'tenant-aaaa'
const TENANT_B = 'tenant-bbbb'
const URI_A = 'https://a.carmen.blue'
const URI_B = 'https://b.carmen.blue'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('getCarmenUrl', () => {
  it('resolves uri from the last-used tenant', () => {
    sessionStorage.setItem('ocr_last_tenant', TENANT_A)
    setCarmenUri(TENANT_A, URI_A)

    expect(getCarmenUrl('/apInvoice/1/show')).toBe(`${URI_A}/#/apInvoice/1/show`)
  })

  it('survives session expiry — the key is only cleared on an explicit logout', () => {
    sessionStorage.setItem('ocr_last_tenant', TENANT_A)
    setCarmenUri(TENANT_A, URI_A)

    expect(getCarmenUrl('/')).toBe(`${URI_A}/#/`)
  })

  it('isolates uri per tenant on a shared device', () => {
    setCarmenUri(TENANT_A, URI_A)
    setCarmenUri(TENANT_B, URI_B)

    sessionStorage.setItem('ocr_last_tenant', TENANT_B)
    expect(getCarmenUrl('/')).toBe(`${URI_B}/#/`)

    sessionStorage.setItem('ocr_last_tenant', TENANT_A)
    expect(getCarmenUrl('/')).toBe(`${URI_A}/#/`)
  })

  it('falls back to the current host when no uri is stored', () => {
    // jsdom default location is http://localhost
    expect(getCarmenUrl('/')).toBe(`${window.location.protocol}//${window.location.hostname}/#/`)
  })

  it('falls back to host when tenant is known but no uri stored for it', () => {
    sessionStorage.setItem('ocr_last_tenant', TENANT_A)
    // nothing stored for TENANT_A
    expect(getCarmenUrl('/')).toBe(`${window.location.protocol}//${window.location.hostname}/#/`)
  })

  it('normalizes paths without a leading slash', () => {
    sessionStorage.setItem('ocr_last_tenant', TENANT_A)
    setCarmenUri(TENANT_A, URI_A)

    expect(getCarmenUrl('apVendor/create')).toBe(`${URI_A}/#/apVendor/create`)
  })

  it('defaults to root path when called with no argument', () => {
    sessionStorage.setItem('ocr_last_tenant', TENANT_A)
    setCarmenUri(TENANT_A, URI_A)

    expect(getCarmenUrl()).toBe(`${URI_A}/#/`)
  })

  it('strips a trailing slash from the stored uri', () => {
    sessionStorage.setItem('ocr_last_tenant', TENANT_A)
    setCarmenUri(TENANT_A, `${URI_A}/`)

    expect(getCarmenUrl('/glJv/9/show')).toBe(`${URI_A}/#/glJv/9/show`)
  })
})

describe('getCarmenUrl in a production build (PROD)', () => {
  beforeEach(() => {
    vi.stubEnv('PROD', true)
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('inserts /carmen before the hash', () => {
    sessionStorage.setItem('ocr_last_tenant', TENANT_A)
    setCarmenUri(TENANT_A, URI_A)
    expect(getCarmenUrl('/apInvoice/1/show')).toBe(`${URI_A}/carmen/#/apInvoice/1/show`)
  })

  it('handles uri that already has a trailing slash', () => {
    sessionStorage.setItem('ocr_last_tenant', TENANT_A)
    setCarmenUri(TENANT_A, `${URI_A}/`)
    expect(getCarmenUrl('/')).toBe(`${URI_A}/carmen/#/`)
  })

  it('works with no argument (defaults to root path)', () => {
    sessionStorage.setItem('ocr_last_tenant', TENANT_A)
    setCarmenUri(TENANT_A, URI_A)
    expect(getCarmenUrl()).toBe(`${URI_A}/carmen/#/`)
  })
})
