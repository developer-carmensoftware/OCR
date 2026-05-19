import { useState, useRef } from 'react'
import type React from 'react'
import { apiFetch } from '../../lib/api/client'
import { getAPVendorMapping } from '../../lib/api/config'
import { showToast } from '../../lib/toast'
import { fmt } from '../../lib/format'
import { EMPTY_HEADER, DEFAULT_MAPPINGS } from '../../constants/apInvoice'
import type { APInvoiceHeader, APColumnKey, APFieldKey } from '../../constants/apInvoice'

export interface APLineItem {
  category?: string
  description?: string
  qty?: string
  unitPrice?: string
  discountPct?: string
  discountAmt?: string
  lineSubTotal?: string
  taxPct?: string
  taxType?: string
  taxAmt?: string
  lineTotal?: string
  deptCode?: string
  accountCode?: string
  _suggestDept?: string
  _suggestAcc?: string
  [key: string]: string | undefined
}

interface APExtractionProps {
  t: Record<string, string>
  setStep: (step: number) => void
  setModal: (config: Record<string, unknown>) => void
  loadVendors?: (() => void) | null
  vendorDbByTax?: Record<string, unknown>
}

const NUMERIC_FIELDS = [
  'qty',
  'unitPrice',
  'discountPct',
  'discountAmt',
  'lineSubTotal',
  'taxPct',
  'taxAmt',
  'lineTotal',
]
const isNumFld = (f: string) => NUMERIC_FIELDS.includes(f)

export function useAPExtraction({ t, setStep, setModal, loadVendors }: APExtractionProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewType, setPreviewType] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [headerData, setHeaderData] = useState<APInvoiceHeader>(EMPTY_HEADER)
  const [lineItems, setLineItems] = useState<APLineItem[]>([])
  const [fieldMappings, setFieldMappings] =
    useState<Record<APColumnKey, APFieldKey | 'ignore'>>(DEFAULT_MAPPINGS)
  const [apInvoiceId, setApInvoiceId] = useState<string | null>(null)
  const [isDuplicate, setIsDuplicate] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  const runOCR = async (fileObj: File) => {
    setLoading(true)
    setStatus('AI is extracting data from document...')
    setError(null)
    try {
      let retries = 3,
        delay = 800
      while (retries > 0) {
        try {
          const formData = new FormData()
          formData.append('file', fileObj)
          const res = await apiFetch('/api/v1/ap-invoice/extract', {
            method: 'POST',
            body: formData,
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = (await res.json()) as Record<string, unknown>

          setApInvoiceId((data.id as string) || null)
          setHeaderData({
            vendorName: (data.vendorName as string) || '',
            vendorTaxId: (data.vendorTaxId as string) || '',
            vendorBranch: (data.vendorBranch as string) || '',
            documentName: (data.documentName as string) || '',
            documentDate: (data.documentDate as string) || '',
            documentNumber: (data.documentNumber as string) || '',
            taxType: (data.taxType as string) || '',
            invhDesc: '',
            subTotal: fmt(data.subTotal),
            taxAmount: fmt(data.taxAmount),
            totalDiscount: fmt(data.totalDiscount),
            grandTotal: fmt(data.grandTotal),
          })

          const rawItems = (data.items as Array<Record<string, unknown>>) || []
          const formattedItems: APLineItem[] = rawItems.map(item => {
            const ni: APLineItem = { ...(item as APLineItem), deptCode: '', accountCode: '' }
            Object.keys(ni).forEach(k => {
              if (isNumFld(k) && ni[k] !== undefined && ni[k] !== '') ni[k] = fmt(ni[k])
            })
            return ni
          })
          setLineItems(formattedItems)

          const taxId = data.vendorTaxId as string
          if (taxId) {
            getAPVendorMapping(taxId)
              .then(res => {
                const r = res as unknown as Record<string, unknown>
                if (r.mapping) {
                  setFieldMappings(r.mapping as Record<APColumnKey, APFieldKey | 'ignore'>)
                } else throw new Error('no mapping')
              })
              .catch(() => {
                try {
                  const savedAll = JSON.parse(
                    localStorage.getItem('ap_invoice_mapping') || '{}'
                  ) as Record<string, Record<APColumnKey, APFieldKey | 'ignore'>>
                  if (savedAll[taxId]) setFieldMappings(savedAll[taxId])
                } catch {
                  /* ignore */
                }
              })
          }

          if (data.is_duplicate) {
            setIsDuplicate(true)
            setStatus('Duplicate document found')
            setModal({
              show: true,
              type: 'warning',
              title: 'Duplicate document found',
              message: `Document No. ${(data.documentNumber as string) || '—'} for this vendor is already in the system.`,
              confirmText: 'Proceed Anyway',
              cancelText: 'Cancel',
              onConfirm: () => {
                setModal({ show: false })
                setStep(2)
                if (loadVendors) loadVendors()
              },
              onCancel: () => {
                setModal({ show: false })
                setFile(null)
                setPreviewUrl(null)
                setStep(1)
              },
            })
            return
          }

          setStatus('Data extracted successfully ✓')
          showToast('Data extracted successfully — please review and adjust', 'success')
          setStep(2)
          if (loadVendors) loadVendors()
          return
        } catch (err) {
          const e = err as { message: string }
          if (e.message.includes('429')) {
            setModal({
              show: true,
              type: 'warning',
              title: 'Monthly Quota Exceeded',
              message: 'Your Business Unit has reached the monthly document processing limit.',
              confirmText: 'Acknowledge',
              onConfirm: () => {
                setModal({ show: false })
                setStep(1)
                setFile(null)
                setPreviewUrl(null)
              },
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
      const e = err as { message: string }
      console.error(err)
      setStatus(e.message)
      setError(t.errProcess)
      if (!e.message.includes('429'))
        showToast('Failed to extract data. Please try again.', 'error')
    } finally {
      setLoading(false)
      window.dispatchEvent(new Event('ocr:quota-refresh'))
    }
  }

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList | File[] | null } }
  ) => {
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
    setFile(null)
    setPreviewUrl(null)
    setPreviewType(null)
    setHeaderData(EMPTY_HEADER)
    setLineItems([])
    setFieldMappings(DEFAULT_MAPPINGS)
    setIsDuplicate(false)
    setApInvoiceId(null)
    setStatus('')
    setError(null)
  }

  const updateHeader = (key: string, val: string) => setHeaderData(p => ({ ...p, [key]: val }))
  const blurHeader = (key: string, val: string) => {
    if (val) setHeaderData(p => ({ ...p, [key]: fmt(val) }))
  }
  const updateItem = (idx: number, key: string, val: string) =>
    setLineItems(items =>
      items.map((r, i) => {
        if (i !== idx) return r
        const clearSuggest =
          key === 'deptCode'
            ? { _suggestDept: undefined }
            : key === 'accountCode'
              ? { _suggestAcc: undefined }
              : {}
        return { ...r, [key]: val, ...clearSuggest }
      })
    )
  const blurItem = (idx: number, key: string, val: string) => {
    if (val) setLineItems(items => items.map((r, i) => (i === idx ? { ...r, [key]: fmt(val) } : r)))
  }

  return {
    file,
    previewUrl,
    previewType,
    fileInputRef,
    loading,
    status,
    error,
    setError,
    headerData,
    lineItems,
    setLineItems,
    fieldMappings,
    setFieldMappings,
    apInvoiceId,
    isDuplicate,
    handleFileChange,
    runOCR,
    resetExtraction,
    updateHeader,
    blurHeader,
    updateItem,
    blurItem,
  }
}
