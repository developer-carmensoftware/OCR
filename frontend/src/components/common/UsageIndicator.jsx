import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getUsage } from '../../lib/api/auth'
import { Activity } from 'lucide-react'
import Tooltip from './Tooltip'
import { getStoredToken } from '../../lib/api/client'
import { useAuth } from '../../contexts/AuthContext'

export default function UsageIndicator() {
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const { isAuthenticated } = useAuth()

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
    if (isAuthenticated) {
      fetchUsage()
      const interval = setInterval(fetchUsage, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [isAuthenticated])

  const stats = useMemo(() => {
    if (!usage) return null
    const { monthly_calls, max_monthly_calls, remaining_calls } = usage
    const usedPercentage = max_monthly_calls > 0 ? (monthly_calls / max_monthly_calls) * 100 : 0
    const remainingPercentage = max_monthly_calls > 0 ? (remaining_calls / max_monthly_calls) * 100 : 0
    
    let color = 'var(--teal)'
    if (usedPercentage >= 90) color = 'var(--rose)'
    else if (usedPercentage >= 70) color = 'var(--amber)'

    return {
      monthly_calls,
      max_monthly_calls,
      remaining_calls,
      usedPercentage,
      remainingPercentage,
      color,
      isLow: remaining_calls <= 5 || usedPercentage >= 90
    }
  }, [usage])

  if (loading || !stats) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      >
        <Tooltip position="bottom-left" text={`You have used ${stats.monthly_calls} out of ${stats.max_monthly_calls} documents this month.`}>
          <div 
            className={`usage-indicator minimal ${stats.isLow ? 'is-low' : ''}`}
            role="status"
            aria-label={`${stats.remaining_calls} documents remaining this month`}
            onClick={fetchUsage}
            style={{ padding: '0.2rem 0.5rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="text-mono" style={{ 
                fontSize: '0.65rem', 
                opacity: 0.9, 
                fontWeight: 700, 
                whiteSpace: 'nowrap',
                color: stats.usedPercentage >= 70 ? stats.color : 'inherit'
              }}>
                {stats.remaining_calls} LEFT
              </span>
              
              <div className="usage-bar-bg" style={{ width: '30px', height: '2px' }}>
                <motion.div 
                  className="usage-bar-fill"
                  initial={{ width: 0 }}
                  animate={{ 
                    width: `${Math.min(100, stats.usedPercentage)}%`,
                    backgroundColor: stats.color
                  }}
                  transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                />
              </div>
            </div>
          </div>
        </Tooltip>
      </motion.div>
    </AnimatePresence>
  )
}
