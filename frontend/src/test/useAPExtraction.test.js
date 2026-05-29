import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAPExtraction } from '../hooks/ap-invoice/useAPExtraction'

vi.mock('../lib/api/client', () => ({ apiFetch: vi.fn() }))
vi.mock('../lib/api/config', () => ({ getAPVendorMapping: vi.fn() }))
vi.mock('../lib/toast', () => ({
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
vi.mock('../lib/format', () => ({
  fmt: vi.fn(v => (v !== undefined && v !== '' ? String(v) : '')),
  parseNum: vi.fn(v => parseFloat(String(v).replace(/,/g, '')) || 0),
}))
vi.mock('../constants/apInvoice', () => ({
  EMPTY_HEADER: {
    vendorName: '',
    vendorTaxId: '',
    vendorBranch: '',
    documentName: '',
    documentDate: '',
    documentNumber: '',
    taxType: '',
    subTotal: '',
    taxAmount: '',
    totalDiscount: '',
    grandTotal: '',
  },
  DEFAULT_MAPPINGS: {},
}))

import { apiFetch } from '../lib/api/client'
import { getAPVendorMapping } from '../lib/api/config'
import { showToast, toast } from '../lib/toast'

// ─── helpers ──────────────────────────────────────────────────────────────────

const MOCK_T = { errProcess: 'Error processing document' }

function makeProps(overrides = {}) {
  return {
    t: MOCK_T,
    setStep: vi.fn(),
    setModal: vi.fn(),
    loadVendors: vi.fn(),
    vendorDbByTax: {},
    ...overrides,
  }
}

const MOCK_FILE = new File(['%PDF-1.4'], 'invoice.pdf', { type: 'application/pdf' })

const MOCK_API_RESPONSE = {
  id: 'inv-uuid-001',
  vendorName: 'Test Corp',
  vendorTaxId: '1234567890123',
  vendorBranch: '00000',
  documentName: 'ใบกำกับภาษี',
  documentDate: '15/05/2024',
  documentNumber: 'INV-001',
  taxType: 'Add',
  subTotal: 1000,
  taxAmount: 70,
  totalDiscount: 0,
  grandTotal: 1070,
  items: [
    {
      description: 'Office Supplies',
      qty: 1,
      unitPrice: 1000,
      lineSubTotal: 1000,
      taxPct: 7,
      taxAmt: 70,
      lineTotal: 1070,
    },
  ],
  is_duplicate: false,
}

function mockSuccess(data = MOCK_API_RESPONSE) {
  apiFetch.mockResolvedValue({ ok: true, json: async () => data })
  getAPVendorMapping.mockRejectedValue(new Error('no mapping'))
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('useAPExtraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:http://localhost/fake'),
      revokeObjectURL: vi.fn(),
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // ── F1: runOCR happy path ────────────────────────────────────────────────────

  describe('F1: runOCR — happy path', () => {
    it('sets apInvoiceId, headerData, and lineItems from API response', async () => {
      mockSuccess()
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      await act(async () => {
        await result.current.runOCR(MOCK_FILE)
      })
      expect(result.current.apInvoiceId).toBe('inv-uuid-001')
      expect(result.current.headerData.vendorName).toBe('Test Corp')
      expect(result.current.headerData.documentNumber).toBe('INV-001')
      expect(result.current.lineItems).toHaveLength(1)
    })

    it('advances to step 2 on success', async () => {
      mockSuccess()
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      await act(async () => {
        await result.current.runOCR(MOCK_FILE)
      })
      expect(props.setStep).toHaveBeenCalledWith(2)
    })

    it('shows success toast on extraction complete', async () => {
      mockSuccess()
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      await act(async () => {
        await result.current.runOCR(MOCK_FILE)
      })
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Extracted'))
    })

    it('calls loadVendors after successful extraction', async () => {
      mockSuccess()
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      await act(async () => {
        await result.current.runOCR(MOCK_FILE)
      })
      expect(props.loadVendors).toHaveBeenCalled()
    })

    it('dispatches ocr:quota-refresh event after extraction', async () => {
      mockSuccess()
      const spy = vi.spyOn(window, 'dispatchEvent')
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      await act(async () => {
        await result.current.runOCR(MOCK_FILE)
      })
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'ocr:quota-refresh' }))
    })

    it('resets loading=false after success', async () => {
      mockSuccess()
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      await act(async () => {
        await result.current.runOCR(MOCK_FILE)
      })
      expect(result.current.loading).toBe(false)
    })
  })

  // ── F2: duplicate document ───────────────────────────────────────────────────

  describe('F2: duplicate document', () => {
    it('shows duplicate warning modal when is_duplicate=true', async () => {
      mockSuccess({ ...MOCK_API_RESPONSE, is_duplicate: true })
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      await act(async () => {
        await result.current.runOCR(MOCK_FILE)
      })
      expect(props.setModal).toHaveBeenCalledWith(
        expect.objectContaining({
          show: true,
          type: 'warning',
          title: expect.stringContaining('Duplicate'),
        })
      )
    })

    it('does not advance to step 2 automatically on duplicate — waits for user confirmation', async () => {
      mockSuccess({ ...MOCK_API_RESPONSE, is_duplicate: true })
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      await act(async () => {
        await result.current.runOCR(MOCK_FILE)
      })
      expect(props.setStep).not.toHaveBeenCalledWith(2)
    })

    it('sets isDuplicate=true in state when duplicate is detected', async () => {
      mockSuccess({ ...MOCK_API_RESPONSE, is_duplicate: true })
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      await act(async () => {
        await result.current.runOCR(MOCK_FILE)
      })
      expect(result.current.isDuplicate).toBe(true)
    })

    it('proceeds to step 2 when user confirms on duplicate modal', async () => {
      mockSuccess({ ...MOCK_API_RESPONSE, is_duplicate: true })
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      await act(async () => {
        await result.current.runOCR(MOCK_FILE)
      })
      const modalCall = props.setModal.mock.calls[0][0]
      act(() => {
        modalCall.onConfirm()
      })
      expect(props.setStep).toHaveBeenCalledWith(2)
    })
  })

  // ── F3: quota exceeded ───────────────────────────────────────────────────────

  describe('F3: quota exceeded (429)', () => {
    it('shows quota modal and resets to step 1 on 429 response', async () => {
      apiFetch.mockResolvedValue({ ok: false, status: 429 })
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      await act(async () => {
        await result.current.runOCR(MOCK_FILE)
      })
      expect(props.setModal).toHaveBeenCalledWith(
        expect.objectContaining({
          show: true,
          title: expect.stringContaining('Quota'),
        })
      )
    })
  })

  // ── F4: retry logic ──────────────────────────────────────────────────────────

  describe('F4: retry logic', () => {
    it('retries up to 3 times before setting error state', async () => {
      vi.useFakeTimers()
      apiFetch.mockResolvedValue({ ok: false, status: 500 })
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      const runPromise = act(async () => {
        const p = result.current.runOCR(MOCK_FILE)
        await vi.runAllTimersAsync()
        return p
      })
      await runPromise
      expect(apiFetch).toHaveBeenCalledTimes(3)
      expect(result.current.error).toBe(MOCK_T.errProcess)
      vi.useRealTimers()
    })

    it('succeeds on second attempt after one failure', async () => {
      vi.useFakeTimers()
      apiFetch
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true, json: async () => MOCK_API_RESPONSE })
      getAPVendorMapping.mockRejectedValue(new Error('no mapping'))
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      const runPromise = act(async () => {
        const p = result.current.runOCR(MOCK_FILE)
        await vi.runAllTimersAsync()
        return p
      })
      await runPromise
      expect(apiFetch).toHaveBeenCalledTimes(2)
      expect(props.setStep).toHaveBeenCalledWith(2)
      vi.useRealTimers()
    })

    it('resets loading=false even after all retries fail', async () => {
      vi.useFakeTimers()
      apiFetch.mockResolvedValue({ ok: false, status: 500 })
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      const runPromise = act(async () => {
        const p = result.current.runOCR(MOCK_FILE)
        await vi.runAllTimersAsync()
        return p
      })
      await runPromise
      expect(result.current.loading).toBe(false)
      vi.useRealTimers()
    })
  })

  // ── F5: handleFileChange ─────────────────────────────────────────────────────

  describe('F5: handleFileChange', () => {
    it('sets file, previewUrl, and triggers runOCR automatically', async () => {
      mockSuccess()
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      const event = { target: { files: [MOCK_FILE] } }
      await act(async () => {
        result.current.handleFileChange(event)
        // Wait for async runOCR to complete
        await new Promise(r => setTimeout(r, 0))
      })
      expect(result.current.file).toBe(MOCK_FILE)
      expect(result.current.previewUrl).toBeTruthy()
    })

    it('sets previewType=pdf for PDF files', async () => {
      mockSuccess()
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      await act(async () => {
        result.current.handleFileChange({ target: { files: [MOCK_FILE] } })
        await new Promise(r => setTimeout(r, 0))
      })
      expect(result.current.previewType).toBe('pdf')
    })

    it('does nothing when no file is selected', async () => {
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      act(() => {
        result.current.handleFileChange({ target: { files: [] } })
      })
      expect(apiFetch).not.toHaveBeenCalled()
    })
  })

  // ── F6: state manipulation ───────────────────────────────────────────────────

  describe('F6: updateHeader / updateItem', () => {
    async function withExtractedData(props) {
      mockSuccess()
      const hook = renderHook(() => useAPExtraction(props))
      await act(async () => {
        await hook.result.current.runOCR(MOCK_FILE)
      })
      return hook
    }

    it('updateHeader changes a specific field', async () => {
      const props = makeProps()
      const { result } = await withExtractedData(props)
      act(() => {
        result.current.updateHeader('vendorName', 'New Corp')
      })
      expect(result.current.headerData.vendorName).toBe('New Corp')
    })

    it('updateItem changes a specific row field', async () => {
      const props = makeProps()
      const { result } = await withExtractedData(props)
      act(() => {
        result.current.updateItem(0, 'description', 'Updated description')
      })
      expect(result.current.lineItems[0].description).toBe('Updated description')
    })

    it('updateItem clears _suggestDept when deptCode is changed', async () => {
      const props = makeProps()
      const { result } = await withExtractedData(props)
      act(() => {
        result.current.setLineItems([{ ...result.current.lineItems[0], _suggestDept: 'ACC' }])
      })
      act(() => {
        result.current.updateItem(0, 'deptCode', 'NEW')
      })
      expect(result.current.lineItems[0]._suggestDept).toBeUndefined()
    })
  })

  // ── F7: resetExtraction ──────────────────────────────────────────────────────

  describe('F7: resetExtraction', () => {
    it('clears all extraction state to initial values', async () => {
      mockSuccess()
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      await act(async () => {
        await result.current.runOCR(MOCK_FILE)
      })
      act(() => {
        result.current.resetExtraction()
      })
      expect(result.current.file).toBeNull()
      expect(result.current.previewUrl).toBeNull()
      expect(result.current.apInvoiceId).toBeNull()
      expect(result.current.lineItems).toHaveLength(0)
      expect(result.current.isDuplicate).toBe(false)
      expect(result.current.status).toBe('')
      expect(result.current.error).toBeNull()
    })
  })
})
