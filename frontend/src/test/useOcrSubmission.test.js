import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOcrSubmission } from '../hooks/credit-card/useOcrSubmission'

// ─── module mocks ─────────────────────────────────────────────────────────────
vi.mock('../lib/api/submit', () => ({ submitToLocal: vi.fn() }))
vi.mock('../lib/api/carmen', () => ({ submitToCarmen: vi.fn() }))
vi.mock('../lib/api/feedback', () => ({
  logCorrections: vi.fn(),
  diffCorrections: vi.fn(),
}))
vi.mock('../lib/api/config', () => ({ getAccountingConfig: vi.fn() }))
vi.mock('../lib/url', () => ({ getCarmenUrl: vi.fn((p) => `https://carmen.test/#${p}`) }))
vi.mock('../lib/toast', () => ({ showToast: vi.fn() }))

import { submitToLocal } from '../lib/api/submit'
import { submitToCarmen } from '../lib/api/carmen'
import { logCorrections, diffCorrections } from '../lib/api/feedback'
import { getAccountingConfig } from '../lib/api/config'
import { showToast } from '../lib/toast'

// ─── helpers ──────────────────────────────────────────────────────────────────
function makeProps(overrides = {}) {
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
      BankCompanyname: 'BCO',
      BranchNo: '001',
    },
    details: [],
    bank: 'KBANK',
    cardId: 'card-uuid-123',
    originalHeader: {},
    originalDetails: [],
    setJvRows: vi.fn(),
    setCarmenJvId: vi.fn(),
    ...overrides,
  }
}

const defaultRows = [
  { dept: 'ACC', acc: '1100', desc: 'Revenue', credit: 1000, debit: 0 },
]

const defaultConfig = {
  file_prefix: 'PRE',
  file_source: 'SRC',
  description: 'Monthly JV',
}

