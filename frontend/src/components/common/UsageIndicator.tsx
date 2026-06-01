import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getUsage } from '../../lib/api/auth'
import { getStoredToken } from '../../lib/api/client'
import { useAuth } from '../../contexts/AuthContext'
import type { UsageData } from '../../lib/api/auth'

type UsageStats = UsageData['usage'] & {
  usedPercentage: number
  color: string
  isLow: boolean
}

export default function UsageIndicator() {
  const [usage, setUsage] = useState<UsageData['usage'] | null>(null)
  const [loading, setLoading] = useState(true)
  const { isAuthenticated } = useAuth() as { isAuthenticated: boolean }
  const quotaRef = useRef<HTMLDivElement>(null)

  const fetchUsage = async () => {
    try {
      const token = getStoredToken()
      if (token) {
        const data = await getUsage(token)
        setUsage(data.usage)
      }
    } catch (err) {
      console.error('Failed to fetch usage:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return
    void fetchUsage()
    const interval = setInterval(fetchUsage, 5 * 60 * 1000)
    window.addEventListener('ocr:quota-refresh', fetchUsage)
    return () => {
      clearInterval(interval)
      window.removeEventListener('ocr:quota-refresh', fetchUsage)
    }
  }, [isAuthenticated])

  const stats = useMemo((): UsageStats | null => {
    if (!usage) return null
    const { monthly_calls, max_monthly_calls, remaining_calls, credit_balance } = usage
    const totalRemaining = remaining_calls + credit_balance
    const usedPercentage = max_monthly_calls > 0 ? (monthly_calls / max_monthly_calls) * 100 : 0
    let color = 'var(--teal)'
    if (usedPercentage >= 90) color = 'var(--rose)'
    else if (usedPercentage >= 70) color = 'var(--amber)'
    return {
      monthly_calls,
      max_monthly_calls,
      remaining_calls: totalRemaining,
      credit_balance,
      usedPercentage,
      color,
      isLow: totalRemaining <= 5,
    }
  }, [usage])

  useEffect(() => {
    if (!quotaRef.current || !stats) return
    quotaRef.current.style.setProperty('--used-pct', `${Math.min(100, stats.usedPercentage)}%`)
    quotaRef.current.style.setProperty('--quota-color', stats.color)
  }, [stats])

  if (loading) {
    return (
      <div className="ui-quota ui-quota--skeleton" aria-hidden="true">
        <div className="ui-quota-col col-remain">
          <span className="ui-quota-label">Remain</span>
          <span className="ui-quota-value ui-quota-placeholder">—</span>
        </div>
      </div>
    )
  }

  if (!stats) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      >
        <div
          ref={quotaRef}
          role="status"
          aria-label={`OCR quota: ${stats.remaining_calls} documents remaining`}
          title="Open plan & credits"
          onClick={() => {
            window.dispatchEvent(new Event('ocr:open-topup'))
          }}
          className={`ui-quota${stats.isLow ? ' is-low' : ''}`}
        >
          <div className="ui-quota-col col-remain">
            <span className="ui-quota-label">Remain</span>
            <span className="ui-quota-value">{stats.remaining_calls}</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
