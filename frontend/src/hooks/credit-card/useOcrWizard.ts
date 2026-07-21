import { useState, useEffect, useRef } from 'react'
import { useModal } from '../useModal'
import { useFileUpload } from './useFileUpload'
import { useOcrExtraction } from './useOcrExtraction'
import { useOcrSubmission } from './useOcrSubmission'
import { showToast } from '../../lib/toast'
import { getPdfInfo, PDF_PASSWORD_REQUIRED, type ApiError } from '../../lib/api/ocr'
import { usePdfPasswordPrompt } from '../usePdfPasswordPrompt'
import type { JvRow } from './useOcrSubmission'
import type React from 'react'

// pdf-info can fail transiently when the backend is busy with a prior /extract.
// One retry turns most of those intermittent misses into a successful probe.
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
  const [carmenJvId, setCarmenJvId] = useState<string | null>(null)
  const [pdfInfoLoading, setPdfInfoLoading] = useState(false)
  // Guards against a second upload firing while we're still analysing the first
  // (state is async, so a ref is the only reliable in-flight flag inside the closure).
  const uploadBusyRef = useRef(false)

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

  function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList } }
  ) {
    // Ignore a new selection while a previous one is still being analysed or
    // extracted — concurrent backend calls are what intermittently broke uploads.
    if (uploadBusyRef.current || extraction.loading) return

    fileUpload.handleFileChange(e as React.ChangeEvent<HTMLInputElement>, async fileArray => {
      extraction.resetExtractionState()
      pwPrompt.reset()
      setStep(1)

      // Credit card is single-page — only the first selected file is ever used.
      const firstFile = fileArray[0]
      const isPdf =
        firstFile?.name.toLowerCase().endsWith('.pdf') || firstFile?.type === 'application/pdf'

      if (isPdf) {
        uploadBusyRef.current = true
        setPdfInfoLoading(true)
        try {
          // ponytail: getPdfInfo is kept only as an encryption/validity probe; the
          // round-trip for non-encrypted PDFs could be dropped later.
          await getPdfInfoWithRetry(firstFile)
        } catch (err) {
          if ((err as ApiError).code === PDF_PASSWORD_REQUIRED) {
            // Encrypted PDF — prompt for the password instead of failing.
            setPdfInfoLoading(false)
            uploadBusyRef.current = false
            promptForPassword([firstFile])
            return
          }
          // Probe failed for another reason — extract anyway (backend uses page 1).
          console.error('[pdf-info] probe failed, extracting anyway:', err)
        } finally {
          setPdfInfoLoading(false)
          uploadBusyRef.current = false
        }
      }

      extraction.processFile([firstFile])
    })
  }

  // Kick off extraction of an encrypted PDF once unlocked.
  function runEncryptedExtraction(files: File[], password: string) {
    uploadBusyRef.current = true
    setPdfInfoLoading(true)
    void extraction.processFile(files, password).finally(() => {
      setPdfInfoLoading(false)
      uploadBusyRef.current = false
    })
  }

  // Encrypted PDF: the shared prompt owns the verify/retry/shake UX; we just route
  // the validated password into extraction (page 1 only).
  function promptForPassword(files: File[]) {
    pwPrompt.open({
      verify: password => getPdfInfoWithRetry(files[0], password),
      onVerified: password => runEncryptedExtraction(files, password),
      onError: (password, err) => {
        console.error('[pdf-info] failed after password, extracting anyway:', err)
        runEncryptedExtraction(files, password)
      },
    })
  }

  function reExtract(bankType?: string) {
    return extraction.reExtract(fileUpload.files, bankType, pwPrompt.pdfPassword || undefined)
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
    warnings: extraction.warnings,
    submitting: submission.submitting,
    jvRows,
    carmenJvId,
    modal,
    showModal,
    closeModal,
    pdfInfoLoading,
    handleFileChange,
    processFile: (files: File[]) => extraction.processFile(files),
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
