import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOcrSubmission } from './useOcrSubmission'
import type { JvRow } from './useOcrSubmission'
import type { AccountingConfigResponse } from '../../types/api'

// ─── module mocks ─────────────────────────────────────────────────────────────
vi.mock('../../lib/api/carmen', () => ({ submitToCarmen: vi.fn() }))
vi.mock('../../lib/api/feedback', () => ({
  logCorrections: vi.fn(),
  diffCorrections: vi.fn(),
}))
vi.mock('../../lib/api/config', () => ({ getAccountingConfig: vi.fn() }))
vi.mock('../../lib/url', () => ({
  getCarmenUrl: vi.fn((p: string) => `https://carmen.test/#${p}`),
}))
vi.mock('../../lib/toast', () => ({ showToast: vi.fn() }))

import { submitToCarmen as realSubmitToCarmen } from '../../lib/api/carmen'
import {
  logCorrections as realLogCorrections,
  diffCorrections as realDiffCorrections,
} from '../../lib/api/feedback'
import { getAccountingConfig as realGetAccountingConfig } from '../../lib/api/config'
import { showToast as realShowToast } from '../../lib/toast'

const submitToCarmen = vi.mocked(realSubmitToCarmen)
const logCorrections = vi.mocked(realLogCorrections)
const diffCorrections = vi.mocked(realDiffCorrections)
const getAccountingConfig = vi.mocked(realGetAccountingConfig)
const showToast = vi.mocked(realShowToast)

// submitToCarmen's payload param is `unknown` (see lib/api/carmen.ts); this narrows
// just the fields these tests read off its call args.
interface CarmenJvPayload {
  JvhDate: string
  Prefix: string
  JvhSource: string
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    showModal: vi.fn(),
    closeModal: vi.fn(),
    setStep: vi.fn(),
    headerData: {
      DocNo: 'DOC-001',
      DateProcessed: '2024-01-01',
      BankName: 'Test Bank',
      DocName: 'Statement',
      CompanyName: 'Acme Co',
      DocDate: '15/05/2024',
      MerchantName: 'MerchantX',
      MerchantId: 'M123',
      BankCompanyName: 'BCO',
      BranchNo: '001',
    },
    details: [] as Array<Record<string, string | number>>,
    bank: 'KBANK',
    cardId: 'card-uuid-123',
    originalHeader: {},
    originalDetails: [] as Array<Record<string, unknown>>,
    setJvRows: vi.fn(),
    setCarmenJvId: vi.fn(),
    ...overrides,
  }
}

const defaultRows: JvRow[] = [{ dept: 'ACC', acc: '1100', desc: 'Revenue', credit: 1000, debit: 0 }]

const defaultConfig = {
  file_prefix: 'PRE',
  file_source: 'SRC',
  description: 'Monthly JV',
} as unknown as AccountingConfigResponse

