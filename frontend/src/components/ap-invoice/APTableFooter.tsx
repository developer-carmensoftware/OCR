import { Fragment } from 'react'
import { useT } from '../../i18n/LanguageContext'
import { fmt } from '../../constants/apInvoice'
import type { APColumnKey } from '../../constants/apInvoice'

interface Props {
  activeCols: number[]
  fieldMappings: Record<APColumnKey, string>
  sumLineSubTotal: number
  sumLineTotal: number
  sumDiscount: number
  sumTax: number
  showFixedTaxType: boolean
  showFixedTaxPct: boolean
  showFixedTaxProfile: boolean
}

export default function APTableFooter({
  activeCols,
  fieldMappings,
  sumLineSubTotal,
  sumLineTotal,
  sumDiscount,
  sumTax,
  showFixedTaxType,
  showFixedTaxPct,
  showFixedTaxProfile,
}: Props) {
  const { t } = useT()

  return (
    <tfoot>
      <tr>
        {activeCols.map((c, i) => {
          const fld = fieldMappings[`col${c}` as APColumnKey]
          if (i === 0)
            return (
              <td key="lbl" className="ap-total-label">
                {t('ap.tableTotal')}
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
                {!showFixedTaxType && showFixedTaxProfile && <td role="presentation" />}
                <td role="presentation" />
              </Fragment>
            )
          }
          if (fld === 'taxType')
            return (
              <Fragment key={c}>
                {showFixedTaxProfile && showFixedTaxPct && <td role="presentation" />}
                <td role="presentation" />
              </Fragment>
            )
          return <td key={`e${c}`} role="presentation" />
        })}
        {showFixedTaxType && showFixedTaxProfile && <td role="presentation" />}
        {showFixedTaxPct && <td role="presentation" />}
        {showFixedTaxType && <td role="presentation" />}
        <td role="presentation" />
      </tr>
    </tfoot>
  )
}
