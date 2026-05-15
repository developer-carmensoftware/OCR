import { Calculator, RotateCw } from 'lucide-react'
import Badge from '../common/Badge'
import Card from '../common/Card'
import { fmt } from '../../constants/apInvoice'

export default function AmountSummary({
  t,
  sums,
  targets,
  diffs,
  headerData,
  updateHeader,
  blurHeader,
  adjustField,
}) {
  const { lineSubTotal, discount, tax, lineTotal } = sums
  const { subTotal: tgtSub, discount: tgtDisc, tax: tgtTax } = targets
  const { isSubDiff, isDiscDiff, isTaxDiff, isGrandDiff } = diffs

  const calcGrand = lineTotal

  return (
    <Card
      icon={<Calculator size={16} />}
      title={t.summaryAccount}
      right={
        <div style={{ display: 'flex', gap: '0.4rem' }}>
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
          onAdjust={() => adjustField(tgtSub, lineSubTotal, 'lineSubTotal', true)}
          onChange={v => updateHeader('subTotal', v)}
          onBlur={v => blurHeader('subTotal', v)}
        />
        <SummaryRow
          t={t}
          label={t.discount}
          isDiff={isDiscDiff}
          tableVal={fmt(discount)}
          docVal={headerData.totalDiscount}
          onAdjust={() => adjustField(tgtDisc, discount, 'discountAmt', true, true)}
          onChange={v => updateHeader('totalDiscount', v)}
          onBlur={v => blurHeader('totalDiscount', v)}
          tableStyle={{ color: isDiscDiff ? undefined : 'var(--rose)' }}
        />
        <SummaryRow
          t={t}
          label={t.tax}
          isDiff={isTaxDiff}
          tableVal={fmt(tax)}
          docVal={headerData.taxAmount}
          onAdjust={() => adjustField(tgtTax, tax, 'taxAmt', true)}
          onChange={v => updateHeader('taxAmount', v)}
          onBlur={v => blurHeader('taxAmount', v)}
        />

        <div className="ap-grand-total-row">
          <span style={{ fontWeight: 800, fontSize: '1rem' }}>{t.grandTotal}</span>
          <div className="ap-summary-values">
            <span
              style={{
                fontFamily: 'IBM Plex Mono',
                fontWeight: 800,
                fontSize: '1rem',
                color: isGrandDiff ? 'var(--rose)' : 'var(--text)',
              }}
            >
              {fmt(calcGrand)}
            </span>
            <input
              className={`ap-sum-from-doc ${isGrandDiff ? 'diff' : ''}`}
              style={{ fontSize: '0.95rem', fontWeight: 800 }}
              value={headerData.grandTotal}
              onChange={e => updateHeader('grandTotal', e.target.value)}
              onBlur={e => blurHeader('grandTotal', e.target.value)}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}

function SummaryRow({
  t,
  label,
  isDiff,
  tableVal,
  tableStyle,
  docVal,
  onAdjust,
  onChange,
  onBlur,
}) {
  return (
    <div className="ap-summary-row">
      <span className="ap-summary-label">{label}</span>
      <div className="ap-summary-values">
        {isDiff && (
          <button className="ap-adjust-btn" onClick={onAdjust}>
            <RotateCw size={14} /> {t.adjust}
          </button>
        )}
        <span className={`ap-sum-from-table ${isDiff ? 'diff' : ''}`} style={tableStyle}>
          {tableVal}
        </span>
        <input
          className={`ap-sum-from-doc ${isDiff ? 'diff' : ''}`}
          value={docVal}
          onChange={e => onChange(e.target.value)}
          onBlur={e => onBlur(e.target.value)}
        />
      </div>
    </div>
  )
}
