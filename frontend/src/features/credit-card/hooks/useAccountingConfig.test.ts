import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAccountingConfig } from './useAccountingConfig'

vi.mock('@/shared/api/config', () => ({ getAccountingConfig: vi.fn() }))

import { getAccountingConfig as realGetAccountingConfig } from '@/shared/api/config'
import { appKey } from '@/shared/lib/storage'

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

  // A BU with more than one bank keeps a GL mapping per bank (20260924000000). Unscoped, the
  // server answers with whichever bank the mapping page saved last — so a KBANK statement
  // was built, and posted, against another bank's accounts.
  it("asks for the named bank's own mappings", async () => {
    getAccountingConfig.mockResolvedValue({
      bank_code: 'SCB',
      file_prefix: 'IC',
      mappings: { net: { dept: 'GEN', acc: '1011001' } },
    } as never)

    const { result } = renderHook(() => useAccountingConfig('KBANK'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(getAccountingConfig).toHaveBeenCalledWith('KBANK')
  })

  it('refetches when the bank changes, and is loading until that bank has landed', async () => {
    getAccountingConfig.mockResolvedValueOnce({
      bank_code: 'KBANK',
      file_prefix: 'IC',
      mappings: { net: { dept: 'GEN', acc: 'KBANK-ACC' } },
    } as never)
    const { result, rerender } = renderHook(({ bank }) => useAccountingConfig(bank), {
      initialProps: { bank: 'KBANK' },
    })
    await waitFor(() => expect(result.current.mappings.net?.acc).toBe('KBANK-ACC'))

    let land: (v: unknown) => void = () => {}
    getAccountingConfig.mockReturnValueOnce(new Promise(r => (land = r)) as never)
    rerender({ bank: 'SCB' })

    // In the very render that changed the bank, KBANK's accounts must not pass for SCB's.
    expect(result.current.loading).toBe(true)
    expect(getAccountingConfig).toHaveBeenLastCalledWith('SCB')

    await act(async () =>
      land({
        bank_code: 'KBANK',
        file_prefix: 'IC',
        mappings: { net: { dept: 'GEN', acc: 'SCB-ACC' } },
      })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.mappings.net.acc).toBe('SCB-ACC')
  })

  it('does not stand in the offline copy for a bank asked for by name', async () => {
    // The copy holds whichever bank the mapping page saved last, and a scan overwrites its
    // `bank` on every run — its accounts cannot be vouched for as this bank's.
    getAccountingConfig.mockRejectedValue(new Error('offline'))
    localStorage.setItem(
      appKey('accountingConfig'),
      JSON.stringify({
        bank: 'Siam Commercial Bank (SCB)',
        filePrefix: 'IC',
        mappings: { net: { dept: 'GEN', acc: 'SCB-ACC' } },
      })
    )

    const { result } = renderHook(() => useAccountingConfig('KBANK'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.config).toBeNull()
  })

  // A review opened by its link knows no bank until the document arrives; the read that
  // used to go out meanwhile answered for whichever bank the mapping page saved last.
  it('reads nothing while it is told to wait, and then reads once', async () => {
    getAccountingConfig.mockResolvedValue({
      bank_code: 'KTC',
      file_prefix: 'IC',
      mappings: { net: { dept: 'GEN', acc: 'KTC-ACC' } },
    } as never)
    const { result, rerender } = renderHook(
      ({ bank, wait }) => useAccountingConfig(bank, { wait }),
      { initialProps: { bank: undefined as string | undefined, wait: true } }
    )

    await act(async () => {})
    expect(getAccountingConfig).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)

    rerender({ bank: 'KTC', wait: false })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getAccountingConfig).toHaveBeenCalledTimes(1)
    expect(getAccountingConfig).toHaveBeenCalledWith('KTC')
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
