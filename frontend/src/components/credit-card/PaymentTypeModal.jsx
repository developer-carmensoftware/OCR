import React from 'react';
import ReactDOM from 'react-dom';
import { FileText, AlertCircle, AlertTriangle, Check, X, XCircle, Plus } from 'lucide-react';
import CustomSearchSelect from '../common/CustomSearchSelect';
import AISuggestBar from '../common/AISuggestBar';

export default function PaymentTypeModal({
  isAmountModalOpen, setIsAmountModalOpen,
  activeScan, amountMappedCount, allPaymentTypes,
  paymentSuggestions, paymentSuggestLoading, autoSuggestPaymentTypes,
  masterAccounts, masterDepartments, loadingOpts,
  paymentAmount, handlePaymentMappingChange,
  confirmPaymentSuggestion, rejectPaymentSuggestion,
  customPaymentTypes, newCustomType, setNewCustomType, handleAddCustomType, handleRemoveCustomType,
  saveAmountSelection, setPaymentSuggestions, setAcceptAllModal
}) {
  if (!isAmountModalOpen) return null;

  return ReactDOM.createPortal(
    <div className="mapping-modal" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setPaymentSuggestions({}); setIsAmountModalOpen(false); }}>
      <div className="mapping-modal-overlay" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}></div>
      <div className="mapping-modal-content" style={{ position: 'relative', zIndex: 1, background: 'var(--data-card-bg, #fff)', width: '90%', maxWidth: '800px', borderRadius: '8px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="mapping-modal-header" style={{ padding: '1rem', borderBottom: '1px solid var(--border)', fontWeight: 'bold', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--gray-50)', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'space-between' }}>
            <span>เลือก Payment Types สำหรับ Account Receivable</span>
            {activeScan.paymentTypes.size > 0 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--btn-err-text, #dc2626)', background: 'var(--btn-err-bg, #fff)', padding: '4px 12px', borderRadius: '20px', border: '1px solid var(--btn-err-border, #fca5a5)', fontWeight: 700 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><FileText size={13} /> เอกสารชุดนี้ต้องมี: {activeScan.paymentTypes.size} รายการ</span>
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
            <AISuggestBar
              onSuggest={() => autoSuggestPaymentTypes()}
              onAcceptAll={() => setAcceptAllModal(true)}
              hasSuggestions={Object.values(paymentSuggestions).some(s => s)}
              loading={paymentSuggestLoading}
              disabled={loadingOpts}
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-3)', fontWeight: 500 }}>
              ({amountMappedCount}/{allPaymentTypes.length} mapped)
            </span>
          </div>
        </div>
        <div className="mapping-modal-body table-wrapper" style={{ padding: '1rem', overflowY: 'auto' }}>
          <div style={{ minWidth: '700px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 1fr 1fr auto', gap: '1rem', fontWeight: 'bold', marginBottom: '1rem', paddingRight: '0.5rem' }}>
            <div>Payment Type</div>
            <div>Department Code</div>
            <div>Account Code</div>
            <div></div>
          </div>
          {/* ── Required for Scan ── */}
          {activeScan.paymentTypes.size > 0 && (
            <>
              <div style={{ padding: '0.5rem', background: 'var(--btn-err-bg, #fef2f2)', color: 'var(--btn-err-text, #991b1b)', fontSize: '0.75rem', fontWeight: 700, borderRadius: '4px', marginBottom: '0.75rem', border: '1px solid var(--btn-err-border, #fecaca)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={13} /> รายการที่พบในเอกสารปัจจุบัน (Required for this scan)
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
                  <div key={`req-${type}`} style={{
                    display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 1fr 1fr auto', gap: '1rem', marginBottom: '0.5rem', alignItems: 'center', padding: '0.4rem', borderRadius: '8px',
                    background: isPending ? 'var(--btn-err-bg, #fff1f2)' : 'var(--btn-ok-bg, #f0fdf4)', border: `1px solid ${isPending ? 'var(--btn-err-border, #fecaca)' : 'var(--btn-ok-border, #bbf7d0)'}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ background: isPending ? 'var(--rose)' : 'var(--emerald)', color: '#fff', padding: '0.4rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center', flex: 1 }}>{type}</div>
                      {isPending && <AlertTriangle size={14} color="#dc2626" />}
                    </div>
                    <CustomSearchSelect value={pAmt.dept} onChange={(val) => handlePaymentMappingChange(type, 'dept', val)} options={masterDepartments} placeholder="Dept..." topChoice={deptTopChoice} suggestedValue={suggestion?.dept || null} />
                    <CustomSearchSelect value={pAmt.acc} onChange={(val) => handlePaymentMappingChange(type, 'acc', val)} options={masterAccounts} placeholder="Acc..." topChoice={accTopChoice} suggestedValue={suggestion?.acc || null} />
                    {suggestion && (
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button
                          onClick={() => confirmPaymentSuggestion(type)}
                          title="ยอมรับค่าแนะนำ"
                          style={{ padding: '4px 10px', background: 'var(--btn-ok-bg, #f0fdf4)', color: 'var(--btn-ok-text, #15803d)', border: '1px solid var(--btn-ok-border, #86efac)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => rejectPaymentSuggestion(type)}
                          title="ปฏิเสธค่าแนะนำและล้างข้อมูล"
                          style={{ padding: '4px 10px', background: 'var(--btn-err-bg, #fff1f2)', color: 'var(--btn-err-text, #dc2626)', border: '1px solid var(--btn-err-border, #fecaca)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {customPaymentTypes.filter(t => !activeScan.paymentTypes.has(t)).length > 0 && (
                <div style={{ margin: '1.5rem 0 1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-400)' }}>
                  Custom Types (เพิ่มเอง)
                </div>
              )}
            </>
          )}

          {allPaymentTypes
            .filter(t => !activeScan.paymentTypes.has(t))
            .map(type => {
              const pAmt = paymentAmount[type] || { dept: '', acc: '' };
              const isCustom = !activeScan.paymentTypes.has(type);
              const suggestion = paymentSuggestions[type] || null;

              const deptFromMaster = suggestion?.dept ? masterDepartments.find(d => d.code === suggestion.dept) : null;
              const deptTopChoice = suggestion?.dept
                ? {
                  code: suggestion.dept,
                  name: deptFromMaster?.name || '(รหัสจาก AI/ประวัติ)',
                  name2: deptFromMaster?.name2,
                  source: suggestion.source
                }
                : null;

              const accFromMaster = suggestion?.acc ? masterAccounts.find(a => a.code === suggestion.acc) : null;
              const accTopChoice = suggestion?.acc
                ? {
                  code: suggestion.acc,
                  name: accFromMaster?.name || '(รหัสจาก AI/ประวัติ)',
                  name2: accFromMaster?.name2,
                  source: suggestion.source
                }
                : null;

              return (
                <div key={type} style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(120px, 1fr) 1fr 1fr auto',
                  gap: '1rem',
                  marginBottom: '0.5rem',
                  alignItems: 'center',
                  padding: '0.4rem',
                  borderRadius: '8px',
                  background: 'transparent',
                  border: '1px solid transparent',
                  transition: 'all 0.2s'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{
                      background: isCustom ? 'var(--btn-ok-bg, #f0fdf4)' : 'var(--primary-light)',
                      color: isCustom ? 'var(--btn-ok-text, #16a34a)' : 'var(--primary)',
                      padding: '0.4rem 0.5rem',
                      borderRadius: '4px',
                      border: `1px solid ${isCustom ? 'var(--btn-ok-border, #86efac)' : 'var(--primary-mid)'}`,
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      textAlign: 'center',
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}>
                      {type}
                    </div>
                    {isCustom && (
                      <button onClick={() => handleRemoveCustomType(type)} title="ลบ" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.9rem', padding: '0.2rem', lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>
                        <XCircle size={16} />
                      </button>
                    )}
                  </div>
                  <CustomSearchSelect
                    value={pAmt.dept}
                    onChange={(val) => handlePaymentMappingChange(type, 'dept', val)}
                    options={masterDepartments}
                    placeholder="Dept..."
                    topChoice={deptTopChoice?.code ? deptTopChoice : null}
                    suggestedValue={suggestion?.dept || null}
                  />
                  <CustomSearchSelect
                    value={pAmt.acc}
                    onChange={(val) => handlePaymentMappingChange(type, 'acc', val)}
                    options={masterAccounts}
                    placeholder="Acc..."
                    topChoice={accTopChoice?.code ? accTopChoice : null}
                    suggestedValue={suggestion?.acc || null}
                  />
                  {suggestion && (
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button
                        onClick={() => confirmPaymentSuggestion(type)}
                        title="ยอมรับค่าแนะนำ"
                        style={{ padding: '4px 10px', background: 'var(--btn-ok-bg, #f0fdf4)', color: 'var(--btn-ok-text, #15803d)', border: '1px solid var(--btn-ok-border, #86efac)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
                      >
                        <Check size={13} />
                      </button>
                      <button
                        onClick={() => rejectPaymentSuggestion(type)}
                        title="ปฏิเสธค่าแนะนำและล้างข้อมูล"
                        style={{ padding: '4px 10px', background: 'var(--btn-err-bg, #fff1f2)', color: 'var(--btn-err-text, #dc2626)', border: '1px solid var(--btn-err-border, #fecaca)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 1fr 1fr auto', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--border)', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                type="text"
                value={newCustomType}
                onChange={(e) => setNewCustomType(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomType()}
                placeholder="Custom type..."
                style={{ flex: 1, padding: '0.4rem 0.5rem', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.85rem', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', outline: 'none' }}
              />
              <button onClick={handleAddCustomType} title="เพิ่ม" style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.4rem 0.7rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Plus size={13} /> Add
              </button>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-4)', gridColumn: 'span 2' }}>เพิ่ม Payment Type ที่กำหนดเอง</div>
          </div>
          </div>
        </div>
        <div className="mapping-modal-footer" style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button className="btn-cancel" onClick={() => { setPaymentSuggestions({}); setIsAmountModalOpen(false); }} style={{ padding: '0.5rem 1rem', background: 'var(--gray-200)', color: 'var(--text-2)', borderRadius: '4px', cursor: 'pointer', border: 'none' }}>ยกเลิก</button>
          <button className="btn-confirm" onClick={saveAmountSelection} style={{ padding: '0.5rem 1rem', background: 'var(--primary)', color: '#fff', borderRadius: '4px', cursor: 'pointer', border: 'none' }}>ตกลง</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
