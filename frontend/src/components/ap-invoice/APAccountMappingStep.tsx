import type React from 'react'
import {
  Building,
  IdCard,
  GitBranch,
  FileText,
  Calendar,
  AlignLeft,
  Database,
  Check,
  X,
  ArrowLeft,
  AlertTriangle,
  Save,
} from 'lucide-react'
import { SkeletonRow } from '../common/Skeleton'
import CustomSearchSelect from '../common/CustomSearchSelect'
import AISuggestBar from '../common/AISuggestBar'
import type { APLineItem } from '../../hooks/ap-invoice/useAPExtraction'
import type { Vendor } from '../../hooks/ap-invoice/useAPVendor'
import type { APInvoiceHeader } from '../../constants/apInvoice'

interface GLAccount {
  code: string
  name: string
}

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
  isSubmitting?: boolean
}

interface PillProps {
  icon: React.ReactNode
  label: string
  value: string
  last?: boolean
}
interface GLCardRow {
  label: string
  value: string
  colSpan?: boolean
  highlight?: 'primary' | 'emerald'
}
interface GLCardProps {
  title: string
  iconColor: string
  rows: GLCardRow[]
}

function fmtField(code?: string | null, desc?: string | null): string {
  if (code && desc) return `${code} — ${desc}`
  return code || desc || '—'
}

function VendorInfoPill({ icon, label, value, last = false }: PillProps) {
  return (
    <div className={`ap-vendor-info-pill ${last ? 'last' : ''}`}>
      <div className="ap-vendor-info-pill-label">
        {icon}
        {label}
      </div>
      <div className="ap-vendor-info-pill-value">{value}</div>
    </div>
  )
}

