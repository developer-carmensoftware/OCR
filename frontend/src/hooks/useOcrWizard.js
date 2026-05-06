import { useState, useRef, useEffect } from 'react'
import { EMPTY_DETAIL_ROW, detectBankFromCompanyName, detectBankFromExtracted } from '../constants'
import { extractFromFile } from '../lib/api/ocr'
import { submitToLocal } from '../lib/api/submit'
import { submitToCarmen } from '../lib/api/carmen'
import { logCorrections, diffCorrections } from '../lib/api/feedback'
import { getCarmenUrl } from '../lib/url'
import { toast } from 'sonner'
import { useModal } from './useModal'
import { normalizeYearToCE } from '../lib/date'


export function useOcrWizard() {
  const [step, setStep] = useState(1)
  const [bank, setBank] = useState('')
  const [files, setFiles] = useState([])
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewType, setPreviewType] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState('')
  const [cardId, setCardId] = useState(null)
  const [headerData, setHeaderData] = useState({})
  const [details, setDetails] = useState([])
  const [originalDetails, setOriginalDetails] = useState([])
  const [originalHeader, setOriginalHeader] = useState({})
  const [jvRows, setJvRows] = useState([])
  const [filePrefix, setFilePrefix] = useState('IC')
  const [fileSource, setFileSource] = useState('')
  const [jvDescription, setJvDescription] = useState('')
  const [carmenJvId, setCarmenJvId] = useState(null)

  const showToast = (msg, type = 'info') => {
    if (type === 'success') toast.success(msg)
    else if (type === 'error') toast.error(msg)
    else if (type === 'warning') toast.warning(msg)
    else toast.info(msg)
  }
  const { modal, showModal, closeModal } = useModal()

  const fileInputRef = useRef(null)
  const submittedDocNos = useRef(new Set())

  useEffect(() => {
    localStorage.removeItem('ocr_wizard_state')
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl.split('#')[0])
    }
  }, [previewUrl])

  useEffect(() => {
    try {
      const config = JSON.parse(localStorage.getItem('accountingConfig') || '{}')
      setFilePrefix(config.filePrefix || 'IC')
      setFileSource(config.fileSource || '')
      const desc = config.description
        ? `${config.description}${headerData.DocDate ? ` - ${headerData.DocDate}` : ''}`
        : ''
      setJvDescription(desc)
    } catch { /* ignore */ }
  }, [step])

  function handleFileChange(e) {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return
    if (previewUrl) URL.revokeObjectURL(previewUrl.split('#')[0])

    const fileArray = Array.from(selectedFiles)
    setFiles(fileArray)
    setStatus('')

    const f = fileArray[0]
    const name = f.name.toLowerCase()
    const isImage = f.type.startsWith('image/') || /\.(jpe?g|png|gif|bmp|webp)$/i.test(name)
    const isPDF   = f.type === 'application/pdf'  || /\.pdf$/i.test(name)
    if (isImage) {
      setPreviewUrl(URL.createObjectURL(f))
      setPreviewType('image')
    } else if (isPDF) {
      setPreviewUrl(URL.createObjectURL(f) + '#view=FitH')
      setPreviewType('pdf')
    } else {
      setPreviewUrl(null)
      setPreviewType(name.split('.').pop().toUpperCase() || 'other')
    }
    setStep(1)
    processFile(fileArray)
  }

  function applyExtractedData(ext, taskId = null) {
    setCardId(ext.doc_no || taskId || null)
    const header = {
      DateProcessed: new Date().toLocaleDateString('en-GB'),
      BankName:         ext.bank_name         || '',
      DocName:          ext.doc_name          || '',
      CompanyName:      ext.company_name      || '',
      DocDate:          ext.doc_date          || '',
      DocNo:            ext.doc_no            || '',
      MerchantName:     ext.merchant_name     || '',
      MerchantId:       ext.merchant_id       || '',
      BankCompanyname:  ext.bank_companyname  || '',
      BranchNo:         ext.branch_no         || '',
    }
    setHeaderData(header)
    const detailsList = ext.details?.length ? ext.details : [{ ...EMPTY_DETAIL_ROW }]
    setDetails(detailsList)
    setOriginalDetails(JSON.parse(JSON.stringify(detailsList)))
    setOriginalHeader(JSON.parse(JSON.stringify(header)))

    if (ext.bank_companyname || ext.branch_no) {
      try {
        const existing = JSON.parse(localStorage.getItem('accountingConfig') || '{}')
        existing.company = {
          ...existing.company,
          ...(ext.bank_companyname && { name: ext.bank_companyname }),
          ...(ext.branch_no        && { branch: ext.branch_no }),
        }
        const detectedBankCode = detectBankFromCompanyName(ext.bank_companyname)
        const BANK_CODE_TO_NAME = {
          BBL:   'Bangkok Bank (BBL)',
          KBANK: 'Kasikornbank (KBANK)',
          SCB:   'Siam Commercial Bank (SCB)',
        }
        if (detectedBankCode && BANK_CODE_TO_NAME[detectedBankCode]) {
          existing.bank = BANK_CODE_TO_NAME[detectedBankCode]
        }
        localStorage.setItem('accountingConfig', JSON.stringify(existing))
      } catch { /* ignore */ }
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
        setFiles([])
        if (fileInputRef.current) fileInputRef.current.value = ''
      },
    })
  }

  async function processFile(filesOverride) {
    const filesToProcess = filesOverride ?? files
    if (filesToProcess.length === 0) {
      showModal({
        title: 'No Document File Found',
        message: 'Please select an image or PDF file to process.',
        type: 'warning', confirmText: 'OK', onConfirm: closeModal,
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
      showToast(`Successfully extracted ${filesToProcess.length} ${filesToProcess.length === 1 ? 'file' : 'files'} — please review and edit`, 'success')
    } catch (err) {
      if (err.status === 429) {
        showModal({
          title: 'Monthly Quota Exceeded',
          message: 'Your Business Unit has reached the monthly document processing limit. Please contact your administrator to upgrade your plan.',
          type: 'warning',
          confirmText: 'Acknowledge',
          onConfirm: () => { closeModal(); setStep(1); setFiles([]); if (fileInputRef.current) fileInputRef.current.value = '' }
        })
      } else {
        setStatus(err.message)
        showModal({
          title: 'Error Occurred',
          message: `Failed to extract data: ${err.message}`,
          type: 'error', confirmText: 'Close', onConfirm: closeModal,
        })
      }
      setStep(1)
    } finally {
      setLoading(false)
    }
  }

  async function reExtract(bankType) {
    if (files.length === 0) return
    setLoading(true)
    setStatus(`Re-extracting with ${bankType || 'auto-detect'}...`)
    try {
      const ext = await extractFromFile(files[0], bankType || null)
      applyExtractedData(ext)
      // User-selected bank takes priority; fall back to auto-detect from result
      setBank(bankType || detectBankFromExtracted(ext) || '')
      showToast(`Re-extracted successfully${bankType ? ` with ${bankType}` : ''}`, 'success')
    } catch (err) {
      showModal({
        title: 'Re-extract Failed',
        message: `Failed to re-extract: ${err.message}`,
        type: 'error', confirmText: 'Close', onConfirm: closeModal,
      })
    } finally {
      setLoading(false)
      setStatus('')
    }
  }

  function updateHeader(key, value) {
    setHeaderData(prev => ({ ...prev, [key]: value }))
  }

  function updateDetail(rowIndex, col, value) {
    setDetails(prev =>
      prev.map((row, i) => (i === rowIndex ? { ...row, [col]: value } : row))
    )
  }

  function addRow()         { setDetails(prev => [...prev, { ...EMPTY_DETAIL_ROW }]) }
  function deleteRow(index) { setDetails(prev => prev.filter((_, i) => i !== index)) }

  async function handleSubmitFinal(rows) {
    if (submittedDocNos.current.has(headerData.DocNo)) {
      showToast('This document is already saved and cannot be submitted again.', 'warning')
      setStep(4)
      return
    }

    setSubmitting(true)
    setJvRows(rows)
    const docNo = headerData.DocNo
    const payload = {
      BankType:         bank,
      OriginalFilename: files[0]?.name,
      Header: {
        DateProcessed:  headerData.DateProcessed  || '',
        BankName:       headerData.BankName        || '',
        DocName:        headerData.DocName         || '',
        CompanyName:    headerData.CompanyName     || '',
        DocDate:        headerData.DocDate         || '',
        DocNo:            headerData.DocNo            || '',
        MerchantName:     headerData.MerchantName     || '',
        MerchantId:       headerData.MerchantId       || '',
        BankCompanyname:  headerData.BankCompanyname  || '',
        BranchNo:         headerData.BranchNo         || '',
      },
      Details: details.map(row => ({
        Transaction: row.Transaction || row.transaction || '',
        PayAmt:      parseFloat(String(row.PayAmt    || row.pay_amt    || 0).replace(/,/g, '')) || 0,
        CommisAmt:   parseFloat(String(row.CommisAmt || row.commis_amt || 0).replace(/,/g, '')) || 0,
        TaxAmt:      parseFloat(String(row.TaxAmt    || row.tax_amt    || 0).replace(/,/g, '')) || 0,
        Total:       parseFloat(String(row.Total     || row.total      || 0).replace(/,/g, '')) || 0,
        WHTAmount:   parseFloat(String(row.WHTAmount || row.wht_amount || 0).replace(/,/g, '')) || 0,
      })),
    }
    try {
      showToast('Submitting data...', 'info')
      await submitToLocal(payload)
      submittedDocNos.current.add(docNo)

      const corrections = diffCorrections(headerData, originalHeader, details, originalDetails)
      if (corrections.length > 0) {
        logCorrections(cardId, bank, corrections)
          .catch(err => console.error('[feedback] Error logging corrections:', err))
      }

      let carmenError = null
      let jvId = null
      try {
        const carmenConfig = (() => {
          try { return JSON.parse(localStorage.getItem('accountingConfig') || '{}') } catch { return {} }
        })()
        const carmenPayload = {
          JvhSeq: -1,
          JvhDate: (() => {
            if (headerData.DocDate) {
              const [d, m, y] = headerData.DocDate.split('/')
              const normalizedY = normalizeYearToCE(y)
              const parsed = new Date(`${normalizedY}-${m}-${d}`)
              if (!isNaN(parsed)) return parsed.toISOString()
            }
            return new Date().toISOString()
          })(),
          Prefix:      carmenConfig.filePrefix || '',
          JvhNo:       'Auto',
          JvhSource:   carmenConfig.fileSource || '',
          Status:      'Draft',
          Description: carmenConfig.description
            ? `${carmenConfig.description}${headerData.DocDate ? ` - ${headerData.DocDate}` : ''}`
            : '',
          Detail: rows.map(r => ({
            JvhSeq: -1, JvdSeq: -1,
            DeptCode: r.dept, AccCode: r.acc, Description: r.desc,
            CurCode: 'THB', CurRate: 1,
            CrAmount: r.credit, CrBase: r.credit,
            DrAmount: r.debit,  DrBase: r.debit,
            DimList: {},
          })),
          DimHList: { Dim: [] },
          UserModified: '',
        }
        console.log('[Carmen GL JV] payload:', JSON.stringify(carmenPayload, null, 2))
        const carmenRes = await submitToCarmen(carmenPayload)
        if (carmenRes?.InternalMessage) {
          jvId = carmenRes.InternalMessage
          setCarmenJvId(jvId)
        }
        showToast('Successfully sent data to Carmen GL JV', 'success')
      } catch (err) {
        carmenError = err.message
        showToast(`Carmen GL JV: ${err.message}`, 'error')
      }

      showModal({
        title:   carmenError ? 'Saved Successfully (Carmen issue)' : 'JV Saved Successfully!',
        message: carmenError
          ? `Document number ${docNo} has been saved to the database.\n\nHowever, sending to Carmen GL JV failed:\n${carmenError}`
          : `Document number ${docNo} has been successfully saved and sent to Carmen GL JV.`,
        type:        carmenError ? 'warning' : 'success',
        confirmText: 'Proceed to Input Tax Reconciliation',
        cancelText:  jvId ? 'View JV' : undefined,
        cancelStyle: jvId ? { background: 'var(--teal)', color: 'white', border: '1px solid var(--teal)' } : undefined,
        onConfirm:   () => { closeModal(); setStep(4) },
        onCancel:    jvId ? () => window.open(getCarmenUrl(`/glJv/${jvId}/show`), '_blank') : undefined,
      })
    } catch (err) {
      if (err.code === 'DUPLICATE_DOC_NO') {
        showModal({
          title:   'Duplicate Document Found',
          message: `Document number ${docNo} is already saved in the system.\nCannot import duplicate document.`,
          type: 'error',
          confirmText: 'OK',
          onConfirm: closeModal,
        })
      } else {
        showModal({
          title: 'Error saving data',
          message: err.message,
          type: 'error', confirmText: 'Close', onConfirm: closeModal,
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  function resetAll() {
    setStep(1)
    setFiles([])
    setStatus('')
    if (previewUrl) URL.revokeObjectURL(previewUrl.split('#')[0])
    setPreviewUrl(null)
    setPreviewType(null)
    setHeaderData({})
    setDetails([])
    setJvRows([])
    setCarmenJvId(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    closeModal()
  }

  function handleCancel() {
    if (step === 1) return
    showModal({
      title: 'Cancel Process',
      message: 'Are you sure you want to cancel and clear all data?',
      type: 'warning',
      confirmText: 'Confirm', cancelText: 'Go Back',
      onConfirm: resetAll, onCancel: closeModal,
    })
  }

  function goBack() {
    if (step > 1) setStep(step - 1)
  }

  return {
    // State
    step, bank, files, previewUrl, previewType,
    loading, submitting, status,
    headerData, details,
    jvRows, filePrefix, fileSource, jvDescription, carmenJvId,
    // Refs
    fileInputRef,
    // UI
    modal, showToast, showModal, closeModal,
    // Actions
    setBank, setStep,
    handleFileChange, processFile, reExtract,
    updateHeader, updateDetail, addRow, deleteRow,
    handleSubmitFinal, handleCancel, resetAll, goBack,
  }
}
