import type React from 'react'
import {
  Building,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'
import Card from '../common/Card'
import DateInput from '../common/DateInput'
import VendorSearch from './APVendorSearch'
import AmountSummary from './APAmountSummary'
import APLineItemsTable from './APLineItemsTable'
import type { TaxTypeValue } from './TaxTypeDropdown'
import type { APColumnKey } from '../../constants/apInvoice'
import type { Vendor } from '../../hooks/ap-invoice/useAPVendor'
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
  changeLineTaxType: (rowIndex: number, v: TaxTypeValue) => void
  updateHeader: (key: string, val: string) => void
  blurHeader: (key: string, val: string) => void
  updateItem: (idx: number, key: string, val: string) => void
  blurItem: (idx: number, key: string, val: string) => void
  blurLineItem: (idx: number, key: string, val: string) => void
  adjustField: (tgt: unknown, sumCur: unknown, key: string) => void
  setStep: (step: number) => void
  goToAccount: () => void
  isGrouped: boolean
  groupAllItems: () => void
  groupItemsByTaxType: () => void
  hasMixedTaxTypes: boolean
  ungroupItems: () => void
  originalLineItemsCount: number
  removeItem: (idx: number) => void
}

interface Props {
  ctrl: Ctrl
}

const HEADER_FIELDS = (t: Record<string, string>) => [
  { key: 'vendorName', label: t.vendorName },
  { key: 'vendorTaxId', label: t.vendorTaxId },
  { key: 'vendorBranch', label: t.vendorBranch },
  { key: 'documentName', label: t.docName },
  { key: 'documentNumber', label: t.docNo },
  { key: 'documentDate', label: t.docDate },
]

export default function APReviewStep({ ctrl }: Props) {
  const {
    t,
    headerData,
    lineItems,
    fieldMappings,
    activeCols,
    availableFields,
    systemVendor,
    setSystemVendor,
    vendorSearch,
    setVendorSearch,
    showVendorDrop,
    setShowVendorDrop,
    filteredVendors,
    refreshVendors,
    vendorRefreshing,
    isValid,
    validationErrors,
    sumLineSubTotal,
    sumLineTotal,
    sumDiscount,
    sumTax,
    tgtSubTotal,
    tgtDiscount,
    tgtTax,
    isSubDiff,
    isDiscDiff,
    isTaxDiff,
    isGrandDiff,
    changeLineTaxType,
    updateHeader,
    blurHeader,
    updateItem,
    blurLineItem,
    adjustField,
    setStep,
    goToAccount,
    isGrouped,
    groupAllItems,
    groupItemsByTaxType,
    hasMixedTaxTypes,
    ungroupItems,
    originalLineItemsCount,
    removeItem,
  } = ctrl

  const vendorMapped = !!systemVendor.code

  return (
    <>
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

      <Card icon={<Building size={16} />} title={t.headerTitle} className="card-vendor">
        <div className="card-body">
          <div className="header-form">
            {HEADER_FIELDS(t).map(({ key, label }) => (
              <div key={key} className="form-field">
                <label htmlFor={key}>{label}</label>
                {key === 'documentDate' ? (
                  <DateInput
                    id={key}
                    aria-label={label}
                    value={headerData[key as keyof APInvoiceHeader] ?? ''}
                    onChange={v => updateHeader(key, v)}
                  />
                ) : (
                  <input
                    id={key}
                    type="text"
                    value={headerData[key as keyof APInvoiceHeader] ?? ''}
                    onChange={e => updateHeader(key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <APLineItemsTable
        t={t}
        lineItems={lineItems}
        fieldMappings={fieldMappings}
        activeCols={activeCols}
        availableFields={availableFields}
        sumLineSubTotal={sumLineSubTotal}
        sumLineTotal={sumLineTotal}
        sumDiscount={sumDiscount}
        sumTax={sumTax}
        isGrouped={isGrouped}
        hasMixedTaxTypes={hasMixedTaxTypes}
        originalLineItemsCount={originalLineItemsCount}
        changeLineTaxType={changeLineTaxType}
        updateItem={updateItem}
        blurLineItem={blurLineItem}
        groupAllItems={groupAllItems}
        groupItemsByTaxType={groupItemsByTaxType}
        ungroupItems={ungroupItems}
        removeItem={removeItem}
      />

      <div className="ap-review-summary-grid">
        <div className={isValid ? 'ap-valid-ok' : 'ap-valid-err'}>
          {isValid ? (
            <CheckCircle2 size={22} className="ap-valid-icon" />
          ) : (
            <AlertCircle size={22} className="ap-valid-icon" />
          )}
          <div>
            <div className="ap-valid-title">{isValid ? t.validOk : t.validErr}</div>
            <div className="ap-valid-desc">
              {isValid ? t.validOkDesc : `${t.validErrPrefix} ${validationErrors.join(', ')}`}
            </div>
          </div>
        </div>
        <AmountSummary
          t={t}
          sums={{
            lineSubTotal: sumLineSubTotal,
            discount: sumDiscount,
            tax: sumTax,
            lineTotal: sumLineTotal,
          }}
          targets={{ subTotal: tgtSubTotal, discount: tgtDiscount, tax: tgtTax }}
          diffs={{ isSubDiff, isDiscDiff, isTaxDiff, isGrandDiff }}
          headerData={headerData}
          updateHeader={updateHeader}
          blurHeader={blurHeader}
          adjustField={adjustField}
        />
      </div>

      <div className="ap-step-nav">
        <button type="button" className="btn btn-outline" onClick={() => setStep(2)}>
          <ArrowLeft size={14} /> {t.backMap}
        </button>
        <div className="ap-nav-right">
          {!vendorMapped && (
            <span className="ap-vendor-warning">
              <AlertTriangle size={13} />
              {t.warnSelectVendor}
            </span>
          )}
          <button
            type="button"
            className={`btn ${!vendorMapped ? 'btn-disabled' : isValid ? 'btn-primary' : 'btn-success'}`}
            onClick={vendorMapped ? goToAccount : undefined}
            disabled={!vendorMapped}
          >
            {isValid ? t.proceed : t.proceedAnyway}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </>
  )
}
