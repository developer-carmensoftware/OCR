import { useState } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, FileText } from 'lucide-react'
import { useOcrWizard } from '../hooks/useOcrWizard'
import { StepWizard, FormActions, CustomModal, LoadingOverlay, DocumentPreview, DarkModeToggle, Skeleton, SkeletonGrid, UsageIndicator } from '../components/common'
import { UploadSection, BankDetectionBanner, HeaderCard, DetailTable, AccountingReview, InputTaxReconciliation } from '../components/credit-card'
import { BANK_THAI_NAMES } from '../constants'
import logo from '../assets/logo.png'

export default function CreditCardOCR() {
  const {
    step, files, previewUrl, previewType,
    loading, submitting, status,
    headerData, details,
    fileInputRef,
    modal, showModal, closeModal,
    setStep,
    bank,
    handleFileChange, reExtract,
    updateHeader, updateDetail, addRow, deleteRow,
    handleSubmitFinal, handleCancel, resetAll,
  } = useOcrWizard()

  const [showPreview, setShowPreview] = useState(false)

  function handleReExtract(bankType) {
    const bankDisplay = bankType
      ? `${BANK_THAI_NAMES[bankType] || bankType} (${bankType})`
      : 'Auto-detect'
    showModal({
      title: 'Re-extract Document?',
      message: `Re-extracting with ${bankDisplay} will use 1 additional quota.\n\nThe system will use ${bankType ? `the ${bankDisplay} prompt` : 'auto-detection'} as the primary extraction method.`,
      type: 'warning',
      confirmText: 'Re-extract',
      cancelText: 'Cancel',
      onConfirm: () => { closeModal(); reExtract(bankType) },
      onCancel: closeModal,
    })
  }

  function handleStepClick(n) {
    if (n === 1 && step > 1) {
      showModal({
        title: 'Return to Upload?',
        message: 'Going back will clear all extracted data.\nYou will need to re-upload and re-extract the document, which will use 1 additional quota.',
        type: 'warning',
        confirmText: 'Go Back',
        cancelText: 'Stay Here',
        onConfirm: () => { closeModal(); resetAll() },
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
        title={modal.title}
        message={modal.message}
        type={modal.type}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText}
        cancelStyle={modal.cancelStyle}
        onConfirm={modal.onConfirm}
        onCancel={modal.onCancel}
      />

      <LoadingOverlay show={loading} status={status} />

      <div className="app-container" style={{ padding: '1.5rem' }}>

        {/* Page Header */}
        <div className="app-header">
          <div className="brand">
            <div className="logo-box" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)', boxShadow: '0 4px 18px rgba(37,99,235,0.28)' }}>
              <img src={logo} alt="Logo" style={{ width: '20px', height: '20px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text)' }}>Carmen Cloud</h1>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563eb', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '-0.1rem' }}>
                Credit Card Report OCR
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {step === 1 && <UsageIndicator />}
            <DarkModeToggle />
          </div>
        </div>

        <StepWizard step={step} onStepClick={(n) => !loading && !submitting && handleStepClick(n)} />

        <AnimatePresence mode="wait">
          <motion.div
            key={loading ? 'loading' : step}
            initial={{ opacity: 0, transform: 'translateY(10px)' }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            exit={{ opacity: 0, transform: 'translateY(-6px)' }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Step 1 — Upload */}
            {step === 1 && !loading && (
              <UploadSection
                onFileChange={handleFileChange}
                fileInputRef={fileInputRef}
                fileName={files.length > 1 ? `${files.length} files selected` : files[0]?.name}
                multiple={true}
              />
            )}

            {/* Step 1 loading — AI extracting */}
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

            {/* Step 2 loading — re-extracting */}
            {step === 2 && loading && (
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

            {/* Step 2 — Review */}
            {step === 2 && !loading && (
              <div className={`ap-split-layout ${!showPreview ? 'full-width' : ''}`}>
                {showPreview && (
                  <div className="ap-preview-side">
                    <DocumentPreview previewUrl={previewUrl} previewType={previewType} fileName={files[0]?.name} />
                    <button className="preview-toggle-btn hide" onClick={() => setShowPreview(false)}>
                      <ChevronLeft size={14} /> Hide Document
                    </button>
                  </div>
                )}
                {!showPreview && (
                  <button className="preview-toggle-btn show" onClick={() => setShowPreview(true)}>
                    <FileText size={14} /> View Document
                  </button>
                )}
                <div className="ap-work-area">
                  <BankDetectionBanner bank={bank} loading={loading} onReExtract={handleReExtract} />
                  <HeaderCard headerData={headerData} onUpdate={updateHeader} />
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
                </div>
              </div>
            )}

            {/* Step 3 — Accounting Review */}
            {step === 3 && (
              <div className={`ap-split-layout ${!showPreview ? 'full-width' : ''}`}>
                {showPreview && (
                  <div className="ap-preview-side">
                    <DocumentPreview previewUrl={previewUrl} previewType={previewType} fileName={files[0]?.name} />
                    <button className="preview-toggle-btn hide" onClick={() => setShowPreview(false)}>
                      <ChevronLeft size={14} /> Hide Document
                    </button>
                  </div>
                )}
                {!showPreview && (
                  <button className="preview-toggle-btn show" onClick={() => setShowPreview(true)}>
                    <FileText size={14} /> View Document
                  </button>
                )}
                <div className="ap-work-area">
                  <AccountingReview
                    details={details}
                    headerData={headerData}
                    onBack={() => setStep(2)}
                    onSubmit={handleSubmitFinal}
                    onGoMapping={() => {
                    try { localStorage.setItem('ocr_wizard_state', JSON.stringify({ bank, details })) } catch {}
                    toast.info('Opened new tab for Mapping settings')
                    window.open('#/CreditCardOCR/mapping', '_blank')
                  }}
                    submitting={submitting}
                  />
                </div>
              </div>
            )}

            {/* Step 4 — Input Tax Reconciliation */}
            {step === 4 && (
              <InputTaxReconciliation
                details={details}
                headerData={headerData}
                onFinish={resetAll}
              />
            )}
          </motion.div>
        </AnimatePresence>

      </div>
    </>
  )
}
