import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
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
