import { useState } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { useOcrWizard } from '../hooks/useOcrWizard'
import {
  StepWizard,
  FormActions,
  CustomModal,
  LoadingOverlay,
  DarkModeToggle,
  ExtractionSkeleton,
  SplitLayout,
  UsageIndicator,
  AppHeader,
  BugReportButton,
  PaymentButton,
} from '../components/common'
import {
  UploadSection,
  BankDetectionBanner,
  HeaderCard,
  DetailTable,
  AccountingReview,
  InputTaxReconciliation,
} from '../components/credit-card'
import { BANK_THAI_NAMES } from '../constants'
import type { BankCode } from '../types/api'

export default function CreditCardOCR() {
  const {
    step,
    files,
    previewUrl,
    previewType,
    loading,
    submitting,
    status,
    headerData,
    details,
    fileInputRef,
    modal,
    showModal,
    closeModal,
    setStep,
    bank,
    handleFileChange,
    reExtract,
    updateHeader,
    updateDetail,
    addRow,
    deleteRow,
    handleSubmitFinal,
    handleCancel,
    resetAll,
  } = useOcrWizard()

  const [showPreview, setShowPreview] = useState(false)

  function handleReExtract(bankType: BankCode | null) {
    const bankDisplay = bankType
      ? `${BANK_THAI_NAMES[bankType] || bankType} (${bankType})`
      : 'Auto-detect'
    showModal({
      title: 'Re-extract Document?',
      message: `Re-extracting with ${bankDisplay} will use 1 additional quota.\n\nThe system will use ${bankType ? `the ${bankDisplay} prompt` : 'auto-detection'} as the primary extraction method.`,
      type: 'warning',
      confirmText: 'Re-extract',
      cancelText: 'Cancel',
      onConfirm: () => {
        closeModal()
        reExtract(bankType ?? undefined)
      },
      onCancel: closeModal,
    })
  }

  function handleStepClick(n: number) {
    if (n === 1 && step > 1) {
      showModal({
        title: 'Return to Upload?',
        message:
          'Going back will clear all extracted data.\nYou will need to re-upload and re-extract the document, which will use 1 additional quota.',
        type: 'warning',
        confirmText: 'Go Back',
        cancelText: 'Stay Here',
        onConfirm: () => {
          closeModal()
          resetAll()
        },
        onCancel: closeModal,
      })
    } else {
      setStep(n)
    }
  }

  return (
    <>
      <CustomModal
        show={modal.show}
        title={modal.title as string}
        message={modal.message as string}
        type={modal.type as 'info' | 'success' | 'warning' | 'error'}
        confirmText={modal.confirmText as string}
        cancelText={modal.cancelText as string | undefined}
        cancelStyle={modal.cancelStyle as React.CSSProperties | undefined}
        onConfirm={modal.onConfirm as () => void}
        onCancel={modal.onCancel as (() => void) | undefined}
      />

      <LoadingOverlay show={loading} status={status} />

      <div className="app-container">
        <AppHeader
          module="credit-card"
          moduleName="Credit Card Report OCR"
          eyebrow="Carmen Cloud · Journal Voucher"
          backPath="/glJv"
        >
          <UsageIndicator />
          <PaymentButton />
          <BugReportButton module="credit_card_ocr" />
          <DarkModeToggle />
        </AppHeader>

        <StepWizard step={step} onStepClick={n => !loading && !submitting && handleStepClick(n)} />

        <AnimatePresence mode="wait">
          <motion.div
            key={loading ? 'loading' : step}
            initial={{ opacity: 0, transform: 'translateY(10px)' }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            exit={{ opacity: 0, transform: 'translateY(-6px)' }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {step === 1 && !loading && (
              <UploadSection
                onFileChange={handleFileChange}
                fileInputRef={fileInputRef}
                fileName={files.length > 1 ? `${files.length} files selected` : files[0]?.name}
                multiple
              />
            )}
            {step === 1 && loading && <ExtractionSkeleton />}
            {step === 2 && loading && <ExtractionSkeleton />}

            {step === 2 && !loading && (
              <SplitLayout
                showPreview={showPreview}
                onToggle={setShowPreview}
                previewUrl={previewUrl}
                previewType={previewType}
                fileName={files[0]?.name}
              >
                <BankDetectionBanner bank={bank} loading={loading} onReExtract={handleReExtract} />
                <HeaderCard
                  headerData={headerData as Record<string, string>}
                  onUpdate={updateHeader}
                />
                <DetailTable
                  details={details}
                  onUpdate={updateDetail}
                  onAddRow={addRow}
                  onDeleteRow={deleteRow}
                />
                <FormActions
                  onCancel={handleCancel}
                  onSubmit={() => setStep(3)}
                  submitLabel="Next (Review Accounting)"
                  showBack={false}
                />
              </SplitLayout>
            )}

            {step === 3 && (
              <SplitLayout
                showPreview={showPreview}
                onToggle={setShowPreview}
                previewUrl={previewUrl}
                previewType={previewType}
                fileName={files[0]?.name}
              >
                <AccountingReview
                  details={details}
                  headerData={headerData as Record<string, string>}
                  onBack={() => setStep(2)}
                  onSubmit={handleSubmitFinal}
                  onGoMapping={() => {
                    try {
                      localStorage.setItem('ocr_wizard_state', JSON.stringify({ bank, details }))
                    } catch {
                      /* ignore */
                    }
                    toast.info('Opened new tab for Mapping settings')
                    window.open('#/CreditCardOCR/mapping', '_blank')
                  }}
                  submitting={submitting}
                />
              </SplitLayout>
            )}

            {step === 4 && (
              <InputTaxReconciliation
                details={details}
                headerData={headerData as Record<string, string>}
                onBack={() => setStep(3)}
                onFinish={resetAll}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}

import type React from 'react'
