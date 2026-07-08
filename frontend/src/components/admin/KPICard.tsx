import type { ReactNode } from 'react'

interface KPICardProps {
  label: string
  value: string | number
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
  accent?: 'default' | 'green' | 'red' | 'yellow'
  icon?: ReactNode
  loading?: boolean
}

export default function KPICard({
  label,
  value,
  sub,
  trend,
  accent = 'default',
  icon,
  loading = false,
}: KPICardProps) {
  if (loading) {
    return (
      <div className={`kpi-card kpi-card--${accent}`}>
        {icon && <div className="kpi-icon">{icon}</div>}
        <div className="kpi-label">{label}</div>
        <div className="skeleton skeleton-value" aria-hidden="true" />
      </div>
    )
  }

  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : null

  return (
    <div className={`kpi-card kpi-card--${accent}`}>
      {icon && <div className="kpi-icon">{icon}</div>}
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {value}
        {trendIcon && <span className={`kpi-trend kpi-trend--${trend}`}>{trendIcon}</span>}
      </div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}
