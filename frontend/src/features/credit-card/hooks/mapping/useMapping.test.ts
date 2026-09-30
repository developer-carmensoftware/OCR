import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useMapping } from './useMapping'

vi.mock('@/shared/api/config', () => ({
  getAccountingConfig: vi.fn(),
  saveAccountingConfig: vi.fn(),
}))
vi.mock('@/features/credit-card/api/arReconcile', async importOriginal => ({
  ...(await importOriginal<typeof import('@/features/credit-card/api/arReconcile')>()),
  saveARSettings: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/shared/api/carmen', () => ({
  fetchAccountCodes: vi.fn().mockResolvedValue([]),
  fetchDepartments: vi.fn().mockResolvedValue([]),
  fetchGLPrefixes: vi.fn().mockResolvedValue([]),
}))

import {
  getAccountingConfig as realGetAccountingConfig,
  saveAccountingConfig as realSaveAccountingConfig,
} from '@/shared/api/config'
import { appKey } from '@/shared/lib/storage'

const getAccountingConfig = vi.mocked(realGetAccountingConfig)
const saveAccountingConfig = vi.mocked(realSaveAccountingConfig)

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

  // 2026-09-30: until the new bank's mappings land, the form still holds the old bank's —
  // and the PUT replaces the *new* bank's entries with whatever it is sent.
  it("will not save while the new bank's mappings are still on their way", async () => {
    getAccountingConfig.mockResolvedValueOnce({
      bank_code: 'GHL',
      file_prefix: 'IC',
      mappings: { commission: { dept: '307', acc: '6080008' } },
      custom_types: [],
    } as never)
    const { result } = renderHook(() => useMapping())
    await waitFor(() => expect(result.current.mappings.commission.acc).toBe('6080008'))

    getAccountingConfig.mockReturnValueOnce(new Promise(() => {}) as never) // never lands
    act(() => result.current.handleBankChange('Siam Commercial Bank (SCB)'))
    await act(() => result.current.saveAllSettings(false))

    expect(saveAccountingConfig).not.toHaveBeenCalled()
  })
})

// A settlement-report bank's Detail/Summary keys are `useSettlementMapping`'s, not payment
// types of the fee invoice. Loading them into both lists put every settlement key in the
// payment-type dialog twice (2026-09-30), and a settlement type removed there came back
// on save, untagged, from the fee-invoice list.
describe('useMapping — settlement keys', () => {
  const KBANK_CONFIG = {
    bank_code: 'KBANK',
    file_prefix: 'AR',
    mappings: {
      commission: { dept: 'GEN', acc: '6080008' },
      Visa: { dept: 'GEN', acc: '1130V' },
      'VS INTER PREM': { dept: 'GEN', acc: '1021004', source: 'settlement_detail' },
      VS: { dept: '', acc: '', source: 'settlement_summary' },
    },
    custom_types: ['Visa', 'VS INTER PREM', 'VS'],
  }

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  async function loaded() {
    getAccountingConfig.mockResolvedValue(KBANK_CONFIG as never)
    const hook = renderHook(() => useMapping())
    await waitFor(() => expect(hook.result.current.mappings.commission.acc).toBe('6080008'))
    // What `saveAllSettings` insists on before it will send anything.
    act(() => {
      hook.result.current.setFileSource('ACKB')
      hook.result.current.setCompany({
        name: 'Kasikornbank',
        taxId: '0107536000315',
        branch: '00000',
        address: 'Bangkok',
      })
    })
    return hook
  }

  it('keeps them out of the fee-invoice payment types', async () => {
    const { result } = await loaded()

    expect(Object.keys(result.current.paymentAmount)).toEqual(['Visa'])
    expect(result.current.customPaymentTypes).toEqual(['Visa'])
  })

  it('sends them back unchanged when the settlement hook has nothing to give', async () => {
    const { result } = await loaded()
    await act(() => result.current.saveAllSettings(false))

    // The PUT replaces every entry of the bank, so leaving them out would delete them.
    const sent = saveAccountingConfig.mock.calls[0][0].mappings ?? {}
    expect(sent['VS INTER PREM']).toEqual(KBANK_CONFIG.mappings['VS INTER PREM'])
    expect(sent.VS).toEqual(KBANK_CONFIG.mappings.VS)
  })

  it('sends only what the settlement hook holds, so a removed type stays removed', async () => {
    const { result } = await loaded()
    await act(() =>
      result.current.saveAllSettings(false, {
        hasSettlementLayout: true,
        // VS removed in the dialog; VS INTER PREM kept.
        mappingsToSave: {
          'VS INTER PREM': { dept: 'GEN', acc: '1021004', source: 'settlement_detail' },
        },
        postType: 'Detail',
        bankCode: 'KBANK',
      })
    )

    const call = saveAccountingConfig.mock.calls[0][0]
    const sentMappings = call.mappings ?? {}
    expect(sentMappings).not.toHaveProperty('VS')
    expect(sentMappings['VS INTER PREM']).toEqual({
      dept: 'GEN',
      acc: '1021004',
      source: 'settlement_detail',
    })
    expect(sentMappings.Visa).toEqual({ dept: 'GEN', acc: '1130V' })
    expect(call.custom_types).toEqual(['Visa'])
  })
})
