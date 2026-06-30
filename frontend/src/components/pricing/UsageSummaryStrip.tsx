import { useEffect, useState } from 'react'
import { Coins, FileText, AlertTriangle, CalendarClock } from 'lucide-react'
import { getUsage, type UsageData } from '../../lib/api/auth'
import { getStoredToken } from '../../lib/api/client'
import { useT } from '../../i18n/LanguageContext'
import { catalogName } from '../../constants/billing'
import { formatDate } from '../../lib/money'

/** Compact "where you stand" strip: free quota remaining + top-up credit balance. */
export default function UsageSummaryStrip() {
  const { t } = useT()
  const [usage, setUsage] = useState<UsageData['usage'] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getStoredToken()
    if (!token) {
      setLoading(false)
      return
    }
    getUsage(token)
      .then(d => setUsage(d.usage))
      .catch(() => setUsage(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="usage-strip usage-strip--skeleton" aria-hidden="true" />
  }
  if (!usage) return null

  const freeLeft = usage.remaining_calls
  const sub = usage.subscription ?? null
  const planLeft = sub ? sub.docs_remaining : 0
  // With an active plan, the plan allowance is the primary balance; otherwise free + credits.
  const isLow = sub ? planLeft + usage.credit_balance <= 5 : freeLeft + usage.credit_balance <= 5

  return (
    <output className={`usage-strip${isLow ? ' is-low' : ''}`}>
      {sub && (
        <>
          <div className="usage-stat">
            <CalendarClock size={15} className="usage-stat-icon" />
            <span className="usage-stat-label">{catalogName(sub.plan_code)}</span>
            <span className="usage-stat-value text-mono">{planLeft}</span>
            <span className="usage-stat-unit">/ {sub.doc_allowance}</span>
            {sub.period_end && (
              <span className="usage-stat-unit">
                · {t('usage.activeUntil')} {formatDate(sub.period_end)}
              </span>
            )}
          </div>
          <div className="usage-divider" aria-hidden="true" />
        </>
      )}
      <div className="usage-stat">
        <FileText size={15} className="usage-stat-icon" />
        <span className="usage-stat-label">{t('usage.freeLeft')}</span>
        <span className="usage-stat-value text-mono">{freeLeft}</span>
        <span className="usage-stat-unit">/ {usage.max_monthly_calls}</span>
      </div>
      <div className="usage-divider" aria-hidden="true" />
      <div className="usage-stat">
        <Coins size={15} className="usage-stat-icon usage-stat-icon--credit" />
        <span className="usage-stat-label">{t('usage.topupCredits')}</span>
        <span className="usage-stat-value text-mono">{usage.credit_balance.toLocaleString()}</span>
      </div>
      {isLow && (
        <div className="usage-low-note">
          <AlertTriangle size={13} /> {t('usage.runningLow')}
        </div>
      )}
    </output>
  )
}
