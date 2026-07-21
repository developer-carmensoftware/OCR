import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type React from 'react'
import { useAPSubmission } from './useAPSubmission'
import type { APLineItem } from './useAPExtraction'
import type { APInvoiceHeader } from '../../constants/apInvoice'
import type { Vendor } from './useAPVendor'
import type { CarmenCodeItem } from '../../lib/api/carmen'

vi.mock('../../lib/api/carmen', () => ({
  fetchAccountCodes: vi.fn(),
  fetchDepartments: vi.fn(),
  submitAPInvoiceToCarmen: vi.fn(),
}))
vi.mock('../../lib/api/client', () => ({ apiFetch: vi.fn() }))
vi.mock('../../lib/toast', () => ({
  showToast: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
    loading: vi.fn(() => 'toast-id'),
  },
}))
vi.mock('../../lib/format', () => ({
  parseNum: vi.fn((v: unknown) => parseFloat(String(v).replace(/,/g, '')) || 0),
}))
vi.mock('../../lib/date', () => ({
  parseDateToISO: vi.fn(() => '2024-05-15T00:00:00.000Z'),
  normalizeYearToCE: vi.fn((y: string | number) => {
    const val = parseInt(String(y), 10)
    return val > 2400 ? val - 543 : val
  }),
}))

import {
  fetchAccountCodes as realFetchAccountCodes,
  fetchDepartments as realFetchDepartments,
  submitAPInvoiceToCarmen as realSubmitAPInvoiceToCarmen,
} from '../../lib/api/carmen'
import { apiFetch as realApiFetch } from '../../lib/api/client'
import { showToast, toast } from '../../lib/toast'

const fetchAccountCodes = vi.mocked(realFetchAccountCodes)
const fetchDepartments = vi.mocked(realFetchDepartments)
const submitAPInvoiceToCarmen = vi.mocked(realSubmitAPInvoiceToCarmen)
const apiFetch = vi.mocked(realApiFetch)