function GLAccountCard({ title, iconColor, rows }: GLCardProps) {
  const [firstRow, ...pairRows] = rows
  return (
    <div className="ap-account-card">
      <div className="ap-account-card-header">
        <div className={`ap-account-icon ${iconColor}`}>
          <Database size={14} />
        </div>
        <div className="ap-account-card-title">{title}</div>
      </div>
      <div className="ap-account-body">
        <div className="ap-account-body-grid">
          {firstRow && (
            <div>
              <div className="field-label">{firstRow.label}</div>
              <div className="ap-static-field">{firstRow.value}</div>
            </div>
          )}
          <div className="ap-account-body-grid-pair">
            {pairRows.map(({ label, value, highlight }) => (
              <div key={label}>
                <div className="field-label">{label}</div>
                <div className={`ap-static-field ${highlight ? `highlight-${highlight}` : ''}`}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function APAccountMappingStep({
  t,
  lineItems,
  updateItem,
  systemVendor = {},
  headerData = {},
  updateHeader,
  masterAccounts = [],
  masterDepts = [],
  onBack,
  onGenerate,
  onAISuggest,
  onAcceptAll,
  hasSuggestions = false,
  suggestLoading = false,
  onConfirmSuggest,
  onRejectSuggest,
  allMapped = false,
  isSubmitting = false,
}: Props) {
  const taxProfile = fmtField(systemVendor.taxProfileCode1, systemVendor.taxProfileDesc1)
  const debitDept = fmtField(systemVendor.vat1DrDeptCode, systemVendor.vat1DrDeptDesc)
  const debitAcc = fmtField(systemVendor.vat1DrAccCode, systemVendor.vat1DrAccDesc)
  const vendorGroup = fmtField(systemVendor.catCode, systemVendor.catDesc)
  const creditDept = fmtField(systemVendor.crDeptCode, systemVendor.crDeptDesc)
  const creditAcc = fmtField(systemVendor.vatCrAccCode, systemVendor.vatCrAccDesc)
  const vendorDisplayName = systemVendor.name || headerData.vendorName || '—'
  const vendorCode = systemVendor.code || '—'
  const vendorTaxId = headerData.vendorTaxId || '—'
  const branchNo =
    systemVendor.branchNo != null ? String(systemVendor.branchNo) : headerData.vendorBranch || '—'
  const docNo = headerData.documentNumber || '—'
  const docDate = headerData.documentDate || '—'

  return (
    <div className="ap-mapping-step-container">
      {/* Vendor info bar */}
      <div className="ap-vendor-info-bar">
        <div className="ap-vendor-name-section">
          <div className="ap-vendor-icon-container">
            <Building size={16} color="#fff" />
          </div>
          <div>
            <div className="ap-vendor-display-name">{vendorDisplayName}</div>
            <div className="ap-vendor-code">Code: {vendorCode}</div>
          </div>
        </div>
        <div className="ap-vendor-pills-container">
          <VendorInfoPill icon={<IdCard size={10} />} label="Tax ID" value={vendorTaxId} />
          <VendorInfoPill icon={<GitBranch size={10} />} label="Branch No" value={branchNo} />
          <VendorInfoPill icon={<FileText size={10} />} label="Document No." value={docNo} />
          <VendorInfoPill
            icon={<Calendar size={10} />}
            label="Document Date"
            value={docDate}
            last
          />
        </div>
      </div>

      {/* Invoice description */}
      <div className="ap-invoice-desc-container">
        <label className="ap-invoice-desc-label">
          <AlignLeft size={13} style={{ marginRight: '0.35rem' }} /> Invoice Description
        </label>
        <input
          type="text"
          value={headerData.invhDesc || ''}
          onChange={e => updateHeader('invhDesc', e.target.value)}
          placeholder="Invoice description..."
          aria-label="Invoice Description"
          className="ap-invoice-desc-input"
        />
      </div>

      {/* Fixed GL accounts */}
      <div className="ap-fixed-gl-grid">
        <GLAccountCard
          title={t.debitTax}
          iconColor="blue"
          rows={[
            { label: t.taxProfile, value: taxProfile, colSpan: true },
            { label: t.deptCode, value: debitDept },
            { label: t.accountCode, value: debitAcc, highlight: 'primary' },
          ]}
        />
        <GLAccountCard
          title={t.creditAp}
          iconColor="green"
          rows={[
            { label: t.vendorGroup, value: vendorGroup, colSpan: true },
            { label: t.deptCode, value: creditDept },
            { label: t.accountCode, value: creditAcc, highlight: 'emerald' },
          ]}
        />
      </div>

      {/* Expense line mapping */}
      <div className="data-card card-acct">
        <div className="card-title">
          <div className="card-title-left">
            <Database size={15} color="#7c3aed" />
            {t.debitExpense}
          </div>
          <div className="ap-card-title-right">
            <span className="ap-card-title-sub">{t.expenseDesc}</span>
            <AISuggestBar
              onSuggest={onAISuggest}
              onAcceptAll={onAcceptAll}
              hasSuggestions={hasSuggestions}
              loading={suggestLoading}
            />
          </div>
        </div>
        <div className="table-wrapper">
          <table className="ap-acct-table">
            <thead>
              <tr>
                <th scope="col" className="col-description">
                  {t.description}
                </th>
                <th scope="col" className="col-dept">
                  {t.deptCode}
                </th>
                <th scope="col" className="col-acc">
                  {t.accountCode}
                </th>
                {hasSuggestions && <th scope="col" className="col-actions"></th>}
              </tr>
            </thead>
            <tbody>
              {masterAccounts.length === 0 &&
                Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonRow key={i} cols={hasSuggestions ? 4 : 3} />
                ))}
              {masterAccounts.length > 0 &&
                lineItems.map((item, ri) => {
                  const hasSuggest = !!(item._suggestDept || item._suggestAcc)
                  const missingDept = !item.deptCode
                  const missingAcc = !item.accountCode
                  const hasError = missingDept || missingAcc
                  const deptChoice = item._suggestDept
                    ? {
                        code: item._suggestDept,
                        name: masterDepts.find(d => d.code === item._suggestDept)?.name || '',
                        source: 'ai',
                      }
                    : null
                  const accChoice = item._suggestAcc
                    ? {
                        code: item._suggestAcc,
                        name: masterAccounts.find(a => a.code === item._suggestAcc)?.name || '',
                        source: 'ai',
                      }
                    : null
                  return (
                    <tr
                      key={ri}
                      className={hasSuggest ? 'row-suggest' : hasError ? 'row-error' : undefined}
                    >
                      <td className="ap-line-desc">{item.description || '—'}</td>
                      <td>
                        <div
                          style={
                            missingDept
                              ? {
                                  borderRadius: '7px',
                                  outline: '2px solid var(--ap-error-border, #fca5a5)',
                                }
                              : undefined
                          }
                        >
                          <CustomSearchSelect
                            value={item.deptCode || ''}
                            options={masterDepts}
                            placeholder={t.searchDept}
                            topChoice={deptChoice}
                            onChange={val => updateItem(ri, 'deptCode', val)}
                          />
                        </div>
                      </td>
                      <td>
                        <div
                          style={
                            missingAcc
                              ? {
                                  borderRadius: '7px',
                                  outline: '2px solid var(--ap-error-border, #fca5a5)',
                                }
                              : undefined
                          }
                        >
                          <CustomSearchSelect
                            value={item.accountCode || ''}
                            options={masterAccounts}
                            placeholder={t.searchAcc}
                            topChoice={accChoice}
                            onChange={val => updateItem(ri, 'accountCode', val)}
                          />
                        </div>
                      </td>
                      {hasSuggestions && (
                        <td>
                          {hasSuggest && (
                            <div
                              style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}
                            >
                              <button
                                type="button"
                                onClick={() => onConfirmSuggest(ri)}
                                title="Confirm"
                                style={{
                                  padding: '3px 8px',
                                  background: 'var(--btn-ok-bg, #f0fdf4)',
                                  color: 'var(--btn-ok-text, #15803d)',
                                  border: '1px solid var(--btn-ok-border, #86efac)',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <Check size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => onRejectSuggest(ri)}
                                title="Reject"
                                style={{
                                  padding: '3px 8px',
                                  background: 'var(--btn-err-bg, #fff1f2)',
                                  color: 'var(--btn-err-text, #dc2626)',
                                  border: '1px solid var(--btn-err-border, #fca5a5)',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <X size={12} />
                              </button>
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
        <button type="button" className="btn btn-outline" onClick={onBack}>
          <ArrowLeft size={14} /> {t.backReview}
        </button>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '0.35rem',
          }}
        >
          {!allMapped && (
            <span
              style={{
                fontSize: '0.75rem',
                color: '#b45309',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <AlertTriangle size={13} /> Please provide both Department and Account codes before
              proceeding.
            </span>
          )}
          <button
            type="button"
            className="btn btn-success"
            onClick={onGenerate}
            disabled={!allMapped || isSubmitting}
            style={
              !allMapped || isSubmitting ? { opacity: 0.55, cursor: 'not-allowed' } : undefined
            }
          >
            <Save size={14} /> {isSubmitting ? 'Sending...' : t.generateInv}
          </button>
        </div>
      </div>
    </div>
  )
}
