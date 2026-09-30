import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Check,
  X,
  History,
  ChevronRight,
} from 'lucide-react'
import CustomSearchSelect from '@/shared/components/common/CustomSearchSelect'
// The row shape and its stacked form live here. Imported by the component that renders it
// rather than left to whichever sibling happens to be mounted — that assumption is the bug
// this file's own header records.
import '@/styles/components/mapping-row.css'
import { useT } from '@/i18n/LanguageContext'
import { glFieldLabel } from '@/features/credit-card/lib/glFieldLabels'
import { allowedAccountsForDept, isAccountAllowed } from '@/shared/lib/deptAccounts'
import AISuggestBar from '@/shared/components/common/AISuggestBar'
import type { FieldMapping } from '@/shared/types/api'
import type {
  MasterAccount,
  MasterDepartment,
} from '@/features/credit-card/hooks/mapping/useMappingData'
import type { MainMappings } from '@/features/credit-card/hooks/mapping/useMapping'
import type {
  MainMappingKey,
  Suggestion,
  SuggestionSource,
} from '@/features/credit-card/hooks/mapping/useMappingSuggestions'

interface Props {
  masterAccounts: MasterAccount[]
  masterDepartments: MasterDepartment[]
  loadingOpts: boolean
  mappings: MainMappings
  handleMappingChange: (type: string, field: keyof FieldMapping, value: string) => void
  suggestionMeta: Record<MainMappingKey, SuggestionSource>
  mainSuggestions: Record<MainMappingKey, Suggestion | null>
  suggestLoading: boolean
  autoSuggest: () => void
  confirmMainSuggestion: (key: MainMappingKey) => void
  rejectMainSuggestion: (key: string) => void
  setAcceptAllModal: (v: boolean) => void
  loadInitialData: () => void
  /** The payment-type dialog's first list, as the credit row summarises it: its name
   *  (e.g. "Settlement report · Summary"), and how many of its types have an account. */
  paymentSummary: { label: string; mapped: number; total: number }
  openAmountModal: () => void
}

