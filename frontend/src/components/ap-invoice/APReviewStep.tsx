import type React from 'react'
import { Building, CircleDot, PlusCircle, LayoutList, CheckCircle2, AlertCircle, ArrowLeft, AlertTriangle, ArrowRight } from 'lucide-react'
import { isNumFld, fmt } from '../../constants/apInvoice'
import Card from '../common/Card'
import VendorSearch from './APVendorSearch'
import AmountSummary from './APAmountSummary'
import type { APColumnKey } from '../../constants/apInvoice'
import type { Vendor } from '../../hooks/ap/useAPVendor'
import type { APInvoiceHeader } from '../../constants/apInvoice'

interface Ctrl {
  t: Record<string, string>
  headerData: APInvoiceHeader
  lineItems: Array<Record<string, string | undefined>>
  fieldMappings: Record<APColumnKey, string>
  activeCols: number[]
  availableFields: Array<{ value: string; label: string }>
  systemVendor: Vendor
  setSystemVendor: React.Dispatch<React.SetStateAction<Vendor>>
  vendorSearch: string
  setVendorSearch: (v: string) => void
  showVendorDrop: boolean
  setShowVendorDrop: (v: boolean) => void
  filteredVendors: Vendor[]
  refreshVendors: () => void
  vendorRefreshing: boolean
  isValid: boolean
  validationErrors: string[]
  sumLineSubTotal: number
  sumLineTotal: number
  sumDiscount: number
  sumTax: number
  tgtSubTotal: number
  tgtDiscount: number
  tgtTax: number
  isSubDiff: boolean
  isDiscDiff: boolean
  isTaxDiff: boolean
  isGrandDiff: boolean
  isInclude: boolean
  updateHeader: (key: string, val: string) => void
  blurHeader: (key: string, val: string) => void
  updateItem: (idx: number, key: string, val: string) => void
  blurItem: (idx: number, key: string, val: string) => void
  adjustField: (tgt: unknown, sumCur: unknown, key: string, adjustTotal?: boolean, isDiscount?: boolean) => void
  setStep: (step: number) => void
  goToAccount: () => void
}

interface Props { ctrl: Ctrl }

const HEADER_FIELDS = (t: Record<string, string>) => [
  { key: 'vendorName', label: t.vendorName },
  { key: 'vendorTaxId', label: t.vendorTaxId },
  { key: 'vendorBranch', label: t.vendorBranch },
  { key: 'documentName', label: t.docName },
  { key: 'documentNumber', label: t.docNo },
  { key: 'documentDate', label: t.docDate },
]

