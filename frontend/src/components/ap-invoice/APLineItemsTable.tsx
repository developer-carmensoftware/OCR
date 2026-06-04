import { Fragment, useMemo, useState } from 'react'
import { LayoutList, Trash2 } from 'lucide-react'
import { isNumFld, fmt, parseNum } from '../../constants/apInvoice'
import Card from '../common/Card'
import NumericInput from '../common/NumericInput'
import APGroupModal from './APGroupModal'
import type { TaxTypeValue } from './TaxTypeDropdown'
import type { APColumnKey } from '../../constants/apInvoice'
import type { TaxProfileItem } from '../../lib/api/carmen'
import type { Vendor } from '../../hooks/ap-invoice/useAPVendor'
import type { APLineItem } from '../../hooks/ap-invoice/useAPExtraction'

interface Props {
  t: Record<string, string>
  lineItems: Array<Record<string, string | undefined>>
  fieldMappings: Record<APColumnKey, string>
  activeCols: number[]
  availableFields: Array<{ value: string; label: string }>
  taxProfiles: TaxProfileItem[]
  systemVendor: Vendor
  sumLineSubTotal: number
  sumLineTotal: number
  sumDiscount: number
  sumTax: number
  isGrouped: boolean
  originalLineItemsCount: number
  changeLineTaxType: (rowIndex: number, v: TaxTypeValue) => void
  updateItem: (idx: number, key: string, val: string) => void
  blurLineItem: (idx: number, key: string, val: string) => void
  applyLineTax: (
    idx: number,
    patch: { taxType?: TaxTypeValue; taxProfileCode1?: string; taxPct?: string }
  ) => void
  groupAllItems: () => void
  groupByDescription: (indices: number[], description: string) => boolean
  ungroupItems: () => void
  removeItem: (idx: number) => void
}

