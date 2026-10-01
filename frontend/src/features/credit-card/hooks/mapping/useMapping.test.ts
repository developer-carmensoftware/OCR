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
vi.mock('@/shared/lib/toast', () => ({ showToast: vi.fn() }))
vi.mock('@/features/credit-card/api/mapping', () => ({
  suggestMapping: vi.fn(),
  suggestPaymentTypes: vi.fn(),
}))

import {
  getAccountingConfig as realGetAccountingConfig,
  saveAccountingConfig as realSaveAccountingConfig,
} from '@/shared/api/config'
import { saveARSettings as realSaveARSettings } from '@/features/credit-card/api/arReconcile'
import { showToast as realShowToast } from '@/shared/lib/toast'
import { appKey } from '@/shared/lib/storage'

const getAccountingConfig = vi.mocked(realGetAccountingConfig)
const saveAccountingConfig = vi.mocked(realSaveAccountingConfig)
const saveARSettings = vi.mocked(realSaveARSettings)
const showToast = vi.mocked(realShowToast)

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
    await act(() => result.current.saveAllSettings())

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
    await act(() => result.current.saveAllSettings())

    // The PUT replaces every entry of the bank, so leaving them out would delete them.
    const sent = saveAccountingConfig.mock.calls[0][0].mappings ?? {}
    expect(sent['VS INTER PREM']).toEqual(KBANK_CONFIG.mappings['VS INTER PREM'])
    expect(sent.VS).toEqual(KBANK_CONFIG.mappings.VS)
  })

  it('sends only what the settlement hook holds, so a removed type stays removed', async () => {
    const { result } = await loaded()
    await act(() =>
      result.current.saveAllSettings({
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

// The page's one button. A failed PUT used to be swallowed ("localStorage already saved"),
// and the page carried on — saved the settlement grouping, closed the tab or went back to
// the queue — exactly as if it had worked.
describe('useMapping — saving', () => {
  const KTC = {
    bank_code: 'KTC',
    file_prefix: 'IC',
    branch: '00000',
    mappings: { commission: { dept: '307', acc: '6080008' } },
    custom_types: [],
  }

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    window.location.hash = '#/CreditCardOCR/mapping'
  })

  async function loaded(config: object = KTC) {
    getAccountingConfig.mockResolvedValue(config as never)
    const hook = renderHook(() => useMapping())
    await waitFor(() => expect(hook.result.current.mappingsBankCode).toBe('KTC'))
    return hook
  }

  it('stays on the page and says why when the save fails', async () => {
    saveAccountingConfig.mockRejectedValue(
      new Error('Account 999 is not allowed for department GEN')
    )
    const { result } = await loaded()

    await act(() =>
      result.current.saveAllSettings({
        hasSettlementLayout: true,
        mappingsToSave: {},
        postType: 'Detail',
        bankCode: 'KTC',
      })
    )

    expect(saveARSettings).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('#/CreditCardOCR/mapping')
    expect(result.current.modalConfig).toMatchObject({ show: true, type: 'error' })
    expect(result.current.modalConfig.message).toContain('Account 999 is not allowed')
    // Nothing tells the wizard's tab to re-read a config that was never saved.
    expect(localStorage.getItem(appKey('accounting_config_updated'))).toBeNull()
    expect(result.current.saving).toBe(false)
  })

  it('says it saved, then goes back to the queue', async () => {
    saveAccountingConfig.mockResolvedValue({} as never)
    const { result } = await loaded()

    await act(() => result.current.saveAllSettings())

    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('KTC'), 'success')
    expect(window.location.hash).toBe('#/CreditCardOCR')
  })

  it('will not save a branch that is not five digits', async () => {
    // `0000` is what nopackage1 has stored, typed that way; the input-tax record posts it.
    const { result } = await loaded({ ...KTC, branch: '0000' })

    await act(() => result.current.saveAllSettings())

    expect(saveAccountingConfig).not.toHaveBeenCalled()
    expect(result.current.modalConfig).toMatchObject({ show: true, type: 'error' })
    expect(result.current.modalConfig.message).toMatch(/5 digits/)
  })

  it("does not ask for the bank's name, tax ID or address, which come from the registry", async () => {
    // They are overwritten from BANK_INFO on every load and never reach the server; every
    // reader takes the document's bank from the registry. Required, they only blocked Save.
    const { result } = await loaded()
    act(() => result.current.setCompany({ name: '', taxId: '', branch: '00000', address: '' }))

    expect(result.current.missingCompanyFields).toEqual([])
  })
})

// AI Suggest on the page and in the dialog. A failure went to the console only — the
// button stopped spinning and nothing else happened — while the settlement list in the
// same dialog raised a toast; and "all mapped" was a modal stacked over the dialog there.
describe('useMapping — AI suggest says what happened', () => {
  beforeEach(async () => {
    localStorage.clear()
    vi.clearAllMocks()
    const carmen = await import('@/shared/api/carmen')
    vi.mocked(carmen.fetchAccountCodes).mockResolvedValueOnce([
      { AccCode: '6080008', Description: 'Commission' },
    ] as never)
    vi.mocked(carmen.fetchDepartments).mockResolvedValueOnce([
      { DeptCode: 'GEN', Description: 'General' },
    ] as never)
  })

  async function withMasters(mappings: object = {}) {
    getAccountingConfig.mockResolvedValue({
      bank_code: 'KTC',
      file_prefix: 'IC',
      mappings,
      custom_types: ['VISA'],
    } as never)
    const hook = renderHook(() => useMapping())
    await waitFor(() => expect(hook.result.current.masterAccounts).toHaveLength(1))
    await waitFor(() => expect(hook.result.current.mappingsBankCode).toBe('KTC'))
    return hook
  }

  it('says so when the suggestion fails, not only in the console', async () => {
    const api = await import('@/features/credit-card/api/mapping')
    vi.mocked(api.suggestMapping).mockRejectedValue(new Error('502'))
    const { result } = await withMasters()

    await act(() => result.current.autoSuggest())

    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/suggestion failed/i), 'error')
  })

  it('answers "all mapped" with a toast, not a modal over the dialog', async () => {
    const { result } = await withMasters({ VISA: { dept: 'GEN', acc: '6080008' } })

    await act(() => result.current.autoSuggestPaymentTypes(['VISA']))

    expect(showToast).toHaveBeenCalledWith('Every payment type is already mapped', 'info')
    expect(result.current.modalConfig.show).toBe(false)
  })
})

