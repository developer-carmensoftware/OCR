import { describe, it, expect, beforeEach } from 'vitest'
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
  it('resolves uri from the active session (ocr_user) tenant', () => {
    sessionStorage.setItem('ocr_user', JSON.stringify({ tenant_id: TENANT_A }))
    setCarmenUri(TENANT_A, URI_A)

    expect(getCarmenUrl('/apInvoice/1/show')).toBe(`${URI_A}/#/apInvoice/1/show`)
  })

  it('falls back to ocr_last_tenant after session expiry (ocr_user gone)', () => {
    // session expiry path: ocr_user removed but ocr_last_tenant retained
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

  it('prefers the active session tenant over the last-used tenant', () => {
    setCarmenUri(TENANT_A, URI_A)
    setCarmenUri(TENANT_B, URI_B)
    sessionStorage.setItem('ocr_user', JSON.stringify({ tenant_id: TENANT_B }))
    sessionStorage.setItem('ocr_last_tenant', TENANT_A)

    expect(getCarmenUrl('/')).toBe(`${URI_B}/#/`)
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

  it('does not throw and falls back to host on malformed ocr_user json', () => {
    sessionStorage.setItem('ocr_user', '{not valid json')

    expect(getCarmenUrl('/')).toBe(`${window.location.protocol}//${window.location.hostname}/#/`)
  })
})
