import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { saveDraft, loadDraft, clearDraft, clearAllDrafts } from './draft'
import { setActiveTenant, appKey } from './storage'

const TENANT_A = 'tenant-aaaa'
const TENANT_B = 'tenant-bbbb'
const SIX_HOURS = 6 * 60 * 60 * 1000

beforeEach(() => {
  localStorage.clear()
  setActiveTenant(TENANT_A)
})

afterEach(() => {
  vi.useRealTimers()
  setActiveTenant(null)
})

describe('draft round-trip', () => {
  it('returns what was saved', () => {
    saveDraft('cc', { step: 3, details: [{ Total: '100' }] })
    expect(loadDraft<{ step: number }>('cc')?.data).toEqual({
      step: 3,
      details: [{ Total: '100' }],
    })
  })

  it('returns null when nothing was saved', () => {
    expect(loadDraft('ap')).toBeNull()
  })

  it('keeps the two wizards independent', () => {
    saveDraft('cc', { step: 2 })
    saveDraft('ap', { step: 4 })
    expect(loadDraft<{ step: number }>('cc')?.data.step).toBe(2)
    expect(loadDraft<{ step: number }>('ap')?.data.step).toBe(4)
  })

  it('reports when the draft was taken', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-27T10:00:00Z'))
    saveDraft('cc', { step: 2 })
    expect(loadDraft('cc')?.at).toBe(new Date('2026-07-27T10:00:00Z').getTime())
  })
})

describe('expiry', () => {
  it('still returns a draft just inside the TTL', () => {
    vi.useFakeTimers()
    saveDraft('cc', { step: 2 })
    vi.advanceTimersByTime(SIX_HOURS - 1000)
    expect(loadDraft('cc')).not.toBeNull()
  })

  it('returns null past the TTL and removes the key so it is not re-offered', () => {
    vi.useFakeTimers()
    saveDraft('cc', { step: 2 })
    vi.advanceTimersByTime(SIX_HOURS + 1000)
    expect(loadDraft('cc')).toBeNull()
    expect(localStorage.getItem(appKey('ocr_draft:cc'))).toBeNull()
  })
})

describe('version gate', () => {
  it('drops a draft written by a different app version', () => {
    // The poison-pill case: a snapshot outlives a deploy that changed its shape.
    localStorage.setItem(
      appKey('ocr_draft:cc'),
      JSON.stringify({ v: 99, at: Date.now(), data: { step: 2 } })
    )
    expect(loadDraft('cc')).toBeNull()
    expect(localStorage.getItem(appKey('ocr_draft:cc'))).toBeNull()
  })

  it('drops a draft written before versioning existed', () => {
    localStorage.setItem(
      appKey('ocr_draft:cc'),
      JSON.stringify({ at: Date.now(), data: { step: 2 } })
    )
    expect(loadDraft('cc')).toBeNull()
  })

  it('accepts what saveDraft itself writes', () => {
    saveDraft('cc', { step: 2 })
    expect(loadDraft('cc')).not.toBeNull()
  })
})

describe('corrupt data', () => {
  it('returns null on unparseable json and clears it', () => {
    localStorage.setItem(appKey('ocr_draft:cc'), '{not valid json')
    expect(loadDraft('cc')).toBeNull()
    expect(localStorage.getItem(appKey('ocr_draft:cc'))).toBeNull()
  })

  it('returns null on a payload written by an older shape (no envelope)', () => {
    localStorage.setItem(appKey('ocr_draft:cc'), JSON.stringify({ step: 2 }))
    expect(loadDraft('cc')).toBeNull()
  })
})

describe('clearing', () => {
  it('clearDraft drops only that wizard', () => {
    saveDraft('cc', { step: 2 })
    saveDraft('ap', { step: 2 })
    clearDraft('cc')
    expect(loadDraft('cc')).toBeNull()
    expect(loadDraft('ap')).not.toBeNull()
  })

  it('clearAllDrafts drops every wizard for every tenant', () => {
    saveDraft('cc', { step: 2 })
    saveDraft('ap', { step: 2 })
    setActiveTenant(TENANT_B)
    saveDraft('cc', { step: 5 })

    clearAllDrafts()

    expect(loadDraft('cc')).toBeNull()
    setActiveTenant(TENANT_A)
    expect(loadDraft('cc')).toBeNull()
    expect(loadDraft('ap')).toBeNull()
  })

  it('clearAllDrafts leaves other app storage alone', () => {
    localStorage.setItem(appKey('accountingConfig'), '{"bank":"BBL"}')
    saveDraft('cc', { step: 2 })
    clearAllDrafts()
    expect(localStorage.getItem(appKey('accountingConfig'))).toBe('{"bank":"BBL"}')
  })
})

describe('tenant isolation on a shared device', () => {
  it('one tenant cannot read another tenant draft', () => {
    saveDraft('cc', { step: 3, doc: 'A-001' })
    setActiveTenant(TENANT_B)
    expect(loadDraft('cc')).toBeNull()

    saveDraft('cc', { step: 1, doc: 'B-001' })
    setActiveTenant(TENANT_A)
    expect(loadDraft<{ doc: string }>('cc')?.data.doc).toBe('A-001')
  })
})
