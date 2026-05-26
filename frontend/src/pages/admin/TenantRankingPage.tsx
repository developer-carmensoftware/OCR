import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable, { type Column } from '../../components/admin/DataTable'
import { fetchTenantRanking } from '../../lib/api/adminClient'

type Metric = 'cost' | 'error_rate' | 'latency' | 'volume'

interface RankRow {
  tenant_id: string
  tenant_name: string
  total_calls?: number
  total_cost_usd?: number
  total_tokens?: number
  total_requests?: number
  errors?: number
  error_rate_pct?: number
  avg_latency_ms?: number
  max_latency_ms?: number
}

const COLS_COST: Column<RankRow>[] = [
  { key: 'tenant_name', label: 'Tenant', sortable: true },
  { key: 'total_calls', label: 'Calls', sortable: true, align: 'right' },
  { key: 'total_tokens', label: 'Tokens', sortable: true, align: 'right' },
  {
    key: 'total_cost_usd',
    label: 'Cost (USD)',
    sortable: true,
    align: 'right',
    render: r => `$${Number(r.total_cost_usd ?? 0).toFixed(4)}`,
  },
]

const COLS_PERF: Column<RankRow>[] = [
  { key: 'tenant_name', label: 'Tenant', sortable: true },
  { key: 'total_requests', label: 'Requests', sortable: true, align: 'right' },
  { key: 'errors', label: 'Errors', sortable: true, align: 'right' },
  {
    key: 'error_rate_pct',
    label: 'Error %',
    sortable: true,
    align: 'right',
    render: r => `${r.error_rate_pct ?? 0}%`,
  },
  { key: 'avg_latency_ms', label: 'Avg Latency (ms)', sortable: true, align: 'right' },
]

export default function TenantRankingPage() {
  const [metric, setMetric] = useState<Metric>('cost')
  const [period, setPeriod] = useState(24)
  const [rows, setRows] = useState<RankRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchTenantRanking({ metric, period_hours: period })
      .then(r => setRows(r.data ?? []))
      .catch(e => toast.error(`Tenant ranking: ${e?.message ?? 'failed to load'}`))
      .finally(() => setLoading(false))
  }, [metric, period])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">Tenant Ranking</h2>
        <div className="admin-page-controls">
          <select
            className="admin-select"
            aria-label="Ranking metric"
            value={metric}
            onChange={e => setMetric(e.target.value as Metric)}
          >
            <option value="cost">By Cost</option>
            <option value="error_rate">By Error Rate</option>
            <option value="latency">By Latency</option>
            <option value="volume">By Volume</option>
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
            <option value={720}>Last 30d</option>
          </select>
        </div>
      </div>
      <div className="admin-card">
        <DataTable
          columns={metric === 'cost' ? COLS_COST : COLS_PERF}
          rows={rows}
          loading={loading}
          emptyText="No data for period"
        />
      </div>
    </div>
  )
}
