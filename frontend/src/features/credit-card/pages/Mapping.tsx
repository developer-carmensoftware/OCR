import { Network, Loader2, CheckCircle2 } from 'lucide-react'
import CustomModal from '@/shared/components/common/CustomModal'
import '@/styles/pages/mapping.css'
import '@/styles/pages/ar-reconcile.css'
import '@/styles/components/mapping-row.css'
import { useT } from '@/i18n/LanguageContext'
import { useMapping } from '../hooks/mapping'
import { useSettlementMapping } from '../hooks/mapping/useSettlementMapping'
import { descriptionForBank } from '../lib/bankTransforms'
import { BANK_CODE_MAP } from '@/shared/constants/banks'
import { POST_TYPES, type PostType } from '@/features/credit-card/api/arReconcile'
import TopLevelConfigSection from '@/features/credit-card/components/TopLevelConfigSection'
import CompanyInfoSection from '@/features/credit-card/components/CompanyInfoSection'
import MainMappingTable from '@/features/credit-card/components/MainMappingTable'
import PaymentMappingDialog from '@/features/credit-card/components/payment-mapping/PaymentMappingDialog'
import { statsOf } from '@/features/credit-card/components/payment-mapping/types'
import { buildMappingSets } from '../hooks/mapping/mappingSets'
import SwapLabel from '@/shared/components/common/SwapLabel'
import type { ModalConfig } from '@/shared/hooks/useModal'
import type { BankDisplayName } from '@/shared/types/api'

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

/**
 * Step 2 of the page's load — the bank-scoped sections, while the selected bank's own GL
 * mappings and settlement settings are in flight. Step 1 (`MappingSkeleton`) runs once;
 * this runs on the first load and on every bank switch, and only here: the bank picker,
 * prefix, description and company info above stay live, because none of them waits on it.
 *
 * It stands in for the Settlement card *and* the mapping table as one block, so both
 * appear in a single reveal instead of three staggered pops, and the previous bank's
 * accounts are never on screen under this bank's name. Laid out on the real
 * `.cc-mapping-grid-container` (a credit row and the three debit rows), so its columns
 * and its phone-width stacking are the table's own and the reveal does not jump.
 */
