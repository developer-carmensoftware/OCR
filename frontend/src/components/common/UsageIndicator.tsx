import { useState, useEffect, useMemo, useRef } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { getUsage } from '../../lib/api/auth'
import { getStoredToken } from '../../lib/api/client'
import { useAuth } from '../../contexts/AuthContext'
import type { UsageData } from '../../lib/api/auth'
import { computeUsageStats } from '../../lib/usage'

export default function UsageIndicator() {
  const [usage, setUsage] = useState<UsageData['usage'] | null>(null)
  const [loading, setLoading] = useState(true)
  const { isAuthenticated } = useAuth() as { isAuthenticated: boolean }
  const quotaRef = useRef<HTMLAnchorElement>(null)

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
    window.addEventListener('ocr:quota-refresh', fetchUsage)
    return () => {
      window.removeEventListener('ocr:quota-refresh', fetchUsage)
    }
  }, [isAuthenticated])

  const stats = useMemo(() => computeUsageStats(usage), [usage])

  useEffect(() => {
    if (!quotaRef.current || !stats) return
    quotaRef.current.style.setProperty(
      '--used-pct-factor',
      `${Math.min(100, stats.usedPercentage) / 100}`
    )
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
      <m.div
        initial={{ opacity: 0, scale: 0.95, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      >
        <a
          ref={quotaRef}
          href="#/pricing"
          title="View plans and top up credits"
          aria-label={`OCR quota: ${stats.remaining_calls} documents remaining — open pricing`}
          className={`ui-quota ui-quota--link${stats.isLow ? ' is-low' : ''}`}
        >
          <div className="ui-quota-col col-remain">
            <span className="ui-quota-label">Remain</span>
            <span className="ui-quota-value">{stats.remaining_calls}</span>
          </div>
        </a>
      </m.div>
    </AnimatePresence>
  )
}
