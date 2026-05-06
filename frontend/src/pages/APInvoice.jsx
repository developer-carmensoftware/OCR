import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, RotateCw, ChevronLeft, FileText } from 'lucide-react'
import { DocumentPreview, CustomModal, StepWizard, LoadingOverlay, DarkModeToggle, Skeleton, SkeletonGrid, UsageIndicator } from '../components/common'
import APUploadStep from '../components/ap-invoice/APUploadStep'
import APFieldMappingStep from '../components/ap-invoice/APFieldMappingStep'
import APReviewStep from '../components/ap-invoice/APReviewStep'
import APAccountMappingStep from '../components/ap-invoice/APAccountMappingStep'
import APSuccessStep from '../components/ap-invoice/APSuccessStep'
import { useAPInvoice } from '../hooks/useAPInvoice'
import { AP_STEPS } from '../constants/apInvoice'
import logo from '../assets/logo.png'

export default function APInvoice() {
  const ctrl = useAPInvoice()
  const {
    t,
    step, setStep,
    file, previewUrl, previewType, fileInputRef,
    loading, status, error, setError, suggestLoading,
    lineItems, fieldMappings, setFieldMappings, headerData,
    availableFields, systemVendor, masterAccounts, masterDepts,
    handleFileChange, confirmMapping,
    handleAISuggest, handleAcceptAll, hasSuggestions, allMapped,
    handleConfirmSuggest, handleRejectSuggest, handleReset,
    handleGenerate, invoiceSeq,
    updateItem, updateHeader, modal, setModal, isDuplicate,
  } = ctrl

  const [showPreview, setShowPreview] = useState(false)
  const [acceptAllModal, setAcceptAllModal] = useState(false)

  function handleStepClick(n) {
    if (n === 1 && step > 1) {
      setModal({
        show: true,
        title: 'Return to Upload?',
        message: 'Going back will clear all extracted data.\nYou will need to re-upload and re-extract the document, which will use 1 additional quota.',
        type: 'warning',
        confirmText: 'Go Back',
        cancelText: 'Stay Here',
        onConfirm: () => { setModal({ show: false }); handleReset() },
        onCancel: () => setModal({ show: false }),
      })
    } else {
      setStep(n)
    }
  }
  return (
    <>
      <CustomModal
        show={modal.show}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText}
        onConfirm={modal.onConfirm}
        onCancel={modal.onCancel}
      />

      <CustomModal
        show={acceptAllModal}
        title="Confirm Accept All"
        message="AI may suggest incorrect account codes. Have you reviewed all items?"
        type="warning"
        confirmText="Confirm Accept All"
        cancelText="Cancel"
        onConfirm={() => { setAcceptAllModal(false); handleAcceptAll() }}
        onCancel={() => setAcceptAllModal(false)}
      />

      <LoadingOverlay show={loading} status={status} />

      <div className="app-container" style={{ padding: '1.5rem' }}>

        {/* Page Header */}
        <div className="app-header ap-header">
          <div className="brand">
            <div className="logo-box">
              <img src={logo} alt="Logo" style={{ width: '20px', height: '20px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
            </div>
            <div>
              <h1 style={{ margin: 0 }}>{t.appTitle}</h1>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7c3aed', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '-0.1rem' }}>
                {t.appSub}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {step === 1 && <UsageIndicator />}
            <DarkModeToggle />
          </div>
        </div>

        <StepWizard step={step} steps={AP_STEPS} onStepClick={(n) => !loading && handleStepClick(n)} />

        <AnimatePresence mode="wait">
          <motion.div
            key={loading ? `${step}-loading` : error ? `${step}-error` : step}
            initial={{ opacity: 0, transform: 'translateY(10px)' }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            exit={{ opacity: 0, transform: 'translateY(-6px)' }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Step 1 — Upload */}
            {step === 1 && !loading && !error && (
              <APUploadStep t={t} fileInputRef={fileInputRef} onFileChange={handleFileChange} />
            )}

            {step === 1 && loading && (
              <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="data-card">
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <Skeleton height="1.1rem" width="40%" />
                    <SkeletonGrid rows={3} cols={2} height="2.2rem" gap="0.75rem" />
                  </div>
                </div>
                <div className="data-card">
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <Skeleton height="1.1rem" width="30%" />
                    <SkeletonGrid rows={4} cols={4} height="1.9rem" gap="0.5rem" colTemplate="2fr 1fr 1fr 1fr" />
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ maxWidth: 480, margin: '0 auto', padding: '2rem 0' }}>
                <div className="ap-error-box">
                  <AlertCircle size={20} />
                  <div>
                    <div className="ap-error-title">OCR Processing Error</div>
                    <div className="ap-error-msg">{error}</div>
                    <button className="btn btn-sm btn-outline" style={{ marginTop: '0.75rem' }} onClick={() => setError(null)}>
                      <RotateCw size={14} /> {t.retry}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Steps 2 & 3 — Split layout with toggleable document preview */}
            {(step === 2 || step === 3) && previewUrl && !loading && (
              <div className={`ap-split-layout ${!showPreview ? 'full-width' : ''}`}>
                {showPreview && (
                  <div className="ap-preview-side">
                    <DocumentPreview previewUrl={previewUrl} previewType={previewType} fileName={file?.name} />
                    <button className="preview-toggle-btn hide" onClick={() => setShowPreview(false)}>
                      <ChevronLeft size={14} /> Hide Document
                    </button>
                  </div>
                )}

                {!showPreview && (
                  <button className="preview-toggle-btn show" onClick={() => setShowPreview(true)}>
                    <FileText size={14} /> {t.showDoc || 'View Document'}
                  </button>
                )}

                <div className="ap-work-area">
                  {step === 2 && (
                    <APFieldMappingStep
                      t={t}
                      lineItems={lineItems}
                      fieldMappings={fieldMappings}
                      availableFields={availableFields}
                      onMappingChange={(col, val) => setFieldMappings(p => ({ ...p, [`col${col}`]: val }))}
                      onBack={() => setStep(1)}
                      onConfirm={confirmMapping}
                    />
                  )}
                  {step === 3 && <APReviewStep ctrl={ctrl} />}
                </div>
              </div>
            )}

            {/* Step 4 — Account Mapping */}
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

            {/* Step 5 — Success */}
            {step === 5 && (
              <APSuccessStep
                t={t}
                headerData={headerData}
                lineItems={lineItems}
                invoiceSeq={invoiceSeq}
                onReset={handleReset}
              />
            )}
          </motion.div>
        </AnimatePresence>

      </div>
    </>
  )
}
