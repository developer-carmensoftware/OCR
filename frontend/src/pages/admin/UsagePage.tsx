import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable, { type Column } from '../../components/admin/DataTable'
import DateRangePicker from '../../components/admin/DateRangePicker'
import MetricChart from '../../components/admin/MetricChart'
import TenantSelector from '../../components/admin/TenantSelector'
import { fetchUsageSummary } from '../../lib/api/adminClient'

interface UsageRow {
  date: string
  module_id: string
  tenant_id: string
  documents: number
  submissions: number
  llm_calls: number
  tokens: number
  cost_usd: number
  errors: number
  avg_llm_latency_ms: number | null
}

const COLS: Column<UsageRow>[] = [
  { key: 'date', label: 'Date', sortable: true },
  { key: 'module_id', label: 'Module', sortable: true },
  { key: 'tenant_id', label: 'Tenant', sortable: true },
  { key: 'documents', label: 'Docs', sortable: true, align: 'right' },
  { key: 'llm_calls', label: 'LLM Calls', sortable: true, align: 'right' },
  { key: 'tokens', label: 'Tokens', sortable: true, align: 'right' },
  {
    key: 'cost_usd',
    label: 'Cost (USD)',
    sortable: true,
    align: 'right',
    render: r => `$${Number(r.cost_usd).toFixed(4)}`,
  },
  { key: 'errors', label: 'Errors', sortable: true, align: 'right' },
]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function monthStartStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function UsagePage() {
  const [from, setFrom] = useState(monthStartStr)
  const [to, setTo] = useState(todayStr)
  const [tenantId, setTenantId] = useState('')
  const [rows, setRows] = useState<UsageRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchUsageSummary({ from, to, tenant_id: tenantId || undefined })
      .then(r => setRows(r.data ?? []))
      .catch(e => toast.error(`Usage: ${e?.message ?? 'failed to load'}`))
      .finally(() => setLoading(false))
  }, [from, to, tenantId])

  // Build daily aggregated chart data (sum across modules)
  const chartData = Object.values(
    rows.reduce<Record<string, { date: string; credit_card_ocr: number; ap_invoice: number }>>(
      (acc, r) => {
        if (!acc[r.date]) acc[r.date] = { date: r.date, credit_card_ocr: 0, ap_invoice: 0 }
        if (r.module_id === 'credit_card_ocr') acc[r.date].credit_card_ocr += r.llm_calls
        else if (r.module_id === 'ap_invoice') acc[r.date].ap_invoice += r.llm_calls
        return acc
      },
      {}
    )
  ).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">Usage</h2>
        <div className="admin-page-controls">
          <DateRangePicker
            from={from}
            to={to}
            onChange={(f, t) => {
              setFrom(f)
              setTo(t)
            }}
          />
          <TenantSelector value={tenantId} onChange={setTenantId} />
        </div>
      </div>

      <div className="admin-chart-card">
        <h3 className="admin-chart-title">LLM Calls by Module</h3>
        <MetricChart
          type="stacked-bar"
          data={chartData}
          xKey="date"
          series={[
            { key: 'credit_card_ocr', label: 'Credit Card OCR', color: '#6366f1' },
            { key: 'ap_invoice', label: 'AP Invoice', color: '#22d3ee' },
          ]}
          loading={loading}
        />
      </div>

      <div className="admin-card">
        <DataTable
          columns={COLS}
          rows={rows}
          loading={loading}
          emptyText="No usage data for period"
        />
      </div>
    </div>
  )
}
