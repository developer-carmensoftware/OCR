import { Network, Loader2, CheckCircle2, Scale } from 'lucide-react'
import CustomModal from '../components/common/CustomModal'
import Card from '../components/admin/ui/Card'
import Switch from '../components/admin/ui/Switch'
import ARJvPreview from '../components/ar-reconcile/ARJvPreview'
import '../styles/pages/mapping.css'
import '../styles/pages/ar-reconcile.css'
import '../styles/components/mapping-row.css'
import { useT } from '../i18n/LanguageContext'
import { useMapping } from '../hooks/mapping'
import { useSettlementMapping } from '../hooks/mapping/useSettlementMapping'
import { descriptionForBank } from '../lib/bankTransforms'
import { BANK_CODE_MAP } from '../constants/banks'
import { POST_TYPES, type PostType } from '../lib/api/arReconcile'
import TopLevelConfigSection from '../components/credit-card/TopLevelConfigSection'
import CompanyInfoSection from '../components/credit-card/CompanyInfoSection'
import MainMappingTable from '../components/credit-card/MainMappingTable'
import PaymentTypeModal from '../components/credit-card/PaymentTypeModal'
import SwapLabel from '../components/common/SwapLabel'
import type { ModalConfig } from '../hooks/useModal'
import type { BankDisplayName } from '../types/api'

/**
 * Account Mapping Configuration — and, since 2026-09-22 (decision #3), a bank's
 * settlement-report posting profile as well. The two used to be separate screens
 * (`#/CreditCardOCR/ar-settings`) reading and writing separate tables; decision #28
 * made a settlement JV's debit legs read this page's own commission/tax/net mapping,
 * and decision #3 finished the collapse by moving the credit-side mapping here too —
 * so there is exactly one screen and one save for a bank's GL configuration now.
 *
 * The Settlement card renders only when the selected bank has a settlement layout
 * (`hasSettlementLayout`, from `banks.settlement_grouping`) — every other bank sees
 * exactly the page that existed before this merge.
 */

