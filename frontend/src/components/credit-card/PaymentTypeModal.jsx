import { useState } from 'react';
import ReactDOM from 'react-dom';
import { FileText, AlertCircle, AlertTriangle, Check, X, XCircle, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import CustomSearchSelect from '../common/CustomSearchSelect';
import AISuggestBar from '../common/AISuggestBar';
import '../../styles/components/payment-modal.css';

export default function PaymentTypeModal({
  isAmountModalOpen,
  activeScan, amountMappedCount, allPaymentTypes,
  paymentSuggestions, paymentSuggestLoading, autoSuggestPaymentTypes,
  masterAccounts, masterDepartments, loadingOpts,
  paymentAmount, handlePaymentMappingChange,
  confirmPaymentSuggestion, rejectPaymentSuggestion,
  customPaymentTypes, newCustomType, setNewCustomType, handleAddCustomType, handleRemoveCustomType,
  saveAmountSelection, cancelAmountSelection, setAcceptAllModal
}) {
  const [showAdditional, setShowAdditional] = useState(false)

  if (!isAmountModalOpen) return null;

  // Types not in the current scan (loaded from DB or manually added in a previous session)
  const additionalTypes = allPaymentTypes.filter(t => !activeScan.paymentTypes.has(t))

  return ReactDOM.createPortal(
    <div className="pm-overlay mapping-modal" onClick={cancelAmountSelection}>
      <div className="pm-backdrop mapping-modal-overlay" />
      <div className="pm-dialog mapping-modal-content" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="pm-header mapping-modal-header">
          <div className="pm-header-top">
            <span>Select Payment Types for Account Receivable</span>
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

        {/* ── Body ── */}
        <div className="pm-body mapping-modal-body table-wrapper">
          <div className="pm-inner">
            <div className="pm-grid-header">
              <div>Payment Type</div>
              <div>Department Code</div>
              <div>Account Code</div>
              <div />
            </div>

            {/* Required for scan */}
            {activeScan.paymentTypes.size > 0 && (
              <>
                <div className="pm-section-label">
                  <AlertCircle size={13} /> Required for this scan
                </div>
                {[...activeScan.paymentTypes].map(type => {
                  const pAmt = paymentAmount[type] || { dept: '', acc: '' };
                  const suggestion = paymentSuggestions[type] || null;
                  const isPending = !pAmt.dept || !pAmt.acc;

                  const deptFromMaster = suggestion?.dept ? masterDepartments.find(d => d.code === suggestion.dept) : null;
                  const deptTopChoice = suggestion?.dept ? { code: suggestion.dept, name: deptFromMaster?.name || '(AI)', name2: deptFromMaster?.name2, source: suggestion.source } : null;
                  const accFromMaster = suggestion?.acc ? masterAccounts.find(a => a.code === suggestion.acc) : null;
                  const accTopChoice = suggestion?.acc ? { code: suggestion.acc, name: accFromMaster?.name || '(AI)', name2: accFromMaster?.name2, source: suggestion.source } : null;

                  return (
                    <div key={`req-${type}`} className={`pm-row ${isPending ? 'pm-row--required-pending' : 'pm-row--required-ok'}`}>
                      <div className="pm-type-cell">
                        <div className={`pm-type-badge ${isPending ? 'pm-type-badge--pending' : 'pm-type-badge--ok'}`}>{type}</div>
                        {isPending && <AlertTriangle size={14} color="#dc2626" />}
                      </div>
                      <CustomSearchSelect value={pAmt.dept} onChange={(val) => handlePaymentMappingChange(type, 'dept', val)} options={masterDepartments} placeholder="Dept..." topChoice={deptTopChoice} suggestedValue={suggestion?.dept || null} />
                      <CustomSearchSelect value={pAmt.acc} onChange={(val) => handlePaymentMappingChange(type, 'acc', val)} options={masterAccounts} placeholder="Acc..." topChoice={accTopChoice} suggestedValue={suggestion?.acc || null} />
                      {suggestion && (
                        <div className="pm-suggest-actions">
                          <button className="pm-accept-btn" onClick={() => confirmPaymentSuggestion(type)} title="Accept suggestion"><Check size={13} /></button>
                          <button className="pm-reject-btn" onClick={() => rejectPaymentSuggestion(type)} title="Reject and clear"><X size={13} /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* Additional mappings (previously saved / user-added) — collapsible */}
            {additionalTypes.length > 0 && (
              <>
                <button
                  className="pm-additional-toggle"
                  onClick={() => setShowAdditional(p => !p)}
                >
                  {showAdditional ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {showAdditional ? 'Hide' : 'Show'} additional mappings
                  <span className="pm-additional-count">{additionalTypes.length}</span>
                </button>

                {showAdditional && additionalTypes.map(type => {
                  const pAmt = paymentAmount[type] || { dept: '', acc: '' };
                  const isCustom = customPaymentTypes.includes(type);
                  const suggestion = paymentSuggestions[type] || null;

                  const deptFromMaster = suggestion?.dept ? masterDepartments.find(d => d.code === suggestion.dept) : null;
                  const deptTopChoice = suggestion?.dept
                    ? { code: suggestion.dept, name: deptFromMaster?.name || '(AI/History code)', name2: deptFromMaster?.name2, source: suggestion.source }
                    : null;
                  const accFromMaster = suggestion?.acc ? masterAccounts.find(a => a.code === suggestion.acc) : null;
                  const accTopChoice = suggestion?.acc
                    ? { code: suggestion.acc, name: accFromMaster?.name || '(AI/History code)', name2: accFromMaster?.name2, source: suggestion.source }
                    : null;

                  return (
                    <div key={type} className="pm-row pm-row--custom">
                      <div className="pm-type-cell">
                        <div className="pm-type-badge pm-type-badge--custom">{type}</div>
                        {isCustom && (
                          <button className="pm-remove-btn" onClick={() => handleRemoveCustomType(type)} title="Remove">
                            <XCircle size={16} />
                          </button>
                        )}
                      </div>
                      <CustomSearchSelect value={pAmt.dept} onChange={(val) => handlePaymentMappingChange(type, 'dept', val)} options={masterDepartments} placeholder="Dept..." topChoice={deptTopChoice?.code ? deptTopChoice : null} suggestedValue={suggestion?.dept || null} />
                      <CustomSearchSelect value={pAmt.acc} onChange={(val) => handlePaymentMappingChange(type, 'acc', val)} options={masterAccounts} placeholder="Acc..." topChoice={accTopChoice?.code ? accTopChoice : null} suggestedValue={suggestion?.acc || null} />
                      {suggestion && (
                        <div className="pm-suggest-actions">
                          <button className="pm-accept-btn" onClick={() => confirmPaymentSuggestion(type)} title="Accept suggestion"><Check size={13} /></button>
                          <button className="pm-reject-btn" onClick={() => rejectPaymentSuggestion(type)} title="Reject and clear"><X size={13} /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* Add custom type row */}
            <div className="pm-add-row">
              <div className="pm-add-input-wrap">
                <input
                  type="text"
                  className="pm-add-input"
                  value={newCustomType}
                  onChange={(e) => setNewCustomType(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomType()}
                  placeholder="Custom type..."
                />
                <button className="pm-add-btn" onClick={handleAddCustomType} title="Add">
                  <Plus size={13} /> Add
                </button>
              </div>
              <div className="pm-add-hint">Add custom Payment Type</div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="pm-footer mapping-modal-footer">
          <button className="btn-cancel" onClick={cancelAmountSelection}>Cancel</button>
          <button className="btn-confirm" onClick={saveAmountSelection}>OK</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
