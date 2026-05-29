import { LayoutList, Trash2 } from 'lucide-react'
import { isNumFld, fmt } from '../../constants/apInvoice'
import Card from '../common/Card'
import NumericInput from '../common/NumericInput'
import type { TaxTypeValue } from './TaxTypeDropdown'
import type { APColumnKey } from '../../constants/apInvoice'

interface Props {
  t: Record<string, string>
  lineItems: Array<Record<string, string | undefined>>
  fieldMappings: Record<APColumnKey, string>
  activeCols: number[]
  availableFields: Array<{ value: string; label: string }>
  sumLineSubTotal: number
  sumLineTotal: number
  sumDiscount: number
  sumTax: number
  isGrouped: boolean
  hasMixedTaxTypes: boolean
  originalLineItemsCount: number
  changeLineTaxType: (rowIndex: number, v: TaxTypeValue) => void
  updateItem: (idx: number, key: string, val: string) => void
  blurLineItem: (idx: number, key: string, val: string) => void
  groupAllItems: () => void
  groupItemsByTaxType: () => void
  ungroupItems: () => void
  removeItem: (idx: number) => void
}

export default function APLineItemsTable({
  t,
  lineItems,
  fieldMappings,
  activeCols,
  availableFields,
  sumLineSubTotal,
  sumLineTotal,
  sumDiscount,
  sumTax,
  isGrouped,
  hasMixedTaxTypes,
  originalLineItemsCount,
  changeLineTaxType,
  updateItem,
  blurLineItem,
  groupAllItems,
  groupItemsByTaxType,
  ungroupItems,
  removeItem,
}: Props) {
  const mappedFieldValues = Object.values(fieldMappings)
  const showFixedTaxPct = !mappedFieldValues.includes('taxPct')
  const showFixedTaxType = !mappedFieldValues.includes('taxType')

  return (
    <Card
      icon={<LayoutList size={16} />}
      title={t.reviewTitle}
      right={
        <div className="ap-card-header-actions">
          {(lineItems.length > 1 || isGrouped) &&
            (isGrouped ? (
              <button type="button" className="btn btn-sm btn-outline" onClick={ungroupItems}>
                Ungroup ({originalLineItemsCount} items)
              </button>
            ) : (
              <>
                {hasMixedTaxTypes && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={groupItemsByTaxType}
                  >
                    Group by tax type
                  </button>
                )}
                <button type="button" className="btn btn-sm btn-outline" onClick={groupAllItems}>
                  Group all
                </button>
              </>
            ))}
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
              {activeCols.map(c => (
                <th key={c} scope="col">
                  {
                    availableFields.find(f => f.value === fieldMappings[`col${c}` as APColumnKey])
                      ?.label
                  }
                </th>
              ))}
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

                  if (fld === 'taxType') {
                    const tv = (item.taxType as TaxTypeValue | undefined) || 'Exclude'
                    return (
                      <td key={c}>
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
                    )
                  }

                  const cellClass = `ap-edit-input ${numeric ? 'numeric' : ''} ${fld === 'category' ? 'category' : ''}`
                  return (
                    <td key={c}>
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
                {showFixedTaxPct && (
                  <td>
                    <NumericInput
                      aria-label="taxPct"
                      className="ap-edit-input numeric"
                      value={item.taxPct || ''}
                      onChange={v => updateItem(ri, 'taxPct', v)}
                      onBlur={v => blurLineItem(ri, 'taxPct', v)}
                    />
                  </td>
                )}
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
                return <td key={`e${c}`} />
              })}
              {showFixedTaxPct && <td />}
              {showFixedTaxType && <td />}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}
