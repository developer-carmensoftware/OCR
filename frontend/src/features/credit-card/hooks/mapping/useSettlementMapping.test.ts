import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useSettlementMapping } from './useSettlementMapping'

vi.mock('@/features/credit-card/api/arReconcile', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/credit-card/api/arReconcile')>()
  return {
    ...actual,
    getARSettings: vi.fn(),
    getSamplePaymentTypes: vi.fn(),
    previewARJv: vi.fn(),
  }
})
vi.mock('@/features/credit-card/api/mapping', () => ({ suggestPaymentTypes: vi.fn() }))

import {
  getARSettings as realGetARSettings,
  getSamplePaymentTypes as realGetSamplePaymentTypes,
  previewARJv as realPreviewARJv,
} from '@/features/credit-card/api/arReconcile'

const getARSettings = vi.mocked(realGetARSettings)
const getSamplePaymentTypes = vi.mocked(realGetSamplePaymentTypes)
const previewARJv = vi.mocked(realPreviewARJv)

function settingsResponse(over: Partial<Awaited<ReturnType<typeof realGetARSettings>>> = {}) {
  return {
    bank_code: 'KBANK',
    enabled: false,
    post_type: 'Detail' as const,
    has_settlement_layout: true,
    ...over,
  }
}

const PREVIEW = {
  rows: [],
  description: '',
  doc_no: '',
  doc_date: '',
  total_debit: 0,
  total_credit: 0,
  balanced: true,
  unmapped: [],
  post_type: 'Detail' as const,
}

