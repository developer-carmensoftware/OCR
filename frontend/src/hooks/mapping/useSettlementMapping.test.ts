import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useSettlementMapping } from './useSettlementMapping'

vi.mock('../../lib/api/arReconcile', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/api/arReconcile')>()
  return {
    ...actual,
    getARSettings: vi.fn(),
    getSamplePaymentTypes: vi.fn(),
    previewARJv: vi.fn(),
  }
})
vi.mock('../../lib/api/mapping', () => ({ suggestPaymentTypes: vi.fn() }))

import {
  getARSettings as realGetARSettings,
  getSamplePaymentTypes as realGetSamplePaymentTypes,
  previewARJv as realPreviewARJv,
} from '../../lib/api/arReconcile'

const getARSettings = vi.mocked(realGetARSettings)
const getSamplePaymentTypes = vi.mocked(realGetSamplePaymentTypes)
const previewARJv = vi.mocked(realPreviewARJv)

function settingsResponse(over: Partial<Awaited<ReturnType<typeof realGetARSettings>>> = {}) {
  return {
    bank_code: 'KBANK',
    enabled: false,
    post_type: 'Detail' as const,
    jv_description_template: 'Credit Card AR Reconcile {Settlement_Date}',
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

    const { result } = renderHook(() => useSettlementMapping('SCB', {}, [], []))
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

    const { result } = renderHook(() => useSettlementMapping('KBANK', saved, [], []))
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

    const { result } = renderHook(() => useSettlementMapping('KBANK', {}, [], []))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.rows.map(r => r.code).sort()).toEqual(['JCB PREM', 'VS INTER UP PREM'])
    expect(result.current.rows.every(r => !r.mapping.dept && !r.mapping.acc)).toBe(true)
  })

  it('seeds Summary by folding the sample onto each scheme’s first token, deduped', async () => {
    getARSettings.mockResolvedValue(settingsResponse({ post_type: 'Summary' }))
    getSamplePaymentTypes.mockResolvedValue([
      { payment_type_code: 'VS INTER NON-PREM' },
      { payment_type_code: 'VS INTER PREM' },
      { payment_type_code: 'JCB PREM' },
    ])

    const { result } = renderHook(() => useSettlementMapping('KBANK', {}, [], []))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.rows.map(r => r.code).sort()).toEqual(['JCB', 'VS'])
  })

  it('is not dirty right after loading, and becomes dirty on an edit', async () => {
    getARSettings.mockResolvedValue(settingsResponse())
    getSamplePaymentTypes.mockResolvedValue([{ payment_type_code: 'VS' }])

    const { result } = renderHook(() => useSettlementMapping('KBANK', {}, [], []))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.dirty).toBe(false)

    act(() => result.current.setRowMapping('VS', 'dept', 'GEN'))
    await waitFor(() => expect(result.current.dirty).toBe(true))
  })

  it('mappingsToSave carries both post-type sets together, source-tagged', async () => {
    getARSettings.mockResolvedValue(settingsResponse({ post_type: 'Detail' }))
    getSamplePaymentTypes.mockResolvedValue([])

    const { result } = renderHook(() => useSettlementMapping('KBANK', {}, [], []))
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

    const { result } = renderHook(() => useSettlementMapping('KBANK', {}, [], []))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.addCustomType('AMEX'))
    act(() => result.current.setRowMapping('AMEX', 'dept', 'GEN'))
    act(() => result.current.addCustomType('amex'))

    expect(result.current.rows).toHaveLength(1)
    expect(result.current.rows[0].mapping.dept).toBe('GEN')
  })
})
