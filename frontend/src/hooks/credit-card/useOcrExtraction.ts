import { useState, useEffect } from 'react'
import type React from 'react'
import {
  EMPTY_DETAIL_ROW,
  detectBankFromCompanyName,
  detectBankFromExtracted,
} from '../../constants'
import { extractFromFile } from '../../lib/api/ocr'
import { showToast } from '../../lib/toast'
import { appKey } from '../../lib/storage'
import type { ModalConfig } from '../useModal'
import type { BankCode } from '../../types/api'
import { normalizeDateStringToCE } from '../../lib/date'

export interface HeaderData {
  DateProcessed: string
  BankName: string
  DocName: string
  CompanyName: string
  DocDate: string
  DocNo: string
  MerchantName: string
  MerchantId: string
  BankCompanyName: string
  BranchNo: string
  [key: string]: string
}

export interface DetailRow {
  Transaction: string
  PayAmt: string
  CommisAmt: string
  TaxAmt: string
  Total: string
  _uid: string
  [key: string]: string
}

interface OcrExtractionProps {
  showModal: (config: Omit<ModalConfig, 'show'>) => void
  closeModal: () => void
  setStep: (step: number) => void
  clearFiles: () => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
}

export interface OcrExtractionHook {
  loading: boolean
  status: string
  elapsed: number
  extractionStatus: string
  bank: BankCode | ''
  setBank: React.Dispatch<React.SetStateAction<BankCode | ''>>
  cardId: string | null
  headerData: HeaderData | Record<string, string>
  details: DetailRow[]
  originalDetails: DetailRow[]
  originalHeader: HeaderData | Record<string, string>
  processFile: (
    filesToProcess: File[],
    selectedPages?: number[],
    pdfPassword?: string
  ) => Promise<void>
  reExtract: (
    files: File[],
    bankType?: string,
    selectedPages?: number[],
    pdfPassword?: string
  ) => Promise<void>
  updateHeader: (key: string, value: string) => void
  updateDetail: (rowIndex: number, col: string, value: string) => void
  addRow: () => void
  deleteRow: (index: number) => void
  resetExtractionState: () => void
  applyExtractedData: (ext: Record<string, unknown>, _taskId?: string | null) => void
}

const EXTRACTION_STAGES = [
  { at: 0, text: 'Reading document…' },
  { at: 6, text: 'Analysing document structure…' },
  { at: 13, text: 'Extracting transactions and amounts…' },
  { at: 22, text: 'Almost done…' },
  { at: 35, text: 'Complex document — still working…' },
]

const BANK_CODE_TO_NAME: Record<string, string> = {
  BBL: 'Bangkok Bank (BBL)',
  KBANK: 'Kasikornbank (KBANK)',
  SCB: 'Siam Commercial Bank (SCB)',
}

// Persists bank code + detail rows for the mapping step (ocr_wizard_state) and merges vendor
// company/branch into accountingConfig so the GL-mapping step pre-fills correctly.
// Kept outside the hook because it is a pure side effect with no React state dependency.
function _persistOcrLocalStorage(ext: Record<string, unknown>, detailsList: DetailRow[]): void {
  try {
    const bankCode =
      detectBankFromExtracted(ext as Record<string, string | null | undefined>) ||
      detectBankFromCompanyName(ext.bank_company_name as string) ||
      ''
    localStorage.setItem(
      appKey('ocr_wizard_state'),
      JSON.stringify({ bank: bankCode, details: detailsList })
    )
  } catch {
    /* ignore */
  }

  if (ext.bank_company_name || ext.branch_no) {
    try {
      const existing = JSON.parse(
        localStorage.getItem(appKey('accountingConfig')) || '{}'
      ) as Record<string, unknown>
      const existingCompany = (existing.company as Record<string, string> | undefined) || {}
      const updatedCompany: Record<string, unknown> = {
        ...(existingCompany as Record<string, unknown>),
      }
      if (ext.bank_company_name) updatedCompany.name = ext.bank_company_name as string
      if (ext.branch_no) updatedCompany.branch = ext.branch_no as string
      existing.company = updatedCompany
      const detectedBankCode = detectBankFromCompanyName(ext.bank_company_name as string)
      if (detectedBankCode && BANK_CODE_TO_NAME[detectedBankCode]) {
        existing.bank = BANK_CODE_TO_NAME[detectedBankCode]
      }
      localStorage.setItem(appKey('accountingConfig'), JSON.stringify(existing))
    } catch {
      /* ignore */
    }
  }
}

