import { useState } from 'react'
import {
  EMPTY_DETAIL_ROW,
  detectBankFromCompanyName,
  detectBankFromExtracted,
} from '../../constants'
import { extractFromFile } from '../../lib/api/ocr'
import { showToast } from '../../lib/toast'
import type { ModalConfig } from '../useModal'
import type { BankCode } from '../../types/api'

export interface HeaderData {
  DateProcessed: string
  BankName: string
  DocName: string
  CompanyName: string
  DocDate: string
  DocNo: string
  MerchantName: string
  MerchantId: string
  BankCompanyname: string
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
  bank: BankCode | ''
  setBank: React.Dispatch<React.SetStateAction<BankCode | ''>>
  cardId: string | null
  headerData: HeaderData | Record<string, string>
  details: DetailRow[]
  originalDetails: DetailRow[]
  originalHeader: HeaderData | Record<string, string>
  processFile: (filesToProcess: File[]) => Promise<void>
  reExtract: (files: File[], bankType?: string) => Promise<void>
  updateHeader: (key: string, value: string) => void
  updateDetail: (rowIndex: number, col: string, value: string) => void
  addRow: () => void
  deleteRow: (index: number) => void
  resetExtractionState: () => void
  applyExtractedData: (ext: Record<string, unknown>, taskId?: string | null) => void
}

import type React from 'react'

const BANK_CODE_TO_NAME: Record<string, string> = {
  BBL: 'Bangkok Bank (BBL)',
  KBANK: 'Kasikornbank (KBANK)',
  SCB: 'Siam Commercial Bank (SCB)',
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
  const [bank, setBank] = useState<BankCode | ''>('')
  const [cardId, setCardId] = useState<string | null>(null)
  const [headerData, setHeaderData] = useState<Record<string, string>>({})
  const [details, setDetails] = useState<DetailRow[]>([])
  const [originalDetails, setOriginalDetails] = useState<DetailRow[]>([])
  const [originalHeader, setOriginalHeader] = useState<Record<string, string>>({})

  function applyExtractedData(ext: Record<string, unknown>, taskId: string | null = null) {
    setCardId((ext.doc_no as string) || taskId || null)
    const header: Record<string, string> = {
      DateProcessed: new Date().toLocaleDateString('en-GB'),
      BankName: (ext.bank_name as string) || '',
      DocName: (ext.doc_name as string) || '',
      CompanyName: (ext.company_name as string) || '',
      DocDate: (ext.doc_date as string) || '',
      DocNo: (ext.doc_no as string) || '',
      MerchantName: (ext.merchant_name as string) || '',
      MerchantId: (ext.merchant_id as string) || '',
      BankCompanyname: (ext.bank_companyname as string) || '',
      BranchNo: (ext.branch_no as string) || '',
    }
    setHeaderData(header)
    const rawDetails = (ext.details as Array<Record<string, string>> | undefined) || []
    const detailsList: DetailRow[] = (rawDetails.length ? rawDetails : [{ ...EMPTY_DETAIL_ROW }]).map(
      row => ({ ...EMPTY_DETAIL_ROW, ...row, _uid: crypto.randomUUID() })
    )
    setDetails(detailsList)
    setOriginalDetails(JSON.parse(JSON.stringify(detailsList)) as DetailRow[])
    setOriginalHeader(JSON.parse(JSON.stringify(header)) as Record<string, string>)

    try {
      const bankCode =
        detectBankFromExtracted(ext as Record<string, string | null | undefined>) ||
        detectBankFromCompanyName(ext.bank_companyname as string) ||
        ''
      localStorage.setItem(
        'ocr_wizard_state',
        JSON.stringify({ bank: bankCode, details: detailsList })
      )
    } catch {
      /* ignore */
    }

    if (ext.bank_companyname || ext.branch_no) {
      try {
        const existing = JSON.parse(localStorage.getItem('accountingConfig') || '{}') as Record<string, unknown>
        const existingCompany = (existing.company as Record<string, string> | undefined) || {}
        const updatedCompany: Record<string, unknown> = { ...(existingCompany as Record<string, unknown>) }
        if (ext.bank_companyname) updatedCompany.name = ext.bank_companyname as string
        if (ext.branch_no) updatedCompany.branch = ext.branch_no as string
        existing.company = updatedCompany
        const detectedBankCode = detectBankFromCompanyName(ext.bank_companyname as string)
        if (detectedBankCode && BANK_CODE_TO_NAME[detectedBankCode]) {
          existing.bank = BANK_CODE_TO_NAME[detectedBankCode]
        }
        localStorage.setItem('accountingConfig', JSON.stringify(existing))
      } catch {
        /* ignore */
      }
    }
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

  async function processFile(filesToProcess: File[]) {
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
      const ext = await extractFromFile(filesToProcess[0])
      if (ext.is_duplicate) {
        setStatus('Duplicate document found')
        showDuplicateModal(ext.doc_no)
        return
      }
      applyExtractedData(ext as unknown as Record<string, unknown>)
      setBank((detectBankFromExtracted(ext as unknown as Record<string, string>) || '') as BankCode | '')
      setStatus('Data extracted successfully ✓')
      setStep(2)
      showToast(
        `Successfully extracted ${filesToProcess.length} ${filesToProcess.length === 1 ? 'file' : 'files'} — please review and edit`,
        'success'
      )
    } catch (err) {
      const e = err as { status?: number; message: string }
      if (e.status === 429) {
        showModal({
          title: 'Monthly Quota Exceeded',
          message:
            'Your Business Unit has reached the monthly document processing limit. Please contact your administrator to upgrade your plan.',
          type: 'warning',
          confirmText: 'Acknowledge',
          onConfirm: () => {
            closeModal()
            setStep(1)
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

  async function reExtract(files: File[], bankType?: string) {
    if (!files || files.length === 0) return
    setLoading(true)
    setStatus(`Re-extracting with ${bankType || 'auto-detect'}...`)
    try {
      const ext = await extractFromFile(files[0], bankType || undefined)
      applyExtractedData(ext as unknown as Record<string, unknown>)
      setBank((bankType || detectBankFromExtracted(ext as unknown as Record<string, string>) || '') as BankCode | '')
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
    setBank('')
    setCardId(null)
  }

  return {
    loading, status, bank, setBank, cardId, headerData, details, originalDetails, originalHeader,
    processFile, reExtract, updateHeader, updateDetail, addRow, deleteRow,
    resetExtractionState, applyExtractedData,
  }
}
