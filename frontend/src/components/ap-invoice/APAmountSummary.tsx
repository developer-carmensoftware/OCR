import type React from 'react'
import { Calculator, RotateCw } from 'lucide-react'
import Badge from '../common/Badge'
import Card from '../common/Card'
import { fmt } from '../../constants/apInvoice'
import type { APInvoiceHeader } from '../../constants/apInvoice'

interface Sums { lineSubTotal: number; discount: number; tax: number; lineTotal: number }
interface Targets { subTotal: number; discount: number; tax: number }
interface Diffs { isSubDiff: boolean; isDiscDiff: boolean; isTaxDiff: boolean; isGrandDiff: boolean }

interface Props {
  t: Record<string, string>
  sums: Sums
  targets: Targets
  diffs: Diffs
  headerData: APInvoiceHeader
  updateHeader: (key: string, val: string) => void
  blurHeader: (key: string, val: string) => void
  adjustField: (tgt: unknown, sumCur: unknown, itemKey: string, adjustTotal?: boolean, isDiscount?: boolean) => void
}

interface SummaryRowProps {
  t: Record<string, string>
  label: string
  isDiff: boolean
  tableVal: string
  tableStyle?: React.CSSProperties
  docVal: string
  onAdjust: () => void
  onChange: (v: string) => void
  onBlur: (v: string) => void
}

function SummaryRow({ t, label, isDiff, tableVal, tableStyle, docVal, onAdjust, onChange, onBlur }: SummaryRowProps) {
  return (
    <div className="ap-summary-row">
      <span className="ap-summary-label">{label}</span>
      <div className="ap-summary-values">
        {isDiff && (
          <button type="button" className="ap-adjust-btn" onClick={onAdjust}>
            <RotateCw size={14} /> {t.adjust}
          </button>
        )}
        <span className={`ap-sum-from-table ${isDiff ? 'diff' : ''}`} style={tableStyle}>{tableVal}</span>
        <input className={`ap-sum-from-doc ${isDiff ? 'diff' : ''}`} aria-label={label} value={docVal} onChange={e => onChange(e.target.value)} onBlur={e => onBlur(e.target.value)} />
      </div>
    </div>
  )
}

export default function AmountSummary({ t, sums, targets, diffs, headerData, updateHeader, blurHeader, adjustField }: Props) {
  const { lineSubTotal, discount, tax, lineTotal } = sums
  const { subTotal: tgtSub, discount: tgtDisc, tax: tgtTax } = targets
  const { isSubDiff, isDiscDiff, isTaxDiff, isGrandDiff } = diffs

  return (
    <Card
      icon={<Calculator size={16} />}
      title={t.summaryAccount}
      right={
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <Badge variant="success" pill={false}>{t.sumFromTable}</Badge>
          <Badge variant="info" pill={false}>{t.sumFromDoc}</Badge>
        </div>
      }
    >
      <div className="card-body">
        <SummaryRow t={t} label={t.subTotal} isDiff={isSubDiff} tableVal={fmt(lineSubTotal)} docVal={headerData.subTotal} onAdjust={() => adjustField(tgtSub, lineSubTotal, 'lineSubTotal', true)} onChange={v => updateHeader('subTotal', v)} onBlur={v => blurHeader('subTotal', v)} />
        <SummaryRow t={t} label={t.discount} isDiff={isDiscDiff} tableVal={fmt(discount)} docVal={headerData.totalDiscount} onAdjust={() => adjustField(tgtDisc, discount, 'discountAmt', true, true)} onChange={v => updateHeader('totalDiscount', v)} onBlur={v => blurHeader('totalDiscount', v)} tableStyle={{ color: isDiscDiff ? undefined : 'var(--rose)' }} />
        <SummaryRow t={t} label={t.tax} isDiff={isTaxDiff} tableVal={fmt(tax)} docVal={headerData.taxAmount} onAdjust={() => adjustField(tgtTax, tax, 'taxAmt', true)} onChange={v => updateHeader('taxAmount', v)} onBlur={v => blurHeader('taxAmount', v)} />
        <div className="ap-grand-total-row">
          <span style={{ fontWeight: 800, fontSize: '1rem' }}>{t.grandTotal}</span>
          <div className="ap-summary-values">
            <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 800, fontSize: '1rem', color: isGrandDiff ? 'var(--rose)' : 'var(--text)' }}>{fmt(lineTotal)}</span>
            <input className={`ap-sum-from-doc ${isGrandDiff ? 'diff' : ''}`} style={{ fontSize: '0.95rem', fontWeight: 800 }} aria-label={t.grandTotal} value={headerData.grandTotal} onChange={e => updateHeader('grandTotal', e.target.value)} onBlur={e => blurHeader('grandTotal', e.target.value)} />
          </div>
        </div>
      </div>
    </Card>
  )
}