function mockHappyPath() {
  diffCorrections.mockReturnValue([])
  getAccountingConfig.mockResolvedValue(defaultConfig)
  submitToCarmen.mockResolvedValue({ Code: 0, InternalMessage: 'JV-999' })
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('useOcrSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── F1: State management ────────────────────────────────────────────────────

  describe('F1: state management', () => {
    it('F1.1 – submitting becomes true while async work is in flight', async () => {
      let resolveCarmen: (value: unknown) => void
      submitToCarmen.mockReturnValue(
        new Promise(r => {
          resolveCarmen = r
        })
      )
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))

      expect(result.current.submitting).toBe(false)

      // Intentionally not awaited — keeps the promise in-flight so we can
      // assert submitting === true before it resolves.
      act(() => {
        void result.current.handleSubmitFinal(defaultRows)
      })
      expect(result.current.submitting).toBe(true)

      await act(async () => {
        resolveCarmen!({ Code: 0 })
      })
      expect(result.current.submitting).toBe(false)
    })

    it('F1.2 – submitting resets to false after success', async () => {
      mockHappyPath()
      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))

      await act(async () => {
        await result.current.handleSubmitFinal(defaultRows)
      })

      expect(result.current.submitting).toBe(false)
    })

    it('F1.3 – submitting resets to false after error', async () => {
      getAccountingConfig.mockRejectedValue(new Error('Config error'))
      diffCorrections.mockReturnValue([])

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))

      await act(async () => {
        await result.current.handleSubmitFinal(defaultRows)
      })

      expect(result.current.submitting).toBe(false)
    })
  })

  // ── F2: Date parsing ─────────────────────────────────────────────────────────

  describe('F2: Carmen payload date parsing', () => {
    async function getJvhDate(docDate: string) {
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockResolvedValue({ Code: 0 })

      const props = makeProps({ headerData: { DocNo: 'X', DocDate: docDate } })
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => {
        await result.current.handleSubmitFinal(defaultRows)
      })
      return (submitToCarmen.mock.calls[0][0] as CarmenJvPayload).JvhDate
    }

    it('F2.1 – CE date "15/05/2024" → ISO 2024-05-15', async () => {
      const iso = await getJvhDate('15/05/2024')
      expect(iso).toMatch(/^2024-05-15/)
    })

    it('F2.2 – BE date "15/05/2567" → CE 2024, ISO 2024-05-15', async () => {
      const iso = await getJvhDate('15/05/2567')
      expect(iso).toMatch(/^2024-05-15/)
    })
    it('F2.3 – empty DocDate → fallback to approximately current time', async () => {
      const before = Date.now()
      const iso = await getJvhDate('')
      const after = Date.now()
      const parsed = new Date(iso).getTime()
      expect(parsed).toBeGreaterThanOrEqual(before)
      expect(parsed).toBeLessThanOrEqual(after + 1000)
    })

    it('F2.4 – invalid DocDate "not-a-date" → fallback to approximately current time', async () => {
      const before = Date.now()
      const iso = await getJvhDate('not-a-date')
      const after = Date.now()
      const parsed = new Date(iso).getTime()
      expect(parsed).toBeGreaterThanOrEqual(before)
      expect(parsed).toBeLessThanOrEqual(after + 1000)
    })
  })

  // ── F3: Corrections / feedback ────────────────────────────────────────────────

  describe('F3: corrections / feedback (fire-and-forget)', () => {
    it('F3.1 – no corrections → logCorrections NOT called', async () => {
      mockHappyPath()
      diffCorrections.mockReturnValue([])

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => {
        await result.current.handleSubmitFinal(defaultRows)
      })

      expect(logCorrections).not.toHaveBeenCalled()
    })

    it('F3.2 – corrections present → logCorrections called with cardId, bank, corrections', async () => {
      mockHappyPath()
      const fakeCorrections = [{ fieldName: 'DocNo', originalValue: 'A', correctedValue: 'B' }]
      diffCorrections.mockReturnValue(fakeCorrections)
      logCorrections.mockResolvedValue(undefined)

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => {
        await result.current.handleSubmitFinal(defaultRows)
      })

      expect(logCorrections).toHaveBeenCalledWith('DOC-001', 'KBANK', fakeCorrections)
    })
  })

  // ── F4: getAccountingConfig & source derivation ───────────────────────────────

  describe('F4: getAccountingConfig fallback', () => {
    it('F4.1 – Prefix from API config; JvhSource derived from the scanned bank (not config)', async () => {
      // Source is 1:1 with the bank (single authority: BANK_SOURCE_MAP), so it
      // must follow the scanned bank, never the stored file_source — otherwise a
      // stale saved config posts the wrong source. Prefix still comes from config.
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue({
        file_prefix: 'API_PRE',
        file_source: 'API_SRC',
        description: '',
      } as unknown as AccountingConfigResponse)
      submitToCarmen.mockResolvedValue({ Code: 0 })

      const props = makeProps() // bank: 'KBANK' → source ACKB
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => {
        await result.current.handleSubmitFinal(defaultRows)
      })

      const payload = submitToCarmen.mock.calls[0][0] as CarmenJvPayload
      expect(payload.Prefix).toBe('API_PRE')
      expect(payload.JvhSource).toBe('ACKB')
    })

    it('F4.2 – unknown bank → JvhSource falls back to the stored file_source', async () => {
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue({
        file_prefix: 'API_PRE',
        file_source: 'API_SRC',
        description: '',
      } as unknown as AccountingConfigResponse)
      submitToCarmen.mockResolvedValue({ Code: 0 })

      const props = makeProps({ bank: '' })
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => {
        await result.current.handleSubmitFinal(defaultRows)
      })

      const payload = submitToCarmen.mock.calls[0][0] as CarmenJvPayload
      expect(payload.JvhSource).toBe('API_SRC')
    })
  })

  // ── F5: Carmen success (Code === 0) ───────────────────────────────────────────

  describe('F5: Carmen success (Code === 0)', () => {
    it('F5.1 – InternalMessage present → setCarmenJvId called with jvId', async () => {
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockResolvedValue({ Code: 0, InternalMessage: 'JV-777' })

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => {
        await result.current.handleSubmitFinal(defaultRows)
      })

      expect(props.setCarmenJvId).toHaveBeenCalledWith('JV-777')
    })

    it('F5.2 – Code !== 0 → warning toast + rejection modal, setCarmenJvId not called', async () => {
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockResolvedValue({ Code: 3, UserMessage: 'Already posted in Carmen' })

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => {
        await result.current.handleSubmitFinal(defaultRows)
      })

      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('Already posted in Carmen'),
        'warning'
      )
      expect(props.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Carmen rejected the JV',
          message: expect.stringContaining('NOT posted'),
        })
      )
      expect(props.setCarmenJvId).not.toHaveBeenCalled()
    })

    it('F5.3 – a verdict with no UserMessage still names the Code', async () => {
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      // What an upstream 401 used to look like here: a body with neither Code nor
      // UserMessage, rendered as the unactionable "Carmen error (Code: undefined)".
      submitToCarmen.mockResolvedValue({ Message: 'Authorization has been denied' })

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => {
        await result.current.handleSubmitFinal(defaultRows)
      })

      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('Authorization has been denied'),
        'warning'
      )
    })
  })

  // ── F6: Metadata verification ───────────────────────────────────────────────

  describe('F6: Metadata and parameters passed to submitToCarmen', () => {
    it('F6.1 – Metadata parameters are populated correctly', async () => {
      mockHappyPath()
      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => {
        await result.current.handleSubmitFinal(defaultRows)
      })

      // submitToCarmen should receive: carmenPayload, cardId, metadata
      const callArgs = submitToCarmen.mock.calls[0]
      expect(callArgs[1]).toBe('card-uuid-123')
      expect(callArgs[2]).toEqual({
        doc_no: 'DOC-001',
        company_name: 'Acme Co',
        bank_code: 'KBANK',
        branch_no: '001',
      })
    })
  })

  // ── F7: submitToCarmen throws (network / unexpected error) ────────────────────

  describe('F7: submitToCarmen throws', () => {
    it('F7.1 – network error → honest "Submission failed" modal, no advance, submitting false', async () => {
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockRejectedValue(new Error('network timeout'))

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => {
        await result.current.handleSubmitFinal(defaultRows)
      })

      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('network timeout'), 'error')
      // A transport failure must never claim the JV was saved, and must not advance
      // the wizard to Step 4 (Input Tax Reconciliation).
      expect(props.showModal).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Submission failed', type: 'error' })
      )
      expect(props.setStep).not.toHaveBeenCalledWith(4)
      expect(props.setCarmenJvId).not.toHaveBeenCalled()
      expect(result.current.submitting).toBe(false)
    })

    it('F7.3 – 409 duplicate → "Duplicate Document Found" modal, not a generic error', async () => {
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      const dupErr = Object.assign(new Error('already submitted'), { code: 'DUPLICATE_DOC_NO' })
      submitToCarmen.mockRejectedValue(dupErr)

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => {
        await result.current.handleSubmitFinal(defaultRows)
      })

      expect(props.showModal).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Duplicate Document Found' })
      )
      expect(props.setStep).not.toHaveBeenCalledWith(4)
      expect(result.current.submitting).toBe(false)
    })

    it('F7.2 – submitToCarmen throws without UserMessage → error text from Error.message', async () => {
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockRejectedValue(new Error('connection refused'))

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => {
        await result.current.handleSubmitFinal(defaultRows)
      })

      const toastCall = showToast.mock.calls.find(c => c[1] === 'error')
      expect(toastCall).toBeDefined()
      expect(toastCall?.[0]).toMatch(/connection refused/)
    })
  })

  // ── F8: amount rounding at the Carmen boundary (round2) ───────────────────────

  describe('F8: Cr/Dr amounts rounded to 2dp in the JV payload', () => {
    interface JvDetail {
      CrAmount: number
      CrBase: number
      DrAmount: number
      DrBase: number
    }

    it('F8.1 – float residue and >2dp values are rounded before submit', async () => {
      mockHappyPath()
      const rows: JvRow[] = [
        // 0.1 + 0.2 = 0.30000000000000004 — must not reach the ERP raw
        { dept: 'A', acc: '1', desc: 'x', credit: 0.1 + 0.2, debit: 0 },
        { dept: 'B', acc: '2', desc: 'y', credit: 0, debit: 12.3456 },
      ]
      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => {
        await result.current.handleSubmitFinal(rows)
      })

      const payload = submitToCarmen.mock.calls[0][0] as { Detail: JvDetail[] }
      expect(payload.Detail[0].CrAmount).toBe(0.3)
      expect(payload.Detail[0].CrBase).toBe(0.3)
      expect(payload.Detail[1].DrAmount).toBe(12.35)
      expect(payload.Detail[1].DrBase).toBe(12.35)
    })
  })
})