function mockHappyPath() {
  submitToLocal.mockResolvedValue({})
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
      let resolveLocal
      submitToLocal.mockReturnValue(new Promise(r => { resolveLocal = r }))
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockResolvedValue({ Code: 0 })

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))

      expect(result.current.submitting).toBe(false)

      act(() => { result.current.handleSubmitFinal(defaultRows) })
      expect(result.current.submitting).toBe(true)

      await act(async () => { resolveLocal({}) })
    })

    it('F1.2 – submitting resets to false after success', async () => {
      mockHappyPath()
      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))

      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(result.current.submitting).toBe(false)
    })

    it('F1.3 – submitting resets to false after submitToLocal error', async () => {
      submitToLocal.mockRejectedValue(new Error('DB error'))
      diffCorrections.mockReturnValue([])

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))

      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(result.current.submitting).toBe(false)
    })

    it('F1.4 – setJvRows called immediately with rows argument', async () => {
      mockHappyPath()
      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))

      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(props.setJvRows).toHaveBeenCalledWith(defaultRows)
    })
  })

  // ── F2: Payload construction ─────────────────────────────────────────────────

  describe('F2: payload construction', () => {
    it('F2.1 – all header fields mapped correctly', async () => {
      mockHappyPath()
      const props = makeProps()
      renderHook(() => useOcrSubmission(props))

      // We verify via what submitToLocal receives
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      const payload = submitToLocal.mock.calls[0][0]
      expect(payload.Header.BankName).toBe('Test Bank')
      expect(payload.Header.DocNo).toBe('DOC-001')
      expect(payload.Header.CompanyName).toBe('Acme Co')
      expect(payload.Header.MerchantName).toBe('MerchantX')
      expect(payload.Header.BranchNo).toBe('001')
      expect(payload.BankType).toBe('KBANK')
    })

    it('F2.2 – missing header fields fall back to empty string', async () => {
      mockHappyPath()
      const props = makeProps({
        headerData: { DocNo: 'X', DocDate: '01/01/2024' }, // most fields missing
      })
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      const { Header } = submitToLocal.mock.calls[0][0]
      expect(Header.BankName).toBe('')
      expect(Header.CompanyName).toBe('')
      expect(Header.MerchantName).toBe('')
    })

    it('F2.3 – detail rows use camelCase keys (PayAmt, CommisAmt...)', async () => {
      mockHappyPath()
      const details = [{
        Transaction: 'Sale', PayAmt: '1,000', CommisAmt: '20', TaxAmt: '5', Total: '1,025', WHTAmount: '10',
      }]
      const props = makeProps({ details })
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      const d = submitToLocal.mock.calls[0][0].Details[0]
      expect(d.Transaction).toBe('Sale')
      expect(d.PayAmt).toBe(1000)
      expect(d.CommisAmt).toBe(20)
      expect(d.TaxAmt).toBe(5)
      expect(d.Total).toBe(1025)
      expect(d.WHTAmount).toBe(10)
    })

    it('F2.4 – detail rows fall back to snake_case keys (pay_amt, commis_amt...)', async () => {
      mockHappyPath()
      const details = [{
        transaction: 'Transfer', pay_amt: '500', commis_amt: '10', tax_amt: '2', total: '512', wht_amount: '0',
      }]
      const props = makeProps({ details })
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      const d = submitToLocal.mock.calls[0][0].Details[0]
      expect(d.Transaction).toBe('Transfer')
      expect(d.PayAmt).toBe(500)
    })

    it('F2.5 – comma-formatted amounts stripped correctly', async () => {
      mockHappyPath()
      const details = [{ PayAmt: '1,234,567.89', CommisAmt: '0', TaxAmt: '0', Total: '0', WHTAmount: '0' }]
      const props = makeProps({ details })
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(submitToLocal.mock.calls[0][0].Details[0].PayAmt).toBe(1234567.89)
    })

    it('F2.6 – null/undefined amounts default to 0', async () => {
      mockHappyPath()
      const details = [{ Transaction: 'X' }] // all amounts missing
      const props = makeProps({ details })
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      const d = submitToLocal.mock.calls[0][0].Details[0]
      expect(d.PayAmt).toBe(0)
      expect(d.CommisAmt).toBe(0)
      expect(d.TaxAmt).toBe(0)
      expect(d.Total).toBe(0)
      expect(d.WHTAmount).toBe(0)
    })
  })

  // ── F3: Date parsing ─────────────────────────────────────────────────────────

  describe('F3: Carmen payload date parsing', () => {
    async function getJvhDate(docDate) {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockResolvedValue({ Code: 0 })

      const props = makeProps({ headerData: { DocNo: 'X', DocDate: docDate } })
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })
      return submitToCarmen.mock.calls[0][0].JvhDate
    }

    it('F3.1 – CE date "15/05/2024" → ISO 2024-05-15', async () => {
      const iso = await getJvhDate('15/05/2024')
      expect(iso).toMatch(/^2024-05-15/)
    })

    it('F3.2 – BE date "15/05/2567" → CE 2024, ISO 2024-05-15', async () => {
      const iso = await getJvhDate('15/05/2567')
      expect(iso).toMatch(/^2024-05-15/)
    })

    it('F3.3 – invalid date falls back to current date ISO', async () => {
      const before = Date.now()
      const iso = await getJvhDate('xx/yy/zzzz')
      const after = Date.now()
      const parsed = new Date(iso).getTime()
      expect(parsed).toBeGreaterThanOrEqual(before - 1000)
      expect(parsed).toBeLessThanOrEqual(after + 1000)
    })

    it('F3.4 – empty DocDate falls back to current date ISO', async () => {
      const before = Date.now()
      const iso = await getJvhDate('')
      const parsed = new Date(iso).getTime()
      expect(parsed).toBeGreaterThanOrEqual(before - 1000)
    })
  })

  // ── F4: submitToLocal failures ────────────────────────────────────────────────

  describe('F4: submitToLocal failures', () => {
    it('F4.1 – DUPLICATE_DOC_NO error shows duplicate modal', async () => {
      const err = new Error('Duplicate')
      err.code = 'DUPLICATE_DOC_NO'
      submitToLocal.mockRejectedValue(err)
      diffCorrections.mockReturnValue([])

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(props.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Duplicate Document Found',
          message: expect.stringContaining('DOC-001'),
          type: 'error',
        })
      )
    })

    it('F4.2 – generic error shows generic modal with err.message', async () => {
      submitToLocal.mockRejectedValue(new Error('DB connection failed'))
      diffCorrections.mockReturnValue([])

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(props.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error saving data',
          message: 'DB connection failed',
          type: 'error',
        })
      )
    })

    it('F4.3 – submitToCarmen NOT called when submitToLocal throws', async () => {
      submitToLocal.mockRejectedValue(new Error('fail'))
      diffCorrections.mockReturnValue([])

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(submitToCarmen).not.toHaveBeenCalled()
    })

    it('F4.4 – submitting resets to false even on DUPLICATE_DOC_NO', async () => {
      const err = new Error('dup'); err.code = 'DUPLICATE_DOC_NO'
      submitToLocal.mockRejectedValue(err)
      diffCorrections.mockReturnValue([])

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(result.current.submitting).toBe(false)
    })
  })

  // ── F5: Corrections / feedback ────────────────────────────────────────────────

  describe('F5: corrections / feedback (fire-and-forget)', () => {
    it('F5.1 – no corrections → logCorrections NOT called', async () => {
      mockHappyPath()
      diffCorrections.mockReturnValue([])

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(logCorrections).not.toHaveBeenCalled()
    })

    it('F5.2 – corrections present → logCorrections called with cardId, bank, corrections', async () => {
      mockHappyPath()
      const fakeCorrections = [{ fieldName: 'DocNo', originalValue: 'A', correctedValue: 'B' }]
      diffCorrections.mockReturnValue(fakeCorrections)
      logCorrections.mockResolvedValue(undefined)

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(logCorrections).toHaveBeenCalledWith('card-uuid-123', 'KBANK', fakeCorrections)
    })

    it('F5.3 – logCorrections error is caught silently, flow continues', async () => {
      mockHappyPath()
      diffCorrections.mockReturnValue([{ fieldName: 'X', originalValue: '1', correctedValue: '2' }])
      logCorrections.mockRejectedValue(new Error('network'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      // flow continued → submitToCarmen was called
      expect(submitToCarmen).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  // ── F6: getAccountingConfig & fallback ────────────────────────────────────────

  describe('F6: getAccountingConfig fallback', () => {
    it('F6.1 – API success → Prefix and JvhSource from API config', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue({ file_prefix: 'API_PRE', file_source: 'API_SRC', description: '' })
      submitToCarmen.mockResolvedValue({ Code: 0 })

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      const payload = submitToCarmen.mock.calls[0][0]
      expect(payload.Prefix).toBe('API_PRE')
      expect(payload.JvhSource).toBe('API_SRC')
    })

    it('F6.2 – API fails → falls back to localStorage accountingConfig', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockRejectedValue(new Error('network'))
      submitToCarmen.mockResolvedValue({ Code: 0 })
      window.localStorage.setItem('accountingConfig', JSON.stringify({ file_prefix: 'LS_PRE', file_source: 'LS_SRC', description: '' }))

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(submitToCarmen.mock.calls[0][0].Prefix).toBe('LS_PRE')
    })

    it('F6.3 – API fails + localStorage invalid JSON → uses empty config (no crash)', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockRejectedValue(new Error('network'))
      submitToCarmen.mockResolvedValue({ Code: 0 })
      window.localStorage.setItem('accountingConfig', 'NOT_JSON')

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(submitToCarmen.mock.calls[0][0].Prefix).toBe('')
    })

    it('F6.4 – API fails + localStorage empty → uses empty config (no crash)', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockRejectedValue(new Error('network'))
      submitToCarmen.mockResolvedValue({ Code: 0 })

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(submitToCarmen.mock.calls[0][0].Prefix).toBe('')
    })

    it('F6.5 – snake_case config key file_prefix used for Prefix', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue({ file_prefix: 'SNAKE', description: '' })
      submitToCarmen.mockResolvedValue({ Code: 0 })

      const { result } = renderHook(() => useOcrSubmission(makeProps()))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(submitToCarmen.mock.calls[0][0].Prefix).toBe('SNAKE')
    })

    it('F6.6 – camelCase config key filePrefix used as fallback', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue({ filePrefix: 'CAMEL', description: '' })
      submitToCarmen.mockResolvedValue({ Code: 0 })

      const { result } = renderHook(() => useOcrSubmission(makeProps()))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(submitToCarmen.mock.calls[0][0].Prefix).toBe('CAMEL')
    })
  })

  // ── F7: Carmen success (Code === 0) ───────────────────────────────────────────

  describe('F7: Carmen success (Code === 0)', () => {
    it('F7.1 – InternalMessage present → setCarmenJvId called with jvId', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockResolvedValue({ Code: 0, InternalMessage: 'JV-777' })

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(props.setCarmenJvId).toHaveBeenCalledWith('JV-777')
    })

    it('F7.2 – no InternalMessage → setCarmenJvId NOT called', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockResolvedValue({ Code: 0 })

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(props.setCarmenJvId).not.toHaveBeenCalled()
    })

    it('F7.3 – jvId present → modal has "View JV" cancelText and onCancel', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockResolvedValue({ Code: 0, InternalMessage: 'JV-888' })

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(props.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          cancelText: 'View JV',
          onCancel: expect.any(Function),
        })
      )
    })

    it('F7.4 – no jvId → modal has no cancelText', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockResolvedValue({ Code: 0 })

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(props.showModal).toHaveBeenCalledWith(
        expect.objectContaining({ cancelText: undefined })
      )
    })

    it('F7.5 – success toast shown', async () => {
      mockHappyPath()
      const { result } = renderHook(() => useOcrSubmission(makeProps()))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(showToast).toHaveBeenCalledWith('Successfully sent data to Carmen GL JV', 'success')
    })

    it('F7.6 – modal onConfirm calls closeModal + setStep(4)', async () => {
      mockHappyPath()
      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      const { onConfirm } = props.showModal.mock.calls[0][0]
      onConfirm()
      expect(props.closeModal).toHaveBeenCalled()
      expect(props.setStep).toHaveBeenCalledWith(4)
    })

    it('F7.7 – "View JV" onCancel opens Carmen URL', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockResolvedValue({ Code: 0, InternalMessage: 'JV-100' })

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      const { onCancel } = props.showModal.mock.calls[0][0]
      onCancel()
      expect(window.open).toHaveBeenCalledWith('https://carmen.test/#/glJv/JV-100/show', '_blank')
    })
  })

  // ── F8: Carmen "already posted" (Code !== 0) ──────────────────────────────────

  describe('F8: Carmen already posted (Code !== 0)', () => {
    it('F8.1 – non-zero Code shows "Warning: Data Already Posted" modal', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockResolvedValue({ Code: 1, UserMessage: 'Already posted' })

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(props.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Warning: Data Already Posted',
          type: 'warning',
        })
      )
    })

    it('F8.2 – modal message contains docNo and UserMessage', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockResolvedValue({ Code: 5, UserMessage: 'Document exists in ERP' })

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      const { message } = props.showModal.mock.calls[0][0]
      expect(message).toContain('DOC-001')
      expect(message).toContain('Document exists in ERP')
    })

    it('F8.3 – warning toast shown with UserMessage', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockResolvedValue({ Code: 2, UserMessage: 'Duplicate JV' })

      const { result } = renderHook(() => useOcrSubmission(makeProps()))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Duplicate JV'), 'warning')
    })

    it('F8.4 – modal onConfirm calls closeModal + setStep(1)', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockResolvedValue({ Code: 1, UserMessage: 'Err' })

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      const { onConfirm } = props.showModal.mock.calls[0][0]
      onConfirm()
      expect(props.closeModal).toHaveBeenCalled()
      expect(props.setStep).toHaveBeenCalledWith(1)
    })
  })

  // ── F9: Carmen throws (network error) ────────────────────────────────────────

  describe('F9: Carmen throws (network/runtime error)', () => {
    it('F9.1 – error toast shown with err.message', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockRejectedValue(new Error('timeout'))

      const { result } = renderHook(() => useOcrSubmission(makeProps()))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('timeout'), 'error')
    })

    it('F9.2 – modal title indicates Carmen issue', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockRejectedValue(new Error('ECONNREFUSED'))

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(props.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Saved Successfully (Carmen issue)',
          type: 'warning',
        })
      )
    })

    it('F9.3 – modal message contains err.message', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockRejectedValue(new Error('socket hang up'))

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      const { message } = props.showModal.mock.calls[0][0]
      expect(message).toContain('socket hang up')
    })

    it('F9.4 – setCarmenJvId NOT called when Carmen throws', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockRejectedValue(new Error('fail'))

      const props = makeProps()
      const { result } = renderHook(() => useOcrSubmission(props))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(props.setCarmenJvId).not.toHaveBeenCalled()
    })
  })

  // ── F10: Carmen payload structure ─────────────────────────────────────────────

  describe('F10: Carmen payload structure', () => {
    it('F10.1 – Detail rows mapped from rows arg (dept/acc/desc/credit/debit)', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockResolvedValue({ Code: 0 })

      const rows = [
        { dept: 'FIN', acc: '2100', desc: 'Payable', credit: 500, debit: 0 },
        { dept: 'OPS', acc: '3000', desc: 'Expense', credit: 0, debit: 250 },
      ]
      const { result } = renderHook(() => useOcrSubmission(makeProps()))
      await act(async () => { await result.current.handleSubmitFinal(rows) })

      const { Detail } = submitToCarmen.mock.calls[0][0]
      expect(Detail).toHaveLength(2)
      expect(Detail[0]).toMatchObject({ DeptCode: 'FIN', AccCode: '2100', Description: 'Payable', CrAmount: 500, DrAmount: 0 })
      expect(Detail[1]).toMatchObject({ DeptCode: 'OPS', AccCode: '3000', DrAmount: 250 })
    })

    it('F10.2 – static fields have correct values', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue(defaultConfig)
      submitToCarmen.mockResolvedValue({ Code: 0 })

      const { result } = renderHook(() => useOcrSubmission(makeProps()))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      const p = submitToCarmen.mock.calls[0][0]
      expect(p.JvhSeq).toBe(-1)
      expect(p.JvhNo).toBe('Auto')
      expect(p.Status).toBe('Draft')
      expect(p.Detail[0].CurCode).toBe('THB')
      expect(p.Detail[0].CurRate).toBe(1)
      expect(p.Detail[0].JvhSeq).toBe(-1)
      expect(p.Detail[0].JvdSeq).toBe(-1)
      expect(p.DimHList).toEqual({ Dim: [] })
    })

    it('F10.3 – Description built as "{desc} - {DocDate}"', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue({ description: 'Monthly JV', file_prefix: '' })
      submitToCarmen.mockResolvedValue({ Code: 0 })

      const { result } = renderHook(() => useOcrSubmission(makeProps()))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(submitToCarmen.mock.calls[0][0].Description).toBe('Monthly JV - 15/05/2024')
    })

    it('F10.4 – empty description config → Description is empty string', async () => {
      submitToLocal.mockResolvedValue({})
      diffCorrections.mockReturnValue([])
      getAccountingConfig.mockResolvedValue({ description: '', file_prefix: '' })
      submitToCarmen.mockResolvedValue({ Code: 0 })

      const { result } = renderHook(() => useOcrSubmission(makeProps()))
      await act(async () => { await result.current.handleSubmitFinal(defaultRows) })

      expect(submitToCarmen.mock.calls[0][0].Description).toBe('')
    })
  })
})