// Save is per bank and leaves the page, so setting up several banks means switching — and a
// switch replaced the form with the next bank's rows, dropping every unsaved edit unasked.
describe('useMapping — unsaved changes', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  async function loaded() {
    getAccountingConfig.mockResolvedValue({
      bank_code: 'KTC',
      file_prefix: 'IC',
      branch: '00000',
      mappings: {
        commission: { dept: '307', acc: '6080008' },
        VISA: { dept: 'GEN', acc: '1130' },
      },
      custom_types: ['VISA'],
      bank_descriptions: { KTC: 'KTC fee' },
    } as never)
    const hook = renderHook(() => useMapping())
    await waitFor(() => expect(hook.result.current.mappingsBankCode).toBe('KTC'))
    return hook
  }

  it('is clean once a bank has loaded', async () => {
    const { result } = await loaded()

    expect(result.current.rulesDirty).toBe(false)
    expect(result.current.headerDirty).toBe(false)
  })

  it('an account edit is a rules change, and putting it back is clean again', async () => {
    const { result } = await loaded()

    act(() => result.current.handleMappingChange('commission', 'acc', '6080009'))
    expect(result.current.rulesDirty).toBe(true)

    act(() => result.current.handleMappingChange('commission', 'acc', '6080008'))
    expect(result.current.rulesDirty).toBe(false)
  })

  it('counts a payment-type edit too', async () => {
    const { result } = await loaded()

    act(() => result.current.handlePaymentMappingChange('VISA', 'acc', '1131'))

    expect(result.current.rulesDirty).toBe(true)
  })

  it('counts a description edit as a header change: it survives a bank switch', async () => {
    const { result } = await loaded()

    act(() => result.current.setBankDescriptions({ KTC: 'KTC merchant fee' }))

    expect(result.current.headerDirty).toBe(true)
    expect(result.current.rulesDirty).toBe(false)
  })

  it("is clean again once the next bank's rows have replaced the form", async () => {
    const { result } = await loaded()
    act(() => result.current.handleMappingChange('commission', 'acc', '6080009'))

    getAccountingConfig.mockResolvedValue({
      bank_code: 'KTC',
      file_prefix: 'IC',
      mappings: { tax: { dept: 'GEN', acc: '1154' } },
      custom_types: [],
    } as never)
    act(() => result.current.handleBankChange('Siam Commercial Bank (SCB)'))
    await waitFor(() => expect(result.current.mappingsBankCode).toBe('SCB'))

    expect(result.current.rulesDirty).toBe(false)
  })
})
