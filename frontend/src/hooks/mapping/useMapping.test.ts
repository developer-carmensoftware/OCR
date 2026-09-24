import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useMapping } from './useMapping'

vi.mock('../../lib/api/config', () => ({
  getAccountingConfig: vi.fn(),
  saveAccountingConfig: vi.fn(),
}))
vi.mock('../../lib/api/carmen', () => ({
  fetchAccountCodes: vi.fn().mockResolvedValue([]),
  fetchDepartments: vi.fn().mockResolvedValue([]),
  fetchGLPrefixes: vi.fn().mockResolvedValue([]),
}))

import { getAccountingConfig as realGetAccountingConfig } from '../../lib/api/config'
import { appKey } from '../../lib/storage'

const getAccountingConfig = vi.mocked(realGetAccountingConfig)

const AR = 'Account Receivable'

describe('useMapping — restoring saved mappings', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('restores payment-type mappings, not just commission/tax/net', async () => {
    getAccountingConfig.mockResolvedValue({
      bank_code: 'GHL',
      file_prefix: 'IC',
      mappings: {
        commission: { dept: '307', acc: '6080008' },
        [AR]: { dept: 'GEN', acc: '1021009' },
      },
      custom_types: [],
    } as never)

    const { result } = renderHook(() => useMapping())
    await waitFor(() => expect(result.current.mappings.commission.acc).toBe('6080008'))

    expect(result.current.paymentAmount[AR]).toEqual({ dept: 'GEN', acc: '1021009' })
  })

  it('restores custom payment types', async () => {
    getAccountingConfig.mockResolvedValue({
      bank_code: 'GHL',
      file_prefix: 'IC',
      mappings: { [AR]: { dept: 'GEN', acc: '1021009' } },
      custom_types: ['VISA'],
    } as never)

    const { result } = renderHook(() => useMapping())
    await waitFor(() => expect(result.current.customPaymentTypes).toContain('VISA'))

    // seeded blank so the row renders and can be mapped
    expect(result.current.paymentAmount.VISA).toEqual({ dept: '', acc: '' })
  })

  it('restores from localStorage when the API is unreachable', async () => {
    getAccountingConfig.mockRejectedValue(new Error('offline'))
    localStorage.setItem(
      appKey('accountingConfig'),
      JSON.stringify({
        bank: 'GHL',
        filePrefix: 'IC',
        mappings: { commission: { dept: '307', acc: '6080008' } },
        paymentAmount: { [AR]: { dept: 'GEN', acc: '1021009' } },
      })
    )

    const { result } = renderHook(() => useMapping())
    await waitFor(() => expect(result.current.paymentAmount[AR]?.acc).toBe('1021009'))

    expect(result.current.mappings.commission.acc).toBe('6080008')
  })
})

// A BU handling more than one bank has a separate GL mapping per bank
// (20260924000000_bank_scoped_mapping_entries) — switching the dropdown must show that
// bank's own dept/acc pairs, never the previous bank's carried forward.
describe('useMapping — switching banks', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('replaces commission/tax/net and payment types with the new bank’s own, dropping the old', async () => {
    getAccountingConfig.mockResolvedValueOnce({
      bank_code: 'GHL',
      file_prefix: 'IC',
      mappings: {
        commission: { dept: '307', acc: '6080008' },
        [AR]: { dept: 'GEN', acc: '1021009' },
      },
      custom_types: [AR],
    } as never)

    const { result } = renderHook(() => useMapping())
    await waitFor(() => expect(result.current.mappings.commission.acc).toBe('6080008'))
    expect(result.current.paymentAmount[AR]).toEqual({ dept: 'GEN', acc: '1021009' })

    getAccountingConfig.mockResolvedValueOnce({
      bank_code: 'SCB',
      file_prefix: 'IC',
      mappings: { tax: { dept: '999', acc: '1112223' } },
      custom_types: [],
    } as never)
    act(() => result.current.setBank('Siam Commercial Bank (SCB)'))

    await waitFor(() => expect(result.current.mappings.tax.acc).toBe('1112223'))
    // GHL's commission mapping and its custom payment type must not survive the switch.
    expect(result.current.mappings.commission).toEqual({ dept: '', acc: '' })
    expect(result.current.paymentAmount[AR]).toBeUndefined()
    expect(result.current.customPaymentTypes).toEqual([])
  })
})
