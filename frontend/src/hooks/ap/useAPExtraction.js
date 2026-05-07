import { useState, useRef } from 'react'
import { apiFetch } from '../../lib/api/client'
import { showToast } from '../../lib/toast'
import { fmt, parseNum } from '../../lib/format'
import { EMPTY_HEADER, DEFAULT_MAPPINGS } from '../../constants/apInvoice'

/**
 * Manages AP Invoice OCR extraction: file upload, API call,
 * response normalization, and retry logic.
 */
export function useAPExtraction({ t, setStep, setModal, loadVendors, vendorDbByTax }) {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewType, setPreviewType] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState(null)
  const [headerData, setHeaderData] = useState(EMPTY_HEADER)
  const [lineItems, setLineItems] = useState([])
  const [fieldMappings, setFieldMappings] = useState(DEFAULT_MAPPINGS)
  const [apInvoiceId, setApInvoiceId] = useState(null)
  const [isDuplicate, setIsDuplicate] = useState(false)
  const fileInputRef = useRef(null)
  const previewUrlRef = useRef(null)

  const isNumFld = (f) => [
    'qty', 'unitPrice', 'discountPct', 'discountAmt',
    'lineSubTotal', 'taxPct', 'taxAmt', 'lineTotal',
  ].includes(f)

  const runOCR = async (fileObj) => {
    setLoading(true)
    setStatus('AI is extracting data from document...')
    setError(null)
    try {
      let retries = 3, delay = 800
      while (retries > 0) {
        try {
          const formData = new FormData()
          formData.append('file', fileObj)
          const res = await apiFetch('/api/v1/ap-invoice/extract', { method: 'POST', body: formData })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()

          if (data.is_duplicate) {
            setStatus('Duplicate document found')
            setModal({
              show: true, type: 'warning',
              title: 'Duplicate document found',
              message: `Document No. ${data.documentNumber || '—'} for this vendor is already in the system and cannot be imported again.`,
              confirmText: 'OK',
              onConfirm: () => { setModal({ show: false }); setStep(1); setFile(null); setPreviewUrl(null) },
            })
            return
          }

          setApInvoiceId(data.id)
          setHeaderData({
            vendorName: data.vendorName || '',
            vendorTaxId: data.vendorTaxId || '',
            vendorBranch: data.vendorBranch || '',
            documentName: data.documentName || '',
            documentDate: data.documentDate || '',
            documentNumber: data.documentNumber || '',
            taxType: data.taxType || '',
            subTotal: fmt(data.subTotal),
            taxAmount: fmt(data.taxAmount),
            totalDiscount: fmt(data.totalDiscount),
            grandTotal: fmt(data.grandTotal),
          })

          const formattedItems = (data.items || []).map(item => {
            const ni = { ...item, deptCode: '', accountCode: '' }
            Object.keys(ni).forEach(k => {
              if (isNumFld(k) && ni[k] !== undefined && ni[k] !== '') ni[k] = fmt(ni[k])
            })
            return ni
          })
          setLineItems(formattedItems)

          if (data.vendorTaxId) {
            try {
              const savedAll = JSON.parse(localStorage.getItem('ap_invoice_mapping') || '{}')
              if (savedAll[data.vendorTaxId]) setFieldMappings(savedAll[data.vendorTaxId])
            } catch { /* ignore */ }
          }

          setStatus('Data extracted successfully ✓')
          showToast('Data extracted successfully — please review and adjust', 'success')
          setStep(2)
          if (loadVendors) loadVendors()
          return
        } catch (err) {
          if (err.message.includes('429')) {
            setModal({
              show: true, type: 'warning',
              title: 'Monthly Quota Exceeded',
              message: 'Your Business Unit has reached the monthly document processing limit. Please contact your administrator to upgrade your plan.',
              confirmText: 'Acknowledge',
              onConfirm: () => { setModal({ show: false }); setStep(1); setFile(null); setPreviewUrl(null) },
            })
            return
          }
          retries--
          if (retries === 0) throw err
          setStatus('Retrying...')
          showToast('Retrying...', 'info')
          await new Promise(r => setTimeout(r, delay))
          delay *= 2
        }
      }
    } catch (err) {
      console.error(err)
      setStatus(err.message)
      setError(t.errProcess)
      if (!err.message.includes('429')) showToast('Failed to extract data. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const url = URL.createObjectURL(f)
    previewUrlRef.current = url
    setFile(f)
    setPreviewUrl(url)
    setPreviewType(f.type === 'application/pdf' ? 'pdf' : 'image')
    runOCR(f)
  }

  const resetExtraction = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setFile(null); setPreviewUrl(null); setPreviewType(null)
    setHeaderData(EMPTY_HEADER)
    setLineItems([]); setFieldMappings(DEFAULT_MAPPINGS)
    setIsDuplicate(false); setApInvoiceId(null)
    setStatus(''); setError(null)
  }

  const updateHeader = (key, val) => setHeaderData(p => ({ ...p, [key]: val }))
  const blurHeader = (key, val) => { if (val) setHeaderData(p => ({ ...p, [key]: fmt(val) })) }

  const updateItem = (idx, key, val) => setLineItems(items => items.map((r, i) => {
    if (i !== idx) return r
    const clearSuggest = key === 'deptCode' ? { _suggestDept: undefined } : key === 'accountCode' ? { _suggestAcc: undefined } : {}
    return { ...r, [key]: val, ...clearSuggest }
  }))
  const blurItem = (idx, key, val) => {
    if (val) setLineItems(items => items.map((r, i) => i === idx ? { ...r, [key]: fmt(val) } : r))
  }

  return {
    file, previewUrl, previewType, fileInputRef,
    loading, status, error, setError,
    headerData, lineItems, setLineItems, fieldMappings, setFieldMappings,
    apInvoiceId, isDuplicate,
    handleFileChange, runOCR, resetExtraction,
    updateHeader, blurHeader, updateItem, blurItem,
  }
}
