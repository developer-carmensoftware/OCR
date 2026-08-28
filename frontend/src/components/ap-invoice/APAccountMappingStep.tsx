import type React from 'react'
import {
  Building,
  IdCard,
  GitBranch,
  FileText,
  Calendar,
  AlignLeft,
  Database,
  ArrowLeft,
  AlertTriangle,
  Save,
} from 'lucide-react'
import AccountMappingTable from './AccountMappingTable'
import { useT } from '../../i18n/LanguageContext'
import SwapLabel from '../common/SwapLabel'
import type { APLineItem } from '../../hooks/ap-invoice/useAPExtraction'
import type { Vendor } from '../../hooks/ap-invoice/useAPVendor'
import type { APInvoiceHeader } from '../../constants/apInvoice'

interface GLAccount {
  code: string
  name: string
}

interface Props {
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
  hint?: string
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
              <div className="field-label">
                {firstRow.label}
                {firstRow.hint && (
                  <span className="gl-help-tip" title={firstRow.hint}>
                    ?
                  </span>
                )}
              </div>
              <div className="ap-static-field">{firstRow.value}</div>
            </div>
          )}
          <div className="ap-account-body-grid-pair">
            {pairRows.map(({ label, value, highlight, hint }) => (
              <div key={label}>
                <div className="field-label">
                  {label}
                  {hint && (
                    <span className="gl-help-tip" title={hint}>
                      ?
                    </span>
                  )}
                </div>
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

const DEFAULT_EMPTY_OBJECT = {}
const DEFAULT_EMPTY_ARRAY: never[] = []

export default function APAccountMappingStep({
  lineItems,
  updateItem,
  systemVendor = DEFAULT_EMPTY_OBJECT,
  headerData = DEFAULT_EMPTY_OBJECT,
  updateHeader,
  masterAccounts = DEFAULT_EMPTY_ARRAY,
  masterDepts = DEFAULT_EMPTY_ARRAY,
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
  const { t } = useT()
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
            <Building size={16} color="white" />
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
          <AlignLeft size={13} style={{ marginRight: '0.35rem' }} /> {t('ap.invDescLabel')}
        </label>
        <input
          type="text"
          value={headerData.invhDesc || ''}
          onChange={e => updateHeader('invhDesc', e.target.value)}
          placeholder={t('ap.invDescPlaceholder')}
          aria-label={t('ap.invDescLabel')}
          className="ap-invoice-desc-input"
        />
      </div>

      {/* Fixed GL accounts */}
      <div className="ap-fixed-gl-grid">
        <GLAccountCard
          title={t('ap.debitTax')}
          iconColor="blue"
          rows={[
            {
              label: t('ap.taxProfile'),
              value: taxProfile,
              colSpan: true,
              hint: 'Tax profile from Carmen linking this vendor to the correct input tax account',
            },
            {
              label: t('ap.deptCode'),
              value: debitDept,
              hint: 'Department code from Carmen — e.g. ACC, SALE, MKT',
            },
            {
              label: t('ap.accountCode'),
              value: debitAcc,
              highlight: 'primary',
              hint: 'GL account code from Carmen chart of accounts — e.g. 1101-01, 5100-00',
            },
          ]}
        />
        <GLAccountCard
          title={t('ap.creditAp')}
          iconColor="green"
          rows={[
            {
              label: t('ap.vendorGroup'),
              value: vendorGroup,
              colSpan: true,
              hint: 'Vendor category in Carmen — determines the default accounts payable posting account',
            },
            {
              label: t('ap.deptCode'),
              value: creditDept,
              hint: 'Department code from Carmen — e.g. ACC, SALE, MKT',
            },
            {
              label: t('ap.accountCode'),
              value: creditAcc,
              highlight: 'emerald',
              hint: 'GL account code from Carmen chart of accounts — e.g. 1101-01, 5100-00',
            },
          ]}
        />
      </div>

      {/* Expense line mapping */}
      <AccountMappingTable
        lineItems={lineItems}
        masterAccounts={masterAccounts}
        masterDepts={masterDepts}
        hasSuggestions={hasSuggestions}
        suggestLoading={suggestLoading}
        updateItem={updateItem}
        onAISuggest={onAISuggest}
        onAcceptAll={onAcceptAll}
        onConfirmSuggest={onConfirmSuggest}
        onRejectSuggest={onRejectSuggest}
      />

      {/* Navigation */}
      <div className="ap-step-nav">
        <button type="button" className="btn btn-outline" onClick={onBack}>
          <ArrowLeft size={14} /> {t('ap.backReview')}
        </button>
        <div className="ap-step-nav-end">
          {!allMapped && (
            <span className="ap-mapping-warning">
              <AlertTriangle size={13} /> {t('ap.mappingWarning')}
            </span>
          )}
          {/* btn-primary, not btn-success: this posts to Carmen, it does not confirm that
              anything succeeded. The credit-card wizard's equivalent submit is already
              primary — same action, same colour. Green is reserved for genuinely
              post-completion actions now (DESIGN.md §5). */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={onGenerate}
            disabled={!allMapped || isSubmitting}
          >
            <Save size={14} />{' '}
            <SwapLabel active={isSubmitting} idle={t('ap.generateInv')} busy={t('ap.sending')} />
          </button>
        </div>
      </div>
    </div>
  )
}
