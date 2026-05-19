import { useState, useEffect, useMemo } from 'react'
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
    const { monthly_calls, max_monthly_calls, remaining_calls } = usage
    const usedPercentage = max_monthly_calls > 0 ? (monthly_calls / max_monthly_calls) * 100 : 0
    let color = 'var(--teal)'
    if (usedPercentage >= 90) color = 'var(--rose)'
    else if (usedPercentage >= 70) color = 'var(--amber)'
    return {
      monthly_calls,
      max_monthly_calls,
      remaining_calls,
      usedPercentage,
      color,
      isLow: remaining_calls <= 5 || usedPercentage >= 90,
    }
  }, [usage])

  if (loading) {
    return (
      <div className="ui-quota ui-quota--skeleton" aria-hidden="true">
        {['Used', 'Remain', 'Total'].map((label, i) => (
          <div key={i} className={`ui-quota-col col-${label.toLowerCase()}`}>
            <span className="ui-quota-label">{label}</span>
            <span className="ui-quota-value ui-quota-placeholder">—</span>
          </div>
        ))}
      </div>
    )
  }

  if (!stats) return null

  const usedColor =
    stats.usedPercentage >= 90
      ? 'var(--rose)'
      : stats.usedPercentage >= 70
        ? 'var(--amber)'
        : 'var(--text-3)'

  const COLS = [
    { key: 'col-used', label: 'Used', value: stats.monthly_calls, color: usedColor },
    {
      key: 'col-remain',
      label: 'Remain',
      value: stats.remaining_calls,
      color: stats.isLow ? 'var(--rose)' : 'var(--primary)',
    },
    { key: 'col-total', label: 'Total', value: stats.max_monthly_calls, color: 'var(--text-4)' },
  ]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      >
        <div
          role="status"
          aria-label={`OCR quota: used ${stats.monthly_calls}, remaining ${stats.remaining_calls}, total ${stats.max_monthly_calls}`}
          onClick={() => {
            void fetchUsage()
          }}
          className={`ui-quota${stats.isLow ? ' is-low' : ''}`}
          style={
            {
              '--used-pct': `${Math.min(100, stats.usedPercentage)}%`,
              '--quota-color': stats.color,
            } as React.CSSProperties
          }
        >
          {COLS.map(({ key, label, value, color }) => (
            <div key={key} className={`ui-quota-col ${key}`}>
              <span className="ui-quota-label">{label}</span>
              <span className="ui-quota-value" style={{ color }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

import type React from 'react'
