import { CircleDollarSign, Clock, Layers, Wallet } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import { formatThb } from '../../lib/money'
import type { KpiSummary } from '../../lib/api/adminClient'

export default function OrderKpiCards({ kpi }: { kpi: KpiSummary | null }) {
  const { t } = useT()
  if (!kpi) return null

  const cnt = (k: string) => kpi.status_counts[k] ?? 0
  const unpaidAmt = kpi.awaiting_amount + kpi.to_review_amount
  const unpaidCnt = cnt('awaiting_payment') + cnt('to_review')
  const paidAmt = kpi.to_post_amount + kpi.posted_amount
  const paidCnt = cnt('to_post') + cnt('posted')
  const rejectedCnt = cnt('rejected')
  const totalCnt = unpaidCnt + paidCnt + rejectedCnt
  const totalAmt = kpi.total_amount + kpi.rejected_amount

  return (
    <div className="orev-kpi-row">
      <div className="orev-kpi-card">
        <div className="orev-kpi-header">
          <CircleDollarSign size={16} strokeWidth={2} aria-hidden="true" />
          <span className="orev-kpi-title">{t('orev.kpi.unpaid')}</span>
        </div>
        <span className="orev-kpi-amt orev-kpi-amt--lg">฿{formatThb(unpaidAmt)}</span>
        <span className="orev-kpi-desc">{t('orev.kpi.orderCount', { n: unpaidCnt })}</span>
      </div>
      <div className="orev-kpi-card">
        <div className="orev-kpi-header">
          <Wallet size={16} strokeWidth={2} aria-hidden="true" />
          <span className="orev-kpi-title">{t('orev.kpi.paid')}</span>
        </div>
        <span className="orev-kpi-amt orev-kpi-amt--lg orev-kpi-amt--ok">
          ฿{formatThb(paidAmt)}
        </span>
        <span className="orev-kpi-desc">{t('orev.kpi.orderCount', { n: paidCnt })}</span>
      </div>
      <div className="orev-kpi-card">
        <div className="orev-kpi-header">
          <Clock size={16} strokeWidth={2} aria-hidden="true" />
          <span className="orev-kpi-title">{t('orev.kpi.toReview')}</span>
        </div>
        <span className="orev-kpi-amt orev-kpi-amt--lg orev-kpi-amt--warn">{cnt('to_review')}</span>
        <span className="orev-kpi-desc">฿{formatThb(kpi.to_review_amount)}</span>
      </div>
      <div className="orev-kpi-card">
        <div className="orev-kpi-header">
          <Layers size={16} strokeWidth={2} aria-hidden="true" />
          <span className="orev-kpi-title">{t('orev.kpi.totalOrders')}</span>
        </div>
        <span className="orev-kpi-amt orev-kpi-amt--lg">{totalCnt}</span>
        <span className="orev-kpi-desc">฿{formatThb(totalAmt)}</span>
      </div>
    </div>
  )
}