function BankDataSkeleton() {
  const bar = (height: number, width: number | string = '100%') => (
    <div className="skeleton" style={{ height, width, borderRadius: height > 20 ? 8 : 4 }} />
  )
  return (
    <div className="section" aria-hidden="true">
      <div className="section-title">{bar(12, 180)}</div>
      <div className="cc-mapping-grid-container">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="cc-mapping-row">
            {bar(24, 44)}
            {bar(14, '75%')}
            {bar(38)}
            {bar(38)}
            <div />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Mapping() {
  const { t } = useT()
  const mappingCtrl = useMapping()

  const bankCode = mappingCtrl.bank ? BANK_CODE_MAP[mappingCtrl.bank as BankDisplayName] : ''
  // This bank's own description — the same resolution `description_for` applies
  // server-side at posting time. Ticket D (2026-09-22): a settlement JV's wording too.
  const resolvedDescription = descriptionForBank(mappingCtrl.bankDescriptions, bankCode)
  const settlementCtrl = useSettlementMapping(
    bankCode,
    mappingCtrl.savedMappings,
    mappingCtrl.masterAccounts,
    mappingCtrl.masterDepartments,
    resolvedDescription,
    mappingCtrl.mappingsBankCode
  )

  if (mappingCtrl.configLoading) return <MappingSkeleton />

  const postTypeLabel = (pt: PostType) =>
    t(pt === 'Detail' ? 'review.arPostTypeDetail' : 'review.arPostTypeSummary')

  const showSettlement = bankCode && !settlementCtrl.loading && settlementCtrl.hasSettlementLayout
  // Step 2: this bank's mappings have not landed, or its settlement settings have not.
  // Until both have, what the hooks hold is the previous bank's (or nothing), so the
  // sections that show it are swapped for `BankDataSkeleton` and Save is off.
  const bankFailed = Boolean(bankCode) && mappingCtrl.bankError === bankCode
  const bankLoading =
    Boolean(bankCode) && (mappingCtrl.mappingsBankCode !== bankCode || settlementCtrl.loading)

  // Every list of payment types this bank has, for the one dialog that maps them all.
  const mappingSets = buildMappingSets({
    fee: mappingCtrl,
    settlement: showSettlement ? settlementCtrl : null,
    labels: {
      feeInvoice: t('cc.pmSetFeeInvoice'),
      settlement: t('cc.pmSetSettlement', { postType: postTypeLabel(settlementCtrl.postType) }),
    },
  })
  const primarySet = mappingSets.sets[0]
  const primaryStats = statsOf(primarySet, mappingCtrl.masterDepartments)

  const handleSave = () =>
    void mappingCtrl.saveAllSettings(
      true,
      showSettlement
        ? {
            hasSettlementLayout: true,
            mappingsToSave: settlementCtrl.mappingsToSave,
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
          prefixes={mappingCtrl.masterGLPrefixes}
          fileSource={mappingCtrl.fileSource}
          bankDescriptions={mappingCtrl.bankDescriptions}
          setBankDescriptions={mappingCtrl.setBankDescriptions}
          hasSettlementLayout={Boolean(showSettlement)}
          settlementPreview={settlementCtrl.preview?.description}
        />

        <CompanyInfoSection
          company={mappingCtrl.company}
          handleCompanyChange={mappingCtrl.handleCompanyChange}
          companyRequiredFields={mappingCtrl.companyRequiredFields}
          missingCompanyFields={mappingCtrl.missingCompanyFields}
        />

        {bankFailed ? (
          <div className="section" role="alert">
            <p className="ar-hint ar-hint-warn" style={{ margin: '0 0 0.75rem' }}>
              {t('cc.mapBankLoadFailed', { bank: bankCode })}
            </p>
            <button type="button" className="btn btn-secondary" onClick={mappingCtrl.retryBank}>
              {t('cc.mapRetry')}
            </button>
          </div>
        ) : bankLoading ? (
          <div aria-busy="true">
            <span className="sr-only" role="status">
              {t('cc.mapLoadingBank', { bank: bankCode })}
            </span>
            <BankDataSkeleton />
          </div>
        ) : (
          <>
            {/* Settlement — a settlement report's Detail/Summary grouping. Only for a bank with
            a settlement layout (`banks.settlement_grouping`); every other bank's page goes
            straight to the mapping. Above it, not below: the grouping decides which payment
            types there are to map, so it is chosen first. The same flat section + form row
            as the rest of this page: since the "Reconcile this bank" toggle moved to Carmen
            (2026-09-29) this is one control, and a card around one control was most of the
            page's height. */}
            {showSettlement && (
              <div className="section">
                <div className="section-title">{t('cc.settlementCardTitle')}</div>
                {/* Whether this bank reconciles at all is its email rule, switched in Carmen's
                settings — said here, not set here. */}
                {!settlementCtrl.enabled && (
                  <p className="ar-hint ar-hint-warn" style={{ margin: '0 0 1rem' }}>
                    {t('ar.enabledOffHint')}
                  </p>
                )}
                <div className="form-grid">
                  <label id="ar-posttype-label">
                    {t('ar.postType')}
                    <span className="gl-help-tip" title={t('ar.postTypeHintShared')}>
                      ?
                    </span>
                  </label>
                  <div className="ar-posttype-row">
                    <div
                      className="segmented-control ar-posttype"
                      role="radiogroup"
                      aria-labelledby="ar-posttype-label"
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
                          {postTypeLabel(pt)}
                          <span
                            className="ar-seg-count"
                            title={t('ar.postTypeMapped', {
                              mapped: settlementCtrl.mappedCount(pt),
                              total: settlementCtrl.rowCount(pt),
                            })}
                          >
                            {settlementCtrl.mappedCount(pt)}/{settlementCtrl.rowCount(pt)}
                          </span>
                        </button>
                      ))}
                    </div>
                    <span className="ar-hint" style={{ margin: 0 }}>
                      {settlementCtrl.postType === 'Detail'
                        ? t('ar.postTypeHintDetail')
                        : t('ar.postTypeHintSummary')}
                    </span>
                  </div>
                </div>
              </div>
            )}

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
              paymentSummary={{
                label: primarySet.label,
                mapped: primaryStats.mapped,
                total: primaryStats.total,
              }}
              openAmountModal={mappingSets.open}
            />
          </>
        )}

        <div style={{ marginTop: '2.5rem' }}>
          <button
            type="button"
            className="btn-save-mapping"
            onClick={handleSave}
            // Off through step 2 as well: until this bank's mappings land, the form holds
            // the previous bank's, and the PUT would replace this bank's with them.
            disabled={mappingCtrl.saving || bankLoading || bankFailed}
            style={{
              background: mappingCtrl.saving ? '#5eaca3' : 'var(--teal)',
              cursor: mappingCtrl.saving || bankLoading || bankFailed ? 'not-allowed' : 'pointer',
              opacity: !mappingCtrl.saving && (bankLoading || bankFailed) ? 0.55 : undefined,
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

      <PaymentMappingDialog
        open={mappingCtrl.isAmountModalOpen}
        sets={mappingSets.sets}
        context={bankCode}
        masterAccounts={mappingCtrl.masterAccounts}
        masterDepartments={mappingCtrl.masterDepartments}
        loadingOpts={mappingCtrl.loadingOpts}
        onCancel={mappingSets.cancel}
        onDone={mappingSets.done}
      />
    </>
  )
}
