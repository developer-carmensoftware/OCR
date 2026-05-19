import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, RotateCw } from 'lucide-react'
import { DocumentPreview, CustomModal, StepWizard, LoadingOverlay, DarkModeToggle, ExtractionSkeleton, SplitLayout, UsageIndicator, AppHeader } from '../components/common'
import APUploadStep from '../components/ap-invoice/APUploadStep'
import APFieldMappingStep from '../components/ap-invoice/APFieldMappingStep'
import APReviewStep from '../components/ap-invoice/APReviewStep'
import APAccountMappingStep from '../components/ap-invoice/APAccountMappingStep'
import APSuccessStep from '../components/ap-invoice/APSuccessStep'
import { useAPInvoice } from '../hooks/useAPInvoice'
import { AP_STEPS } from '../constants/apInvoice'
import type { APColumnKey, APFieldKey } from '../constants/apInvoice'

// suppress unused import
void DocumentPreview

export default function APInvoice() {
  const ctrl = useAPInvoice()
  const { t, step, setStep, file, previewUrl, previewType, fileInputRef, loading, status, error, setError, suggestLoading, lineItems, fieldMappings, setFieldMappings, headerData, availableFields, systemVendor, masterAccounts, masterDepts, handleFileChange, confirmMapping, handleAISuggest, handleAcceptAll, hasSuggestions, allMapped, handleConfirmSuggest, handleRejectSuggest, handleReset, handleGenerate, invoiceSeq, updateItem, updateHeader, modal, setModal, isDuplicate } = ctrl

  const [showPreview, setShowPreview] = useState(false)
  const [acceptAllModal, setAcceptAllModal] = useState(false)

  function handleStepClick(n: number) {
    if (n === 1 && step > 1) {
      setModal({
        show: true, title: 'Return to Upload?',
        message: 'Going back will clear all extracted data.\nYou will need to re-upload and re-extract the document, which will use 1 additional quota.',
        type: 'warning', confirmText: 'Go Back', cancelText: 'Stay Here',
        onConfirm: () => { setModal({ show: false }); handleReset() },
        onCancel: () => setModal({ show: false }),
      })
    } else {
      setStep(n)
    }
  }

  return (
    <>
      <CustomModal show={!!modal.show} title={modal.title as string} message={modal.message as string} type={modal.type as 'info' | 'success' | 'warning' | 'error'} confirmText={modal.confirmText as string} cancelText={modal.cancelText as string | undefined} onConfirm={modal.onConfirm as (() => void) | undefined} onCancel={modal.onCancel as (() => void) | undefined} inputLabel={modal.inputLabel as string | undefined} inputValue={modal.inputValue as string | undefined} onInputChange={modal.onInputChange as ((v: string) => void) | undefined} inputPlaceholder={modal.inputPlaceholder as string | undefined} />

      <CustomModal show={acceptAllModal} title="Confirm Accept All" message="AI may suggest incorrect account codes. Have you reviewed all items?" type="warning" confirmText="Confirm Accept All" cancelText="Cancel" onConfirm={() => { setAcceptAllModal(false); handleAcceptAll() }} onCancel={() => setAcceptAllModal(false)} />

      <LoadingOverlay show={loading} status={status} />

      <div className="app-container" style={{ padding: '1.5rem' }}>
        <AppHeader module="ap-invoice" moduleName={t.appSub} eyebrow={`${t.appTitle} · Account Payable`} backPath="/apInvoice">
          <UsageIndicator /><DarkModeToggle />
        </AppHeader>

        <StepWizard step={step} steps={AP_STEPS} onStepClick={n => !loading && handleStepClick(n)} />

        <AnimatePresence mode="wait">
          <motion.div key={loading ? `${step}-loading` : error ? `${step}-error` : step} initial={{ opacity: 0, transform: 'translateY(10px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} exit={{ opacity: 0, transform: 'translateY(-6px)' }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}>

            {step === 1 && !loading && !error && (
              <APUploadStep t={t} fileInputRef={fileInputRef} onFileChange={handleFileChange} />
            )}
            {step === 1 && loading && <ExtractionSkeleton />}

            {error && (
              <div style={{ maxWidth: 480, margin: '0 auto', padding: '2rem 0' }}>
                <div className="ap-error-box">
                  <AlertCircle size={20} />
                  <div>
                    <div className="ap-error-title">OCR Processing Error</div>
                    <div className="ap-error-msg">{error}</div>
                    <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: '0.75rem' }} onClick={() => setError(null)}>
                      <RotateCw size={14} /> {t.retry}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(step === 2 || step === 3) && previewUrl && !loading && (
              <SplitLayout showPreview={showPreview} onToggle={setShowPreview} previewUrl={previewUrl} previewType={previewType} fileName={file?.name}>
                {step === 2 && (
                  <APFieldMappingStep
                    t={t}
                    lineItems={lineItems}
                    fieldMappings={fieldMappings as Record<APColumnKey, APFieldKey | 'ignore'>}
                    availableFields={availableFields}
                    onMappingChange={(col, val) => setFieldMappings(p => ({ ...p, [`col${col}`]: val as APFieldKey | 'ignore' }))}
                    onBack={() => setStep(1)}
                    onConfirm={confirmMapping}
                  />
                )}
                {step === 3 && <APReviewStep ctrl={ctrl as Parameters<typeof APReviewStep>[0]['ctrl']} />}
              </SplitLayout>
            )}

            {step === 4 && (
              <APAccountMappingStep
                t={t}
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
              />
            )}

            {step === 5 && (
              <APSuccessStep t={t} headerData={headerData} lineItems={lineItems} invoiceSeq={invoiceSeq} onReset={handleReset} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}
