import React from 'react'
import { Loader2, AlertTriangle, CheckCircle2, Info, Check, X, History } from 'lucide-react'
import CustomSearchSelect from '../common/CustomSearchSelect'
import { allowedAccountsForDept, isAccountAllowed } from '../../lib/deptAccounts'
import AISuggestBar from '../common/AISuggestBar'
import Badge from '../common/Badge'
import type { FieldMapping } from '../../types/api'
import type { MasterAccount, MasterDepartment } from '../../hooks/mapping/useMappingData'
import type { MainMappings, ActiveScan } from '../../hooks/mapping/useMapping'
import type {
  MainMappingKey,
  Suggestion,
  SuggestionSource,
} from '../../hooks/mapping/useMappingSuggestions'

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
  activeScan: ActiveScan
  requiredMissingCount: number
  openAmountModal: () => void
}

const LABEL_MAP: Record<MainMappingKey, string> = {
  commission: 'Credit card commission',
  tax: 'Input Tax',
  net: 'Bank Account',
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
  activeScan,
  requiredMissingCount,
  openAmountModal,
}: Props) {
  return (
    <div className="section">
      <div className="section-title cc-section-title-container">
        <div className="cc-flex-center-gap">
          <span>
            ACCOUNT CODE MAPPING{' '}
            {loadingOpts && (
              <span className="cc-loading-text-primary">
                <Loader2 size={13} className="animate-spin" /> Loading account codes...
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
          <div />
          <div />
          <div className="mapping-header">
            Department Code
            <span
              className="gl-help-tip"
              title="Department code from Carmen Cloud — e.g. ACC, SALE, MKT"
            >
              ?
            </span>
          </div>
          <div className="mapping-header">
            Account Code
            <span
              className="gl-help-tip"
              title="Account code from Carmen Cloud — e.g. 1101-01, 5100-00"
            >
              ?
            </span>
          </div>
          <div />

          {/* Credit row — Account Receivable */}
          <div className="mapping-type type-credit cc-mapping-type-credit">Credit</div>
          <button
            type="button"
            className="mapping-label clickable cc-mapping-label-clickable"
            onClick={openAmountModal}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openAmountModal()
              }
            }}
          >
            Account Receivable (Click to Map)
          </button>
          <div className="cc-grid-span-3">
            <div
              id="amountMappingStatus"
              className={`cc-mapping-status ${requiredMissingCount > 0 ? 'missing' : 'ready'}`}
            >
              {activeScan.paymentTypes.size === 0 ? (
                <>
                  <Info size={14} className="cc-flex-shrink-0" />
                  <span>
                    Click <strong>Account Receivable</strong> to open mapping modal
                  </span>
                </>
              ) : requiredMissingCount > 0 ? (
                <>
                  <AlertTriangle size={14} color="var(--rose)" className="cc-flex-shrink-0" />
                  <span>
                    Found <strong>{activeScan.paymentTypes.size}</strong> items in document
                  </span>
                  <span className="cc-bullet-divider-missing">·</span>
                  <span>
                    <strong>{requiredMissingCount}</strong> pending mapping
                  </span>
                  <Badge variant="error" className="cc-required-badge">
                    Required for this scan
                  </Badge>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} className="cc-flex-shrink-0" />
                  <span>
                    All <strong>{activeScan.paymentTypes.size}</strong> items mapped
                  </span>
                  <span className="cc-ready-subtext">Ready for JV</span>
                </>
              )}
            </div>
          </div>

          {/* Debit rows — commission, tax, net */}
          {(['commission', 'tax', 'net'] as MainMappingKey[]).map(key => {
            const meta = suggestionMeta[key]
            const badge = meta === 'history' ? { label: 'History' } : null
            const hasSuggestionButtons = meta === 'ai' || meta === 'history'
            const suggestion = mainSuggestions[key] ?? null

            const deptFromMaster = suggestion?.dept
              ? masterDepartments.find(d => d.code === suggestion.dept)
              : null
            const deptTopChoice = suggestion?.dept
              ? {
                  code: suggestion.dept,
                  name: deptFromMaster?.name || '(AI/History code)',
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
                ? `${acctOptions.length} accounts allowed for ${mappings[key].dept}`
                : undefined

            const accFromMaster = suggestion?.acc
              ? masterAccounts.find(a => a.code === suggestion.acc)
              : null
            const accTopChoice = suggestion?.acc
              ? {
                  code: suggestion.acc,
                  name: accFromMaster?.name || '(AI/History code)',
                  name2: accFromMaster?.name2,
                  source: suggestion.source,
                }
              : null

            return (
              <React.Fragment key={key}>
                <div className="mapping-type type-debit cc-mapping-type-debit">Debit</div>
                <div className="mapping-label cc-label-flex-container">
                  <span>{LABEL_MAP[key]}</span>
                  {badge && (
                    <span className="cc-history-badge">
                      <History size={11} /> {badge.label}
                    </span>
                  )}
                </div>
                <div>
                  <CustomSearchSelect
                    value={mappings[key].dept}
                    onChange={(val: string) => handleMappingChange(key, 'dept', val)}
                    options={masterDepartments}
                    placeholder="Type Dept. Code..."
                    topChoice={deptTopChoice?.code ? deptTopChoice : null}
                    suggestedValue={suggestion?.dept ?? null}
                    hasError={!mappings[key].dept}
                  />
                </div>
                <div>
                  <CustomSearchSelect
                    value={mappings[key].acc}
                    onChange={(val: string) => handleMappingChange(key, 'acc', val)}
                    options={acctOptions}
                    notice={acctNotice}
                    placeholder="Type Account Code..."
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
                        title="Accept suggestion"
                        className="cc-btn-accept"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectMainSuggestion(key)}
                        title="Reject and clear"
                        className="cc-btn-reject"
                      >
                        <X size={13} />
                      </button>
                    </>
                  )}
                </div>
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}
