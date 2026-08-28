import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAPExtraction } from './useAPExtraction'

vi.mock('../../lib/api/client', () => ({
  apiFetch: vi.fn(),
  // Real fetchTimeout returns { signal, clear }; the hook destructures both on
  // every runOCR call, so the mock must too or it throws before apiFetch runs.
  fetchTimeout: vi.fn(() => ({ signal: new AbortController().signal, clear: vi.fn() })),
  getStoredToken: vi.fn(() => 'test-token'),
}))
vi.mock('../../lib/api/config', () => ({ getAPVendorMapping: vi.fn() }))
vi.mock('../../lib/api/auth', () => ({ getUsage: vi.fn() }))
// Only getPdfInfo is stubbed — PDF_PASSWORD_REQUIRED and the rest stay real so the
// error-code branches keep testing the real marker.
vi.mock('../../lib/api/ocr', async importOriginal => ({
  ...(await importOriginal<typeof import('../../lib/api/ocr')>()),
  getPdfInfo: vi.fn(),
}))
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
  fmt: vi.fn((v: unknown) => (v !== undefined && v !== '' ? String(v) : '')),
  parseNum: vi.fn((v: unknown) => parseFloat(String(v).replace(/,/g, '')) || 0),
}))
vi.mock('../../constants/apInvoice', () => ({
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

import { apiFetch as realApiFetch } from '../../lib/api/client'
import { getAPVendorMapping as realGetAPVendorMapping } from '../../lib/api/config'
import { getUsage as realGetUsage } from '../../lib/api/auth'
import { getPdfInfo as realGetPdfInfo } from '../../lib/api/ocr'
import { toast } from '../../lib/toast'
import { appKey } from '../../lib/storage'

const apiFetch = vi.mocked(realApiFetch)
const getAPVendorMapping = vi.mocked(realGetAPVendorMapping)
const getUsage = vi.mocked(realGetUsage)
const getPdfInfo = vi.mocked(realGetPdfInfo)

// ─── helpers ──────────────────────────────────────────────────────────────────

// useAPExtraction now pulls copy from the i18n dict via useT(); on error it sets
// the localized `ap.errProcess` string (English default in tests). Keep this in
// sync with dict.ts.
const MOCK_T = { errProcess: 'OCR processing error. Please try again.' }

function makeProps(overrides: Record<string, unknown> = {}) {
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

/**
 * Vitest's own per-test timeout is 5s, which killed the previewUrl test before the 10s
 * `waitFor` budget below could ever be spent — so the 2026-08-21 flake fix never took
 * effect in a full-suite run. Both numbers are needed; raising only one does nothing.
 */
const PDF_PARSE_TIMEOUT_MS = 15_000

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

function mockSuccess(data: Record<string, unknown> = MOCK_API_RESPONSE) {
  apiFetch.mockResolvedValue({ ok: true, json: async () => data } as unknown as Response)
  getAPVendorMapping.mockRejectedValue(new Error('no mapping'))
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('useAPExtraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    // Single-page by default: handleFileChange extracts straight away, no picker.
    getPdfInfo.mockResolvedValue({ page_count: 1, thumbnails: [] })
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

  // ── F1b: vendor column mapping restore ───────────────────────────────────────
  // Every other test in this file mocks getAPVendorMapping as rejected, so neither
  // branch of the restore was covered. The GET wraps the flat map in `mapping` —
  // reading the wrong key here silently drops a vendor's saved column layout.

  describe('F1b: vendor mapping restore', () => {
    it('applies the saved mapping returned by the API', async () => {
      apiFetch.mockResolvedValue({
        ok: true,
        json: async () => MOCK_API_RESPONSE,
      } as unknown as Response)
      getAPVendorMapping.mockResolvedValue({
        vendor_tax_id: '1234567890123',
        mapping: { col1: 'description', col2: 'lineTotal' },
      })

      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      await act(async () => {
        await result.current.runOCR(MOCK_FILE)
      })

      await waitFor(() =>
        expect(result.current.fieldMappings).toEqual({ col1: 'description', col2: 'lineTotal' })
      )
      expect(getAPVendorMapping).toHaveBeenCalledWith('1234567890123')
    })

    it('falls back to the localStorage mapping for that vendor when the API has none', async () => {
      mockSuccess()
      localStorage.setItem(
        appKey('ap_invoice_mapping'),
        JSON.stringify({ '1234567890123': { col1: 'description' } })
      )

      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      await act(async () => {
        await result.current.runOCR(MOCK_FILE)
      })

      await waitFor(() => expect(result.current.fieldMappings).toEqual({ col1: 'description' }))
    })

    it('does not look up a mapping when the document carries no vendor tax id', async () => {
      mockSuccess({ ...MOCK_API_RESPONSE, vendorTaxId: '' })
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      await act(async () => {
        await result.current.runOCR(MOCK_FILE)
      })

      expect(getAPVendorMapping).not.toHaveBeenCalled()
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
      const modalCall = (props.setModal.mock.calls[0] as [{ onConfirm: () => void }])[0]
      act(() => {
        modalCall.onConfirm()
      })
      expect(props.setStep).toHaveBeenCalledWith(2)
    })
  })

  // ── F3: out of documents / rate limit ────────────────────────────────────────

  describe('F3: billing limits', () => {
    it('shows out-of-documents modal on 402 response', async () => {
      apiFetch.mockResolvedValue({ ok: false, status: 402 } as unknown as Response)
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      await act(async () => {
        await result.current.runOCR(MOCK_FILE)
      })
      expect(props.setModal).toHaveBeenCalledWith(
        expect.objectContaining({
          show: true,
          title: expect.stringContaining('Out of Documents'),
        })
      )
    })

    it('shows rate-limit modal on 429 response', async () => {
      apiFetch.mockResolvedValue({ ok: false, status: 429 } as unknown as Response)
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      await act(async () => {
        await result.current.runOCR(MOCK_FILE)
      })
      expect(props.setModal).toHaveBeenCalledWith(
        expect.objectContaining({
          show: true,
          title: expect.stringContaining('Too Many Requests'),
        })
      )
    })
  })

  // ── F4: no auto-retry (billing safety) ───────────────────────────────────────
  //
  // /extract charges a document credit server-side before calling the LLM. A failed
  // extraction is refunded, but a response lost after a *successful* one is not — and
  // the client can't tell those apart — so a retry risks charging twice for one
  // document. The old 3x auto-retry did exactly that; extraction now posts once.

  describe('F4: no auto-retry (billing safety)', () => {
    it('posts /extract exactly once on a 500 — a retry would re-charge a document', async () => {
      vi.useFakeTimers()
      apiFetch.mockResolvedValue({ ok: false, status: 500 } as unknown as Response)
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      const runPromise = act(async () => {
        const p = result.current.runOCR(MOCK_FILE)
        await vi.runAllTimersAsync()
        return p
      })
      await runPromise
      expect(apiFetch).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })

    it('surfaces a 500 as a server error, not as a bad-scan hint', async () => {
      vi.useFakeTimers()
      apiFetch.mockResolvedValue({ ok: false, status: 500 } as unknown as Response)
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      const runPromise = act(async () => {
        const p = result.current.runOCR(MOCK_FILE)
        await vi.runAllTimersAsync()
        return p
      })
      await runPromise
      expect(props.setModal).toHaveBeenCalledWith(
        expect.objectContaining({ show: true, title: 'Server Error' })
      )
      expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining('clearer scan'))
      vi.useRealTimers()
    })

    it('does not retry a network drop either (the server may have processed it)', async () => {
      vi.useFakeTimers()
      apiFetch.mockRejectedValue(new Error('Failed to fetch'))
      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      const runPromise = act(async () => {
        const p = result.current.runOCR(MOCK_FILE)
        await vi.runAllTimersAsync()
        return p
      })
      await runPromise
      expect(apiFetch).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })

    it('resets loading=false after a failed extraction', async () => {
      vi.useFakeTimers()
      apiFetch.mockResolvedValue({ ok: false, status: 500 } as unknown as Response)
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
    it(
      'sets file, previewUrl, and triggers runOCR automatically',
      async () => {
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
        // previewUrl is produced asynchronously now (auto-print stripping); wait for it.
        // 10s, not the 1s default: the pdf-lib parse behind it takes seconds when the
        // whole suite runs in parallel. Flaked in CI at the default.
        await waitFor(() => expect(result.current.previewUrl).toBeTruthy(), { timeout: 10_000 })
      },
      PDF_PARSE_TIMEOUT_MS
    )

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
    async function withExtractedData(props: ReturnType<typeof makeProps>) {
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

  // ── F8: page selector affordability ──────────────────────────────────────────
  //
  // Every selected page costs a document, so the picker has to know what's left. The
  // lookup is deliberately non-blocking: the picker opens first, and a failed /usage
  // leaves `remaining` undefined so the picker never blocks a scan the backend would
  // have allowed.

  describe('F8: page selector — documents remaining', () => {
    const multiPage = () =>
      getPdfInfo.mockResolvedValue({ page_count: 3, thumbnails: ['a', 'b', 'c'] })

    it('opens the picker for a multi-page PDF and fills in documents remaining', async () => {
      multiPage()
      getUsage.mockResolvedValue({
        usage: { credit_balance: 4, subscription: { docs_remaining: 2 } },
      } as unknown as Awaited<ReturnType<typeof realGetUsage>>)

      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      await act(async () => {
        result.current.handleFileChange({ target: { files: [MOCK_FILE] } })
        await new Promise(r => setTimeout(r, 0))
      })

      await waitFor(() => expect(result.current.pdfSelector?.remaining).toBe(6))
      expect(result.current.pdfSelector?.thumbnails).toHaveLength(3)
      // The picker is a gate, not an extraction — nothing charged yet.
      expect(apiFetch).not.toHaveBeenCalled()
    })

    it('leaves remaining undefined when the usage lookup fails — never blocks the scan', async () => {
      multiPage()
      getUsage.mockRejectedValue(new Error('offline'))

      const props = makeProps()
      const { result } = renderHook(() => useAPExtraction(props))
      await act(async () => {
        result.current.handleFileChange({ target: { files: [MOCK_FILE] } })
        await new Promise(r => setTimeout(r, 0))
      })

      await waitFor(() => expect(result.current.pdfSelector).not.toBeNull())
      expect(result.current.pdfSelector?.remaining).toBeUndefined()
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
