import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAccountingConfig } from './useAccountingConfig'

vi.mock('../../lib/api/config', () => ({ getAccountingConfig: vi.fn() }))

import { getAccountingConfig as realGetAccountingConfig } from '../../lib/api/config'
import { appKey } from '../../lib/storage'

const getAccountingConfig = vi.mocked(realGetAccountingConfig)

const AR = 'Account Receivable'

// This hook feeds the Step-4 JV rows. The API returns main mappings and payment types
// merged in one `mappings` object; everything downstream expects them split.
describe('useAccountingConfig', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('splits the merged API mappings into main mappings and payment types', async () => {
    getAccountingConfig.mockResolvedValue({
      bank_code: 'GHL',
      file_prefix: 'IC',
      file_source: 'ACPP',
      mappings: {
        commission: { dept: '307', acc: '6080008' },
        tax: { dept: 'GEN', acc: '1022005' },
        net: { dept: 'GEN', acc: '1011001' },
        [AR]: { dept: 'GEN', acc: '1021009' },
      },
    } as never)

    const { result } = renderHook(() => useAccountingConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(Object.keys(result.current.mappings).sort()).toEqual(['commission', 'net', 'tax'])
    expect(result.current.paymentAmount).toEqual({ [AR]: { dept: 'GEN', acc: '1021009' } })
    expect(result.current.filePrefix).toBe('IC')
    expect(result.current.fileSource).toBe('ACPP')
  })

  it('falls back to localStorage when the API is unreachable', async () => {
    getAccountingConfig.mockRejectedValue(new Error('offline'))
    localStorage.setItem(
      appKey('accountingConfig'),
      JSON.stringify({
        filePrefix: 'IC',
        mappings: { commission: { dept: '307', acc: '6080008' } },
        paymentAmount: { [AR]: { dept: 'GEN', acc: '1021009' } },
      })
    )

    const { result } = renderHook(() => useAccountingConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.mappings.commission.acc).toBe('6080008')
    expect(result.current.paymentAmount[AR].acc).toBe('1021009')
  })

  it('merges accountMappingAmount over the offline config, dropping __customTypes', async () => {
    getAccountingConfig.mockRejectedValue(new Error('offline'))
    localStorage.setItem(
      appKey('accountingConfig'),
      JSON.stringify({ filePrefix: 'IC', mappings: {}, paymentAmount: {} })
    )
    localStorage.setItem(
      appKey('accountMappingAmount'),
      JSON.stringify({ [AR]: { dept: 'GEN', acc: '1021009' }, __customTypes: ['VISA'] })
    )

    const { result } = renderHook(() => useAccountingConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.paymentAmount[AR].acc).toBe('1021009')
    expect(result.current.paymentAmount.__customTypes).toBeUndefined()
  })

  it('treats an empty API config as no config at all', async () => {
    getAccountingConfig.mockResolvedValue({ mappings: {} } as never)

    const { result } = renderHook(() => useAccountingConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))

    // AccountingReview keys its "no mapping yet" banner off a null config.
    expect(result.current.config).toBeNull()
  })

  it('refresh re-reads the config', async () => {
    getAccountingConfig.mockResolvedValue({
      bank_code: 'GHL',
      file_prefix: 'IC',
      mappings: { commission: { dept: '307', acc: '6080008' } },
    } as never)

    const { result } = renderHook(() => useAccountingConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))

    getAccountingConfig.mockResolvedValue({
      bank_code: 'GHL',
      file_prefix: 'IC',
      mappings: { commission: { dept: '308', acc: '6080009' } },
    } as never)
    act(() => result.current.refresh())

    await waitFor(() => expect(result.current.mappings.commission.acc).toBe('6080009'))
  })
})
