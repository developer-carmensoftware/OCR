import { useState, useEffect, useRef } from 'react'
import { useModal } from '../useModal'
import { useFileUpload } from './useFileUpload'
import { useOcrExtraction } from './useOcrExtraction'
import { useOcrSubmission } from './useOcrSubmission'
import { showToast } from '../../lib/toast'
import {
  getPdfInfo,
  PDF_PASSWORD_REQUIRED,
  type ApiError,
  type PdfInfoResult,
} from '../../lib/api/ocr'
import { imagesToPdf, MAX_MULTI_IMAGES } from '../../lib/imagesToPdf'
import { selectedPagesToPdfUrl } from '../../lib/pdfPages'
import { usePdfPasswordPrompt } from '../usePdfPasswordPrompt'
import { appKey } from '../../lib/storage'
import type { JvRow } from './useOcrSubmission'
import type React from 'react'

export interface PdfSelectorState {
  thumbnails: string[]
  pendingFiles: File[]
}

// pdf-info can fail transiently when the backend is busy with a prior /extract.
// One retry turns most of those intermittent misses into a shown selector.
// A password-required error is deterministic, so it is rethrown without retry.
async function getPdfInfoWithRetry(file: File, password?: string) {
  try {
    return await getPdfInfo(file, password)
  } catch (err) {
    if ((err as ApiError).code === PDF_PASSWORD_REQUIRED) throw err
    await new Promise(r => setTimeout(r, 600))
    return getPdfInfo(file, password)
  }
}