// The Carmen JV payload is built as Record<string, unknown> (see apInvoicePayload.ts);
// this narrows just the fields these tests read off submitAPInvoiceToCarmen's call args.
interface CarmenDetailLine {
  InvdTaxT1: string
  TaxProfileCode1: string | null
  InvdT1Dr: string
  InvdT1DrDeptCode: string
  InvdTaxR1: string
  InvdPrice: string
  InvdQty: number
  NetAmt: string
  TotalPrice: string
}
interface CarmenPayload {
  Detail: CarmenDetailLine[]
  TaxPeriod: string
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const MOCK_VENDOR = {
  code: 'VN001',
  term: 30,
  vatCrAccCode: '2100',
  vat1DrAccCode: '1100',
  vat1DrDeptCode: 'ACC',
  crDeptCode: 'ACC',
  taxProfileCode1: null,
} as unknown as Vendor

const MAPPED_ITEMS: APLineItem[] = [
  {
    description: 'Office supplies',
    qty: '1',
    unitPrice: '100.00',
    discountAmt: '0',
    discountPct: '0',
    lineSubTotal: '100.00',
    taxPct: '7',
    taxAmt: '7.00',
    lineTotal: '107.00',
    deptCode: 'ACC',
    accountCode: '1100',
  },
]

const UNMAPPED_ITEMS: APLineItem[] = [{ ...MAPPED_ITEMS[0], deptCode: '', accountCode: '' }]

const MOCK_HEADER = {
  vendorName: 'Test Corp',
  documentNumber: 'INV-001',
  documentDate: '15/05/2024',
  taxType: 'Add',
  grandTotal: '107.00',
  invhDesc: 'Monthly office supplies',
} as unknown as APInvoiceHeader

function makeProps(overrides: Record<string, unknown> = {}) {
  const lineItems = (overrides.lineItems as APLineItem[] | undefined) ?? [...MAPPED_ITEMS]
  const setLineItems =
    (overrides.setLineItems as React.Dispatch<React.SetStateAction<APLineItem[]>> | undefined) ??
    vi.fn((updater: React.SetStateAction<APLineItem[]>) => {
      if (typeof updater === 'function') updater(lineItems)
    })
  return {
    setStep: vi.fn(),
    setModal: vi.fn(),
    headerData: { ...MOCK_HEADER },
    lineItems,
    setLineItems,
    systemVendor: { ...MOCK_VENDOR },
    taxProfiles: [],
    apInvoiceId: 'ap-uuid-001',
    updateHeader: vi.fn(),
    ...overrides,
  }
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('useAPSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── F1: handleGenerate ───────────────────────────────────────────────────────

  describe('F1: handleGenerate', () => {
    it('shows warning toast when any item is missing deptCode or accountCode', async () => {
      const props = makeProps({ lineItems: UNMAPPED_ITEMS })
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleGenerate()
      })
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('required'), 'warning')
      expect(submitAPInvoiceToCarmen).not.toHaveBeenCalled()
    })

    it('calls submitAPInvoiceToCarmen with all items mapped', async () => {
      submitAPInvoiceToCarmen.mockResolvedValue({ Code: 0, InternalMessage: 'JV-123' })
      const props = makeProps()
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleGenerate()
      })
      expect(submitAPInvoiceToCarmen).toHaveBeenCalledWith(expect.any(Object), 'ap-uuid-001')
    })

    it('advances to step 5 on successful Carmen submission', async () => {
      submitAPInvoiceToCarmen.mockResolvedValue({ Code: 0, InternalMessage: 'JV-123' })
      const props = makeProps()
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleGenerate()
      })
      expect(props.setStep).toHaveBeenCalledWith(5)
      expect(result.current.invoiceSeq).toBe('JV-123')
    })

    it('shows Carmen error modal when Code < 0 (non-duplicate error)', async () => {
      submitAPInvoiceToCarmen.mockResolvedValue({
        Code: -1,
        UserMessage: 'InvhInvNo is invalid',
      })
      const props = makeProps()
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleGenerate()
      })
      expect(props.setModal).toHaveBeenCalledWith(
        expect.objectContaining({ show: true, type: 'warning' })
      )
      expect(props.setStep).not.toHaveBeenCalledWith(5)
    })

    it('shows duplicate modal when Carmen returns a duplicate invoice error', async () => {
      submitAPInvoiceToCarmen.mockResolvedValue({
        Code: -1,
        UserMessage: 'InvhInvNo already exists [INV-001, VN001]',
      })
      const props = makeProps()
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleGenerate()
      })
      expect(props.setModal).toHaveBeenCalledWith(
        expect.objectContaining({
          show: true,
          title: expect.stringContaining('Already Exists'),
        })
      )
    })

    it('shows error modal when submitAPInvoiceToCarmen throws', async () => {
      submitAPInvoiceToCarmen.mockRejectedValue(new Error('Network failure'))
      const props = makeProps()
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleGenerate()
      })
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Could not send'),
        expect.any(Object)
      )
      expect(props.setModal).toHaveBeenCalledWith(expect.objectContaining({ show: true }))
    })
  })

  // ── F2: handleAISuggest ──────────────────────────────────────────────────────

  describe('F2: handleAISuggest', () => {
    it('shows info toast when all items already have account codes', async () => {
      const props = makeProps({ lineItems: MAPPED_ITEMS })
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleAISuggest()
      })
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('already have'), 'info')
      expect(apiFetch).not.toHaveBeenCalled()
    })

    it('shows invhDesc modal when items need suggestion but description is empty', async () => {
      const props = makeProps({
        lineItems: UNMAPPED_ITEMS,
        headerData: { ...MOCK_HEADER, invhDesc: '' },
      })
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleAISuggest()
      })
      expect(props.setModal).toHaveBeenCalledWith(
        expect.objectContaining({
          show: true,
          title: expect.stringContaining('No Invoice Description'),
        })
      )
    })

    it('calls suggest API for unmapped items when invhDesc is set', async () => {
      apiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ suggestions: { 0: { deptCode: 'ACC', accountCode: '5100' } } }),
      } as unknown as Response)
      const props = makeProps({ lineItems: UNMAPPED_ITEMS })
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleAISuggest()
      })
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/v1/ap-invoice/suggest',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('shows success toast with count when suggestions are returned', async () => {
      apiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ suggestions: { 0: { deptCode: 'ACC', accountCode: '5100' } } }),
      } as unknown as Response)
      const props = makeProps({ lineItems: UNMAPPED_ITEMS })
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleAISuggest()
      })
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('suggested'), 'success')
    })

    it('shows info toast when API returns no suggestions', async () => {
      apiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ suggestions: {} }),
      } as unknown as Response)
      const props = makeProps({ lineItems: UNMAPPED_ITEMS })
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleAISuggest()
      })
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('could not generate'), 'info')
    })

    it('shows error toast when suggest API call fails', async () => {
      apiFetch.mockResolvedValue({ ok: false, status: 500 } as unknown as Response)
      const props = makeProps({ lineItems: UNMAPPED_ITEMS })
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleAISuggest()
      })
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Failed to suggest'), 'error')
    })
  })

  // ── F3: suggestion accept/reject ─────────────────────────────────────────────

  describe('F3: suggestion accept / reject', () => {
    const ITEMS_WITH_SUGGESTIONS: APLineItem[] = [
      {
        deptCode: 'ACC',
        accountCode: '5100',
        _suggestDept: 'ACC',
        _suggestAcc: '5100',
        description: 'A',
      },
      {
        deptCode: 'FIN',
        accountCode: '6100',
        _suggestDept: 'FIN',
        _suggestAcc: '6100',
        description: 'B',
      },
    ]

    it('handleAcceptAll clears all suggestion flags from every item', async () => {
      let items = [...ITEMS_WITH_SUGGESTIONS]
      const props = makeProps({
        lineItems: items,
        setLineItems: vi.fn((updater: React.SetStateAction<APLineItem[]>) => {
          items = typeof updater === 'function' ? updater(items) : updater
        }),
      })
      const { result } = renderHook(() => useAPSubmission(props))
      act(() => {
        result.current.handleAcceptAll()
      })
      expect(items.every(i => !i._suggestDept && !i._suggestAcc)).toBe(true)
    })

    it('handleConfirmSuggest clears suggestion flags only for the given index', async () => {
      let items = [...ITEMS_WITH_SUGGESTIONS]
      const props = makeProps({
        lineItems: items,
        setLineItems: vi.fn((updater: React.SetStateAction<APLineItem[]>) => {
          items = typeof updater === 'function' ? updater(items) : updater
        }),
      })
      const { result } = renderHook(() => useAPSubmission(props))
      act(() => {
        result.current.handleConfirmSuggest(0)
      })
      expect(items[0]._suggestDept).toBeUndefined()
      expect(items[1]._suggestDept).toBe('FIN') // unchanged
    })

    it('handleRejectSuggest clears suggestion flags and resets codes for the given index', async () => {
      let items = [...ITEMS_WITH_SUGGESTIONS]
      const props = makeProps({
        lineItems: items,
        setLineItems: vi.fn((updater: React.SetStateAction<APLineItem[]>) => {
          items = typeof updater === 'function' ? updater(items) : updater
        }),
      })
      const { result } = renderHook(() => useAPSubmission(props))
      act(() => {
        result.current.handleRejectSuggest(0)
      })
      expect(items[0]._suggestDept).toBeUndefined()
      expect(items[0].deptCode).toBe('')
      expect(items[0].accountCode).toBe('')
      expect(items[1].deptCode).toBe('FIN') // unchanged
    })
  })

  // ── F4: loadGLData ───────────────────────────────────────────────────────────

  describe('F4: loadGLData', () => {
    it('populates masterAccounts and masterDepts from Carmen API', async () => {
      fetchAccountCodes.mockResolvedValue([
        { AccCode: '1100', Description: 'Cash' },
      ] as unknown as CarmenCodeItem[])
      fetchDepartments.mockResolvedValue([
        { DeptCode: 'ACC', Description: 'Accounting' },
      ] as unknown as CarmenCodeItem[])
      const props = makeProps()
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.loadGLData()
      })
      expect(result.current.masterAccounts).toHaveLength(1)
      expect(result.current.masterAccounts[0].code).toBe('1100')
      expect(result.current.masterDepts).toHaveLength(1)
      expect(result.current.masterDepts[0].code).toBe('ACC')
    })

    it('filters out header rows from accounts (AccCode === "AccCode")', async () => {
      fetchAccountCodes.mockResolvedValue([
        { AccCode: 'AccCode', Description: 'Header' }, // should be filtered
        { AccCode: '1100', Description: 'Cash' },
      ] as unknown as CarmenCodeItem[])
      fetchDepartments.mockResolvedValue([])
      const props = makeProps()
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.loadGLData()
      })
      expect(result.current.masterAccounts).toHaveLength(1)
      expect(result.current.masterAccounts[0].code).toBe('1100')
    })

    it('does not re-fetch when called a second time (glLoaded guard)', async () => {
      fetchAccountCodes.mockResolvedValue([])
      fetchDepartments.mockResolvedValue([])
      const props = makeProps()
      const { result } = renderHook(() => useAPSubmission(props))
      // Two separate act() calls so the hook re-renders between them,
      // allowing the second call to read glLoaded=true from updated state.
      await act(async () => {
        await result.current.loadGLData()
      })
      await act(async () => {
        await result.current.loadGLData()
      })
      expect(fetchAccountCodes).toHaveBeenCalledTimes(1)
    })

    it('resetGLLoaded allows loadGLData to re-fetch', async () => {
      fetchAccountCodes.mockResolvedValue([])
      fetchDepartments.mockResolvedValue([])
      const props = makeProps()
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.loadGLData()
      })
      act(() => {
        result.current.resetGLLoaded()
      })
      await act(async () => {
        await result.current.loadGLData()
      })
      expect(fetchAccountCodes).toHaveBeenCalledTimes(2)
    })
  })

  // ── F5: derived state ────────────────────────────────────────────────────────

  describe('F5: derived state', () => {
    it('hasSuggestions=true when any item has _suggestDept or _suggestAcc', () => {
      const items = [{ ...MAPPED_ITEMS[0], _suggestDept: 'ACC' }]
      const props = makeProps({ lineItems: items })
      const { result } = renderHook(() => useAPSubmission(props))
      expect(result.current.hasSuggestions).toBe(true)
    })

    it('hasSuggestions=false when no items have pending suggestions', () => {
      const props = makeProps({ lineItems: MAPPED_ITEMS })
      const { result } = renderHook(() => useAPSubmission(props))
      expect(result.current.hasSuggestions).toBe(false)
    })

    it('allMapped=true when every item has deptCode and accountCode without pending suggestions', () => {
      const props = makeProps({ lineItems: MAPPED_ITEMS })
      const { result } = renderHook(() => useAPSubmission(props))
      expect(result.current.allMapped).toBe(true)
    })

    it('allMapped=false when any item is missing codes', () => {
      const props = makeProps({ lineItems: UNMAPPED_ITEMS })
      const { result } = renderHook(() => useAPSubmission(props))
      expect(result.current.allMapped).toBe(false)
    })
  })

  // ── F6: Carmen payload — per-line InvdTaxT1 (P0 bug fix) ─────────────────────

  describe('F6: Carmen payload InvdTaxT1 per line', () => {
    const makeItems = (...types: string[]): APLineItem[] =>
      types.map((taxType, i) => ({
        description: `Item ${i}`,
        qty: '1',
        unitPrice: '100.00',
        discountAmt: '0',
        discountPct: '0',
        lineSubTotal: '100.00',
        taxPct: taxType === 'None' ? '0' : '7',
        taxAmt: taxType === 'None' ? '0.00' : '7.00',
        lineTotal: taxType === 'None' ? '100.00' : '107.00',
        taxType,
        deptCode: 'ACC',
        accountCode: '5100',
      }))

    it('uses "Include" for Include lines regardless of header taxType', async () => {
      submitAPInvoiceToCarmen.mockResolvedValue({ Code: 0, InternalMessage: 'JV-1' })
      const props = makeProps({
        lineItems: makeItems('Include'),
        headerData: { ...MOCK_HEADER, taxType: 'Add' },
      })
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleGenerate()
      })
      const payload = submitAPInvoiceToCarmen.mock.calls[0][0] as CarmenPayload
      expect(payload.Detail[0].InvdTaxT1).toBe('Include')
    })

    it('uses "Add" for Exclude lines', async () => {
      submitAPInvoiceToCarmen.mockResolvedValue({ Code: 0, InternalMessage: 'JV-1' })
      const props = makeProps({ lineItems: makeItems('Exclude') })
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleGenerate()
      })
      const payload = submitAPInvoiceToCarmen.mock.calls[0][0] as CarmenPayload
      expect(payload.Detail[0].InvdTaxT1).toBe('Add')
    })

    it('uses "None" for None lines', async () => {
      submitAPInvoiceToCarmen.mockResolvedValue({ Code: 0, InternalMessage: 'JV-1' })
      const props = makeProps({ lineItems: makeItems('None') })
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleGenerate()
      })
      const payload = submitAPInvoiceToCarmen.mock.calls[0][0] as CarmenPayload
      expect(payload.Detail[0].InvdTaxT1).toBe('None')
    })

    it('sends correct per-line types for mixed Include + Exclude + None invoice', async () => {
      submitAPInvoiceToCarmen.mockResolvedValue({ Code: 0, InternalMessage: 'JV-1' })
      const props = makeProps({
        lineItems: makeItems('Include', 'Exclude', 'None'),
        headerData: { ...MOCK_HEADER, taxType: 'Include' },
      })
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleGenerate()
      })
      const detail = (submitAPInvoiceToCarmen.mock.calls[0][0] as CarmenPayload).Detail
      expect(detail[0].InvdTaxT1).toBe('Include')
      expect(detail[1].InvdTaxT1).toBe('Add')
      expect(detail[2].InvdTaxT1).toBe('None')
    })

    // A NONE line must clear the whole tax-1 field set so the tax profile follows the LINE,
    // not the vendor. Leaving the vendor's tax-Dr account populated makes Carmen back-fill the
    // vendor's default tax profile (e.g. VAT07) onto a line the user marked NONE.
    it('blanks tax profile + tax-Dr account/dept on a None line', async () => {
      submitAPInvoiceToCarmen.mockResolvedValue({ Code: 0, InternalMessage: 'JV-1' })
      const props = makeProps({ lineItems: makeItems('None') })
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleGenerate()
      })
      const line = (submitAPInvoiceToCarmen.mock.calls[0][0] as CarmenPayload).Detail[0]
      expect(line.TaxProfileCode1).toBeNull()
      expect(line.InvdT1Dr).toBe('')
      expect(line.InvdT1DrDeptCode).toBe('')
      expect(line.InvdTaxR1).toBe('0.00')
    })

    // A taxable (Add) line still carries the vendor's tax-Dr account + the line's profile.
    it('keeps tax profile + tax-Dr account/dept on a taxable line', async () => {
      submitAPInvoiceToCarmen.mockResolvedValue({ Code: 0, InternalMessage: 'JV-1' })
      const items = makeItems('Exclude').map(i => ({ ...i, taxProfileCode1: 'VAT07' }))
      const props = makeProps({
        lineItems: items,
        taxProfiles: [{ code: 'VAT07', desc: 'VAT 7%', rate: 7 }],
      })
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleGenerate()
      })
      const line = (submitAPInvoiceToCarmen.mock.calls[0][0] as CarmenPayload).Detail[0]
      expect(line.TaxProfileCode1).toBe('VAT07')
      expect(line.InvdT1Dr).toBe('1100')
      expect(line.InvdT1DrDeptCode).toBe('ACC')
    })
  })

  // ── F7: isSubmitting guard (P1 bug fix) ──────────────────────────────────────

  describe('F7: isSubmitting double-submit guard', () => {
    it('exposes isSubmitting=false before submit', () => {
      const props = makeProps()
      const { result } = renderHook(() => useAPSubmission(props))
      expect(result.current.isSubmitting).toBe(false)
    })

    it('second call to handleGenerate is a no-op while first is in-flight', async () => {
      let resolveFirst: (value: unknown) => void
      submitAPInvoiceToCarmen.mockImplementation(
        () =>
          new Promise(r => {
            resolveFirst = r
          })
      )
      const props = makeProps()
      const { result } = renderHook(() => useAPSubmission(props))
      // Fire first call (does not await — intentionally left pending)
      act(() => {
        result.current.handleGenerate()
      })
      // Second call while first is in-flight — should be ignored
      await act(async () => {
        await result.current.handleGenerate()
      })
      // Only one POST should have been made
      expect(submitAPInvoiceToCarmen).toHaveBeenCalledTimes(1)
      // Resolve the first call to clean up
      resolveFirst!({ Code: 0, InternalMessage: 'JV-1' })
    })

    it('resets isSubmitting=false after success', async () => {
      submitAPInvoiceToCarmen.mockResolvedValue({ Code: 0, InternalMessage: 'JV-1' })
      const props = makeProps()
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleGenerate()
      })
      expect(result.current.isSubmitting).toBe(false)
    })

    it('resets isSubmitting=false after network error', async () => {
      submitAPInvoiceToCarmen.mockRejectedValue(new Error('Network failure'))
      const props = makeProps()
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleGenerate()
      })
      expect(result.current.isSubmitting).toBe(false)
    })
  })

  // ── F8: InvdPrice is anchored on the line amount ────────────────────────────

  describe('F8: InvdPrice x InvdQty always reproduces the line amount', () => {
    const priceOf = (p: CarmenPayload, i = 0) => parseFloat(p.Detail[i].InvdPrice)
    const submit = async (lineItems: APLineItem[]) => {
      submitAPInvoiceToCarmen.mockResolvedValue({ Code: 0, InternalMessage: 'JV-1' })
      const { result } = renderHook(() => useAPSubmission(makeProps({ lineItems })))
      await act(async () => {
        await result.current.handleGenerate()
      })
      return submitAPInvoiceToCarmen.mock.calls[0][0] as CarmenPayload
    }

    it('derives the unit price from NetAmt, not from unitPrice - discountAmt', async () => {
      // The regression seen in Carmen's AP screen on invoice 66-0023: the row posted
      // Qty 6 x Price 781.00 against a Net Amount of 4,379.44, which does not multiply
      // out. The price must follow the amount.
      const payload = await submit([
        {
          ...MAPPED_ITEMS[0],
          qty: '6',
          unitPrice: '781.00',
          discountAmt: '0.00',
          taxType: 'Exclude',
          lineSubTotal: '4379.44',
          taxAmt: '306.56',
          lineTotal: '4686.00',
        },
      ])
      expect(priceOf(payload)).toBeCloseTo(729.91, 2)
      const d = payload.Detail[0]
      expect(parseFloat(d.InvdPrice) * d.InvdQty).toBeCloseTo(parseFloat(d.NetAmt), 1)
    })

    it('anchors Include lines on the VAT-inclusive total', async () => {
      // Include lines carry VAT in the price column, so NetAmt (ex-VAT) is the wrong
      // anchor — TotalPrice is what Qty x Price/Unit must reproduce.
      const payload = await submit([
        {
          ...MAPPED_ITEMS[0],
          qty: '2',
          unitPrice: '107.00',
          discountAmt: '0.00',
          taxType: 'Include',
          lineSubTotal: '200.00',
          taxAmt: '14.00',
          lineTotal: '214.00',
        },
      ])
      expect(priceOf(payload)).toBeCloseTo(107.0, 2)
      const d = payload.Detail[0]
      expect(parseFloat(d.InvdPrice) * d.InvdQty).toBeCloseTo(parseFloat(d.TotalPrice), 1)
    })

    it('posts a negative price for a credit row instead of clamping it to 0.00', async () => {
      // The prompt emits "5% DISCOUNT -190" rows as a negative unitPrice. The old
      // Math.max(0, ...) guard turned every one of them into 0.00 alongside a negative
      // NetAmt — arithmetic that cannot be checked by hand.
      const payload = await submit([
        {
          ...MAPPED_ITEMS[0],
          qty: '1',
          unitPrice: '-190.00',
          discountAmt: '0.00',
          taxType: 'None',
          lineSubTotal: '-190.00',
          taxAmt: '0.00',
          lineTotal: '-190.00',
        },
      ])
      expect(priceOf(payload)).toBeCloseTo(-190.0, 2)
    })

    it('posts a negative price for a deposit row', async () => {
      const payload = await submit([
        {
          ...MAPPED_ITEMS[0],
          category: 'เงินมัดจำ',
          qty: '1',
          unitPrice: '-500.00',
          discountAmt: '0.00',
          taxType: 'Exclude',
          lineSubTotal: '-500.00',
          taxAmt: '-35.00',
          lineTotal: '-535.00',
        },
      ])
      expect(priceOf(payload)).toBeCloseTo(-500.0, 2)
    })

    it('ignores discountAmt entirely', async () => {
      // discountAmt is a display field; a wrong one (the old Adjust button wrote
      // fabricated values onto the last row) must not be able to move the posted price.
      const base = {
        ...MAPPED_ITEMS[0],
        qty: '2',
        unitPrice: '100.00',
        taxType: 'Exclude' as const,
        lineSubTotal: '180.00',
        taxAmt: '12.60',
        lineTotal: '192.60',
      }
      const clean = await submit([{ ...base, discountAmt: '20.00' }])
      submitAPInvoiceToCarmen.mockClear()
      const tampered = await submit([{ ...base, discountAmt: '999.00' }])
      expect(priceOf(clean)).toBeCloseTo(90.0, 2)
      expect(priceOf(tampered)).toBeCloseTo(priceOf(clean), 2)
    })
  })

  describe('F9: TaxPeriod normalization', () => {
    it('normalizes Buddhist Era year in taxPeriod to CE', async () => {
      submitAPInvoiceToCarmen.mockResolvedValue({ Code: 0, InternalMessage: 'JV-1' })
      const props = makeProps({
        headerData: { ...MOCK_HEADER, documentDate: '15/05/2567' },
      })
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleGenerate()
      })
      const payload = submitAPInvoiceToCarmen.mock.calls[0][0] as CarmenPayload
      expect(payload.TaxPeriod).toBe('05/2024')
    })
  })
})
