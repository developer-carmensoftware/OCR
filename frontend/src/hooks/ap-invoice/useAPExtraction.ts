import { useState, useRef, useEffect } from 'react'
import type React from 'react'
import { apiFetch, fetchTimeout } from '../../lib/api/client'
import { API } from '../../lib/api/endpoints'
import { getAPVendorMapping } from '../../lib/api/config'
import {
  getPdfInfo,
  getFilePreview,
  PDF_PASSWORD_REQUIRED,
  type ApiError,
  type PdfInfoResult,
} from '../../lib/api/ocr'
import { usePdfPasswordPrompt } from '../usePdfPasswordPrompt'
import { imagesToPdf, MAX_MULTI_IMAGES } from '../../lib/imagesToPdf'
import { selectedPagesToPdfUrl } from '../../lib/pdfPages'
import { toast } from '../../lib/toast'
import { appKey } from '../../lib/storage'
import { checkFilesSize } from '../../lib/fileValidation'
import { fmt } from '../../lib/format'
import { EMPTY_HEADER, DEFAULT_MAPPINGS } from '../../constants/apInvoice'
import type { APInvoiceHeader, APColumnKey, APFieldKey } from '../../constants/apInvoice'
import type { ModalState } from '../../types/modal'
import type { APLineItem } from '../../types/ap'

export type { APLineItem }

const EXTRACT_TIMEOUT_MS = 150_000

interface APExtractionProps {
  t: Record<string, string>
  setStep: (step: number) => void
  setModal: (state: ModalState) => void
  loadVendors?: (() => void) | null
  vendorDbByTax?: Record<string, unknown>
}

const EXTRACTION_STAGES = [
  { at: 0, text: 'Reading document…' },
  { at: 6, text: 'Analysing document structure…' },
  { at: 13, text: 'Extracting line items and amounts…' },
  { at: 22, text: 'Almost done…' },
  { at: 35, text: 'Complex document — still working…' },
]

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

// Pure fetch+retry helper — no React state. Throws for terminal errors (401/402/408/429) and after
// retry exhaustion so the caller (runOCR) handles modals and state in one place.
async function _fetchExtractWithRetry(
  fileObj: File,
  selectedPages?: number[],
  pdfPassword?: string
): Promise<Record<string, unknown>> {
  let retries = 3
  let delay = 800
  while (retries > 0) {
    try {
      const formData = new FormData()
      formData.append('file', fileObj)
      if (selectedPages && selectedPages.length > 0) {
        formData.append('selected_pages', JSON.stringify(selectedPages))
      }
      if (pdfPassword) formData.append('pdf_password', pdfPassword)
      const { signal, clear } = fetchTimeout(EXTRACT_TIMEOUT_MS)
      let res: Response
      try {
        res = await apiFetch(API.apInvoice.extract, {
          method: 'POST',
          body: formData,
          signal,
        })
      } catch (fetchErr) {
        if ((fetchErr as Error).name === 'AbortError')
          throw Object.assign(new Error('HTTP 408'), { cause: fetchErr })
        throw fetchErr
      } finally {
        clear()
      }
      if (!res.ok) {
        // PdfPasswordRequired maps to 400 — only that status carries the code marker.
        if (res.status === 400) {
          const body = (await res.json?.().catch(() => ({}))) as { code?: string }
          if (body?.code === PDF_PASSWORD_REQUIRED) {
            throw Object.assign(new Error('pdf_password_required'), { code: PDF_PASSWORD_REQUIRED })
          }
        }
        throw new Error(`HTTP ${res.status}`)
      }
      return (await res.json()) as Record<string, unknown>
    } catch (err) {
      const msg = (err as Error).message
      // Terminal errors — propagate immediately without retrying
      if (
        (err as ApiError).code === PDF_PASSWORD_REQUIRED ||
        msg.includes('401') ||
        msg.includes('402') ||
        msg.includes('408') ||
        msg.includes('429')
      )
        throw err
      retries--
      if (retries === 0) throw err
      await new Promise(r => setTimeout(r, delay))
      delay *= 2
    }
  }
  throw new Error('Extraction failed after retries')
}

