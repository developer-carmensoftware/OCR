import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import TenantSelector from '../../components/admin/TenantSelector'
import { fetchAlerts, resolveAlert } from '../../lib/api/adminClient'

interface Alert {
  id: number
  tenant_id: string
  tenant_name?: string | null
  module_id: string | null
  metric: string
  severity: string | null
  threshold: number | null
  actual: number | null
  description: string | null
  created_at: string | null
  resolved_at: string | null
}

export default function AnomaliesPage() {
  const [status, setStatus] = useState<'open' | 'resolved' | 'all'>('open')
  const [tenantId, setTenantId] = useState('')
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    fetchAlerts({ status, tenant_id: tenantId || undefined, limit: 100 })
      .then(r => setAlerts(r.data ?? []))
      .catch(e => toast.error(`Alerts: ${e?.message ?? 'failed to load'}`))
      .finally(() => setLoading(false))
  }

  useEffect(load, [status, tenantId])

  const handleResolve = async (id: number) => {
    try {
      await resolveAlert(id)
      toast.success('Alert resolved')
      load()
    } catch {
      toast.error('Failed to resolve alert')
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">Anomaly Alerts</h2>
        <div className="admin-page-controls">
          <select
            className="admin-select"
            aria-label="Alert status filter"
            value={status}
            onChange={e => setStatus(e.target.value as typeof status)}
          >
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>
          <TenantSelector value={tenantId} onChange={setTenantId} />
        </div>
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="admin-td-empty">Loading…</div>
        ) : alerts.length === 0 ? (
          <div className="admin-td-empty">No alerts</div>
        ) : (
          <div className="alert-list">
            {alerts.map(a => (
              <div key={a.id} className={`alert-item alert-item--${a.severity ?? 'warn'}`}>
                <div className="alert-meta">
                  <span className={`alert-severity alert-severity--${a.severity}`}>
                    {a.severity?.toUpperCase() ?? 'WARN'}
                  </span>
                  <span className="alert-metric">{a.metric}</span>
                  {a.module_id && <span className="alert-module">{a.module_id}</span>}
                  <span className="alert-tenant">{a.tenant_name ?? a.tenant_id}</span>
                </div>
                <div className="alert-body">
                  {a.description && <p className="alert-description">{a.description}</p>}
                  {a.threshold != null && (
                    <p className="alert-values">
                      Threshold: <b>{a.threshold}</b> — Actual:{' '}
                      <b className="text-red">{a.actual}</b>
                    </p>
                  )}
                  <p className="alert-time">
                    {a.created_at?.slice(0, 19).replace('T', ' ')}
                    {a.resolved_at && ` → resolved ${a.resolved_at.slice(0, 19).replace('T', ' ')}`}
                  </p>
                </div>
                {!a.resolved_at && (
                  <button
                    type="button"
                    className="alert-resolve-btn"
                    onClick={() => handleResolve(a.id)}
                  >
                    Resolve
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
