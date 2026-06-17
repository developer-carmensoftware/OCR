import { useEffect, useState } from 'react'
import { Coins, FileText, AlertTriangle } from 'lucide-react'
import { getUsage, type UsageData } from '../../lib/api/auth'
import { getStoredToken } from '../../lib/api/client'
import { useT } from '../../i18n/LanguageContext'

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
  const isLow = freeLeft + usage.credit_balance <= 5

  return (
    <div className={`usage-strip${isLow ? ' is-low' : ''}`} role="status">
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
    </div>
  )
}
