import { useState } from 'react'
import { toast } from 'sonner'
import { m, AnimatePresence } from 'framer-motion'
import { useOcrWizard } from '../hooks/credit-card'
import {
  StepWizard,
  FormActions,
  CustomModal,
  DarkModeToggle,
  ExtractionSkeleton,
  SplitLayout,
  UsageIndicator,
  AppHeader,
} from '../components/common'
import PDFPageSelector from '../components/common/PDFPageSelector'
import LanguageToggle from '../components/common/LanguageToggle'
import { useT } from '../i18n/LanguageContext'
import { appKey } from '../lib/storage'
import {
  UploadSection,
  BankDetectionBanner,
  ExtractionWarningBanner,
  HeaderCard,
  DetailTable,
  AccountingReview,
  InputTaxReconciliation,
} from '../components/credit-card'
import { BANK_THAI_NAMES } from '../constants'
import type { BankCode } from '../types/api'

export default function CreditCardOCR() {
  const { t } = useT()
  const {
    step,
    files,
    previewUrl,
    previewType,
    loading,
    submitting,
    elapsed,
    extractionStatus,
    headerData,
    details,
    warnings,
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
    pdfSelector,
    pdfInfoLoading,
    imageMerging,
    imageCount,
    selectedPageThumbs,
    confirmPageSelection,
    cancelPageSelection,
  } = useOcrWizard()

  const [showPreview, setShowPreview] = useState(false)

  function handleReExtract(bankType: BankCode | null) {
    const bankDisplay = bankType
      ? `${BANK_THAI_NAMES[bankType] || bankType} (${bankType})`
      : t('cc.autoDetect')
    const method = bankType ? t('cc.methodPrompt', { bank: bankDisplay }) : t('cc.methodAuto')
    showModal({
      title: t('cc.reExtractTitle'),
      message: t('cc.reExtractMsg', { bank: bankDisplay, method }),
      type: 'warning',
      confirmText: t('cc.reExtract'),
      cancelText: t('modal.cancel'),
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
        title: t('cc.returnTitle'),
        message: t('cc.returnMsg'),
        type: 'warning',
        confirmText: t('cc.goBack'),
        cancelText: t('cc.stayHere'),
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
      {pdfSelector && (
        <PDFPageSelector
          thumbnails={pdfSelector.thumbnails}
          onConfirm={confirmPageSelection}
          onCancel={cancelPageSelection}
        />
      )}
      <CustomModal
        show={modal.show}
        title={modal.title as string}
        message={modal.message as string}
        type={modal.type as 'info' | 'success' | 'warning' | 'error'}
        confirmText={modal.confirmText as string}
        cancelText={modal.cancelText as string | undefined}
        cancelStyle={modal.cancelStyle as React.CSSProperties | undefined}
        inputLabel={modal.inputLabel as string | undefined}
        inputType={modal.inputType as 'text' | 'password' | undefined}
        inputPlaceholder={modal.inputPlaceholder as string | undefined}
        busy={modal.busy as boolean | undefined}
        errorNonce={modal.errorNonce as number | undefined}
        onInputChange={modal.onInputChange as ((v: string) => void) | undefined}
        onConfirm={modal.onConfirm as () => void}
        onCancel={modal.onCancel as (() => void) | undefined}
      />

      <div className="app-container">
        <AppHeader
          module="credit-card"
          moduleName="AI JV Automation"
          eyebrow="Carmen Cloud · Credit Card"
          backPath="/glJv"
        >
          <UsageIndicator />
          <LanguageToggle />
          <DarkModeToggle />
        </AppHeader>

        <StepWizard step={step} onStepClick={n => !loading && !submitting && handleStepClick(n)} />

        <AnimatePresence mode="wait">
          <m.div
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
                fileName={files[0]?.name}
                fileCount={imageCount || undefined}
                pdfInfoLoading={pdfInfoLoading}
                imageMerging={imageMerging}
              />
            )}
            {step === 1 && loading && (
              <ExtractionSkeleton status={extractionStatus} elapsed={elapsed} />
            )}
            {step === 2 && loading && (
              <ExtractionSkeleton status={extractionStatus} elapsed={elapsed} />
            )}

            {step === 2 && !loading && (
              <SplitLayout
                showPreview={showPreview}
                onToggle={setShowPreview}
                previewUrl={previewUrl}
                previewType={previewType}
                fileName={files[0]?.name}
                selectedPageThumbs={selectedPageThumbs}
              >
                <BankDetectionBanner bank={bank} loading={loading} onReExtract={handleReExtract} />
                <ExtractionWarningBanner warnings={warnings} />
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
                  submitLabel={t('cc.nextReview')}
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
                selectedPageThumbs={selectedPageThumbs}
              >
                <AccountingReview
                  details={details}
                  headerData={headerData as Record<string, string>}
                  onBack={() => setStep(2)}
                  onSubmit={handleSubmitFinal}
                  onGoMapping={() => {
                    try {
                      localStorage.setItem(
                        appKey('ocr_wizard_state'),
                        JSON.stringify({ bank, details })
                      )
                    } catch {
                      /* ignore */
                    }
                    toast.info(t('cc.openedMapping'))
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
          </m.div>
        </AnimatePresence>
      </div>
    </>
  )
}

import type React from 'react'