function MappingSkeleton() {
  return (
    <div style={{ margin: '2rem auto', maxWidth: '960px' }}>
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
  const { t } = useT()
  const mappingCtrl = useMapping()

  const bankCode = mappingCtrl.bank ? BANK_CODE_MAP[mappingCtrl.bank as BankDisplayName] : ''
  // The *effective* description for this bank — own wording if set, else the BU-wide
  // fallback — same resolution `description_for` applies server-side at posting time.
  // Ticket D (2026-09-22): this is what a settlement JV's wording is now, too.
  const resolvedDescription = descriptionForBank(
    mappingCtrl.description,
    mappingCtrl.bankDescriptions,
    bankCode
  )
  const settlementCtrl = useSettlementMapping(
    bankCode,
    mappingCtrl.savedMappings,
    mappingCtrl.masterAccounts,
    mappingCtrl.masterDepartments,
    resolvedDescription
  )

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

  const postTypeLabel = (pt: PostType) =>
    t(pt === 'Detail' ? 'review.arPostTypeDetail' : 'review.arPostTypeSummary')

  const showSettlement = bankCode && !settlementCtrl.loading && settlementCtrl.hasSettlementLayout

  const handleSave = () =>
    void mappingCtrl.saveAllSettings(
      true,
      showSettlement
        ? {
            hasSettlementLayout: true,
            mappingsToSave: settlementCtrl.mappingsToSave,
            enabled: settlementCtrl.enabled,
            postType: settlementCtrl.postType,
            bankCode,
          }
        : undefined
    )

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
        title={t('cc.acceptAllTitle')}
        message={t('cc.acceptAllMsg')}
        type="warning"
        confirmText={t('cc.acceptAllConfirm')}
        cancelText={t('modal.cancel')}
        onConfirm={mappingCtrl.handleAcceptAll}
        onCancel={() => mappingCtrl.setAcceptAllModal(false)}
      />

      <div className="container">
        <h1>
          <Network size={20} /> {t('cc.mappingTitle')}
        </h1>

        <TopLevelConfigSection
          bank={mappingCtrl.bank}
          handleBankChange={mappingCtrl.handleBankChange}
          filePrefix={mappingCtrl.filePrefix}
          setFilePrefix={mappingCtrl.setFilePrefix}
          fileSource={mappingCtrl.fileSource}
          description={mappingCtrl.description}
          setDescription={mappingCtrl.setDescription}
          bankDescriptions={mappingCtrl.bankDescriptions}
          setBankDescriptions={mappingCtrl.setBankDescriptions}
          masterGLPrefixes={mappingCtrl.masterGLPrefixes}
          hasSettlementLayout={Boolean(showSettlement)}
          settlementPreview={settlementCtrl.preview?.description}
        />

        <CompanyInfoSection
          company={mappingCtrl.company}
          handleCompanyChange={mappingCtrl.handleCompanyChange}
          companyRequiredFields={mappingCtrl.companyRequiredFields}
          missingCompanyFields={mappingCtrl.missingCompanyFields}
        />

        <MainMappingTable
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
          requiredMissingCount={requiredMissingCount}
          openAmountModal={mappingCtrl.openAmountModal}
        />

        {/* Settlement — a settlement report's own posting profile. Only for a bank with
            a settlement layout (`banks.settlement_grouping`); every other bank's page
            ends at the section above, exactly as it did before this merge. */}
        {showSettlement && (
          <div className="ar-page" style={{ padding: 0, marginTop: '2.5rem' }}>
            <div className="ar-grid">
              <div className="ar-col">
                <Card title={t('cc.settlementCardTitle')} icon={<Scale size={16} />}>
                  <div className="ar-field" style={{ marginBottom: '1rem' }}>
                    <Switch
                      checked={settlementCtrl.enabled}
                      onChange={settlementCtrl.setEnabled}
                      label={t('ar.enabled')}
                    />
                    {!settlementCtrl.enabled && (
                      <p className="ar-hint ar-hint-warn">{t('ar.enabledOffHint')}</p>
                    )}
                  </div>

                  <fieldset className="ar-field ar-posttype">
                    <legend>{t('ar.postType')}</legend>
                    <div
                      className="segmented-control"
                      role="radiogroup"
                      aria-label={t('ar.postType')}
                    >
                      {POST_TYPES.map(pt => (
                        <button
                          key={pt}
                          type="button"
                          role="radio"
                          aria-checked={settlementCtrl.postType === pt}
                          className={`segmented-btn ${settlementCtrl.postType === pt ? 'active' : ''}`}
                          onClick={() => settlementCtrl.setPostType(pt)}
                        >
                          <span className="ar-seg-name">{postTypeLabel(pt)}</span>
                          <span className="ar-seg-count">
                            {t('ar.postTypeMapped', {
                              mapped: settlementCtrl.mappedCount(pt),
                              total: settlementCtrl.rowCount(pt),
                            })}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="ar-hint">
                      {settlementCtrl.postType === 'Detail'
                        ? t('ar.postTypeHintDetail')
                        : t('ar.postTypeHintSummary')}{' '}
                      {t('ar.postTypeHintShared')}
                    </p>
                  </fieldset>
                </Card>
              </div>

              <div className="ar-rail">
                <ARJvPreview
                  preview={settlementCtrl.preview}
                  loading={settlementCtrl.previewLoading}
                  postTypeLabel={postTypeLabel(settlementCtrl.postType)}
                />
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: '2.5rem' }}>
          <button
            type="button"
            className="btn-save-mapping"
            onClick={handleSave}
            disabled={mappingCtrl.saving}
            style={{
              background: mappingCtrl.saving ? '#5eaca3' : 'var(--teal)',
              cursor: mappingCtrl.saving ? 'not-allowed' : 'pointer',
            }}
          >
            {mappingCtrl.saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <CheckCircle2 size={18} />
            )}
            <SwapLabel active={mappingCtrl.saving} idle={t('cc.saveClose')} busy={t('cc.saving')} />
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
        handleRemoveCustomType={mappingCtrl.handleRemoveCustomType}
        saveAmountSelection={mappingCtrl.saveAmountSelection}
        cancelAmountSelection={mappingCtrl.cancelAmountSelection}
        setAcceptAllModal={mappingCtrl.setAcceptAllModal}
        settlement={
          showSettlement
            ? {
                postTypeLabel: postTypeLabel(settlementCtrl.postType),
                rows: settlementCtrl.rows,
                setRowMapping: settlementCtrl.setRowMapping,
                addCustomType: settlementCtrl.addCustomType,
                removeType: settlementCtrl.removeType,
                suggestions: settlementCtrl.suggestions,
                suggestLoading: settlementCtrl.suggestLoading,
                runSuggest: () => void settlementCtrl.runSuggest(),
                acceptSuggestion: settlementCtrl.acceptSuggestion,
                rejectSuggestion: settlementCtrl.rejectSuggestion,
              }
            : undefined
        }
      />
    </>
  )
}
