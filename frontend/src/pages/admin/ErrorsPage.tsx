import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import MetricChart from '../../components/admin/MetricChart'
import TenantSelector from '../../components/admin/TenantSelector'
import { fetchErrorBreakdown } from '../../lib/api/adminClient'

type GroupBy = 'module' | 'tenant' | 'endpoint'

interface ErrorRow {
  group: string
  total_tasks?: number
  total_requests?: number
  errors: number
  error_rate_pct: number
  avg_latency_ms?: number
}

export default function ErrorsPage() {
  const [groupBy, setGroupBy] = useState<GroupBy>('module')
  const [period, setPeriod] = useState(24)
  const [tenantId, setTenantId] = useState('')
  const [rows, setRows] = useState<ErrorRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchErrorBreakdown({
      group_by: groupBy,
      period_hours: period,
      tenant_id: tenantId || undefined,
    })
      .then(r => setRows(r.data ?? []))
      .catch(e => toast.error(`Errors: ${e?.message ?? 'failed to load'}`))
      .finally(() => setLoading(false))
  }, [groupBy, period, tenantId])

  const chartData = rows.map(r => ({
    group: r.group ?? '—',
    errors: r.errors,
    total: r.total_tasks ?? r.total_requests ?? 0,
  }))

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">Errors</h2>
        <div className="admin-page-controls">
          <select
            className="admin-select"
            aria-label="Group by"
            value={groupBy}
            onChange={e => setGroupBy(e.target.value as GroupBy)}
          >
            <option value="module">By Module</option>
            <option value="tenant">By Tenant</option>
            <option value="endpoint">By Endpoint</option>
          </select>
          <select
            className="admin-select"
            aria-label="Time period"
            value={period}
            onChange={e => setPeriod(Number(e.target.value))}
          >
            <option value={1}>Last 1h</option>
            <option value={24}>Last 24h</option>
            <option value={168}>Last 7d</option>
          </select>
          <TenantSelector value={tenantId} onChange={setTenantId} />
        </div>
      </div>

      {!loading && rows.length > 0 && (
        <div className="admin-chart-card">
          <MetricChart
            type="bar"
            data={chartData}
            xKey="group"
            series={[
              { key: 'errors', label: 'Errors', color: '#f43f5e' },
              { key: 'total', label: 'Total', color: '#e5e7eb' },
            ]}
          />
        </div>
      )}

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="admin-th">Group</th>
              <th className="admin-th text-right">Total</th>
              <th className="admin-th text-right">Errors</th>
              <th className="admin-th text-right">Error %</th>
              {groupBy !== 'module' && <th className="admin-th text-right">Avg Latency</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="admin-td-empty">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-td-empty">
                  No errors in period
                </td>
              </tr>
            ) : (
              rows.map(r => (
                <tr key={r.group} className="admin-tr">
                  <td className="admin-td">{r.group ?? '—'}</td>
                  <td className="admin-td text-right">{r.total_tasks ?? r.total_requests ?? 0}</td>
                  <td className="admin-td text-right">
                    <span className={r.errors > 0 ? 'text-red' : ''}>{r.errors}</span>
                  </td>
                  <td className="admin-td text-right">
                    <span
                      className={
                        r.error_rate_pct > 5
                          ? 'text-red'
                          : r.error_rate_pct > 1
                            ? 'text-yellow'
                            : ''
                      }
                    >
                      {r.error_rate_pct}%
                    </span>
                  </td>
                  {groupBy !== 'module' && (
                    <td className="admin-td text-right">
                      {r.avg_latency_ms != null ? `${r.avg_latency_ms}ms` : '—'}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
