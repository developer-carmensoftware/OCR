import React from 'react'
import { Loader2, AlertTriangle, CheckCircle2, Info, Check, X, History } from 'lucide-react'
import CustomSearchSelect from '../common/CustomSearchSelect'
import AISuggestBar from '../common/AISuggestBar'
import type { FieldMapping } from '../../types/api'
import type { MasterAccount, MasterDepartment } from '../../hooks/mapping/useMappingData'
import type { MainMappings, ActiveScan } from '../../hooks/useMapping'
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
  amountMappedCount: number
  requiredMissingCount: number
  openAmountModal: () => void
  allPaymentTypes: string[]
}

const LABEL_MAP: Record<MainMappingKey, string> = {
  commission: 'Credit card commission',
  tax: 'Input Tax',
  net: 'Bank Account',
}

export default function AccountMappingTable({
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
  amountMappedCount: _amountMappedCount,
  requiredMissingCount,
  openAmountModal,
  allPaymentTypes: _allPaymentTypes,
}: Props) {
  return (
    <div className="section">
      <div
        className="section-title"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>
            ACCOUNT CODE MAPPING{' '}
            {loadingOpts && (
              <span
                style={{
                  marginLeft: '10px',
                  fontSize: '0.8rem',
                  color: 'var(--primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
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

      <div className="table-wrapper" style={{ paddingBottom: '0' }}>
        <div
          className="mapping-container"
          style={{
            display: 'grid',
            gridTemplateColumns: '70px 140px minmax(0, 1fr) minmax(0, 1fr) auto',
            gap: '0.5rem',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <div />
          <div />
          <div className="mapping-header" style={{ fontWeight: 600 }}>
            Department Code
          </div>
          <div className="mapping-header" style={{ fontWeight: 600 }}>
            Account Code
          </div>
          <div />

          {/* Credit row — Account Receivable */}
          <div
            className="mapping-type type-credit"
            style={{
              color: 'var(--primary)',
              background: 'var(--primary-light)',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              textAlign: 'center',
              fontWeight: 'bold',
            }}
          >
            Credit
          </div>
          <div
            className="mapping-label clickable"
            style={{ cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline' }}
            onClick={openAmountModal}
          >
            Account Receivable (Click to Map)
          </div>
          <div style={{ gridColumn: 'span 3' }}>
            <div
              id="amountMappingStatus"
              style={{
                fontSize: '0.85rem',
                padding: '0.6rem 1rem',
                borderRadius: '8px',
                border: '1px solid',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.5rem',
                color: requiredMissingCount > 0 ? '#dc2626' : 'var(--teal)',
                background:
                  requiredMissingCount > 0 ? 'var(--btn-err-bg, #fff1f2)' : 'var(--teal-light)',
                borderColor: requiredMissingCount > 0 ? '#fca5a5' : 'var(--teal)',
              }}
            >
              {activeScan.paymentTypes.size === 0 ? (
                <>
                  <Info size={14} style={{ flexShrink: 0 }} />
                  <span>
                    Click <strong>Account Receivable</strong> to open mapping modal
                  </span>
                </>
              ) : requiredMissingCount > 0 ? (
                <>
                  <AlertTriangle size={14} color="#dc2626" style={{ flexShrink: 0 }} />
                  <span>
                    Found <strong>{activeScan.paymentTypes.size}</strong> items in document
                  </span>
                  <span style={{ color: '#fca5a5' }}>·</span>
                  <span>
                    <strong>{requiredMissingCount}</strong> pending mapping
                  </span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: '0.72rem',
                      background: 'var(--rose)',
                      color: 'white',
                      padding: '2px 10px',
                      borderRadius: '10px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    Required for this scan
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                  <span>
                    All <strong>{activeScan.paymentTypes.size}</strong> items mapped
                  </span>
                  <span style={{ fontSize: '0.78rem', opacity: 0.75 }}>Ready for JV</span>
                </>
              )}
            </div>
          </div>

          {/* Debit rows — commission, tax, net */}
          {(['commission', 'tax', 'net'] as MainMappingKey[]).map(key => {
            const meta = suggestionMeta[key]
            const badge =
              meta === 'history'
                ? { label: 'History', bg: '#f0fdf4', color: '#16a34a', border: '#86efac' }
                : null
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
                <div
                  className="mapping-type type-debit"
                  style={{
                    color: '#d97706',
                    background: 'var(--ap-include-bg, #fef3c7)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                  }}
                >
                  Debit
                </div>
                <div
                  className="mapping-label"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <span>{LABEL_MAP[key]}</span>
                  {badge && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: badge.color,
                        background: badge.bg,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        border: `1px solid ${badge.border}`,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
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
                  />
                </div>
                <div>
                  <CustomSearchSelect
                    value={mappings[key].acc}
                    onChange={(val: string) => handleMappingChange(key, 'acc', val)}
                    options={masterAccounts}
                    placeholder="Type Account Code..."
                    topChoice={accTopChoice?.code ? accTopChoice : null}
                    suggestedValue={suggestion?.acc ?? null}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {hasSuggestionButtons && (
                    <>
                      <button
                        type="button"
                        onClick={() => confirmMainSuggestion(key)}
                        title="Accept suggestion"
                        style={{
                          padding: '4px 10px',
                          background: '#f0fdf4',
                          color: '#15803d',
                          border: '1px solid #86efac',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontWeight: 600,
                        }}
                      >
                        <Check size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectMainSuggestion(key)}
                        title="Reject and clear"
                        style={{
                          padding: '4px 10px',
                          background: 'var(--btn-err-bg, #fff1f2)',
                          color: 'var(--btn-err-text, #dc2626)',
                          border: '1px solid var(--btn-err-border, #fecaca)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontWeight: 600,
                        }}
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