export function useOcrWizard() {
  const [step, setStep] = useState(1)
  const [jvRows, setJvRows] = useState<JvRow[]>([])
  const [filePrefix, setFilePrefix] = useState('IC')
  const [fileSource, setFileSource] = useState('')
  const [jvDescription, setJvDescription] = useState('')
  const [carmenJvId, setCarmenJvId] = useState<string | null>(null)
  const [pdfSelector, setPdfSelector] = useState<PdfSelectorState | null>(null)
  const [pdfInfoLoading, setPdfInfoLoading] = useState(false)
  const [imageMerging, setImageMerging] = useState(false)
  const [imageCount, setImageCount] = useState(0)
  const [selectedPageThumbs, setSelectedPageThumbs] = useState<
    { thumb: string; pageNum: number; label?: string }[] | null
  >(null)
  // Guards against a second upload firing while we're still analysing the first
  // (state is async, so a ref is the only reliable in-flight flag inside the closure).
  const uploadBusyRef = useRef(false)
  const imageThumbsRef = useRef<string[]>([])

  const { modal, showModal, closeModal } = useModal()

  const fileUpload = useFileUpload()

  const pwPrompt = usePdfPasswordPrompt({
    openModal: showModal,
    closeModal,
    onCancel: fileUpload.clearFiles,
  })

  const extraction = useOcrExtraction({
    showModal,
    closeModal,
    setStep,
    clearFiles: fileUpload.clearFiles,
    fileInputRef: fileUpload.fileInputRef,
  })

  const submission = useOcrSubmission({
    showModal,
    closeModal,
    setStep,
    headerData: extraction.headerData as Record<string, string>,
    details: extraction.details,
    bank: extraction.bank,
    cardId: extraction.cardId,
    originalHeader: extraction.originalHeader as Record<string, string>,
    originalDetails: extraction.originalDetails,
    setJvRows,
    setCarmenJvId,
  })

  useEffect(() => {
    return () => {
      if (fileUpload.previewUrl) URL.revokeObjectURL(fileUpload.previewUrl.split('#')[0])
    }
  }, [fileUpload.previewUrl])

  useEffect(() => {
    try {
      const config = JSON.parse(localStorage.getItem(appKey('accountingConfig')) || '{}') as {
        filePrefix?: string
        fileSource?: string
        description?: string
      }
      setFilePrefix(config.filePrefix || 'IC')
      setFileSource(config.fileSource || '')
      const desc = config.description
        ? `${config.description}${extraction.headerData.DocDate ? ` - ${extraction.headerData.DocDate}` : ''}`
        : ''
      setJvDescription(desc)
    } catch {
      /* ignore */
    }
  }, [step, extraction.headerData.DocDate])

  function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList } }
  ) {
    // Ignore a new selection while a previous one is still being analysed or
    // extracted — concurrent backend calls are what intermittently broke the selector.
    if (uploadBusyRef.current || extraction.loading || imageMerging) return

    fileUpload.handleFileChange(e as React.ChangeEvent<HTMLInputElement>, async fileArray => {
      extraction.resetExtractionState()
      setSelectedPageThumbs(null)
      setImageCount(0)
      pwPrompt.reset()
      setStep(1)

      const firstFile = fileArray[0]
      const isPdf =
        firstFile?.name.toLowerCase().endsWith('.pdf') || firstFile?.type === 'application/pdf'
      const allImages = fileArray.every(
        f => f.type.startsWith('image/') && !f.name.toLowerCase().endsWith('.pdf')
      )

      // Multiple images → merge into one PDF, skip page-selector
      if (fileArray.length > 1 && allImages) {
        if (fileArray.length > MAX_MULTI_IMAGES) {
          showToast(`Too many images — maximum ${MAX_MULTI_IMAGES} at once`, 'error')
          fileUpload.clearFiles()
          return
        }
        // Revoke old thumb URLs and create new ones for the preview grid
        imageThumbsRef.current.forEach(u => URL.revokeObjectURL(u))
        const thumbUrls = fileArray.map(f => URL.createObjectURL(f))
        imageThumbsRef.current = thumbUrls
        setSelectedPageThumbs(
          thumbUrls.map((thumb, i) => ({ thumb, pageNum: i + 1, label: `Image ${i + 1}` }))
        )

        uploadBusyRef.current = true
        setImageMerging(true)
        setImageCount(fileArray.length)
        try {
          const merged = await imagesToPdf(fileArray)
          fileUpload.setFiles([merged])
          extraction.processFile([merged])
        } catch {
          showToast('Could not merge images — please try again', 'error')
          fileUpload.clearFiles()
          setImageCount(0)
          imageThumbsRef.current.forEach(u => URL.revokeObjectURL(u))
          imageThumbsRef.current = []
          setSelectedPageThumbs(null)
        } finally {
          setImageMerging(false)
          uploadBusyRef.current = false
        }
        return
      }

      if (isPdf) {
        uploadBusyRef.current = true
        setPdfInfoLoading(true)
        try {
          const info = await getPdfInfoWithRetry(firstFile)
          if (info.page_count > 1) {
            setPdfSelector({ thumbnails: info.thumbnails, pendingFiles: fileArray })
            return
          }
          // Single-page PDF — fall through to normal extraction
        } catch (err) {
          if ((err as ApiError).code === PDF_PASSWORD_REQUIRED) {
            // Encrypted PDF — prompt for the password instead of failing.
            setPdfInfoLoading(false)
            uploadBusyRef.current = false
            promptForPassword(fileArray)
            return
          }
          // Don't silently extract: tell the user the selector was skipped.
          console.error('[pdf-info] failed, processing all pages:', err)
          showToast('Could not read PDF pages — processing the whole document', 'info')
        } finally {
          setPdfInfoLoading(false)
          uploadBusyRef.current = false
        }
      }

      extraction.processFile(fileArray)
    })
  }

  // Kick off extraction of an encrypted PDF once unlocked (single-page / fallback).
  function runEncryptedExtraction(files: File[], password: string) {
    uploadBusyRef.current = true
    setPdfInfoLoading(true)
    void extraction.processFile(files, undefined, password).finally(() => {
      setPdfInfoLoading(false)
      uploadBusyRef.current = false
    })
  }

  // Encrypted PDF: the shared prompt owns the verify/retry/shake UX; we just route
  // the validated password (multi-page → selector, single-page/fallback → extract).
  function promptForPassword(files: File[]) {
    pwPrompt.open({
      verify: password => getPdfInfoWithRetry(files[0], password),
      onVerified: (password, result) => {
        const info = result as PdfInfoResult
        if (info.page_count > 1) {
          setPdfSelector({ thumbnails: info.thumbnails, pendingFiles: files })
        } else {
          runEncryptedExtraction(files, password)
        }
      },
      onError: (password, err) => {
        console.error('[pdf-info] failed after password, processing all pages:', err)
        showToast('Could not read PDF pages — processing the whole document', 'info')
        runEncryptedExtraction(files, password)
      },
    })
  }

  function confirmPageSelection(selectedPages: number[]) {
    if (!pdfSelector) return
    setSelectedPageThumbs(
      selectedPages.map(p => ({ thumb: pdfSelector.thumbnails[p], pageNum: p + 1 }))
    )
    const files = pdfSelector.pendingFiles
    setPdfSelector(null)
    // Preview only the selected pages: build a native PDF subset and swap it into the
    // preview iframe (zoomable/readable). Falls back to the full document on failure
    // (e.g. a user-password-encrypted PDF that pdf-lib cannot parse).
    void selectedPagesToPdfUrl(files[0], selectedPages)
      .then(url => {
        if (fileUpload.previewUrl) URL.revokeObjectURL(fileUpload.previewUrl.split('#')[0])
        fileUpload.setPreviewUrl(url + '#view=FitH')
        fileUpload.setPreviewType('pdf')
      })
      .catch(() => {
        /* keep the full-document preview */
      })
    extraction.processFile(files, selectedPages, pwPrompt.pdfPassword || undefined)
  }

  function cancelPageSelection() {
    setPdfSelector(null)
    imageThumbsRef.current.forEach(u => URL.revokeObjectURL(u))
    imageThumbsRef.current = []
    setSelectedPageThumbs(null)
    pwPrompt.reset()
    fileUpload.clearFiles()
  }

  function reExtract(bankType?: string) {
    return extraction.reExtract(
      fileUpload.files,
      bankType,
      undefined,
      pwPrompt.pdfPassword || undefined
    )
  }

  function handleCancel() {
    if (step === 1) return
    showModal({
      title: 'Cancel Process',
      message: 'Are you sure you want to cancel and clear all data?',
      type: 'warning',
      confirmText: 'Confirm',
      cancelText: 'Go Back',
      onConfirm: resetAll,
      onCancel: closeModal,
    })
  }

  function goBack() {
    if (step > 1) setStep(step - 1)
  }

  function resetAll() {
    setStep(1)
    fileUpload.clearFiles()
    extraction.resetExtractionState()
    setJvRows([])
    setCarmenJvId(null)
    imageThumbsRef.current.forEach(u => URL.revokeObjectURL(u))
    imageThumbsRef.current = []
    setSelectedPageThumbs(null)
    setImageCount(0)
    pwPrompt.reset()
    closeModal()
  }

  return {
    step,
    setStep,
    files: fileUpload.files,
    previewUrl: fileUpload.previewUrl,
    previewType: fileUpload.previewType,
    fileInputRef: fileUpload.fileInputRef,
    loading: extraction.loading,
    status: extraction.status,
    elapsed: extraction.elapsed,
    extractionStatus: extraction.extractionStatus,
    bank: extraction.bank,
    setBank: extraction.setBank,
    headerData: extraction.headerData,
    details: extraction.details,
    submitting: submission.submitting,
    jvRows,
    filePrefix,
    fileSource,
    jvDescription,
    carmenJvId,
    modal,
    showModal,
    closeModal,
    pdfSelector,
    pdfInfoLoading,
    imageMerging,
    imageCount,
    selectedPageThumbs,
    confirmPageSelection,
    cancelPageSelection,
    handleFileChange,
    processFile: (files: File[], selectedPages?: number[]) =>
      extraction.processFile(files, selectedPages),
    reExtract,
    updateHeader: extraction.updateHeader,
    updateDetail: extraction.updateDetail,
    addRow: extraction.addRow,
    deleteRow: extraction.deleteRow,
    handleSubmitFinal: submission.handleSubmitFinal,
    handleCancel,
    resetAll,
    goBack,
    showToast,
  }
}
