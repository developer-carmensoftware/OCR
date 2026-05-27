import { useState, useEffect } from 'react'
import { useModal } from './useModal'
import { useFileUpload } from './credit-card/useFileUpload'
import { useOcrExtraction } from './credit-card/useOcrExtraction'
import { useOcrSubmission } from './credit-card/useOcrSubmission'
import { showToast } from '../lib/toast'
import type { JvRow } from './credit-card/useOcrSubmission'
import type React from 'react'

export function useOcrWizard() {
  const [step, setStep] = useState(1)
  const [jvRows, setJvRows] = useState<JvRow[]>([])
  const [filePrefix, setFilePrefix] = useState('IC')
  const [fileSource, setFileSource] = useState('')
  const [jvDescription, setJvDescription] = useState('')
  const [carmenJvId, setCarmenJvId] = useState<string | null>(null)

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
    fileUpload.handleFileChange(e as React.ChangeEvent<HTMLInputElement>, fileArray => {
      extraction.resetExtractionState()
      setStep(1)
      extraction.processFile(fileArray)
    })
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
