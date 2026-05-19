import React from 'react'
import { Network, Loader2, CheckCircle2 } from 'lucide-react'
import CustomModal from '../components/common/CustomModal'
import '../styles/pages/mapping.css'
import { useMapping } from '../hooks/useMapping'
import TopLevelConfigSection from '../components/credit-card/TopLevelConfigSection'
import CompanyInfoSection from '../components/credit-card/CompanyInfoSection'
import AccountMappingTable from '../components/credit-card/AccountMappingTable'
import PaymentTypeModal from '../components/credit-card/PaymentTypeModal'
import type { ModalConfig } from '../hooks/useModal'

function MappingSkeleton() {
  return (
    <div style={{ margin: '2rem auto', maxWidth: '800px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <div className="skeleton" style={{ width: 20, height: 20, borderRadius: '50%' }} />
        <div className="skeleton" style={{ width: 260, height: 24, borderRadius: 6 }} />
      </div>
      <div className="skeleton-card">
        <div
          className="skeleton"
          style={{ width: 140, height: 14, borderRadius: 4, marginBottom: '1rem' }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i}>
              <div
                className="skeleton"
                style={{ width: 80, height: 12, borderRadius: 4, marginBottom: 8 }}
              />
              <div className="skeleton" style={{ width: '100%', height: 38, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      </div>
      <div className="skeleton-card" style={{ marginTop: '1.25rem' }}>
        <div
          className="skeleton"
          style={{ width: 120, height: 14, borderRadius: 4, marginBottom: '1rem' }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i}>
              <div
                className="skeleton"
                style={{ width: 90, height: 12, borderRadius: 4, marginBottom: 8 }}
              />
              <div className="skeleton" style={{ width: '100%', height: 38, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      </div>
      <div className="skeleton-card" style={{ marginTop: '1.25rem' }}>
        <div
          className="skeleton"
          style={{ width: 160, height: 14, borderRadius: 4, marginBottom: '1rem' }}
        />
        {[1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '1rem',
              marginBottom: '0.75rem',
            }}
          >
            <div className="skeleton" style={{ height: 38, borderRadius: 8 }} />
            <div className="skeleton" style={{ height: 38, borderRadius: 8 }} />
            <div className="skeleton" style={{ height: 38, borderRadius: 8 }} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: '2.5rem' }}>
        <div className="skeleton" style={{ width: '100%', height: 58, borderRadius: 12 }} />
      </div>
    </div>
  )
}

export default function Mapping() {
  const mappingCtrl = useMapping()

  if (mappingCtrl.configLoading) return <MappingSkeleton />

  const requiredMissingCount =
    mappingCtrl.activeScan.paymentTypes.size > 0
      ? [...mappingCtrl.activeScan.paymentTypes].filter(
          t => !mappingCtrl.paymentAmount[t]?.dept || !mappingCtrl.paymentAmount[t]?.acc
        ).length
      : 0

  const amountMappedCount = mappingCtrl.allPaymentTypes.filter(
    t => mappingCtrl.paymentAmount[t]?.dept && mappingCtrl.paymentAmount[t]?.acc
  ).length

  return (
    <>
      <CustomModal
        show={mappingCtrl.modalConfig.show}
        title={mappingCtrl.modalConfig.title}
        message={mappingCtrl.modalConfig.message}
        type={mappingCtrl.modalConfig.type as ModalConfig['type']}
        onConfirm={() => mappingCtrl.setModalConfig({ ...mappingCtrl.modalConfig, show: false })}
      />
      <CustomModal
        show={mappingCtrl.acceptAllModal}
        title="Confirm Accept All"
        message="AI might suggest incorrect account codes. Have you reviewed all items?"
        type="warning"
        confirmText="Confirm Accept All"
        cancelText="Cancel"
        onConfirm={mappingCtrl.handleAcceptAll}
        onCancel={() => mappingCtrl.setAcceptAllModal(false)}
      />

      <div className="container" style={{ margin: '2rem auto', maxWidth: '800px' }}>
        <h1>
          <Network size={20} /> Account Mapping Configuration
        </h1>

        <TopLevelConfigSection
          bank={mappingCtrl.bank}
          handleBankChange={mappingCtrl.handleBankChange}
          filePrefix={mappingCtrl.filePrefix}
          setFilePrefix={mappingCtrl.setFilePrefix}
          fileSource={mappingCtrl.fileSource}
          setFileSource={mappingCtrl.setFileSource}
          description={mappingCtrl.description}
          setDescription={mappingCtrl.setDescription}
        />

        <CompanyInfoSection
          company={mappingCtrl.company}
          handleCompanyChange={mappingCtrl.handleCompanyChange}
          companyRequiredFields={mappingCtrl.companyRequiredFields}
          missingCompanyFields={mappingCtrl.missingCompanyFields}
        />

        <AccountMappingTable
          masterAccounts={mappingCtrl.masterAccounts}
          masterDepartments={mappingCtrl.masterDepartments}
          loadingOpts={mappingCtrl.loadingOpts}
          mappings={mappingCtrl.mappings}
          handleMappingChange={mappingCtrl.handleMappingChange}
          suggestionMeta={mappingCtrl.suggestionMeta}
          mainSuggestions={mappingCtrl.mainSuggestions}
          suggestLoading={mappingCtrl.suggestLoading}
          autoSuggest={mappingCtrl.autoSuggest}
          confirmMainSuggestion={mappingCtrl.confirmMainSuggestion}
          rejectMainSuggestion={mappingCtrl.rejectMainSuggestion}
          setAcceptAllModal={mappingCtrl.setAcceptAllModal}
          loadInitialData={mappingCtrl.loadInitialData}
          activeScan={mappingCtrl.activeScan}
          amountMappedCount={amountMappedCount}
          requiredMissingCount={requiredMissingCount}
          openAmountModal={mappingCtrl.openAmountModal}
          allPaymentTypes={mappingCtrl.allPaymentTypes}
        />

        <div style={{ marginTop: '2.5rem' }}>
          <button
            type="button"
            className="btn-save"
            onClick={() => void mappingCtrl.saveAllSettings(true)}
            disabled={mappingCtrl.saving}
            style={{
              width: '100%',
              padding: '1.2rem',
              background: mappingCtrl.saving ? '#5eaca3' : 'var(--teal)',
              color: '#fff',
              borderRadius: '12px',
              cursor: mappingCtrl.saving ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              border: 'none',
              boxShadow: '0 4px 15px rgba(13,148,136,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
            }}
          >
            {mappingCtrl.saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <CheckCircle2 size={18} />
            )}
            {mappingCtrl.saving ? 'Saving...' : 'Save & Close'}
          </button>
        </div>
      </div>

      <PaymentTypeModal
        isAmountModalOpen={mappingCtrl.isAmountModalOpen}
        activeScan={mappingCtrl.activeScan}
        amountMappedCount={amountMappedCount}
        allPaymentTypes={mappingCtrl.allPaymentTypes}
        paymentSuggestions={mappingCtrl.paymentSuggestions}
        paymentSuggestLoading={mappingCtrl.paymentSuggestLoading}
        autoSuggestPaymentTypes={mappingCtrl.autoSuggestPaymentTypes}
        masterAccounts={mappingCtrl.masterAccounts}
        masterDepartments={mappingCtrl.masterDepartments}
        loadingOpts={mappingCtrl.loadingOpts}
        paymentAmount={mappingCtrl.paymentAmount}
        handlePaymentMappingChange={mappingCtrl.handlePaymentMappingChange}
        confirmPaymentSuggestion={mappingCtrl.confirmPaymentSuggestion}
        rejectPaymentSuggestion={mappingCtrl.rejectPaymentSuggestion}
        customPaymentTypes={mappingCtrl.customPaymentTypes}
        newCustomType={mappingCtrl.newCustomType}
        setNewCustomType={mappingCtrl.setNewCustomType}
        handleAddCustomType={mappingCtrl.handleAddCustomType}
        handleRemoveCustomType={mappingCtrl.handleRemoveCustomType}
        saveAmountSelection={mappingCtrl.saveAmountSelection}
        cancelAmountSelection={mappingCtrl.cancelAmountSelection}
        setAcceptAllModal={mappingCtrl.setAcceptAllModal}
      />
    </>
  )
}

// suppress unused import warning
void React
