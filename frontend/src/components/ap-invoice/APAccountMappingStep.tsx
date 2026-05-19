import type React from 'react'
import { Building, IdCard, GitBranch, FileText, Calendar, AlignLeft, Database, Check, X, ArrowLeft, AlertTriangle, Save } from 'lucide-react'
import { SkeletonRow } from '../common/Skeleton'
import CustomSearchSelect from '../common/CustomSearchSelect'
import AISuggestBar from '../common/AISuggestBar'
import type { APLineItem } from '../../hooks/ap/useAPExtraction'
import type { Vendor } from '../../hooks/ap/useAPVendor'
import type { APInvoiceHeader } from '../../constants/apInvoice'

interface GLAccount { code: string; name: string }

interface Props {
  t: Record<string, string>
  lineItems: APLineItem[]
  updateItem: (idx: number, key: string, val: string) => void
  systemVendor?: Partial<Vendor>
  headerData?: Partial<APInvoiceHeader>
  updateHeader: (key: string, val: string) => void
  masterAccounts?: GLAccount[]
  masterDepts?: GLAccount[]
  onBack: () => void
  onGenerate: () => void
  onAISuggest: () => void
  onAcceptAll: () => void
  hasSuggestions?: boolean
  suggestLoading?: boolean
  onConfirmSuggest: (idx: number) => void
  onRejectSuggest: (idx: number) => void
  allMapped?: boolean
  isDuplicate?: boolean
}

interface PillProps { icon: React.ReactNode; label: string; value: string; last?: boolean }
interface GLCardRow { label: string; value: string; colSpan?: boolean; highlight?: string }
interface GLCardProps { title: string; iconColor: string; rows: GLCardRow[] }

function fmtField(code?: string | null, desc?: string | null): string {
  if (code && desc) return `${code} — ${desc}`
  return code || desc || '—'
}

function VendorInfoPill({ icon, label, value, last = false }: PillProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.15rem', padding: '0.55rem 1rem', borderRight: last ? 'none' : '1px solid var(--ap-vendor-pill-border, #ddd6fe)', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', color: 'var(--ap-vendor-text-muted, #7c3aed)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {icon}{label}
      </div>
      <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--ap-vendor-text, #1e1b4b)' }}>{value}</div>
    </div>
  )
}