describe('useSettlementMapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSamplePaymentTypes.mockResolvedValue([])
    previewARJv.mockResolvedValue(PREVIEW)
  })

  it('a bank with no settlement layout loads without seeding or previewing', async () => {
    getARSettings.mockResolvedValue(settingsResponse({ has_settlement_layout: false }))

    const { result } = renderHook(() => useSettlementMapping('SCB', {}, [], [], ''))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.hasSettlementLayout).toBe(false)
    expect(getSamplePaymentTypes).not.toHaveBeenCalled()
    expect(previewARJv).not.toHaveBeenCalled()
  })

  it('splits the page-wide saved mappings by source into Detail and Summary rows', async () => {
    getARSettings.mockResolvedValue(settingsResponse({ post_type: 'Summary' }))
    const saved = {
      commission: { dept: 'GEN', acc: '5100' },
      'VS INTER UP PREM': { dept: 'GEN', acc: '1021001', source: 'settlement_detail' },
      VS: { dept: 'GEN', acc: '1021001', source: 'settlement_summary' },
    }

    const { result } = renderHook(() => useSettlementMapping('KBANK', saved, [], [], ''))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Summary is the loaded post type, so `rows` (the currently-displayed set) is VS —
    // the fixed commission/tax/net key and the Detail-sourced key must not leak in.
    expect(result.current.rows).toEqual([{ code: 'VS', mapping: saved.VS }])
  })

  it('seeds an empty post type from the sample list rather than leaving it blank', async () => {
    getARSettings.mockResolvedValue(settingsResponse({ post_type: 'Detail' }))
    getSamplePaymentTypes.mockResolvedValue([
      { payment_type_code: 'VS INTER UP PREM' },
      { payment_type_code: 'JCB PREM' },
    ])

    const { result } = renderHook(() => useSettlementMapping('KBANK', {}, [], [], ''))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.rows.map(r => r.code).sort()).toEqual(['JCB PREM', 'VS INTER UP PREM'])
    expect(result.current.rows.every(r => !r.mapping.dept && !r.mapping.acc)).toBe(true)
    // Tagged, or the save writes them untagged and the next load cannot find them: the card
    // re-seeds them blank and the save after that blanks the real mapping.
    expect(result.current.mappingsToSave['JCB PREM'].source).toBe('settlement_detail')
    expect(result.current.mappingsToSave['JCB'].source).toBe('settlement_summary')
  })

  it('keeps an untagged mapping this bank already has for a seeded code', async () => {
    getARSettings.mockResolvedValue(settingsResponse({ post_type: 'Detail' }))
    getSamplePaymentTypes.mockResolvedValue([
      { payment_type_code: 'JCB PREM' },
      { payment_type_code: 'VS INTER PREM' },
    ])
    // Saved before seeded rows were tagged — no `source`.
    const saved = { 'JCB PREM': { dept: 'GEN', acc: '1021008' } }

    const { result } = renderHook(() => useSettlementMapping('KBANK', saved, [], [], ''))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.mappingsToSave['JCB PREM']).toEqual({
      dept: 'GEN',
      acc: '1021008',
      source: 'settlement_detail',
    })
    expect(result.current.mappingsToSave['VS INTER PREM']).toEqual({
      dept: '',
      acc: '',
      source: 'settlement_detail',
    })
  })

  // Mappings are per bank, and the page fetches the new bank's *after* the dropdown moves.
  // Loading on the bank change alone seeded the card from the previous bank's mappings and
  // never looked again, so a KBANK mapping that was saved showed as blank rows.
  it("waits for its own bank's mappings instead of seeding from the previous bank's", async () => {
    getARSettings.mockResolvedValue(settingsResponse({ post_type: 'Detail' }))
    const kbank = { 'JCB PREM': { dept: 'GEN', acc: '1021008', source: 'settlement_detail' } }

    const { result, rerender } = renderHook(
      ({ saved, of }: { saved: Record<string, { dept: string; acc: string }>; of: string }) =>
        useSettlementMapping('KBANK', saved, [], [], '', of),
      { initialProps: { saved: {}, of: 'SCB' } }
    )
    expect(getARSettings).not.toHaveBeenCalled()

    rerender({ saved: kbank, of: 'KBANK' })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.rows).toEqual([{ code: 'JCB PREM', mapping: kbank['JCB PREM'] }])
  })

  it('seeds Summary by folding the sample onto each scheme’s first token, deduped', async () => {
    getARSettings.mockResolvedValue(settingsResponse({ post_type: 'Summary' }))
    getSamplePaymentTypes.mockResolvedValue([
      { payment_type_code: 'VS INTER NON-PREM' },
      { payment_type_code: 'VS INTER PREM' },
      { payment_type_code: 'JCB PREM' },
    ])

    const { result } = renderHook(() => useSettlementMapping('KBANK', {}, [], [], ''))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.rows.map(r => r.code).sort()).toEqual(['JCB', 'VS'])
  })

  it('is not dirty right after loading, and becomes dirty on an edit', async () => {
    getARSettings.mockResolvedValue(settingsResponse())
    getSamplePaymentTypes.mockResolvedValue([{ payment_type_code: 'VS' }])

    const { result } = renderHook(() => useSettlementMapping('KBANK', {}, [], [], ''))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.dirty).toBe(false)

    act(() => result.current.setRowMapping('VS', 'dept', 'GEN'))
    await waitFor(() => expect(result.current.dirty).toBe(true))
  })

  it('mappingsToSave carries both post-type sets together, source-tagged', async () => {
    getARSettings.mockResolvedValue(settingsResponse({ post_type: 'Detail' }))
    getSamplePaymentTypes.mockResolvedValue([])

    const { result } = renderHook(() => useSettlementMapping('KBANK', {}, [], [], ''))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.addCustomType('AMEX PREM'))
    act(() => result.current.setPostType('Summary'))
    act(() => result.current.addCustomType('AMEX'))

    expect(result.current.mappingsToSave).toEqual({
      'AMEX PREM': { dept: '', acc: '', source: 'settlement_detail' },
      AMEX: { dept: '', acc: '', source: 'settlement_summary' },
    })
  })

  it('a duplicate custom type is rejected rather than silently overwritten', async () => {
    getARSettings.mockResolvedValue(settingsResponse())
    getSamplePaymentTypes.mockResolvedValue([])

    const { result } = renderHook(() => useSettlementMapping('KBANK', {}, [], [], ''))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.addCustomType('AMEX'))
    act(() => result.current.setRowMapping('AMEX', 'dept', 'GEN'))
    act(() => result.current.addCustomType('amex'))

    expect(result.current.rows).toHaveLength(1)
    expect(result.current.rows[0].mapping.dept).toBe('GEN')
  })

  // Ticket D (2026-09-22): `description` is now injected live from the page's own
  // Description field (`descriptionForBank`), not a `template` this hook owns — the
  // preview has to track it the same way it already tracks `postType` and the rows.
  it('previews using the description the page passed in', async () => {
    getARSettings.mockResolvedValue(settingsResponse())
    getSamplePaymentTypes.mockResolvedValue([])

    renderHook(() => useSettlementMapping('KBANK', {}, [], [], 'AR Recon {Settlement_Date}'))
    await waitFor(() => expect(previewARJv).toHaveBeenCalled())

    expect(previewARJv).toHaveBeenCalledWith(
      expect.objectContaining({ jv_description_template: 'AR Recon {Settlement_Date}' })
    )
  })

  it('refreshes the preview when the page edits the description', async () => {
    getARSettings.mockResolvedValue(settingsResponse())
    getSamplePaymentTypes.mockResolvedValue([])

    const { rerender } = renderHook(
      ({ description }) => useSettlementMapping('KBANK', {}, [], [], description),
      { initialProps: { description: 'AR Recon' } }
    )
    await waitFor(() => expect(previewARJv).toHaveBeenCalledTimes(1))

    rerender({ description: 'AR Recon v2' })
    await waitFor(() => expect(previewARJv).toHaveBeenCalledTimes(2))
    expect(previewARJv).toHaveBeenLastCalledWith(
      expect.objectContaining({ jv_description_template: 'AR Recon v2' })
    )
  })

  // ── The payment-type dialog's draft (2026-09-30) ──────────────────────────────────

  it('bulk-applies one department and account to several rows, keeping their tag', async () => {
    getARSettings.mockResolvedValue(settingsResponse({ post_type: 'Detail' }))
    getSamplePaymentTypes.mockResolvedValue([
      { payment_type_code: 'VS INTER PREM' },
      { payment_type_code: 'VS INTER UP PREM' },
      { payment_type_code: 'JCB PREM' },
    ])
    const { result } = renderHook(() => useSettlementMapping('KBANK', {}, [], [], ''))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() =>
      result.current.applyToMany(['VS INTER PREM', 'VS INTER UP PREM'], {
        dept: 'GEN',
        acc: '1021004',
      })
    )

    const saved = result.current.mappingsToSave
    expect(saved['VS INTER PREM']).toEqual({
      dept: 'GEN',
      acc: '1021004',
      source: 'settlement_detail',
    })
    expect(saved['VS INTER UP PREM']).toEqual({
      dept: 'GEN',
      acc: '1021004',
      source: 'settlement_detail',
    })
    expect(saved['JCB PREM']).toEqual({ dept: '', acc: '', source: 'settlement_detail' })
  })

  it('clears an account the new department does not allow, as a fee-invoice row does', async () => {
    getARSettings.mockResolvedValue(settingsResponse({ post_type: 'Summary' }))
    const saved = { VS: { dept: 'GEN', acc: '1130M', source: 'settlement_summary' } }
    const departments = [{ code: 'FIN', name: 'Finance', allowedAccounts: ['1130V'] }]
    const { result } = renderHook(() => useSettlementMapping('KBANK', saved, [], departments, ''))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setRowMapping('VS', 'dept', 'FIN'))
    expect(result.current.mappingsToSave.VS).toEqual({
      dept: 'FIN',
      acc: '',
      source: 'settlement_summary',
    })
  })

  it('restores both post types on Cancel, and keeps them on Done', async () => {
    getARSettings.mockResolvedValue(settingsResponse({ post_type: 'Summary' }))
    const saved = { VS: { dept: 'GEN', acc: '1021004', source: 'settlement_summary' } }
    const { result } = renderHook(() => useSettlementMapping('KBANK', saved, [], [], ''))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.snapshot())
    act(() => result.current.setRowMapping('VS', 'acc', '9999'))
    act(() => {
      result.current.addCustomType('AMEX')
    })
    act(() => result.current.restore())
    expect(result.current.mappingsToSave).toEqual(saved)

    act(() => result.current.snapshot())
    act(() => result.current.setRowMapping('VS', 'acc', '9999'))
    act(() => result.current.dropSnapshot())
    act(() => result.current.restore())
    expect(result.current.mappingsToSave.VS.acc).toBe('9999')
  })

  it('refuses a code another list already owns', async () => {
    getARSettings.mockResolvedValue(settingsResponse({ post_type: 'Summary' }))
    const { result } = renderHook(() => useSettlementMapping('KBANK', {}, [], [], ''))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let err: string | null = null
    act(() => {
      err = result.current.addCustomType('visa', new Set(['VISA']))
    })
    expect(err).toBe('duplicate')
    expect(result.current.rows).toEqual([])
  })

  it('the undo a remove returns puts the row back with its mapping and tag', async () => {
    getARSettings.mockResolvedValue(settingsResponse({ post_type: 'Summary' }))
    const saved = {
      VS: { dept: 'GEN', acc: '1021004', source: 'settlement_summary' },
      MC: { dept: 'GEN', acc: '1021005', source: 'settlement_summary' },
    }
    const { result } = renderHook(() => useSettlementMapping('KBANK', saved, [], [], ''))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let undo = () => {}
    act(() => {
      undo = result.current.removeType('VS')
    })
    expect(result.current.mappingsToSave).not.toHaveProperty('VS')

    act(() => undo())
    expect(result.current.mappingsToSave.VS).toEqual(saved.VS)

    // Idempotent: a second press, or one after Cancel restored the row, changes nothing.
    act(() => result.current.setRowMapping('VS', 'acc', '9999'))
    act(() => undo())
    expect(result.current.mappingsToSave.VS.acc).toBe('9999')
  })
})