export default function APReviewStep({ ctrl }: Props) {
  const { t, headerData, lineItems, fieldMappings, activeCols, availableFields, systemVendor, setSystemVendor, vendorSearch, setVendorSearch, showVendorDrop, setShowVendorDrop, filteredVendors, refreshVendors, vendorRefreshing, isValid, validationErrors, sumLineSubTotal, sumLineTotal, sumDiscount, sumTax, tgtSubTotal, tgtDiscount, tgtTax, isSubDiff, isDiscDiff, isTaxDiff, isGrandDiff, isInclude, updateHeader, blurHeader, updateItem, blurItem, adjustField, setStep, goToAccount } = ctrl

  const vendorMapped = !!systemVendor.code

  return (
    <>
      <VendorSearch t={t} systemVendor={systemVendor} setSystemVendor={setSystemVendor} vendorSearch={vendorSearch} setVendorSearch={setVendorSearch} showVendorDrop={showVendorDrop} setShowVendorDrop={setShowVendorDrop} filteredVendors={filteredVendors} onRefresh={refreshVendors} refreshing={vendorRefreshing} />

      <Card icon={<Building size={16} />} title={t.headerTitle} className="card-vendor">
        <div className="card-body">
          {headerData.taxType && (
            <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>Tax calculation type :</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.2rem 0.7rem', borderRadius: '99px', fontWeight: 700, fontSize: '0.8rem', background: isInclude ? 'var(--ap-include-bg, #fffbeb)' : 'var(--ap-exclude-bg, #eff6ff)', color: isInclude ? 'var(--amber-700, #b45309)' : 'var(--blue-700, #1d4ed8)', border: `1px solid ${isInclude ? 'var(--amber-300, #fcd34d)' : 'var(--blue-300, #93c5fd)'}` }}>
                {isInclude ? <CircleDot size={13} /> : <PlusCircle size={13} />}
                {isInclude ? 'Tax Include' : 'Tax Exclude'}
              </span>
            </div>
          )}
          <div className="header-form">
            {HEADER_FIELDS(t).map(({ key, label }) => (
              <div key={key} className="form-field">
                <label>{label}</label>
                <input type="text" value={headerData[key as keyof APInvoiceHeader] ?? ''} onChange={e => updateHeader(key, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card icon={<LayoutList size={16} />} title={t.reviewTitle} right={<span className="row-count">{lineItems.length} {t.items}</span>}>
        <div className="table-wrapper">
          <table className="ap-review-table">
            <thead>
              <tr>
                {activeCols.map(c => (
                  <th key={c} scope="col">
                    {availableFields.find(f => f.value === fieldMappings[`col${c}` as APColumnKey])?.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, ri) => (
                <tr key={ri} style={{ animation: `fadeUp 0.25s var(--ease) ${Math.min(ri * 40, 400)}ms both` }}>
                  {activeCols.map(c => {
                    const fld = fieldMappings[`col${c}` as APColumnKey]
                    const numeric = isNumFld(fld)
                    return (
                      <td key={c}>
                        <input type="text" aria-label={fld} className={`ap-edit-input ${numeric ? 'numeric' : ''} ${fld === 'category' ? 'category' : ''}`} value={item[fld] || ''} onChange={e => updateItem(ri, fld, e.target.value)} onBlur={e => numeric && blurItem(ri, fld, e.target.value)} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                {activeCols.map((c, i) => {
                  const fld = fieldMappings[`col${c}` as APColumnKey]
                  if (i === 0) return <td key="lbl" style={{ color: 'var(--text-3)' }}>{t.tableTotal}</td>
                  if (fld === 'lineSubTotal') return <td key="st" style={{ textAlign: 'right', color: 'var(--emerald)' }}>{fmt(sumLineSubTotal)}</td>
                  if (fld === 'lineTotal') return <td key="lt" style={{ textAlign: 'right', color: 'var(--rose)', fontWeight: 800 }}>{fmt(sumLineTotal)}</td>
                  if (fld === 'discountAmt') return <td key="da" style={{ textAlign: 'right' }}>{fmt(sumDiscount)}</td>
                  if (fld === 'taxAmt') return <td key="ta" style={{ textAlign: 'right' }}>{fmt(sumTax)}</td>
                  return <td key={`e${c}`} />
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1rem' }}>
        <div className={isValid ? 'ap-valid-ok' : 'ap-valid-err'}>
          {isValid ? <CheckCircle2 size={22} style={{ flexShrink: 0 }} /> : <AlertCircle size={22} style={{ flexShrink: 0 }} />}
          <div>
            <div style={{ fontWeight: 700 }}>{isValid ? t.validOk : t.validErr}</div>
            <div style={{ fontSize: '0.8rem', marginTop: '0.2rem', fontWeight: 400 }}>{isValid ? t.validOkDesc : `${t.validErrPrefix} ${validationErrors.join(', ')}`}</div>
          </div>
        </div>
        <AmountSummary t={t} sums={{ lineSubTotal: sumLineSubTotal, discount: sumDiscount, tax: sumTax, lineTotal: sumLineTotal }} targets={{ subTotal: tgtSubTotal, discount: tgtDiscount, tax: tgtTax }} diffs={{ isSubDiff, isDiscDiff, isTaxDiff, isGrandDiff }} headerData={headerData} updateHeader={updateHeader} blurHeader={blurHeader} adjustField={adjustField} />
      </div>

      <div className="ap-step-nav">
        <button type="button" className="btn btn-outline" onClick={() => setStep(2)}><ArrowLeft size={14} /> {t.backMap}</button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
          {!vendorMapped && (
            <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <AlertTriangle size={13} />{t.warnSelectVendor}
            </span>
          )}
          <button type="button" className={`btn ${!vendorMapped ? 'btn-disabled' : isValid ? 'btn-primary' : 'btn-success'}`} onClick={vendorMapped ? goToAccount : undefined} disabled={!vendorMapped} style={!vendorMapped ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}>
            {isValid ? t.proceed : t.proceedAnyway}<ArrowRight size={14} />
          </button>
        </div>
      </div>
    </>
  )
}
