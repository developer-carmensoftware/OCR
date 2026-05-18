import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAPSubmission } from '../hooks/ap/useAPSubmission'

vi.mock('../lib/api/carmen', () => ({
  fetchAccountCodes: vi.fn(),
  fetchDepartments: vi.fn(),
  submitAPInvoiceToCarmen: vi.fn(),
}))
vi.mock('../lib/api/client', () => ({ apiFetch: vi.fn() }))
vi.mock('../lib/toast', () => ({ showToast: vi.fn() }))
vi.mock('../lib/format', () => ({
  parseNum: vi.fn(v => parseFloat(String(v).replace(/,/g, '')) || 0),
}))
vi.mock('../lib/date', () => ({
  parseDateToISO: vi.fn(() => '2024-05-15T00:00:00.000Z'),
}))

import { fetchAccountCodes, fetchDepartments, submitAPInvoiceToCarmen } from '../lib/api/carmen'
import { apiFetch } from '../lib/api/client'
import { showToast } from '../lib/toast'

// ─── helpers ──────────────────────────────────────────────────────────────────

const MOCK_VENDOR = {
  code: 'VN001',
  term: 30,
  vatCrAccCode: '2100',
  vat1DrAccCode: '1100',
  vat1DrDeptCode: 'ACC',
  crDeptCode: 'ACC',
  taxProfileCode1: null,
}

const MAPPED_ITEMS = [
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

const UNMAPPED_ITEMS = [{ ...MAPPED_ITEMS[0], deptCode: '', accountCode: '' }]

const MOCK_HEADER = {
  vendorName: 'Test Corp',
  documentNumber: 'INV-001',
  documentDate: '15/05/2024',
  taxType: 'Add',
  grandTotal: '107.00',
  invhDesc: 'Monthly office supplies',
}

function makeProps(overrides = {}) {
  const lineItems = overrides.lineItems ?? [...MAPPED_ITEMS]
  const setLineItems =
    overrides.setLineItems ??
    vi.fn(updater => {
      if (typeof updater === 'function') updater(lineItems)
    })
  return {
    setStep: vi.fn(),
    setModal: vi.fn(),
    headerData: { ...MOCK_HEADER },
    lineItems,
    setLineItems,
    systemVendor: { ...MOCK_VENDOR },
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
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Failed'), 'error')
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

    it('calls suggest-gl API for unmapped items when invhDesc is set', async () => {
      apiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ suggestions: { 0: { deptCode: 'ACC', accountCode: '5100' } } }),
      })
      const props = makeProps({ lineItems: UNMAPPED_ITEMS })
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleAISuggest()
      })
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/v1/ap-invoice/suggest-gl',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('shows success toast with count when suggestions are returned', async () => {
      apiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ suggestions: { 0: { deptCode: 'ACC', accountCode: '5100' } } }),
      })
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
      })
      const props = makeProps({ lineItems: UNMAPPED_ITEMS })
      const { result } = renderHook(() => useAPSubmission(props))
      await act(async () => {
        await result.current.handleAISuggest()
      })
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('could not generate'), 'info')
    })

    it('shows error toast when suggest-gl API call fails', async () => {
      apiFetch.mockResolvedValue({ ok: false, status: 500 })
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
    const ITEMS_WITH_SUGGESTIONS = [
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
        setLineItems: vi.fn(updater => {
          items = updater(items)
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
        setLineItems: vi.fn(updater => {
          items = updater(items)
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
        setLineItems: vi.fn(updater => {
          items = updater(items)
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
      fetchAccountCodes.mockResolvedValue([{ AccCode: '1100', Description: 'Cash' }])
      fetchDepartments.mockResolvedValue([{ DeptCode: 'ACC', Description: 'Accounting' }])
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
      ])
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
})
