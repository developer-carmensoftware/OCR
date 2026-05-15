import { useState } from 'react'
import {
  EMPTY_DETAIL_ROW,
  detectBankFromCompanyName,
  detectBankFromExtracted,
} from '../../constants'
import { extractFromFile } from '../../lib/api/ocr'
import { showToast } from '../../lib/toast'

/**
 * Manages the OCR extraction flow: calling the API, parsing results,
 * applying extracted data to state, and handling re-extraction.
 */
export function useOcrExtraction({ showModal, closeModal, setStep, clearFiles, fileInputRef }) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [bank, setBank] = useState('')
  const [cardId, setCardId] = useState(null)
  const [headerData, setHeaderData] = useState({})
  const [details, setDetails] = useState([])
  const [originalDetails, setOriginalDetails] = useState([])
  const [originalHeader, setOriginalHeader] = useState({})

  const BANK_CODE_TO_NAME = {
    BBL: 'Bangkok Bank (BBL)',
    KBANK: 'Kasikornbank (KBANK)',
    SCB: 'Siam Commercial Bank (SCB)',
  }

  function applyExtractedData(ext, taskId = null) {
    setCardId(ext.doc_no || taskId || null)
    const header = {
      DateProcessed: new Date().toLocaleDateString('en-GB'),
      BankName: ext.bank_name || '',
      DocName: ext.doc_name || '',
      CompanyName: ext.company_name || '',
      DocDate: ext.doc_date || '',
      DocNo: ext.doc_no || '',
      MerchantName: ext.merchant_name || '',
      MerchantId: ext.merchant_id || '',
      BankCompanyname: ext.bank_companyname || '',
      BranchNo: ext.branch_no || '',
    }
    setHeaderData(header)
    const detailsList = (ext.details?.length ? ext.details : [{ ...EMPTY_DETAIL_ROW }]).map(
      row => ({ ...row, _uid: crypto.randomUUID() })
    )
    setDetails(detailsList)
    setOriginalDetails(JSON.parse(JSON.stringify(detailsList)))
    setOriginalHeader(JSON.parse(JSON.stringify(header)))

    // Write for Mapping page to read activeScan (payment types, commission/tax/net flags)
    try {
      const bankCode =
        detectBankFromExtracted(ext) || detectBankFromCompanyName(ext.bank_companyname) || ''
      localStorage.setItem(
        'ocr_wizard_state',
        JSON.stringify({ bank: bankCode, details: detailsList })
      )
    } catch {
      /* ignore */
    }

    if (ext.bank_companyname || ext.branch_no) {
      try {
        const existing = JSON.parse(localStorage.getItem('accountingConfig') || '{}')
        existing.company = {
          ...existing.company,
          ...(ext.bank_companyname && { name: ext.bank_companyname }),
          ...(ext.branch_no && { branch: ext.branch_no }),
        }
        const detectedBankCode = detectBankFromCompanyName(ext.bank_companyname)
        if (detectedBankCode && BANK_CODE_TO_NAME[detectedBankCode]) {
          existing.bank = BANK_CODE_TO_NAME[detectedBankCode]
        }
        localStorage.setItem('accountingConfig', JSON.stringify(existing))
      } catch {
        /* ignore */
      }
    }
  }

  function showDuplicateModal(docNo) {
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

  async function processFile(filesToProcess) {
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
      const ext = await extractFromFile(filesToProcess[0], null)
      if (ext.is_duplicate) {
        setStatus('Duplicate document found')
        showDuplicateModal(ext.doc_no)
        return
      }
      applyExtractedData(ext)
      setBank(detectBankFromExtracted(ext) || '')
      setStatus('Data extracted successfully ✓')
      setStep(2)
      showToast(
        `Successfully extracted ${filesToProcess.length} ${filesToProcess.length === 1 ? 'file' : 'files'} — please review and edit`,
        'success'
      )
    } catch (err) {
      if (err.status === 429) {
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
        setStatus(err.message)
        showModal({
          title: 'Error Occurred',
          message: `Failed to extract data: ${err.message}`,
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

  async function reExtract(files, bankType) {
    if (!files || files.length === 0) return
    setLoading(true)
    setStatus(`Re-extracting with ${bankType || 'auto-detect'}...`)
    try {
      const ext = await extractFromFile(files[0], bankType || null)
      applyExtractedData(ext)
      setBank(bankType || detectBankFromExtracted(ext) || '')
      showToast(`Re-extracted successfully${bankType ? ` with ${bankType}` : ''}`, 'success')
    } catch (err) {
      showModal({
        title: 'Re-extract Failed',
        message: `Failed to re-extract: ${err.message}`,
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

  function updateHeader(key, value) {
    setHeaderData(prev => ({ ...prev, [key]: value }))
  }

  function updateDetail(rowIndex, col, value) {
    setDetails(prev => prev.map((row, i) => (i === rowIndex ? { ...row, [col]: value } : row)))
  }

  function addRow() {
    setDetails(prev => [...prev, { ...EMPTY_DETAIL_ROW, _uid: crypto.randomUUID() }])
  }
  function deleteRow(index) {
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
    loading,
    status,
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