export function useAPExtraction({ t, setStep, setModal, loadVendors }: APExtractionProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewType, setPreviewType] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pdfInfoLoading, setPdfInfoLoading] = useState(false)
  const [imageMerging, setImageMerging] = useState(false)
  const [imageCount, setImageCount] = useState(0)
  const [pdfSelector, setPdfSelector] = useState<{
    thumbnails: string[]
    pendingFile: File
  } | null>(null)
  const [selectedPageThumbs, setSelectedPageThumbs] = useState<
    { thumb: string; pageNum: number }[] | null
  >(null)
  const pwPrompt = usePdfPasswordPrompt({
    openModal: p => setModal({ show: true, ...p }),
    closeModal: () => setModal({ show: false }),
    onCancel: () => cancelPageSelection(),
  })

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
  const [headerData, setHeaderData] = useState<APInvoiceHeader>(EMPTY_HEADER)
  const [lineItems, setLineItems] = useState<APLineItem[]>([])
  const [fieldMappings, setFieldMappings] =
    useState<Record<APColumnKey, APFieldKey | 'ignore'>>(DEFAULT_MAPPINGS)
  const [apInvoiceId, setApInvoiceId] = useState<string | null>(null)
  const [isDuplicate, setIsDuplicate] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const imageThumbsRef = useRef<string[]>([])

  const revokePreviewUrls = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    imageThumbsRef.current.forEach(u => URL.revokeObjectURL(u))
    imageThumbsRef.current = []
  }

  const runOCR = async (fileObj: File, selectedPages?: number[], password?: string) => {
    setLoading(true)
    setStatus('AI is extracting data from document...')
    setError(null)
    try {
      const data = await _fetchExtractWithRetry(
        fileObj,
        selectedPages,
        password ?? pwPrompt.pdfPassword
      )

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
        const ni: APLineItem = {
          ...(item as APLineItem),
          deptCode: '',
          accountCode: '',
          _uid: crypto.randomUUID(),
        }
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
            if (r.mapping) setFieldMappings(r.mapping as Record<APColumnKey, APFieldKey | 'ignore'>)
            else throw new Error('no mapping')
          })
          .catch(() => {
            try {
              const savedAll = JSON.parse(
                localStorage.getItem(appKey('ap_invoice_mapping')) || '{}'
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
        toast.warning(
          `Duplicate: ${(data.documentNumber as string) || 'document'} already in system`
        )
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
      toast.success(
        `Extracted ${formattedItems.length} line${formattedItems.length === 1 ? '' : 's'} — review and adjust`
      )
      setStep(2)
      if (loadVendors) loadVendors()
    } catch (err) {
      const e = err as { message: string }
      if (e.message.includes('401')) {
        // AuthContext handles the "session expired" toast + state reset via ocr:unauthorized.
        setStep(1)
        setFile(null)
        setPreviewUrl(null)
        return
      }
      if (e.message === 'Failed to fetch') {
        toast.error('Connection error')
        setModal({
          show: true,
          type: 'warning',
          title: 'Connection Error',
          message: 'Could not reach the server — please check your network and try again.',
          confirmText: 'Close',
          onConfirm: () => {
            setModal({ show: false })
            setStep(1)
            setFile(null)
            setPreviewUrl(null)
          },
        })
        return
      }
      if (e.message.includes('402')) {
        toast.error('Out of documents')
        setModal({
          show: true,
          type: 'warning',
          title: 'Out of Documents',
          message:
            "You've used all 30 documents in your one-time free trial and have no top-up credits left. Buy a credit pack to continue — credits never expire.",
          confirmText: 'Buy Credits',
          onConfirm: () => {
            setModal({ show: false })
            window.dispatchEvent(new Event('ocr:open-topup'))
            setStep(1)
            setFile(null)
            setPreviewUrl(null)
          },
        })
        return
      }
      if (e.message.includes('408')) {
        toast.error('Extraction timed out')
        setModal({
          show: true,
          type: 'warning',
          title: 'Extraction Timed Out',
          message:
            'The server took too long to process this document. This may happen with large or complex documents — please try again.',
          confirmText: 'Try Again',
          onConfirm: () => {
            setModal({ show: false })
            setStep(1)
            setFile(null)
            setPreviewUrl(null)
          },
        })
        return
      }
      if (e.message.includes('429')) {
        toast.error('Too many requests')
        setModal({
          show: true,
          type: 'warning',
          title: 'Too Many Requests',
          message: 'You are sending requests too quickly. Please slow down and try again shortly.',
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
      if ((err as ApiError).code === PDF_PASSWORD_REQUIRED) {
        promptForPassword(fileObj, selectedPages)
        return
      }
      console.error(err)
      setStatus(e.message)
      setError(t.errProcess)
      toast.error('Could not read this invoice — try a clearer scan')
    } finally {
      setLoading(false)
      window.dispatchEvent(new Event('ocr:quota-refresh'))
    }
  }

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList | File[] | null } }
  ) => {
    const rawFiles = e.target.files
    if (!rawFiles || rawFiles.length === 0) return
    // Ignore a new selection while we're still analysing a PDF or extracting.
    if (pdfInfoLoading || loading || imageMerging) return

    const fileArray = Array.from(rawFiles) as File[]
    const sizeError = checkFilesSize(fileArray)
    if (sizeError) {
      toast.error(sizeError)
      return
    }
    const allImages = fileArray.every(
      f => f.type.startsWith('image/') && !f.name.toLowerCase().endsWith('.pdf')
    )

    // Multiple images → merge into one PDF, skip page-selector
    if (fileArray.length > 1 && allImages) {
      if (fileArray.length > MAX_MULTI_IMAGES) {
        toast.error(`Too many images — maximum ${MAX_MULTI_IMAGES} at once`)
        return
      }
      // Revoke previous preview + thumb URLs before replacing them
      revokePreviewUrls()

      // Create object URLs for each image to use as thumbnails in DocumentPreview
      const thumbUrls = fileArray.map(f => URL.createObjectURL(f))
      imageThumbsRef.current = thumbUrls
      setSelectedPageThumbs(
        thumbUrls.map((thumb, i) => ({ thumb, pageNum: i + 1, label: `Image ${i + 1}` }))
      )

      setFile(fileArray[0])
      setPreviewUrl(null) // no single-image preview; thumbnails take over
      setPreviewType('image') // keep type so DocumentPreview knows context
      setImageCount(fileArray.length)
      setImageMerging(true)
      imagesToPdf(fileArray)
        .then(merged => {
          setFile(merged)
          runOCR(merged)
        })
        .catch(() => {
          toast.error('Could not merge images — please try again')
          revokePreviewUrls()
          setSelectedPageThumbs(null)
          setFile(null)
          setPreviewUrl(null)
          setPreviewType(null)
          setImageCount(0)
        })
        .finally(() => setImageMerging(false))
      return
    }

    const f = fileArray[0]
    revokePreviewUrls()
    setFile(f)
    setImageCount(0)

    const name = f.name.toLowerCase()
    const isPdf = name.endsWith('.pdf') || f.type === 'application/pdf'
    const isHeic =
      /\.(heic|heif)$/i.test(name) || f.type === 'image/heic' || f.type === 'image/heif'

    if (isHeic) {
      // Browsers can't decode HEIC — fetch a server-converted JPEG data URL.
      setPreviewType('image')
      setPreviewUrl(null)
      getFilePreview(f)
        .then(setPreviewUrl)
        .catch(() => setPreviewType('HEIC'))
    } else {
      const url = URL.createObjectURL(f)
      previewUrlRef.current = url
      setPreviewUrl(url)
      setPreviewType(isPdf ? 'pdf' : 'image')
    }

    if (isPdf) {
      pwPrompt.reset()
      // Multi-page → let the user choose pages; single page → extract straight away.
      setPdfInfoLoading(true)
      getPdfInfo(f)
        .then(info => {
          if (info.page_count > 1) {
            setPdfSelector({ thumbnails: info.thumbnails, pendingFile: f })
          } else {
            runOCR(f)
          }
        })
        .catch(err => {
          if ((err as ApiError).code === PDF_PASSWORD_REQUIRED) {
            // Encrypted PDF — prompt for the password instead of failing.
            promptForPassword(f)
            return
          }
          // Can't read pages — don't block the user, process the whole document.
          toast.info('Could not read PDF pages — processing the whole document')
          runOCR(f)
        })
        .finally(() => setPdfInfoLoading(false))
    } else {
      runOCR(f)
    }
  }

  // Encrypted PDF: the shared prompt owns the verify/retry/shake UX; we just route
  // the validated password. `selectedPages` is set when re-asking after an extract
  // that came back password-required (pages were already chosen).
  const promptForPassword = (file: File, selectedPages?: number[]) => {
    pwPrompt.open({
      verify: password => getPdfInfo(file, password),
      onVerified: (password, result) => {
        if (selectedPages) {
          runOCR(file, selectedPages, password)
          return
        }
        const info = result as PdfInfoResult
        if (info.page_count > 1) {
          setPdfSelector({ thumbnails: info.thumbnails, pendingFile: file })
        } else {
          runOCR(file, undefined, password)
        }
      },
      onError: (password, err) => {
        console.error('[pdf-info] failed after password, processing all pages:', err)
        toast.info('Could not read PDF pages — processing the whole document')
        runOCR(file, selectedPages, password)
      },
    })
  }

  const confirmPageSelection = (selectedPages: number[]) => {
    const sel = pdfSelector
    if (!sel) return
    setSelectedPageThumbs(selectedPages.map(p => ({ thumb: sel.thumbnails[p], pageNum: p + 1 })))
    setPdfSelector(null)
    // Preview only the selected pages: swap in a native PDF subset (zoomable/readable).
    // Falls back to the full document if the PDF cannot be parsed client-side.
    void selectedPagesToPdfUrl(sel.pendingFile, selectedPages)
      .then(url => {
        revokePreviewUrls()
        previewUrlRef.current = url
        setPreviewUrl(url)
        setPreviewType('pdf')
      })
      .catch(() => {
        /* keep the full-document preview */
      })
    runOCR(sel.pendingFile, selectedPages)
  }

  const cancelPageSelection = () => {
    setPdfSelector(null)
    setSelectedPageThumbs(null)
    pwPrompt.reset()
    revokePreviewUrls()
    setFile(null)
    setPreviewUrl(null)
    setPreviewType(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const resetExtraction = () => {
    revokePreviewUrls()
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
    setPdfInfoLoading(false)
    setImageMerging(false)
    setImageCount(0)
    setPdfSelector(null)
    setSelectedPageThumbs(null)
    pwPrompt.reset()
  }

  const updateHeader = (key: string, val: string) => setHeaderData(p => ({ ...p, [key]: val }))
  const blurHeader = (key: string, val: string) => {
    setHeaderData(p => ({ ...p, [key]: fmt(val) }))
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
    setLineItems(items => items.map((r, i) => (i === idx ? { ...r, [key]: fmt(val) } : r)))
  }
  const removeItem = (idx: number) => setLineItems(items => items.filter((_, i) => i !== idx))

  return {
    file,
    previewUrl,
    previewType,
    fileInputRef,
    loading,
    status,
    elapsed,
    extractionStatus,
    error,
    setError,
    headerData,
    lineItems,
    setLineItems,
    fieldMappings,
    setFieldMappings,
    apInvoiceId,
    isDuplicate,
    pdfInfoLoading,
    imageMerging,
    imageCount,
    pdfSelector,
    selectedPageThumbs,
    confirmPageSelection,
    cancelPageSelection,
    handleFileChange,
    runOCR,
    resetExtraction,
    updateHeader,
    blurHeader,
    updateItem,
    blurItem,
    removeItem,
  }
}