export function useOcrExtraction({
  showModal,
  closeModal,
  setStep,
  clearFiles,
  fileInputRef: _fileInputRef,
}: OcrExtractionProps): OcrExtractionHook {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!loading) {
      setElapsed(0)
      return
    }
    const id = window.setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [loading])

  const extractionStatus = loading
    ? ([...EXTRACTION_STAGES].reverse().find(s => elapsed >= s.at)?.text ??
      EXTRACTION_STAGES[0].text)
    : status
  const [bank, setBank] = useState<BankCode | ''>('')
  const [cardId, setCardId] = useState<string | null>(null)
  const [headerData, setHeaderData] = useState<Record<string, string>>({})
  const [details, setDetails] = useState<DetailRow[]>([])
  const [originalDetails, setOriginalDetails] = useState<DetailRow[]>([])
  const [originalHeader, setOriginalHeader] = useState<Record<string, string>>({})

  function applyExtractedData(ext: Record<string, unknown>, _taskId: string | null = null) {
    setCardId((ext.id as string) || null)
    const header: Record<string, string> = {
      DateProcessed: new Date().toLocaleDateString('en-GB'),
      BankName: (ext.bank_name as string) || '',
      DocName: (ext.doc_name as string) || '',
      CompanyName: (ext.company_name as string) || '',
      DocDate: normalizeDateStringToCE((ext.doc_date as string) || ''),
      DocNo: (ext.doc_no as string) || '',
      MerchantName: (ext.merchant_name as string) || '',
      MerchantId: (ext.merchant_id as string) || '',
      BankCompanyName: (ext.bank_company_name as string) || '',
      BranchNo: (ext.branch_no as string) || '',
    }
    setHeaderData(header)
    const rawDetails = (ext.details as Array<Record<string, string>> | undefined) || []
    const detailsList: DetailRow[] = (
      rawDetails.length ? rawDetails : [{ ...EMPTY_DETAIL_ROW }]
    ).map(row => ({ ...EMPTY_DETAIL_ROW, ...row, _uid: crypto.randomUUID() }))
    setDetails(detailsList)
    setOriginalDetails(structuredClone(detailsList))
    setOriginalHeader(structuredClone(header))
    _persistOcrLocalStorage(ext, detailsList)
  }

  function showDuplicateModal(docNo: string) {
    showModal({
      title: 'Duplicate Document Found',
      message: `Document number ${docNo} is already saved in the system.\nCannot import duplicate document.`,
      type: 'error',
      confirmText: 'OK',
      onConfirm: () => {
        closeModal()
        setStep(1)
        clearFiles()
      },
    })
  }

  async function processFile(
    filesToProcess: File[],
    selectedPages?: number[],
    pdfPassword?: string
  ) {
    if (!filesToProcess || filesToProcess.length === 0) {
      showModal({
        title: 'No Document File Found',
        message: 'Please select an image or PDF file to process.',
        type: 'warning',
        confirmText: 'OK',
        onConfirm: closeModal,
      })
      return
    }
    setLoading(true)
    setStatus('AI is extracting data from document...')
    try {
      const ext = await extractFromFile(filesToProcess[0], undefined, selectedPages, pdfPassword)
      if (ext.is_duplicate) {
        setStatus('Duplicate document found')
        showDuplicateModal(ext.doc_no)
        return
      }
      applyExtractedData(ext as unknown as Record<string, unknown>)
      setBank(
        (detectBankFromExtracted(ext as unknown as Record<string, string>) || '') as BankCode | ''
      )
      setStatus('Data extracted successfully ✓')
      setStep(2)
      showToast(
        `Successfully extracted ${filesToProcess.length} ${filesToProcess.length === 1 ? 'file' : 'files'} — please review and edit`,
        'success'
      )
    } catch (err) {
      const e = err as { status?: number; message: string }
      if (e.status === 402) {
        showModal({
          title: 'Out of Documents',
          message:
            "You've used all 30 documents in your one-time free trial and have no top-up credits left. Buy a credit pack to continue — credits never expire.",
          type: 'warning',
          confirmText: 'Buy Credits',
          onConfirm: () => {
            closeModal()
            window.dispatchEvent(new Event('ocr:open-topup'))
            setStep(1)
            clearFiles()
          },
        })
      } else if (e.status === 408) {
        showModal({
          title: 'Extraction Timed Out',
          message:
            'The server took too long to process this document. This may happen with large or complex documents — please try again.',
          type: 'warning',
          confirmText: 'Try Again',
          onConfirm: () => {
            closeModal()
            setStep(1)
            clearFiles()
          },
        })
      } else if (e.status === 429) {
        showModal({
          title: 'Too Many Requests',
          message: 'You are sending requests too quickly. Please slow down and try again shortly.',
          type: 'warning',
          confirmText: 'Acknowledge',
          onConfirm: () => {
            closeModal()
            setStep(1)
            clearFiles()
          },
        })
      } else if (e.status === 401) {
        // AuthContext handles the "session expired" toast + state reset via ocr:unauthorized.
        clearFiles()
      } else if (!e.status && (e as unknown as Error).message === 'Failed to fetch') {
        showModal({
          title: 'Connection Error',
          message: 'Could not reach the server — please check your network and try again.',
          type: 'warning',
          confirmText: 'Close',
          onConfirm: () => {
            closeModal()
            clearFiles()
          },
        })
      } else {
        setStatus(e.message)
        showModal({
          title: 'Error Occurred',
          message: `Failed to extract data: ${e.message}`,
          type: 'error',
          confirmText: 'Close',
          onConfirm: closeModal,
        })
      }
      setStep(1)
    } finally {
      setLoading(false)
      window.dispatchEvent(new Event('ocr:quota-refresh'))
    }
  }

  async function reExtract(
    files: File[],
    bankType?: string,
    selectedPages?: number[],
    pdfPassword?: string
  ) {
    if (!files || files.length === 0) return
    setLoading(true)
    setStatus(`Re-extracting with ${bankType || 'auto-detect'}...`)
    try {
      const ext = await extractFromFile(files[0], bankType || undefined, selectedPages, pdfPassword)
      applyExtractedData(ext as unknown as Record<string, unknown>)
      setBank(
        (bankType || detectBankFromExtracted(ext as unknown as Record<string, string>) || '') as
          | BankCode
          | ''
      )
      showToast(`Re-extracted successfully${bankType ? ` with ${bankType}` : ''}`, 'success')
    } catch (err) {
      const e = err as { message: string }
      showModal({
        title: 'Re-extract Failed',
        message: `Failed to re-extract: ${e.message}`,
        type: 'error',
        confirmText: 'Close',
        onConfirm: closeModal,
      })
    } finally {
      setLoading(false)
      setStatus('')
      window.dispatchEvent(new Event('ocr:quota-refresh'))
    }
  }

  function updateHeader(key: string, value: string) {
    setHeaderData(prev => ({ ...prev, [key]: value }))
  }

  function updateDetail(rowIndex: number, col: string, value: string) {
    setDetails(prev => prev.map((row, i) => (i === rowIndex ? { ...row, [col]: value } : row)))
  }

  function addRow() {
    setDetails(prev => [...prev, { ...EMPTY_DETAIL_ROW, _uid: crypto.randomUUID() }])
  }

  function deleteRow(index: number) {
    setDetails(prev => prev.filter((_, i) => i !== index))
  }

  function resetExtractionState() {
    setStatus('')
    setHeaderData({})
    setDetails([])
    setOriginalDetails([])
    setOriginalHeader({})
    setBank('')
    setCardId(null)
  }

  return {
    loading,
    status,
    elapsed,
    extractionStatus,
    bank,
    setBank,
    cardId,
    headerData,
    details,
    originalDetails,
    originalHeader,
    processFile,
    reExtract,
    updateHeader,
    updateDetail,
    addRow,
    deleteRow,
    resetExtractionState,
    applyExtractedData,
  }
}
