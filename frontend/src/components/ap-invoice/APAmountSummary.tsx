import { Calculator, RotateCw } from 'lucide-react'
import Badge from '../common/Badge'
import Card from '../common/Card'
import NumericInput from '../common/NumericInput'
import { fmt, round2 } from '../../constants/apInvoice'
import type { APInvoiceHeader } from '../../constants/apInvoice'

interface Sums {
  lineSubTotal: number
  discount: number
  tax: number
  lineTotal: number
}
interface Targets {
  subTotal: number
  discount: number
  tax: number
}
interface Diffs {
  isSubDiff: boolean
  isDiscDiff: boolean
  isTaxDiff: boolean
  isGrandDiff: boolean
}

interface Props {
  t: Record<string, string>
  sums: Sums
  targets: Targets
  diffs: Diffs
  headerData: APInvoiceHeader
  updateHeader: (key: string, val: string) => void
  blurHeader: (key: string, val: string) => void
  adjustField: (
    tgt: unknown,
    sumCur: unknown,
    itemKey: string,
    adjustTotal?: boolean,
    isDiscount?: boolean
  ) => void
}

interface SummaryRowProps {
  t: Record<string, string>
  label: string
  isDiff: boolean
  tableVal: string
  tableClassName?: string
  docVal: string
  onAdjust: () => void
  onChange: (v: string) => void
  onBlur: (v: string) => void
}

function SummaryRow({
  t,
  label,
  isDiff,
  tableVal,
  tableClassName,
  docVal,
  onAdjust,
  onChange,
  onBlur,
}: SummaryRowProps) {
  return (
    <div className="ap-summary-row">
      <span className="ap-summary-label">{label}</span>
      <div className="ap-summary-values">
        {isDiff && (
          <button type="button" className="ap-adjust-btn" onClick={onAdjust}>
            <RotateCw size={14} /> {t.adjust}
          </button>
        )}
        <span className={`ap-sum-from-table ${isDiff ? 'diff' : ''} ${tableClassName || ''}`}>
          {tableVal}
        </span>
        <NumericInput
          className={`ap-sum-from-doc ${isDiff ? 'diff' : ''}`}
          aria-label={label}
          value={docVal}
          onChange={onChange}
          onBlur={onBlur}
        />
      </div>
    </div>
  )
}

export default function AmountSummary({
  t,
  sums,
  targets,
  diffs,
  headerData,
  updateHeader,
  blurHeader,
  adjustField,
}: Props) {
  const { lineSubTotal, discount, tax, lineTotal } = sums
  const { subTotal: tgtSub, discount: tgtDisc, tax: tgtTax } = targets
  const { isSubDiff, isDiscDiff, isTaxDiff, isGrandDiff } = diffs

  return (
    <Card
      icon={<Calculator size={16} />}
      title={t.summaryAccount}
      right={
        <div className="ap-summary-badges">
          <Badge variant="success" pill={false}>
            {t.sumFromTable}
          </Badge>
          <Badge variant="info" pill={false}>
            {t.sumFromDoc}
          </Badge>
        </div>
      }
    >
      <div className="card-body">
        <SummaryRow
          t={t}
          label={t.subTotal}
          isDiff={isSubDiff}
          tableVal={fmt(lineSubTotal)}
          docVal={headerData.subTotal}
          onAdjust={() => adjustField(tgtSub, lineSubTotal, 'lineSubTotal')}
          onChange={v => updateHeader('subTotal', v)}
          onBlur={v => blurHeader('subTotal', v)}
        />
        <SummaryRow
          t={t}
          label={t.discount}
          isDiff={isDiscDiff}
          tableVal={fmt(discount)}
          docVal={headerData.totalDiscount}
          onAdjust={() => adjustField(tgtDisc, discount, 'discountAmt')}
          onChange={v => updateHeader('totalDiscount', v)}
          onBlur={v => blurHeader('totalDiscount', v)}
          tableClassName={isDiscDiff ? '' : 'ap-sum-discount-no-diff'}
        />
        <SummaryRow
          t={t}
          label={t.tax}
          isDiff={isTaxDiff}
          tableVal={fmt(tax)}
          docVal={headerData.taxAmount}
          onAdjust={() => adjustField(tgtTax, tax, 'taxAmt')}
          onChange={v => updateHeader('taxAmount', v)}
          onBlur={v => blurHeader('taxAmount', v)}
        />
        <div className="ap-grand-total-row">
          <span className="ap-grand-total-label">{t.grandTotal}</span>
          <div className="ap-summary-values">
            {isGrandDiff && (
              <button
                type="button"
                className="ap-adjust-btn"
                onClick={() => adjustField(round2(headerData.grandTotal), lineTotal, 'lineTotal')}
              >
                <RotateCw size={14} /> {t.adjust}
              </button>
            )}
            <span className={`ap-grand-total-table-val ${isGrandDiff ? 'diff' : ''}`}>
              {fmt(lineTotal)}
            </span>
            <NumericInput
              className={`ap-sum-from-doc grand-total ${isGrandDiff ? 'diff' : ''}`}
              aria-label={t.grandTotal}
              value={headerData.grandTotal}
              onChange={v => updateHeader('grandTotal', v)}
              onBlur={v => blurHeader('grandTotal', v)}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}
