import React, { useState } from 'react'
import { AlertCircle, RotateCw, ChevronLeft, FileText } from 'lucide-react'
import { DocumentPreview, CustomModal, StepWizard, LoadingOverlay, DarkModeToggle } from '../components/common'
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
    updateItem, updateHeader, modal, isDuplicate,
  } = ctrl

  const [showPreview, setShowPreview] = useState(false)
  const [acceptAllModal, setAcceptAllModal] = useState(false)
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
          <DarkModeToggle />
        </div>

        <StepWizard step={step} steps={AP_STEPS} onStepClick={(n) => !loading && setStep(n)} />

        {/* Step 1 — Upload */}
        {step === 1 && !loading && !error && (
          <APUploadStep t={t} fileInputRef={fileInputRef} onFileChange={handleFileChange} />
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

      </div>
    </>
  )
}
