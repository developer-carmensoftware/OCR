import { useState, useRef, useEffect } from 'react'
import { EMPTY_DETAIL_ROW, BANK_THAI_NAMES, detectBankFromCompanyName, detectBankFromExtracted } from '../constants'
import { extractFromFile } from '../lib/api/ocr'
import { submitToLocal } from '../lib/api/submit'
import { submitToCarmen } from '../lib/api/carmen'
import { logCorrections, diffCorrections } from '../lib/api/feedback'
import { getCarmenUrl } from '../lib/url'
import { toast } from 'sonner'
import { useModal } from './useModal'

function loadSavedState() {
  try {
    const saved = localStorage.getItem('ocr_wizard_state')
    return saved ? JSON.parse(saved) : null
  } catch { return null }
}

export function useOcrWizard() {
  const saved = loadSavedState()

  const [step, setStep] = useState(saved?.step > 1 ? saved.step : 1)
  const [bank, setBank] = useState(saved?.bank || '')
  const [files, setFiles] = useState([])
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewType, setPreviewType] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState('')
  const [cardId, setCardId] = useState(saved?.cardId || null)
  const [headerData, setHeaderData] = useState(saved?.headerData || {})
  const [details, setDetails] = useState(saved?.details || [])
  const [originalDetails, setOriginalDetails] = useState(saved?.originalDetails || [])
  const [originalHeader, setOriginalHeader] = useState(saved?.originalHeader || {})
  const [jvRows, setJvRows] = useState([])
  const [filePrefix, setFilePrefix] = useState('')
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
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl.split('#')[0])
    }
  }, [previewUrl])

  useEffect(() => {
    try {
      const config = JSON.parse(localStorage.getItem('accountingConfig') || '{}')
      setFilePrefix(config.filePrefix || '')
      setFileSource(config.fileSource || '')
      const desc = config.description
        ? `${config.description}${headerData.DocDate ? ` - ${headerData.DocDate}` : ''}`
        : ''
      setJvDescription(desc)
    } catch { /* ignore */ }
  }, [step])

  useEffect(() => {
    if (step > 1) {
      const state = { step, bank, cardId, headerData, details, originalDetails, originalHeader }
      localStorage.setItem('ocr_wizard_state', JSON.stringify(state))
    }
  }, [step, bank, cardId, headerData, details, originalDetails])

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
      title: 'พบเอกสารซ้ำในระบบ',
      message: `เอกสารหมายเลข ${docNo} ถูกบันทึกไว้ในระบบแล้ว\nไม่สามารถนำเข้าเอกสารซ้ำได้`,
      type: 'error',
      confirmText: 'ตกลง',
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
    if (!bank) {
      showModal({
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณาเลือกธนาคารที่ต้องการนำเข้าข้อมูลก่อนดำเนินการ',
        type: 'warning', confirmText: 'รับทราบ', onConfirm: closeModal,
      })
      return
    }
    if (filesToProcess.length === 0) {
      showModal({
        title: 'ไม่พบไฟล์เอกสาร',
        message: 'กรุณาเลือกไฟล์รูปภาพหรือ PDF ที่ต้องการประมวลผล',
        type: 'warning', confirmText: 'ตกลง', onConfirm: closeModal,
      })
      return
    }
    setLoading(true)
    setStep(2)
    setStatus('AI กำลังอ่านข้อมูลจากเอกสาร...')
    try {
      const ext = await extractFromFile(filesToProcess[0], bank)

      if (ext.is_duplicate) {
        setStatus('พบเอกสารซ้ำ')
        showDuplicateModal(ext.doc_no)
        return
      }

      applyExtractedData(ext)

      const detectedBank = detectBankFromExtracted(ext)
      if (detectedBank && detectedBank !== bank) {
        setStatus('อ่านข้อมูลสำเร็จ ✓')
        setStep(3)
        showModal({
          title: 'ตรวจพบธนาคารไม่ตรงกัน',
          message: `เอกสารนี้น่าจะเป็นของ ${BANK_THAI_NAMES[detectedBank]}\nแต่เลือกธนาคาร: ${BANK_THAI_NAMES[bank]}\n\nต้องการประมวลผลใหม่ด้วย ${BANK_THAI_NAMES[detectedBank]} หรือไม่?`,
          type: 'warning',
          confirmText: `ประมวลผลด้วย ${detectedBank}`,
          cancelText: 'ใช้ผลลัพธ์ปัจจุบัน',
          onConfirm: async () => {
            closeModal()
            setBank(detectedBank)
            setLoading(true)
            setStep(2)
            setStatus('AI กำลังอ่านข้อมูลใหม่...')
            try {
              const ext2 = await extractFromFile(filesToProcess[0], detectedBank)
              if (ext2.is_duplicate) {
                setStatus('พบเอกสารซ้ำ')
                showDuplicateModal(ext2.doc_no)
                return
              }
              applyExtractedData(ext2)
              setStatus('อ่านข้อมูลสำเร็จ ✓')
              setStep(3)
              showToast(`ประมวลผลใหม่ด้วย ${BANK_THAI_NAMES[detectedBank]} สำเร็จ`, 'success')
            } catch (err) {
              setStatus(err.message)
              showModal({
                title: 'เกิดข้อผิดพลาด',
                message: `ไม่สามารถอ่านข้อมูลได้: ${err.message}`,
                type: 'error', confirmText: 'ปิด', onConfirm: closeModal,
              })
              setStep(1)
            } finally {
              setLoading(false)
            }
          },
          onCancel: closeModal,
        })
      } else {
        setStatus('อ่านข้อมูลสำเร็จ ✓')
        setStep(3)
        showToast(`อ่านข้อมูลสำเร็จ ${files.length} ไฟล์ — กรุณาตรวจสอบและแก้ไข`, 'success')
      }
    } catch (err) {
      setStatus(err.message)
      showModal({
        title: 'เกิดข้อผิดพลาด',
        message: `ไม่สามารถอ่านข้อมูลได้: ${err.message}`,
        type: 'error', confirmText: 'ปิด', onConfirm: closeModal,
      })
      setStep(1)
    } finally {
      setLoading(false)
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
      showToast('เอกสารนี้ถูกบันทึกไปแล้ว ไม่สามารถส่งซ้ำได้', 'warning')
      setStep(5)
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
      showToast('กำลังส่งข้อมูล...', 'info')
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
              const parsed = new Date(`${y}-${m}-${d}`)
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
        showToast('ส่งข้อมูลเข้า Carmen GL JV สำเร็จ', 'success')
      } catch (err) {
        carmenError = err.message
        showToast(`Carmen GL JV: ${err.message}`, 'error')
      }

      showModal({
        title:   carmenError ? 'บันทึกสำเร็จ (Carmen มีปัญหา)' : 'บันทึก JV สำเร็จ!',
        message: carmenError
          ? `เอกสารหมายเลข ${docNo} บันทึกลงฐานข้อมูลแล้ว\n\nแต่การส่ง Carmen GL JV ล้มเหลว:\n${carmenError}`
          : `เอกสารหมายเลข ${docNo} ได้ถูกบันทึกและส่ง Carmen GL JV เรียบร้อยแล้ว`,
        type:        carmenError ? 'warning' : 'success',
        confirmText: 'ไปยัง Input Tax Reconciliation',
        cancelText:  jvId ? 'เปิดดู JV' : undefined,
        cancelStyle: jvId ? { background: 'var(--teal)', color: 'white', border: '1px solid var(--teal)' } : undefined,
        onConfirm:   () => { closeModal(); setStep(5) },
        onCancel:    jvId ? () => window.open(getCarmenUrl(`/glJv/${jvId}/show`), '_blank') : undefined,
      })
    } catch (err) {
      if (err.code === 'DUPLICATE_DOC_NO') {
        showModal({
          title:   'พบเอกสารซ้ำในระบบ',
          message: `เอกสารหมายเลข ${docNo} ถูกบันทึกไว้ในระบบแล้ว\nไม่สามารถนำเข้าเอกสารซ้ำได้`,
          type: 'error',
          confirmText: 'ตกลง',
          onConfirm: closeModal,
        })
      } else {
        showModal({
          title: 'เกิดข้อผิดพลาดในการบันทึก',
          message: err.message,
          type: 'error', confirmText: 'ปิด', onConfirm: closeModal,
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
    localStorage.removeItem('ocr_wizard_state')
    closeModal()
  }

  function handleCancel() {
    if (step === 1) return
    showModal({
      title: 'ยกเลิกการทำงาน',
      message: 'ยืนยันการยกเลิกและล้างข้อมูลทั้งหมดหรือไม่?',
      type: 'warning',
      confirmText: 'ยืนยัน', cancelText: 'กลับตัว',
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
    handleFileChange, processFile,
    updateHeader, updateDetail, addRow, deleteRow,
    handleSubmitFinal, handleCancel, resetAll, goBack,
  }
}
