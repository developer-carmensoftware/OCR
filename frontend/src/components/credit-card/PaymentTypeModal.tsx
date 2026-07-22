import { useState } from 'react'
import ReactDOM from 'react-dom'
import {
  FileText,
  AlertCircle,
  AlertTriangle,
  Check,
  X,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import CustomSearchSelect from '../common/CustomSearchSelect'
import AISuggestBar from '../common/AISuggestBar'
import { allowedAccountsForDept, isAccountAllowed } from '../../lib/deptAccounts'
import '../../styles/components/payment-modal.css'
import type { FieldMapping } from '../../types/api'
import type { MasterAccount, MasterDepartment } from '../../hooks/mapping/useMappingData'
import type { ActiveScan } from '../../hooks/mapping/useMapping'
import type { Suggestion } from '../../hooks/mapping/useMappingSuggestions'

interface Props {
  isAmountModalOpen: boolean
  activeScan: ActiveScan
  amountMappedCount: number
  allPaymentTypes: string[]
  paymentSuggestions: Record<string, Suggestion | null>
  paymentSuggestLoading: boolean
  autoSuggestPaymentTypes: () => void
  masterAccounts: MasterAccount[]
  masterDepartments: MasterDepartment[]
  loadingOpts: boolean
  paymentAmount: Record<string, FieldMapping>
  handlePaymentMappingChange: (type: string, field: keyof FieldMapping, value: string) => void
  confirmPaymentSuggestion: (type: string) => void
  rejectPaymentSuggestion: (type: string) => void
  customPaymentTypes: string[]
  handleRemoveCustomType: (type: string) => void
  saveAmountSelection: () => void
  cancelAmountSelection: () => void
  setAcceptAllModal: (v: boolean) => void
}

export default function PaymentTypeModal({
  isAmountModalOpen,
  activeScan,
  amountMappedCount,
  allPaymentTypes,
  paymentSuggestions,
  paymentSuggestLoading,
  autoSuggestPaymentTypes,
  masterAccounts,
  masterDepartments,
  loadingOpts,
  paymentAmount,
  handlePaymentMappingChange,
  confirmPaymentSuggestion,
  rejectPaymentSuggestion,
  customPaymentTypes,
  handleRemoveCustomType,
  saveAmountSelection,
  cancelAmountSelection,
  setAcceptAllModal,
}: Props) {
  const [showAdditional, setShowAdditional] = useState(false)
  const [attemptedOk, setAttemptedOk] = useState(false)

  if (!isAmountModalOpen) return null

  const additionalTypes = allPaymentTypes.filter(t => !activeScan.paymentTypes.has(t))

  // Pairs the dept's DefaultAccount forbids — recomputed live so the banner
  // clears as the user fixes rows.
  const illegalTypes = allPaymentTypes.filter(type => {
    const m = paymentAmount[type]
    return m?.dept && m?.acc && !isAccountAllowed(m.dept, m.acc, masterDepartments)
  })

  const handleOk = () => {
    if (illegalTypes.length === 0) {
      setAttemptedOk(false)
      saveAmountSelection()
      return
    }
    setAttemptedOk(true)
    // The offending row may be inside the collapsed "additional mappings" —
    // expand and scroll to it so the error is visible, not just named.
    if (illegalTypes.some(t => additionalTypes.includes(t))) setShowAdditional(true)
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-pt="${CSS.escape(illegalTypes[0])}"]`)
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    })
  }

  return ReactDOM.createPortal(
    <div className="pm-overlay mapping-modal">
      <button
        type="button"
        className="pm-backdrop mapping-modal-overlay"
        aria-label="Close payment type modal"
        onClick={cancelAmountSelection}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
            e.preventDefault()
            cancelAmountSelection()
          }
        }}
      />
      <div className="pm-dialog mapping-modal-content" onClick={e => e.stopPropagation()}>
        <div className="pm-header mapping-modal-header">
          <div className="pm-header-top">
            <span>Map Payment Types</span>
            {activeScan.paymentTypes.size > 0 && (
              <span className="pm-required-badge">
                <FileText size={13} /> Required for this scan: {activeScan.paymentTypes.size} items
              </span>
            )}
          </div>
          <div className="pm-header-bottom">
            <AISuggestBar
              onSuggest={() => autoSuggestPaymentTypes()}
              onAcceptAll={() => setAcceptAllModal(true)}
              hasSuggestions={Object.values(paymentSuggestions).some(s => s)}
              loading={paymentSuggestLoading}
              disabled={loadingOpts}
            />
            <span className="pm-map-count">
              ({amountMappedCount}/{allPaymentTypes.length} mapped)
            </span>
          </div>
        </div>

        <div className="pm-body mapping-modal-body table-wrapper">
          <div className="pm-inner">
            {attemptedOk && illegalTypes.length > 0 && (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'flex-start',
                  padding: '0.6rem 0.8rem',
                  marginBottom: '0.5rem',
                  borderRadius: '6px',
                  background: 'var(--rose-light)',
                  border: '1px solid var(--rose)',
                  color: 'var(--rose)',
                  fontSize: '0.8rem',
                }}
              >
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Account not allowed for department</strong>
                  {illegalTypes.map(type => {
                    const m = paymentAmount[type]
                    return (
                      <div key={type}>
                        {type}: {m?.acc} is not in department {m?.dept}&apos;s allowed list
                        {additionalTypes.includes(type) ? ' (in additional mappings below)' : ''}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="pm-grid-header">
              <div>Payment Type</div>
              <div>Department Code</div>
              <div>Account Code</div>
              <div />
            </div>

            {activeScan.paymentTypes.size > 0 && (
              <>
                <div className="pm-section-label">
                  <AlertCircle size={13} /> Required for this scan
                </div>
                {[...activeScan.paymentTypes].map(type => {
                  const pAmt = paymentAmount[type] || { dept: '', acc: '' }
                  const suggestion = paymentSuggestions[type] ?? null
                  const isPending = !pAmt.dept || !pAmt.acc

                  const deptFromMaster = suggestion?.dept
                    ? masterDepartments.find(d => d.code === suggestion.dept)
                    : null
                  const deptTopChoice = suggestion?.dept
                    ? {
                        code: suggestion.dept,
                        name: deptFromMaster?.name || '(AI)',
                        name2: deptFromMaster?.name2,
                        source: suggestion.source,
                      }
                    : null
                  const acctOptions = allowedAccountsForDept(
                    pAmt.dept,
                    masterDepartments,
                    masterAccounts
                  )
                  const acctNotice =
                    acctOptions.length < masterAccounts.length
                      ? `${acctOptions.length} accounts allowed for ${pAmt.dept}`
                      : undefined

                  const accFromMaster = suggestion?.acc
                    ? masterAccounts.find(a => a.code === suggestion.acc)
                    : null
                  const accTopChoice = suggestion?.acc
                    ? {
                        code: suggestion.acc,
                        name: accFromMaster?.name || '(AI)',
                        name2: accFromMaster?.name2,
                        source: suggestion.source,
                      }
                    : null

                  return (
                    <div
                      key={`req-${type}`}
                      data-pt={type}
                      className={`pm-row ${isPending ? 'pm-row--required-pending' : 'pm-row--required-ok'}`}
                    >
                      <div className="pm-type-cell">
                        <div
                          className={`pm-type-badge ${isPending ? 'pm-type-badge--pending' : 'pm-type-badge--ok'}`}
                        >
                          {type}
                        </div>
                        {isPending && <AlertTriangle size={14} color="var(--rose)" />}
                      </div>
                      <CustomSearchSelect
                        value={pAmt.dept}
                        onChange={val => handlePaymentMappingChange(type, 'dept', val)}
                        options={masterDepartments}
                        placeholder="Dept..."
                        topChoice={deptTopChoice}
                        suggestedValue={suggestion?.dept ?? null}
                      />
                      <CustomSearchSelect
                        value={pAmt.acc}
                        onChange={val => handlePaymentMappingChange(type, 'acc', val)}
                        options={acctOptions}
                        notice={acctNotice}
                        placeholder="Acc..."
                        hasError={!isAccountAllowed(pAmt.dept, pAmt.acc, masterDepartments)}
                        topChoice={accTopChoice}
                        suggestedValue={suggestion?.acc ?? null}
                      />
                      {suggestion && (
                        <div className="pm-suggest-actions">
                          <button
                            type="button"
                            className="pm-accept-btn"
                            onClick={() => confirmPaymentSuggestion(type)}
                            title="Accept"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            type="button"
                            className="pm-reject-btn"
                            onClick={() => rejectPaymentSuggestion(type)}
                            title="Reject"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}

            {additionalTypes.length > 0 && (
              <>
                <button
                  type="button"
                  className="pm-additional-toggle"
                  onClick={() => setShowAdditional(p => !p)}
                >
                  {showAdditional ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {showAdditional ? 'Hide' : 'Show'} additional mappings
                  <span className="pm-additional-count">{additionalTypes.length}</span>
                </button>

                {showAdditional &&
                  additionalTypes.map(type => {
                    const pAmt = paymentAmount[type] || { dept: '', acc: '' }
                    const isCustom = customPaymentTypes.includes(type)
                    const suggestion = paymentSuggestions[type] ?? null

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
                      pAmt.dept,
                      masterDepartments,
                      masterAccounts
                    )
                    const acctNotice =
                      acctOptions.length < masterAccounts.length
                        ? `${acctOptions.length} accounts allowed for ${pAmt.dept}`
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
                      <div key={type} data-pt={type} className="pm-row pm-row--custom">
                        <div className="pm-type-cell">
                          <div className="pm-type-badge pm-type-badge--custom">{type}</div>
                          {isCustom && (
                            <button
                              type="button"
                              className="pm-remove-btn"
                              onClick={() => handleRemoveCustomType(type)}
                              title="Remove"
                            >
                              <XCircle size={16} />
                            </button>
                          )}
                        </div>
                        <CustomSearchSelect
                          value={pAmt.dept}
                          onChange={val => handlePaymentMappingChange(type, 'dept', val)}
                          options={masterDepartments}
                          placeholder="Dept..."
                          topChoice={deptTopChoice?.code ? deptTopChoice : null}
                          suggestedValue={suggestion?.dept ?? null}
                        />
                        <CustomSearchSelect
                          value={pAmt.acc}
                          onChange={val => handlePaymentMappingChange(type, 'acc', val)}
                          options={acctOptions}
                          notice={acctNotice}
                          placeholder="Acc..."
                          hasError={!isAccountAllowed(pAmt.dept, pAmt.acc, masterDepartments)}
                          topChoice={accTopChoice?.code ? accTopChoice : null}
                          suggestedValue={suggestion?.acc ?? null}
                        />
                        {suggestion && (
                          <div className="pm-suggest-actions">
                            <button
                              type="button"
                              className="pm-accept-btn"
                              onClick={() => confirmPaymentSuggestion(type)}
                              title="Accept"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              type="button"
                              className="pm-reject-btn"
                              onClick={() => rejectPaymentSuggestion(type)}
                              title="Reject"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
              </>
            )}
          </div>
        </div>

        <div className="pm-footer mapping-modal-footer">
          <button type="button" className="btn-cancel" onClick={cancelAmountSelection}>
            Cancel
          </button>
          <button type="button" className="btn-confirm" onClick={handleOk}>
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