export default function MainMappingTable({
  masterAccounts,
  masterDepartments,
  loadingOpts,
  mappings,
  handleMappingChange,
  suggestionMeta,
  mainSuggestions,
  suggestLoading,
  autoSuggest,
  confirmMainSuggestion,
  rejectMainSuggestion,
  setAcceptAllModal,
  loadInitialData,
  paymentSummary,
  openAmountModal,
}: Props) {
  const { t } = useT()
  const total = paymentSummary.total
  const missing = total - paymentSummary.mapped
  return (
    <div className="section">
      <div className="section-title cc-section-title-container">
        <div className="cc-flex-center-gap">
          <span>
            {t('cc.mapTitle')}{' '}
            {loadingOpts && (
              <span className="cc-loading-text-primary">
                <Loader2 size={13} className="animate-spin" /> {t('cc.mapLoadingCodes')}
              </span>
            )}
          </span>
        </div>
        <AISuggestBar
          onSuggest={() => autoSuggest()}
          onAcceptAll={() => setAcceptAllModal(true)}
          hasSuggestions={Object.values(mainSuggestions).some(s => s)}
          loading={suggestLoading}
          disabled={masterAccounts.length === 0 || masterDepartments.length === 0 || loadingOpts}
          onRefresh={loadInitialData}
          refreshLoading={loadingOpts}
        />
      </div>

      <div className="table-wrapper cc-pb-0">
        <div className="cc-mapping-grid-container">
          {/* Each block below is `display: contents` on a wide screen, so the five tracks
              above stay exactly as they were. Below the stacking breakpoint they become the
              thing that groups a row's cells into one readable record. */}
          <div className="cc-mapping-head">
            <div />
            <div />
            <div className="mapping-header">
              {t('cc.mapDeptCode')}
              <span className="gl-help-tip" title={t('cc.mapDeptCodeHelp')}>
                ?
              </span>
            </div>
            <div className="mapping-header">
              {t('cc.mapAccCode')}
              <span className="gl-help-tip" title={t('cc.mapAccCodeHelp')}>
                ?
              </span>
            </div>
            <div />
          </div>

          {/* Credit row — Account Receivable */}
          <div className="cc-mapping-row cc-mapping-row--credit">
            <div className="mapping-type type-credit cc-mapping-type-credit">
              {t('cc.mapCredit')}
            </div>
            <button type="button" className="cc-map-ar-btn" onClick={openAmountModal}>
              <span className="cc-map-ar-title">{t('cc.mapArBank')}</span>
              {total > 0 && (
                <span
                  className={`cc-map-ar-count ${missing > 0 ? 'missing' : 'ready'}`}
                  title={t('cc.mapPtCount', { mapped: paymentSummary.mapped, total })}
                >
                  {paymentSummary.mapped}/{total}
                </span>
              )}
              <ChevronRight size={14} className="cc-map-ar-chevron" />
            </button>
            <div className="cc-grid-span-3">
              <div
                id="amountMappingStatus"
                role="status"
                className={`cc-mapping-status ${missing > 0 ? 'missing' : 'ready'}`}
              >
                {total === 0 ? (
                  <>
                    <Info size={14} className="cc-flex-shrink-0" />
                    <span>{t('cc.mapPtEmpty')}</span>
                  </>
                ) : missing > 0 ? (
                  <>
                    <AlertTriangle size={14} className="cc-flex-shrink-0" />
                    <span>{t('cc.pmSummaryMissing', { missing, total })}</span>
                    <span className="cc-bullet-divider-missing">·</span>
                    <span>{paymentSummary.label}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} className="cc-flex-shrink-0" />
                    <span>{t('cc.mapPtAllMapped', { n: total })}</span>
                    <span className="cc-ready-subtext">{paymentSummary.label}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Debit rows — commission, tax, net */}
          {(['commission', 'tax', 'net'] as MainMappingKey[]).map(key => {
            const meta = suggestionMeta[key]
            const badge = meta === 'history' ? { label: t('cc.mapHistory') } : null
            const hasSuggestionButtons = meta === 'ai' || meta === 'history'
            const suggestion = mainSuggestions[key] ?? null

            const deptFromMaster = suggestion?.dept
              ? masterDepartments.find(d => d.code === suggestion.dept)
              : null
            const deptTopChoice = suggestion?.dept
              ? {
                  code: suggestion.dept,
                  name: deptFromMaster?.name || t('cc.mapAiCode'),
                  name2: deptFromMaster?.name2,
                  source: suggestion.source,
                }
              : null

            const acctOptions = allowedAccountsForDept(
              mappings[key].dept,
              masterDepartments,
              masterAccounts
            )
            const acctNotice =
              acctOptions.length < masterAccounts.length
                ? t('cc.mapAllowedAcc', { n: acctOptions.length, dept: mappings[key].dept ?? '' })
                : undefined

            const accFromMaster = suggestion?.acc
              ? masterAccounts.find(a => a.code === suggestion.acc)
              : null
            const accTopChoice = suggestion?.acc
              ? {
                  code: suggestion.acc,
                  name: accFromMaster?.name || t('cc.mapAiCode'),
                  name2: accFromMaster?.name2,
                  source: suggestion.source,
                }
              : null

            return (
              <div className="cc-mapping-row" key={key}>
                <div className="mapping-type type-debit cc-mapping-type-debit">
                  {t('cc.mapDebit')}
                </div>
                <div className="mapping-label cc-label-flex-container">
                  <span>{glFieldLabel(key, t)}</span>
                  {badge && (
                    <span className="cc-history-badge">
                      <History size={11} /> {badge.label}
                    </span>
                  )}
                </div>
                <div className="pm-cell" data-label={t('cc.mapDeptCode')}>
                  <CustomSearchSelect
                    value={mappings[key].dept}
                    onChange={(val: string) => handleMappingChange(key, 'dept', val)}
                    options={masterDepartments}
                    placeholder={t('cc.mapDeptPh')}
                    topChoice={deptTopChoice?.code ? deptTopChoice : null}
                    suggestedValue={suggestion?.dept ?? null}
                    hasError={!mappings[key].dept}
                  />
                </div>
                <div className="pm-cell" data-label={t('cc.mapAccCode')}>
                  <CustomSearchSelect
                    value={mappings[key].acc}
                    onChange={(val: string) => handleMappingChange(key, 'acc', val)}
                    options={acctOptions}
                    notice={acctNotice}
                    placeholder={t('cc.mapAccPh')}
                    topChoice={accTopChoice?.code ? accTopChoice : null}
                    suggestedValue={suggestion?.acc ?? null}
                    hasError={
                      !mappings[key].acc ||
                      !isAccountAllowed(mappings[key].dept, mappings[key].acc, masterDepartments)
                    }
                  />
                </div>
                <div className="cc-suggestion-buttons">
                  {hasSuggestionButtons && (
                    <>
                      <button
                        type="button"
                        onClick={() => confirmMainSuggestion(key)}
                        title={t('cc.mapAccept')}
                        className="cc-btn-accept"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectMainSuggestion(key)}
                        title={t('cc.mapReject')}
                        className="cc-btn-reject"
                      >
                        <X size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
