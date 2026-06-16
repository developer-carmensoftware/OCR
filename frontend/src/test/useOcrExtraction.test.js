import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOcrExtraction } from '../hooks/credit-card/useOcrExtraction'

vi.mock('../lib/api/ocr', () => ({ extractFromFile: vi.fn() }))
vi.mock('../lib/toast', () => ({ showToast: vi.fn() }))
vi.mock('../constants', () => ({
  EMPTY_DETAIL_ROW: { desc: '', amount: 0, type: '' },
  detectBankFromCompanyName: vi.fn(() => ''),
  detectBankFromExtracted: vi.fn(() => ''),
}))

import { extractFromFile } from '../lib/api/ocr'
import { showToast } from '../lib/toast'

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeProps(overrides = {}) {
  return {
    showModal: vi.fn(),
    closeModal: vi.fn(),
    setStep: vi.fn(),
    clearFiles: vi.fn(),
    fileInputRef: { current: null },
    ...overrides,
  }
}

const MOCK_FILE = new File(['content'], 'receipt.jpg', { type: 'image/jpeg' })

const MOCK_EXTRACTED = {
  bank_name: 'Kasikorn Bank',
  doc_name: 'Statement',
  company_name: 'Acme Co',
  doc_date: '15/05/2024',
  doc_no: 'DOC-001',
  merchant_name: 'MerchantX',
  merchant_id: 'M123',
  bank_company_name: 'KBANK',
  branch_no: '001',
  details: [{ desc: 'Payment', amount: 1000, type: 'purchase' }],
  is_duplicate: false,
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('useOcrExtraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'test-uuid') })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // ── F1: processFile ──────────────────────────────────────────────────────────

  describe('F1: processFile', () => {
    it('shows warning modal when called with empty files array', async () => {
      const props = makeProps()
      const { result } = renderHook(() => useOcrExtraction(props))
      await act(async () => {
        await result.current.processFile([])
      })
      expect(props.showModal).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning' }))
      expect(props.setStep).not.toHaveBeenCalled()
    })

    it('happy path: populates headerData, details, advances to step 2', async () => {
      extractFromFile.mockResolvedValue(MOCK_EXTRACTED)
      const props = makeProps()
      const { result } = renderHook(() => useOcrExtraction(props))
      await act(async () => {
        await result.current.processFile([MOCK_FILE])
      })
      expect(result.current.headerData.DocNo).toBe('DOC-001')
      expect(result.current.headerData.CompanyName).toBe('Acme Co')
      expect(result.current.details).toHaveLength(1)
      expect(props.setStep).toHaveBeenCalledWith(2)
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('extracted'), 'success')
    })

    it('sets cardId from ext.id so submit can carry credit_card_id (duplicate guard)', async () => {
      // Regression: extractFromFile previously dropped `id`, leaving cardId=null,
      // so the Carmen submit never sent credit_card_id and submitted_at was never
      // set — breaking the duplicate check. Guard that the draft id is threaded.
      extractFromFile.mockResolvedValue({ ...MOCK_EXTRACTED, id: 'draft-card-uuid' })
      const props = makeProps()
      const { result } = renderHook(() => useOcrExtraction(props))
      await act(async () => {
        await result.current.processFile([MOCK_FILE])
      })
      expect(result.current.cardId).toBe('draft-card-uuid')
    })

    it('uses EMPTY_DETAIL_ROW when API returns empty details', async () => {
      extractFromFile.mockResolvedValue({ ...MOCK_EXTRACTED, details: [] })
      const props = makeProps()
      const { result } = renderHook(() => useOcrExtraction(props))
      await act(async () => {
        await result.current.processFile([MOCK_FILE])
      })
      expect(result.current.details).toHaveLength(1) // fallback to EMPTY_DETAIL_ROW
    })

    it('shows duplicate modal when is_duplicate=true and does not advance step', async () => {
      extractFromFile.mockResolvedValue({ ...MOCK_EXTRACTED, is_duplicate: true })
      const props = makeProps()
      const { result } = renderHook(() => useOcrExtraction(props))
      await act(async () => {
        await result.current.processFile([MOCK_FILE])
      })
      expect(props.showModal).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', title: expect.stringContaining('Duplicate') })
      )
      expect(props.setStep).not.toHaveBeenCalledWith(2)
    })

    it('shows out-of-documents modal and resets to step 1 on 402 error', async () => {
      const err = Object.assign(new Error('No credits'), { status: 402 })
      extractFromFile.mockRejectedValue(err)
      const props = makeProps()
      const { result } = renderHook(() => useOcrExtraction(props))
      await act(async () => {
        await result.current.processFile([MOCK_FILE])
      })
      expect(props.showModal).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining('Out of Documents') })
      )
      expect(props.setStep).toHaveBeenCalledWith(1)
    })

    it('shows rate-limit modal and resets to step 1 on 429 error', async () => {
      const err = Object.assign(new Error('Too many'), { status: 429 })
      extractFromFile.mockRejectedValue(err)
      const props = makeProps()
      const { result } = renderHook(() => useOcrExtraction(props))
      await act(async () => {
        await result.current.processFile([MOCK_FILE])
      })
      expect(props.showModal).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining('Too Many Requests') })
      )
      expect(props.setStep).toHaveBeenCalledWith(1)
    })

    it('shows generic error modal on API failure', async () => {
      extractFromFile.mockRejectedValue(new Error('Network timeout'))
      const props = makeProps()
      const { result } = renderHook(() => useOcrExtraction(props))
      await act(async () => {
        await result.current.processFile([MOCK_FILE])
      })
      expect(props.showModal).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', title: expect.stringContaining('Error') })
      )
      expect(props.setStep).toHaveBeenCalledWith(1)
    })

    it('resets loading=false after success', async () => {
      extractFromFile.mockResolvedValue(MOCK_EXTRACTED)
      const props = makeProps()
      const { result } = renderHook(() => useOcrExtraction(props))
      await act(async () => {
        await result.current.processFile([MOCK_FILE])
      })
      expect(result.current.loading).toBe(false)
    })

    it('resets loading=false even after failure', async () => {
      extractFromFile.mockRejectedValue(new Error('fail'))
      const props = makeProps()
      const { result } = renderHook(() => useOcrExtraction(props))
      await act(async () => {
        await result.current.processFile([MOCK_FILE])
      })
      expect(result.current.loading).toBe(false)
    })

    it('dispatches ocr:quota-refresh event after extraction', async () => {
      extractFromFile.mockResolvedValue(MOCK_EXTRACTED)
      const spy = vi.spyOn(window, 'dispatchEvent')
      const props = makeProps()
      const { result } = renderHook(() => useOcrExtraction(props))
      await act(async () => {
        await result.current.processFile([MOCK_FILE])
      })
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'ocr:quota-refresh' }))
    })

    it('writes extracted bank info to localStorage accountingConfig', async () => {
      extractFromFile.mockResolvedValue(MOCK_EXTRACTED)
      const props = makeProps()
      const { result } = renderHook(() => useOcrExtraction(props))
      await act(async () => {
        await result.current.processFile([MOCK_FILE])
      })
      // key is tenant-namespaced via appKey(); with no active tenant it resolves to 't:anon:'
      const saved = JSON.parse(localStorage.getItem('t:anon:accountingConfig') || '{}')
      expect(saved.company?.name).toBe('KBANK')
    })
  })

  // ── F2: reExtract ────────────────────────────────────────────────────────────

  describe('F2: reExtract', () => {
    it('does nothing when files array is empty', async () => {
      const props = makeProps()
      const { result } = renderHook(() => useOcrExtraction(props))
      await act(async () => {
        await result.current.reExtract([], 'KBANK')
      })
      expect(extractFromFile).not.toHaveBeenCalled()
    })

    it('updates headerData and shows success toast on re-extract', async () => {
      extractFromFile.mockResolvedValue({ ...MOCK_EXTRACTED, doc_no: 'DOC-002' })
      const props = makeProps()
      const { result } = renderHook(() => useOcrExtraction(props))
      await act(async () => {
        await result.current.reExtract([MOCK_FILE], 'SCB')
      })
      expect(result.current.headerData.DocNo).toBe('DOC-002')
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Re-extracted'), 'success')
    })

    it('passes bankType to extractFromFile', async () => {
      extractFromFile.mockResolvedValue(MOCK_EXTRACTED)
      const props = makeProps()
      const { result } = renderHook(() => useOcrExtraction(props))
      await act(async () => {
        await result.current.reExtract([MOCK_FILE], 'BBL')
      })
      expect(extractFromFile).toHaveBeenCalledWith(MOCK_FILE, 'BBL', undefined, undefined)
    })

    it('shows Re-extract Failed modal on API error', async () => {
      extractFromFile.mockRejectedValue(new Error('LLM error'))
      const props = makeProps()
      const { result } = renderHook(() => useOcrExtraction(props))
      await act(async () => {
        await result.current.reExtract([MOCK_FILE], 'KBANK')
      })
      expect(props.showModal).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining('Re-extract Failed') })
      )
    })
  })

  // ── F3: detail manipulation ──────────────────────────────────────────────────

  describe('F3: detail manipulation', () => {
    async function withExtractedData(props) {
      extractFromFile.mockResolvedValue(MOCK_EXTRACTED)
      const hook = renderHook(() => useOcrExtraction(props))
      await act(async () => {
        await hook.result.current.processFile([MOCK_FILE])
      })
      return hook
    }

    it('updateHeader changes a specific field without affecting others', async () => {
      const props = makeProps()
      const { result } = await withExtractedData(props)
      act(() => {
        result.current.updateHeader('DocNo', 'CHANGED-999')
      })
      expect(result.current.headerData.DocNo).toBe('CHANGED-999')
      expect(result.current.headerData.CompanyName).toBe('Acme Co') // unchanged
    })

    it('updateDetail changes a specific row and column', async () => {
      const props = makeProps()
      const { result } = await withExtractedData(props)
      act(() => {
        result.current.updateDetail(0, 'amount', 9999)
      })
      expect(result.current.details[0].amount).toBe(9999)
    })

    it('addRow appends exactly one empty row', async () => {
      const props = makeProps()
      const { result } = await withExtractedData(props)
      const before = result.current.details.length
      act(() => {
        result.current.addRow()
      })
      expect(result.current.details).toHaveLength(before + 1)
    })

    it('deleteRow removes the row at the given index', async () => {
      extractFromFile.mockResolvedValue({
        ...MOCK_EXTRACTED,
        details: [
          { desc: 'Row A', amount: 1 },
          { desc: 'Row B', amount: 2 },
        ],
      })
      const props = makeProps()
      const { result } = renderHook(() => useOcrExtraction(props))
      await act(async () => {
        await result.current.processFile([MOCK_FILE])
      })
      act(() => {
        result.current.deleteRow(0)
      })
      expect(result.current.details).toHaveLength(1)
      expect(result.current.details[0].desc).toBe('Row B')
    })
  })

  // ── F4: reset ────────────────────────────────────────────────────────────────

  describe('F4: resetExtractionState', () => {
    it('clears all extraction state', async () => {
      extractFromFile.mockResolvedValue(MOCK_EXTRACTED)
      const props = makeProps()
      const { result } = renderHook(() => useOcrExtraction(props))
      await act(async () => {
        await result.current.processFile([MOCK_FILE])
      })
      act(() => {
        result.current.resetExtractionState()
      })
      expect(result.current.headerData).toEqual({})
      expect(result.current.details).toEqual([])
      expect(result.current.bank).toBe('')
      expect(result.current.status).toBe('')
      expect(result.current.cardId).toBeNull()
    })

    it('F4.2 – also resets originalDetails and originalHeader to prevent stale diffs on re-use', async () => {
      // Populate state via a first extraction
      extractFromFile.mockResolvedValue(MOCK_EXTRACTED)
      const props = makeProps()
      const { result } = renderHook(() => useOcrExtraction(props))
      await act(async () => {
        await result.current.processFile([MOCK_FILE])
      })
      // Verify originals were captured
      expect(result.current.originalDetails).toHaveLength(1)
      expect(result.current.originalHeader).not.toEqual({})

      act(() => {
        result.current.resetExtractionState()
      })
      // After reset, originals must also be empty so diff on next submission starts clean
      expect(result.current.originalDetails).toEqual([])
      expect(result.current.originalHeader).toEqual({})
    })
  })
})
