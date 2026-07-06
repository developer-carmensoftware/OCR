import { useState, useEffect } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { AlertCircle, RotateCw } from 'lucide-react'
import {
  DocumentPreview,
  CustomModal,
  StepWizard,
  DarkModeToggle,
  ExtractionSkeleton,
  SplitLayout,
  UsageIndicator,
  AppHeader,
} from '../components/common'
import PDFPageSelector from '../components/common/PDFPageSelector'
import APUploadStep from '../components/ap-invoice/APUploadStep'
import APFieldMappingStep from '../components/ap-invoice/APFieldMappingStep'
import APReviewStep from '../components/ap-invoice/APReviewStep'
import APAccountMappingStep from '../components/ap-invoice/APAccountMappingStep'
import APSuccessStep from '../components/ap-invoice/APSuccessStep'
import { useAPInvoice } from '../hooks/ap-invoice'
import { useT } from '../i18n/LanguageContext'
import LanguageToggle from '../components/common/LanguageToggle'
import { AP_STEPS } from '../constants/apInvoice'
import type { APColumnKey, APFieldKey } from '../constants/apInvoice'

// suppress unused import
void DocumentPreview

export default function APInvoice() {
  const { t } = useT()
  const ctrl = useAPInvoice()
  const {
    step,
    setStep,
    file,
    previewUrl,
    previewType,
    fileInputRef,
    loading,
    elapsed,
    extractionStatus,
    error,
    setError,
    suggestLoading,
    lineItems,
    fieldMappings,
    setFieldMappings,
    headerData,
    availableFields,
    systemVendor,
    masterAccounts,
    masterDepts,
    handleFileChange,
    confirmMapping,
    handleAISuggest,
    handleAcceptAll,
    hasSuggestions,
    allMapped,
    handleConfirmSuggest,
    handleRejectSuggest,
    handleReset,
    handleGenerate,
    invoiceSeq,
    updateItem,
    updateHeader,
    modal,
    setModal,
    isDuplicate,
    isSubmitting,
    pdfInfoLoading,
    imageMerging,
    imageCount,
    pdfSelector,
    selectedPageThumbs,
    confirmPageSelection,
    cancelPageSelection,
    goToAccount,
  } = ctrl

  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'Enter') return
      if (loading || isSubmitting) return
      e.preventDefault()
      if (step === 2) confirmMapping()
      else if (step === 3) goToAccount()
      else if (step === 4 && allMapped) handleGenerate()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [step, loading, isSubmitting, allMapped, confirmMapping, handleGenerate, goToAccount])
  const [acceptAllModal, setAcceptAllModal] = useState(false)

  function handleStepClick(n: number) {
    if (n === 1 && step > 1) {
      setModal({
        show: true,
        title: t('ap.returnTitle'),
        message: t('ap.returnMsg'),
        type: 'warning',
        confirmText: t('ap.goBack'),
        cancelText: t('ap.stayHere'),
        onConfirm: () => {
          setModal({ show: false })
          handleReset()
        },
        onCancel: () => setModal({ show: false }),
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
        title={modal.show ? modal.title : ''}
        message={modal.show ? modal.message : ''}
        type={modal.show ? modal.type : 'info'}
        confirmText={modal.show ? modal.confirmText : undefined}
        cancelText={modal.show ? modal.cancelText : undefined}
        onConfirm={modal.show ? modal.onConfirm : undefined}
        onCancel={modal.show ? modal.onCancel : undefined}
        inputLabel={modal.show ? modal.inputLabel : undefined}
        inputValue={modal.show ? modal.inputValue : undefined}
        onInputChange={modal.show ? modal.onInputChange : undefined}
        inputPlaceholder={modal.show ? modal.inputPlaceholder : undefined}
        inputType={modal.show ? modal.inputType : undefined}
        busy={modal.show ? modal.busy : undefined}
        errorNonce={modal.show ? modal.errorNonce : undefined}
      />

      <CustomModal
        show={acceptAllModal}
        title={t('ap.acceptAllTitle')}
        message={t('ap.acceptAllMsg')}
        type="warning"
        confirmText={t('ap.acceptAllConfirm')}
        cancelText={t('modal.cancel')}
        onConfirm={() => {
          setAcceptAllModal(false)
          handleAcceptAll()
        }}
        onCancel={() => setAcceptAllModal(false)}
      />

      <div className="app-container">
        <AppHeader
          module="ap-invoice"
          moduleName={t('ap.appSub')}
          eyebrow={`${t('ap.appTitle')} · Account Payable`}
          backPath="/apInvoice"
        >
          <UsageIndicator />
          <LanguageToggle />
          <DarkModeToggle />
        </AppHeader>

        <StepWizard
          step={step}
          steps={AP_STEPS}
          onStepClick={n => !loading && handleStepClick(n)}
        />

        <AnimatePresence mode="wait">
          <m.div
            key={loading ? `${step}-loading` : error ? `${step}-error` : step}
            initial={{ opacity: 0, transform: 'translateY(10px)' }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            exit={{ opacity: 0, transform: 'translateY(-6px)' }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {step === 1 && !loading && !error && (
              <APUploadStep
                fileInputRef={fileInputRef}
                onFileChange={handleFileChange}
                pdfInfoLoading={pdfInfoLoading}
                imageMerging={imageMerging}
                fileCount={imageCount || undefined}
              />
            )}
            {step === 1 && loading && (
              <ExtractionSkeleton status={extractionStatus} elapsed={elapsed} />
            )}

            {error && (
              <div className="ap-error-wrapper">
                <div className="ap-error-box">
                  <AlertCircle size={20} />
                  <div>
                    <div className="ap-error-title">{t('ap.ocrError')}</div>
                    <div className="ap-error-msg">{error}</div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline ap-error-retry"
                      onClick={() => setError(null)}
                    >
                      <RotateCw size={14} /> {t('ap.retry')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(step === 2 || step === 3) &&
              (previewUrl || selectedPageThumbs?.length) &&
              !loading && (
                <SplitLayout
                  showPreview={showPreview}
                  onToggle={setShowPreview}
                  previewUrl={previewUrl}
                  previewType={previewType}
                  fileName={file?.name}
                  selectedPageThumbs={selectedPageThumbs}
                >
                  {step === 2 && (
                    <APFieldMappingStep
                      lineItems={lineItems}
                      fieldMappings={fieldMappings as Record<APColumnKey, APFieldKey | 'ignore'>}
                      availableFields={availableFields}
                      onMappingChange={(col, val) =>
                        setFieldMappings(p => ({
                          ...p,
                          [`col${col}`]: val as APFieldKey | 'ignore',
                        }))
                      }
                      onBack={() => setStep(1)}
                      onConfirm={confirmMapping}
                    />
                  )}
                  {step === 3 && (
                    <APReviewStep ctrl={ctrl as Parameters<typeof APReviewStep>[0]['ctrl']} />
                  )}
                </SplitLayout>
              )}

            {step === 4 && (
              <APAccountMappingStep
                lineItems={lineItems}
                updateItem={updateItem}
                updateHeader={updateHeader}
                systemVendor={systemVendor}
                headerData={headerData}
                masterAccounts={masterAccounts}
                masterDepts={masterDepts}
                onBack={() => setStep(3)}
                onGenerate={handleGenerate}
                onAISuggest={handleAISuggest}
                onAcceptAll={() => setAcceptAllModal(true)}
                hasSuggestions={hasSuggestions}
                onConfirmSuggest={handleConfirmSuggest}
                onRejectSuggest={handleRejectSuggest}
                suggestLoading={suggestLoading}
                allMapped={allMapped}
                isDuplicate={isDuplicate}
                isSubmitting={isSubmitting}
              />
            )}

            {step === 5 && (
              <APSuccessStep
                headerData={headerData}
                lineItems={lineItems}
                invoiceSeq={invoiceSeq}
                onReset={handleReset}
              />
            )}
          </m.div>
        </AnimatePresence>
      </div>
    </>
  )
}