export default function APLineItemsTable({
  t,
  lineItems,
  fieldMappings,
  activeCols,
  availableFields,
  taxProfiles,
  systemVendor,
  sumLineSubTotal,
  sumLineTotal,
  sumDiscount,
  sumTax,
  isGrouped,
  originalLineItemsCount,
  changeLineTaxType,
  updateItem,
  blurLineItem,
  applyLineTax,
  groupAllItems,
  groupByDescription,
  ungroupItems,
  removeItem,
}: Props) {
  // "Group by description" opens a modal where the user sets the description and picks rows.
  const [showGroupModal, setShowGroupModal] = useState(false)
  const mappedFieldValues = Object.values(fieldMappings)
  const showFixedTaxPct = !mappedFieldValues.includes('taxPct')
  const showFixedTaxType = !mappedFieldValues.includes('taxType')
  const showFixedTaxProfile = !mappedFieldValues.includes('taxProfileCode1')

  // Distinct, sorted tax rates from the Carmen profile list — the only values Tax% may take.
  const rateOptions = useMemo(
    () =>
      Array.from(new Set(taxProfiles.filter(p => p.rate != null).map(p => p.rate as number))).sort(
        (a, b) => a - b
      ),
    [taxProfiles]
  )

  // Tax Profile select. NONE means non-VAT (the explicit no-VAT choice); the empty option (—) means
  // taxable with no specific profile (keeps the line's current rate, no vendor-default fallback);
  // picking a real profile drives the rate. All routing goes through applyLineTax which keeps
  // Profile/Tax%/Tax Type interlocked and recalcs the row. None lines show NONE.
  const taxProfileCell = (ri: number, item: Record<string, string | undefined>) => {
    const isNone = item.taxType === 'None'
    const val = isNone ? 'NONE' : item.taxProfileCode1 || ''
    const vendorDefault = systemVendor.taxProfileCode1 || ''
    const isMismatch = !isNone && vendorDefault !== '' && val !== vendorDefault
    const hasNoneProfile = taxProfiles.some(p => p.code === 'NONE')

    return (
      <td>
        <select
          aria-label="Tax profile"
          className={`ap-taxtype-select${isMismatch ? ' ap-tax-mismatch' : ''}`}
          title={isMismatch ? `${t.taxProfileMismatch}${vendorDefault}` : undefined}
          value={val}
          onChange={e => applyLineTax(ri, { taxProfileCode1: e.target.value })}
        >
          <option value="">—</option>
          {!hasNoneProfile && <option value="NONE">NONE</option>}
          {taxProfiles.map(p => (
            <option key={p.code} value={p.code}>
              {p.code}
            </option>
          ))}
        </select>
      </td>
    )
  }

  // Tax% select — options are the configured profile rates, plus the row's own rate when no profile
  // defines it (so the dropdown always shows the true extracted value, e.g. 10%, and warns instead
  // of silently snapping to 7%). None lines show a locked —. Falls back to a free NumericInput only
  // if no profiles loaded (so the cell is never empty).
  const taxPctCell = (ri: number, item: Record<string, string | undefined>) => {
    const cur = parseNum(item.taxPct)
    const unmatched =
      item.taxType !== 'None' && cur > 0 && !rateOptions.some(r => Math.abs(r - cur) < 0.01)
    const opts = unmatched ? [...rateOptions, cur].sort((a, b) => a - b) : rateOptions
    return (
      <td>
        {item.taxType === 'None' ? (
          <span className="ap-edit-input numeric ap-tax-na" aria-label="taxPct">
            0%
          </span>
        ) : opts.length ? (
          <select
            aria-label="taxPct"
            className={`ap-taxtype-select${unmatched ? ' ap-tax-unmatched' : ''}`}
            title={unmatched ? t.taxRateUnmatched : undefined}
            value={String(cur)}
            onChange={e => applyLineTax(ri, { taxPct: e.target.value })}
          >
            {opts.map(r => (
              <option key={r} value={String(r)}>
                {r}%
              </option>
            ))}
          </select>
        ) : (
          <NumericInput
            aria-label="taxPct"
            className="ap-edit-input numeric"
            value={item.taxPct || ''}
            onChange={v => updateItem(ri, 'taxPct', v)}
            onBlur={v => blurLineItem(ri, 'taxPct', v)}
          />
        )}
      </td>
    )
  }

  return (
    <>
      <Card
        icon={<LayoutList size={16} />}
        title={t.reviewTitle}
        right={
          <div className="ap-card-header-actions">
            {(lineItems.length > 1 || isGrouped) && (
              <>
                {isGrouped && (
                  <button type="button" className="btn btn-sm btn-outline" onClick={ungroupItems}>
                    Ungroup ({originalLineItemsCount} items)
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setShowGroupModal(true)}
                  disabled={lineItems.length < 2}
                >
                  Group by description
                </button>
                <button type="button" className="btn btn-sm btn-outline" onClick={groupAllItems}>
                  Group all
                </button>
              </>
            )}
            <span className="row-count">
              {lineItems.length} {t.items}
            </span>
          </div>
        }
      >
        <div className="table-wrapper">
          <table className="ap-review-table">
            <thead>
              <tr>
                {activeCols.map(c => {
                  const fld = fieldMappings[`col${c}` as APColumnKey]
                  const label = availableFields.find(f => f.value === fld)?.label
                  if (fld === 'taxPct') {
                    return (
                      <Fragment key={c}>
                        {!showFixedTaxType && showFixedTaxProfile && (
                          <th scope="col">{t.taxProfile}</th>
                        )}
                        <th scope="col">{label}</th>
                      </Fragment>
                    )
                  }
                  if (fld === 'taxType') {
                    return (
                      <Fragment key={c}>
                        {showFixedTaxProfile && showFixedTaxPct && (
                          <th scope="col">{t.taxProfile}</th>
                        )}
                        <th scope="col">{label}</th>
                      </Fragment>
                    )
                  }
                  return (
                    <th key={c} scope="col">
                      {label}
                    </th>
                  )
                })}
                {showFixedTaxType && showFixedTaxProfile && <th scope="col">{t.taxProfile}</th>}
                {showFixedTaxPct && <th scope="col">{t.taxPct}</th>}
                {showFixedTaxType && <th scope="col">{t.taxType}</th>}
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="stagger-rows" key={lineItems.length}>
              {lineItems.map((item, ri) => (
                <tr key={ri}>
                  {activeCols.map(c => {
                    const fld = fieldMappings[`col${c}` as APColumnKey]
                    const numeric = isNumFld(fld)

                    if (fld === 'taxProfileCode1') {
                      return <Fragment key={c}>{taxProfileCell(ri, item)}</Fragment>
                    }

                    if (fld === 'taxPct') {
                      return (
                        <Fragment key={c}>
                          {!showFixedTaxType && showFixedTaxProfile && taxProfileCell(ri, item)}
                          {taxPctCell(ri, item)}
                        </Fragment>
                      )
                    }

                    if (fld === 'taxType') {
                      const tv = (item.taxType as TaxTypeValue | undefined) || 'Exclude'
                      return (
                        <Fragment key={c}>
                          {showFixedTaxProfile && showFixedTaxPct && taxProfileCell(ri, item)}
                          <td>
                            <select
                              aria-label="Tax type"
                              className="ap-taxtype-select"
                              value={tv}
                              onChange={e => changeLineTaxType(ri, e.target.value as TaxTypeValue)}
                            >
                              <option value="Include">Include</option>
                              <option value="Exclude">Exclude</option>
                              <option value="None">None</option>
                            </select>
                          </td>
                        </Fragment>
                      )
                    }

                    const cellClass = `ap-edit-input ${numeric ? 'numeric' : ''} ${fld === 'category' ? 'category' : ''}`
                    const isMissingDesc = fld === 'description' && !item[fld]?.trim()
                    return (
                      <td key={c} className={isMissingDesc ? 'ap-cell-missing' : undefined}>
                        {numeric ? (
                          <NumericInput
                            aria-label={fld}
                            className={cellClass}
                            value={item[fld] || ''}
                            onChange={v => updateItem(ri, fld, v)}
                            onBlur={v => blurLineItem(ri, fld, v)}
                          />
                        ) : (
                          <input
                            type="text"
                            aria-label={fld}
                            className={cellClass}
                            value={item[fld] || ''}
                            onChange={e => updateItem(ri, fld, e.target.value)}
                          />
                        )}
                      </td>
                    )
                  })}
                  {showFixedTaxType && showFixedTaxProfile && taxProfileCell(ri, item)}
                  {showFixedTaxPct && taxPctCell(ri, item)}
                  {showFixedTaxType && (
                    <td>
                      <select
                        aria-label="Tax type"
                        className="ap-taxtype-select"
                        value={(item.taxType as TaxTypeValue | undefined) || 'Exclude'}
                        onChange={e => changeLineTaxType(ri, e.target.value as TaxTypeValue)}
                      >
                        <option value="Include">Include</option>
                        <option value="Exclude">Exclude</option>
                        <option value="None">None</option>
                      </select>
                    </td>
                  )}
                  <td>
                    <button
                      type="button"
                      className="ap-delete-item-btn"
                      aria-label="Delete row"
                      disabled={lineItems.length <= 1}
                      onClick={() => removeItem(ri)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                {activeCols.map((c, i) => {
                  const fld = fieldMappings[`col${c}` as APColumnKey]
                  if (i === 0)
                    return (
                      <td key="lbl" className="ap-total-label">
                        {t.tableTotal}
                      </td>
                    )
                  if (fld === 'lineSubTotal')
                    return (
                      <td key="st" className="ap-total-val-emerald">
                        {fmt(sumLineSubTotal)}
                      </td>
                    )
                  if (fld === 'lineTotal')
                    return (
                      <td key="lt" className="ap-total-val-rose-bold">
                        {fmt(sumLineTotal)}
                      </td>
                    )
                  if (fld === 'discountAmt')
                    return (
                      <td key="da" className="text-right">
                        {fmt(sumDiscount)}
                      </td>
                    )
                  if (fld === 'taxAmt')
                    return (
                      <td key="ta" className="text-right">
                        {fmt(sumTax)}
                      </td>
                    )
                  if (fld === 'taxPct') {
                    return (
                      <Fragment key={c}>
                        {!showFixedTaxType && showFixedTaxProfile && <td />}
                        <td />
                      </Fragment>
                    )
                  }
                  if (fld === 'taxType')
                    return (
                      <Fragment key={c}>
                        {showFixedTaxProfile && showFixedTaxPct && <td />}
                        <td />
                      </Fragment>
                    )
                  return <td key={`e${c}`} />
                })}
                {showFixedTaxType && showFixedTaxProfile && <td />}
                {showFixedTaxPct && <td />}
                {showFixedTaxType && <td />}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      <APGroupModal
        show={showGroupModal}
        t={t}
        lineItems={lineItems as APLineItem[]}
        groupByDescription={groupByDescription}
        onClose={() => setShowGroupModal(false)}
      />
    </>
  )
}
