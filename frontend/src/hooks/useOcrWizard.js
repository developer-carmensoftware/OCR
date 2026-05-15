import { useState, useEffect } from 'react'
import { useModal } from './useModal'
import { useFileUpload } from './credit-card/useFileUpload'
import { useOcrExtraction } from './credit-card/useOcrExtraction'
import { useOcrSubmission } from './credit-card/useOcrSubmission'
import { showToast } from '../lib/toast'
import { BANK_THAI_NAMES } from '../constants'

export function useOcrWizard() {
  const [step, setStep] = useState(1)
  const [jvRows, setJvRows] = useState([])
  const [filePrefix, setFilePrefix] = useState('IC')
  const [fileSource, setFileSource] = useState('')
  const [jvDescription, setJvDescription] = useState('')
  const [carmenJvId, setCarmenJvId] = useState(null)

  const { modal, showModal, closeModal } = useModal()

  // --- Sub-hooks ---
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
    headerData: extraction.headerData,
    details: extraction.details,
    bank: extraction.bank,
    cardId: extraction.cardId,
    originalHeader: extraction.originalHeader,
    originalDetails: extraction.originalDetails,
    setJvRows,
    setCarmenJvId,
  })

  // ocr_wizard_state is written by useOcrExtraction after each extraction

  useEffect(() => {
    return () => {
      if (fileUpload.previewUrl) URL.revokeObjectURL(fileUpload.previewUrl.split('#')[0])
    }
  }, [fileUpload.previewUrl])

  useEffect(() => {
    try {
      const config = JSON.parse(localStorage.getItem('accountingConfig') || '{}')
      setFilePrefix(config.filePrefix || 'IC')
      setFileSource(config.fileSource || '')
      const desc = config.description
        ? `${config.description}${extraction.headerData.DocDate ? ` - ${extraction.headerData.DocDate}` : ''}`
        : ''
      setJvDescription(desc)
    } catch {
      /* ignore */
    }
  }, [step])

  // Wire file selection → processFile
  function handleFileChange(e) {
    fileUpload.handleFileChange(e, fileArray => {
      extraction.resetExtractionState()
      setStep(1)
      extraction.processFile(fileArray)
    })
  }

  function reExtract(bankType) {
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
    // Step
    step,
    setStep,
    // File & preview (from useFileUpload)
    files: fileUpload.files,
    previewUrl: fileUpload.previewUrl,
    previewType: fileUpload.previewType,
    fileInputRef: fileUpload.fileInputRef,
    // Extraction state (from useOcrExtraction)
    loading: extraction.loading,
    status: extraction.status,
    bank: extraction.bank,
    setBank: extraction.setBank,
    headerData: extraction.headerData,
    details: extraction.details,
    // Submission state (from useOcrSubmission)
    submitting: submission.submitting,
    // Config
    jvRows,
    filePrefix,
    fileSource,
    jvDescription,
    carmenJvId,
    // Modal (from useModal)
    modal,
    showModal,
    closeModal,
    // Actions
    handleFileChange,
    processFile: files => extraction.processFile(files),
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
