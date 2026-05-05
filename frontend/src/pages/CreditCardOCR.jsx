import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil, Eye } from 'lucide-react'
import { useOcrWizard } from '../hooks/useOcrWizard'
import { StepWizard, FormActions, CustomModal, LoadingOverlay, DocumentPreview, DarkModeToggle, Skeleton, SkeletonGrid } from '../components/common'
import { UploadSection, HeaderCard, DetailTable, AccountingReview, InputTaxReconciliation } from '../components/credit-card'
import logo from '../assets/logo.png'

export default function CreditCardOCR() {
  const {
    step, bank, files, previewUrl, previewType,
    loading, submitting, status,
    headerData, details,
    fileInputRef,
    modal,
    setBank, setStep,
    handleFileChange,
    updateHeader, updateDetail, addRow, deleteRow,
    handleSubmitFinal, handleCancel, resetAll,
  } = useOcrWizard()

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

      <div className="app-container">
        <div className="app-header">
          <div className="brand">
            <div className="logo-box" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)', color: 'white' }}>
              <img src={logo} alt="Logo" style={{ width: '20px', height: '20px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text)' }}>Carmen Cloud</h1>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563eb', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '-0.1rem' }}>
                Credit Card Report OCR
              </div>
            </div>
          </div>
          <DarkModeToggle />
        </div>

        <StepWizard step={step} onStepClick={(n) => !loading && !submitting && setStep(n)} />

        {step <= 2 && !loading && (
          <>
            <UploadSection
              bank={bank}
              onBankChange={setBank}
              onFileChange={handleFileChange}
              fileInputRef={fileInputRef}
              fileName={files.length > 1 ? `${files.length} files selected` : files[0]?.name}
              multiple={true}
            />
          </>
        )}

        {step <= 2 && loading && (
          <div className="main-content" style={{ animation: 'none', opacity: 1 }}>
            <div className="preview-column">
              <h2 className="section-title">
                <Eye size={16} /> Document Preview
              </h2>
              <div className="preview-frame" style={{ height: '600px', borderStyle: 'dashed', background: 'var(--gray-50)' }}>
                <Skeleton height="100%" width="100%" radius="var(--radius-lg)" />
              </div>
            </div>
            <div className="data-column">
              <h2 className="section-title">
                <Pencil size={14} /> Step 3: Review Data
              </h2>
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
          </div>
        )}

        <div
          className={`main-content ${step < 3 ? 'hide-data' : ''} ${files.length === 0 && step < 3 ? 'hidden' : ''}`}
          style={step >= 4 ? { gridTemplateColumns: '1fr' } : {}}
        >
          {step <= 3 && (
            <DocumentPreview previewUrl={previewUrl} previewType={previewType} fileName={files[0]?.name} />
          )}

          <div className="data-column">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, transform: 'translateY(10px)' }}
                animate={{ opacity: 1, transform: 'translateY(0px)' }}
                exit={{ opacity: 0, transform: 'translateY(-6px)' }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                {step <= 3 && (
                  <div id="step3">
                    <h2 className="section-title">
                      <Pencil size={14} /> Step 3: Review Data
                    </h2>
                    <HeaderCard headerData={headerData} onUpdate={updateHeader} />
                    <DetailTable
                      details={details}
                      onUpdate={updateDetail}
                      onAddRow={addRow}
                      onDeleteRow={deleteRow}
                    />
                    <FormActions
                      onCancel={handleCancel}
                      onSubmit={() => setStep(4)}
                      submitLabel="Next (Review Accounting)"
                      showBack={false}
                    />
                  </div>
                )}

                {step === 4 && (
                  <div id="step4">
                    <AccountingReview
                      details={details}
                      headerData={headerData}
                      onBack={() => setStep(3)}
                      onSubmit={handleSubmitFinal}
                      onGoMapping={() => { toast.info('Opened new tab for Mapping settings'); window.open('#/CreditCardOCR/mapping', '_blank') }}
                      submitting={submitting}
                    />
                  </div>
                )}

                {step === 5 && (
                  <div id="step5">
                    <InputTaxReconciliation
                      details={details}
                      headerData={headerData}
                      onFinish={resetAll}
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  )
}
