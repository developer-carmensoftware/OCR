import { useState, useEffect, useRef } from 'react'
import { useModal } from '../useModal'
import { useFileUpload } from './useFileUpload'
import { useOcrExtraction } from './useOcrExtraction'
import { useOcrSubmission } from './useOcrSubmission'
import { showToast } from '../../lib/toast'
import { getPdfInfo } from '../../lib/api/ocr'
import type { JvRow } from './useOcrSubmission'
import type React from 'react'

export interface PdfSelectorState {
  thumbnails: string[]
  pendingFiles: File[]
}

// pdf-info can fail transiently when the backend is busy with a prior /extract.
// One retry turns most of those intermittent misses into a shown selector.
async function getPdfInfoWithRetry(file: File) {
  try {
    return await getPdfInfo(file)
  } catch {
    await new Promise(r => setTimeout(r, 600))
    return getPdfInfo(file)
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
  // Guards against a second upload firing while we're still analysing the first
  // (state is async, so a ref is the only reliable in-flight flag inside the closure).
  const uploadBusyRef = useRef(false)

  const { modal, showModal, closeModal } = useModal()

  const fileUpload = useFileUpload()

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
      const config = JSON.parse(localStorage.getItem('accountingConfig') || '{}') as {
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
    if (uploadBusyRef.current || extraction.loading) return

    fileUpload.handleFileChange(e as React.ChangeEvent<HTMLInputElement>, async fileArray => {
      extraction.resetExtractionState()
      setStep(1)

      const firstFile = fileArray[0]
      const isPdf = firstFile?.name.toLowerCase().endsWith('.pdf')

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

  function confirmPageSelection(selectedPages: number[]) {
    if (!pdfSelector) return
    const files = pdfSelector.pendingFiles
    setPdfSelector(null)
    extraction.processFile(files, selectedPages)
  }

  function cancelPageSelection() {
    setPdfSelector(null)
    fileUpload.clearFiles()
  }

  function reExtract(bankType?: string) {
    return extraction.reExtract(fileUpload.files, bankType)
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
