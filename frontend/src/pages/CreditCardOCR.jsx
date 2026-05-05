import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { useOcrWizard } from '../hooks/useOcrWizard'
import { StepWizard, FormActions, CustomModal, LoadingOverlay, DocumentPreview, DarkModeToggle } from '../components/common'
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

        {step <= 2 && (
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

        <div
          className={`main-content ${step < 3 ? 'hide-data' : ''} ${files.length === 0 && step < 3 ? 'hidden' : ''}`}
          style={step >= 4 ? { gridTemplateColumns: '1fr' } : {}}
        >
          {step <= 3 && (
            <DocumentPreview previewUrl={previewUrl} previewType={previewType} fileName={files[0]?.name} />
          )}

          <div className="data-column">
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
          </div>
        </div>
      </div>
    </>
  )
}
