import { Building, CircleDot, PlusCircle, LayoutList, CheckCircle2, AlertCircle, ArrowLeft, AlertTriangle, ArrowRight } from 'lucide-react'
import { isNumFld, fmt } from '../../constants/apInvoice'
import Card from '../common/Card'
import VendorSearch from './VendorSearch'
import AmountSummary from './AmountSummary'

const HEADER_FIELDS = (t) => [
  { key: 'vendorName',     label: t.vendorName },
  { key: 'vendorTaxId',    label: t.vendorTaxId },
  { key: 'vendorBranch',   label: t.vendorBranch },
  { key: 'documentName',   label: t.docName },
  { key: 'documentNumber', label: t.docNo },
  { key: 'documentDate',   label: t.docDate },
]

export default function APReviewStep({ ctrl }) {
  const {
    t, headerData, lineItems, fieldMappings, activeCols, availableFields,
    systemVendor, setSystemVendor, vendorSearch, setVendorSearch,
    showVendorDrop, setShowVendorDrop, filteredVendors,
    refreshVendors, vendorRefreshing,
    isValid, validationErrors,
    sumLineSubTotal, sumLineTotal, sumDiscount, sumTax,
    tgtSubTotal, tgtDiscount, tgtTax,
    isSubDiff, isDiscDiff, isTaxDiff, isGrandDiff,
    isInclude,
    updateHeader, blurHeader, updateItem, blurItem,
    adjustField, setStep, goToAccount,
  } = ctrl

  const vendorMapped = !!systemVendor.code

  return (
    <>
      {/* Vendor Search — top */}
      <VendorSearch
        t={t}
        systemVendor={systemVendor}
        setSystemVendor={setSystemVendor}
        vendorSearch={vendorSearch}
        setVendorSearch={setVendorSearch}
        showVendorDrop={showVendorDrop}
        setShowVendorDrop={setShowVendorDrop}
        filteredVendors={filteredVendors}
        onRefresh={refreshVendors}
        refreshing={vendorRefreshing}
      />

      {/* Header Info */}
      <Card icon={<Building size={16} />} title={t.headerTitle} className="card-vendor">
        <div className="card-body">
          {/* Tax Type Badge */}
          {headerData.taxType && (
            <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>ประเภทภาษีมูลค่าเพิ่ม:</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.2rem 0.7rem', borderRadius: '99px', fontWeight: 700, fontSize: '0.8rem',
                background: isInclude ? 'var(--ap-include-bg, #fffbeb)' : 'var(--ap-exclude-bg, #eff6ff)',
                color: isInclude ? 'var(--amber-700, #b45309)' : 'var(--blue-700, #1d4ed8)',
                border: `1px solid ${isInclude ? 'var(--amber-300, #fcd34d)' : 'var(--blue-300, #93c5fd)'}`,
              }}>
                {isInclude ? <CircleDot size={13} /> : <PlusCircle size={13} />}
                {isInclude ? 'Tax Include — ราคารวมภาษีแล้ว' : 'Tax Exclude — ราคายังไม่รวมภาษี'}
              </span>
            </div>
          )}
          <div className="header-form">
            {HEADER_FIELDS(t).map(({ key, label }) => (
              <div key={key} className="form-field">
                <label>{label}</label>
                <input
                  type="text"
                  value={headerData[key]}
                  onChange={e => updateHeader(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Line Items Table */}
      <Card
        icon={<LayoutList size={16} />}
        title={t.reviewTitle}
        right={<span className="row-count">{lineItems.length} รายการ</span>}
      >
        <div className="table-wrapper">
          <table className="ap-review-table">
            <thead>
              <tr>
                {activeCols.map(c => (
                  <th key={c}>{availableFields.find(f => f.value === fieldMappings[`col${c}`])?.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, ri) => (
                <tr key={ri}>
                  {activeCols.map(c => {
                    const fld = fieldMappings[`col${c}`]
                    const numeric = isNumFld(fld)
                    return (
                      <td key={c}>
                        <input
                          type="text"
                          className={`ap-edit-input ${numeric ? 'numeric' : ''} ${fld === 'category' ? 'category' : ''}`}
                          value={item[fld] || ''}
                          onChange={e => updateItem(ri, fld, e.target.value)}
                          onBlur={e => numeric && blurItem(ri, fld, e.target.value)}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                {activeCols.map((c, i) => {
                  const fld = fieldMappings[`col${c}`]
                  if (i === 0)               return <td key="lbl" style={{ color: 'var(--text-3)' }}>{t.tableTotal}</td>
                  if (fld === 'lineSubTotal') return <td key="st"  style={{ textAlign: 'right', color: 'var(--emerald)' }}>{fmt(sumLineSubTotal)}</td>
                  if (fld === 'lineTotal')    return <td key="lt"  style={{ textAlign: 'right', color: 'var(--rose)', fontWeight: 800 }}>{fmt(sumLineTotal)}</td>
                  if (fld === 'discountAmt')  return <td key="da"  style={{ textAlign: 'right' }}>{fmt(sumDiscount)}</td>
                  if (fld === 'taxAmt')       return <td key="ta"  style={{ textAlign: 'right' }}>{fmt(sumTax)}</td>
                  return <td key={`e${c}`} />
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Validation + Amount Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1rem' }}>
        <div className={isValid ? 'ap-valid-ok' : 'ap-valid-err'}>
          {isValid ? <CheckCircle2 size={22} style={{ flexShrink: 0 }} /> : <AlertCircle size={22} style={{ flexShrink: 0 }} />}
          <div>
            <div style={{ fontWeight: 700 }}>{isValid ? t.validOk : t.validErr}</div>
            <div style={{ fontSize: '0.8rem', marginTop: '0.2rem', fontWeight: 400 }}>
              {isValid ? t.validOkDesc : `${t.validErrPrefix} ${validationErrors.join(', ')}`}
            </div>
          </div>
        </div>

        <AmountSummary
          t={t}
          sums={{ lineSubTotal: sumLineSubTotal, discount: sumDiscount, tax: sumTax }}
          targets={{ subTotal: tgtSubTotal, discount: tgtDiscount, tax: tgtTax }}
          diffs={{ isSubDiff, isDiscDiff, isTaxDiff, isGrandDiff }}
          headerData={headerData}
          updateHeader={updateHeader}
          blurHeader={blurHeader}
          adjustField={adjustField}
        />
      </div>

      <div className="ap-step-nav">
        <button className="btn btn-outline" onClick={() => setStep(2)}>
          <ArrowLeft size={14} /> {t.backMap}
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
          {!vendorMapped && (
            <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <AlertTriangle size={13} />
              {t.warnSelectVendor}
            </span>
          )}
          <button
            className={`btn ${!vendorMapped ? 'btn-disabled' : isValid ? 'btn-primary' : 'btn-success'}`}
            onClick={vendorMapped ? goToAccount : undefined}
            disabled={!vendorMapped}
            style={!vendorMapped ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
          >
            {isValid ? t.proceed : t.proceedAnyway}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </>
  )
}