function GLAccountCard({ title, iconColor, rows }: GLCardProps) {
  const [firstRow, ...pairRows] = rows
  return (
    <div className="ap-account-card">
      <div className="ap-account-card-header">
        <div className={`ap-account-icon ${iconColor}`}><Database size={14} /></div>
        <div style={{ fontWeight: 700, fontSize: '0.87rem', color: 'var(--text)' }}>{title}</div>
      </div>
      <div className="ap-account-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem' }}>
          {firstRow && (
            <div>
              <div className="field-label" style={{ marginBottom: '0.3rem' }}>{firstRow.label}</div>
              <div className="ap-static-field">{firstRow.value}</div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            {pairRows.map(({ label, value, highlight }) => (
              <div key={label}>
                <div className="field-label" style={{ marginBottom: '0.3rem' }}>{label}</div>
                <div className="ap-static-field" style={highlight ? { color: highlight, fontWeight: 700 } : undefined}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function APAccountMappingStep({ t, lineItems, updateItem, systemVendor = {}, headerData = {}, updateHeader, masterAccounts = [], masterDepts = [], onBack, onGenerate, onAISuggest, onAcceptAll, hasSuggestions = false, suggestLoading = false, onConfirmSuggest, onRejectSuggest, allMapped = false }: Props) {
  const taxProfile = fmtField(systemVendor.taxProfileCode1, systemVendor.taxProfileDesc1)
  const debitDept  = fmtField(systemVendor.vat1DrDeptCode, systemVendor.vat1DrDeptDesc)
  const debitAcc   = fmtField(systemVendor.vat1DrAccCode, systemVendor.vat1DrAccDesc)
  const vendorGroup = fmtField(systemVendor.catCode, systemVendor.catDesc)
  const creditDept = fmtField(systemVendor.crDeptCode, systemVendor.crDeptDesc)
  const creditAcc  = fmtField(systemVendor.vatCrAccCode, systemVendor.vatCrAccDesc)
  const vendorDisplayName = systemVendor.name || headerData.vendorName || '—'
  const vendorCode = systemVendor.code || '—'
  const vendorTaxId = headerData.vendorTaxId || '—'
  const branchNo = systemVendor.branchNo != null ? String(systemVendor.branchNo) : headerData.vendorBranch || '—'
  const docNo   = headerData.documentNumber || '—'
  const docDate = headerData.documentDate || '—'

  return (
    <div style={{ maxWidth: 1080, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxSizing: 'border-box' }}>
      {/* Vendor info bar */}
      <div style={{ display: 'flex', alignItems: 'stretch', flexWrap: 'wrap', gap: '0', background: 'var(--ap-vendor-bg, #f5f3ff)', border: '1.5px solid var(--ap-vendor-border, #c4b5fd)', borderRadius: '12px', padding: '0', overflow: 'hidden', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 1.1rem', borderRight: '1.5px solid var(--ap-vendor-border, #c4b5fd)', flexShrink: 0, minWidth: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: '8px', background: 'var(--ap-vendor-icon-bg, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Building size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--ap-vendor-text, #3b0764)' }}>{vendorDisplayName}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--ap-vendor-text-muted, #7c3aed)', marginTop: '0.05rem', fontWeight: 600 }}>Code: {vendorCode}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch', flexWrap: 'wrap', gap: '0', flex: 1 }}>
          <VendorInfoPill icon={<IdCard size={10} />} label="Tax ID" value={vendorTaxId} />
          <VendorInfoPill icon={<GitBranch size={10} />} label="Branch No" value={branchNo} />
          <VendorInfoPill icon={<FileText size={10} />} label="Document No." value={docNo} />
          <VendorInfoPill icon={<Calendar size={10} />} label="Document Date" value={docDate} last />
        </div>
      </div>

      {/* Invoice description */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ap-vendor-text-muted, #7c3aed)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <AlignLeft size={13} style={{ marginRight: '0.35rem' }} /> Invoice Description
        </label>
        <input type="text" value={headerData.invhDesc || ''} onChange={e => updateHeader('invhDesc', e.target.value)} placeholder="Invoice description..." aria-label="Invoice Description" style={{ width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.85rem', fontSize: '0.88rem', border: '1.5px solid var(--ap-inv-desc-border, #c4b5fd)', borderRadius: '8px', background: 'var(--ap-inv-desc-bg, #faf5ff)', color: 'var(--ap-vendor-text, #1e1b4b)', outline: 'none' }}
          onFocus={e => { e.target.style.borderColor = 'var(--ap-vendor-icon-bg, #7c3aed)'; e.target.style.boxShadow = 'var(--ap-inv-desc-shadow, 0 0 0 3px #ede9fe)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--ap-inv-desc-border, #c4b5fd)'; e.target.style.boxShadow = 'none' }}
        />
      </div>

      {/* Fixed GL accounts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.25rem' }}>
        <GLAccountCard title={t.debitTax} iconColor="blue" rows={[{ label: t.taxProfile, value: taxProfile, colSpan: true }, { label: t.deptCode, value: debitDept }, { label: t.accountCode, value: debitAcc, highlight: 'var(--primary)' }]} />
        <GLAccountCard title={t.creditAp} iconColor="green" rows={[{ label: t.vendorGroup, value: vendorGroup, colSpan: true }, { label: t.deptCode, value: creditDept }, { label: t.accountCode, value: creditAcc, highlight: 'var(--emerald)' }]} />
      </div>

      {/* Expense line mapping */}
      <div className="data-card card-acct">
        <div className="card-title">
          <div className="card-title-left"><Database size={15} color="#7c3aed" />{t.debitExpense}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>{t.expenseDesc}</span>
            <AISuggestBar onSuggest={onAISuggest} onAcceptAll={onAcceptAll} hasSuggestions={hasSuggestions} loading={suggestLoading} />
          </div>
        </div>
        <div className="table-wrapper">
          <table className="ap-acct-table">
            <thead>
              <tr>
                <th scope="col" style={{ width: '40%' }}>{t.description}</th>
                <th scope="col" style={{ width: '26%' }}>{t.deptCode}</th>
                <th scope="col" style={{ width: '26%' }}>{t.accountCode}</th>
                {hasSuggestions && <th scope="col" style={{ width: '8%' }}></th>}
              </tr>
            </thead>
            <tbody>
              {masterAccounts.length === 0 && Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={hasSuggestions ? 4 : 3} />)}
              {masterAccounts.length > 0 && lineItems.map((item, ri) => {
                const hasSuggest = !!(item._suggestDept || item._suggestAcc)
                const missingDept = !item.deptCode
                const missingAcc  = !item.accountCode
                const hasError = missingDept || missingAcc
                const deptChoice = item._suggestDept ? { code: item._suggestDept, name: masterDepts.find(d => d.code === item._suggestDept)?.name || '', source: 'ai' } : null
                const accChoice  = item._suggestAcc  ? { code: item._suggestAcc,  name: masterAccounts.find(a => a.code === item._suggestAcc)?.name  || '', source: 'ai' } : null
                return (
                  <tr key={ri} style={hasSuggest ? { background: 'var(--ap-suggest-bg, #f5f3ff)' } : hasError ? { background: 'var(--ap-error-bg, #fff1f2)' } : undefined}>
                    <td style={{ fontSize: '0.83rem', color: 'var(--text-2)', paddingLeft: '1rem' }}>{item.description || '—'}</td>
                    <td style={{ padding: '0.35rem 0.5rem' }}>
                      <div style={missingDept ? { borderRadius: '7px', outline: '2px solid var(--ap-error-border, #fca5a5)' } : undefined}>
                        <CustomSearchSelect value={item.deptCode || ''} options={masterDepts} placeholder={t.searchDept} topChoice={deptChoice} onChange={val => updateItem(ri, 'deptCode', val)} />
                      </div>
                    </td>
                    <td style={{ padding: '0.35rem 0.5rem' }}>
                      <div style={missingAcc ? { borderRadius: '7px', outline: '2px solid var(--ap-error-border, #fca5a5)' } : undefined}>
                        <CustomSearchSelect value={item.accountCode || ''} options={masterAccounts} placeholder={t.searchAcc} topChoice={accChoice} onChange={val => updateItem(ri, 'accountCode', val)} />
                      </div>
                    </td>
                    {hasSuggestions && (
                      <td style={{ padding: '0.35rem 0.25rem', textAlign: 'center' }}>
                        {hasSuggest && (
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                            <button type="button" onClick={() => onConfirmSuggest(ri)} title="Confirm" style={{ padding: '3px 8px', background: 'var(--btn-ok-bg, #f0fdf4)', color: 'var(--btn-ok-text, #15803d)', border: '1px solid var(--btn-ok-border, #86efac)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center' }}><Check size={12} /></button>
                            <button type="button" onClick={() => onRejectSuggest(ri)} title="Reject"  style={{ padding: '3px 8px', background: 'var(--btn-err-bg, #fff1f2)', color: 'var(--btn-err-text, #dc2626)', border: '1px solid var(--btn-err-border, #fca5a5)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center' }}><X size={12} /></button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ap-step-nav">
        <button type="button" className="btn btn-outline" onClick={onBack}><ArrowLeft size={14} /> {t.backReview}</button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
          {!allMapped && (
            <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <AlertTriangle size={13} /> Please provide both Department and Account codes before proceeding.
            </span>
          )}
          <button type="button" className="btn btn-success" onClick={onGenerate} disabled={!allMapped} style={!allMapped ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}>
            <Save size={14} /> {t.generateInv}
          </button>
        </div>
      </div>
    </div>
  )
}
