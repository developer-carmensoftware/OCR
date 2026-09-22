import { useState } from 'react'
import ReactDOM from 'react-dom'
import { FileText, AlertCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import AISuggestBar from '../common/AISuggestBar'
import MappingRow from '../common/MappingRow'
import { useT } from '../../i18n/LanguageContext'
import '../../styles/components/mapping-row.css'
import { isAccountAllowed } from '../../lib/deptAccounts'
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
  const { t } = useT()
  const [showAdditional, setShowAdditional] = useState(false)
  const [attemptedOk, setAttemptedOk] = useState(false)

  if (!isAmountModalOpen) return null

  const additionalTypes = allPaymentTypes.filter(pt => !activeScan.paymentTypes.has(pt))

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
    if (illegalTypes.some(pt => additionalTypes.includes(pt))) setShowAdditional(true)
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-pt="${CSS.escape(illegalTypes[0])}"]`)
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    })
  }

  return ReactDOM.createPortal(
    <div className="pm-overlay">
      <button
        type="button"
        className="pm-backdrop"
        aria-label={t('cc.ptClose')}
        onClick={cancelAmountSelection}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
            e.preventDefault()
            cancelAmountSelection()
          }
        }}
      />
      <div className="pm-dialog" onClick={e => e.stopPropagation()}>
        <div className="pm-header">
          <div className="pm-header-top">
            <span>{t('cc.ptTitle')}</span>
            {activeScan.paymentTypes.size > 0 && (
              <span className="pm-required-badge">
                <FileText size={13} />{' '}
                {t('cc.ptRequiredBadge', { n: activeScan.paymentTypes.size })}
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
              {t('cc.ptMappedCount', {
                mapped: amountMappedCount,
                total: allPaymentTypes.length,
              })}
            </span>
          </div>
        </div>

        <div className="pm-body table-wrapper">
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
                  <strong>{t('cc.ptIllegalTitle')}</strong>
                  {illegalTypes.map(type => {
                    const m = paymentAmount[type]
                    return (
                      <div key={type}>
                        {t('cc.ptIllegalRow', {
                          type,
                          acc: m?.acc ?? '',
                          dept: m?.dept ?? '',
                        })}
                        {additionalTypes.includes(type) ? t('cc.ptIllegalBelow') : ''}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="pm-grid-header">
              <div>{t('cc.ptColType')}</div>
              <div>{t('cc.mapDeptCode')}</div>
              <div>{t('cc.mapAccCode')}</div>
              <div />
            </div>

            {activeScan.paymentTypes.size > 0 && (
              <>
                <div className="pm-section-label">
                  <AlertCircle size={13} /> {t('cc.mapPtRequired')}
                </div>
                {[...activeScan.paymentTypes].map(type => {
                  const pAmt = paymentAmount[type] || { dept: '', acc: '' }
                  const isPending = !pAmt.dept || !pAmt.acc
                  return (
                    <MappingRow
                      key={`req-${type}`}
                      type={type}
                      variant={isPending ? 'pending' : 'ok'}
                      value={pAmt}
                      onChange={(field, val) => handlePaymentMappingChange(type, field, val)}
                      masterAccounts={masterAccounts}
                      masterDepartments={masterDepartments}
                      deptPlaceholder={t('cc.ptDeptPh')}
                      accPlaceholder={t('cc.ptAccPh')}
                      deptLabel={t('cc.mapDeptCode')}
                      accLabel={t('cc.mapAccCode')}
                      suggestion={paymentSuggestions[type] ?? null}
                      onAccept={() => confirmPaymentSuggestion(type)}
                      onReject={() => rejectPaymentSuggestion(type)}
                      fallbackName="(AI)"
                    />
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
                  {showAdditional ? t('cc.ptHideAdditional') : t('cc.ptShowAdditional')}
                  <span className="pm-additional-count">{additionalTypes.length}</span>
                </button>

                {showAdditional &&
                  additionalTypes.map(type => (
                    <MappingRow
                      key={type}
                      type={type}
                      variant="custom"
                      value={paymentAmount[type] || { dept: '', acc: '' }}
                      onChange={(field, val) => handlePaymentMappingChange(type, field, val)}
                      masterAccounts={masterAccounts}
                      masterDepartments={masterDepartments}
                      deptPlaceholder={t('cc.ptDeptPh')}
                      accPlaceholder={t('cc.ptAccPh')}
                      deptLabel={t('cc.mapDeptCode')}
                      accLabel={t('cc.mapAccCode')}
                      suggestion={paymentSuggestions[type] ?? null}
                      onAccept={() => confirmPaymentSuggestion(type)}
                      onReject={() => rejectPaymentSuggestion(type)}
                      trailing={
                        customPaymentTypes.includes(type) ? (
                          <button
                            type="button"
                            className="pm-remove-btn"
                            onClick={() => handleRemoveCustomType(type)}
                            title={t('cc.ptRemove')}
                          >
                            <XCircle size={16} />
                          </button>
                        ) : undefined
                      }
                    />
                  ))}
              </>
            )}
          </div>
        </div>

        <div className="pm-footer">
          <button type="button" className="btn btn-outline" onClick={cancelAmountSelection}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-confirm" onClick={handleOk}>
            {t('cc.ptOk')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
