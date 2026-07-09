import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Bell, Bot, Coins, FileText, AlertCircle, Send, TrendingUp, BarChart3 } from 'lucide-react'
import KPICard from '../../components/admin/KPICard'
import MetricChart from '../../components/admin/MetricChart'
import TenantSelector from '../../components/admin/TenantSelector'
import PageHeader from '../../components/admin/ui/PageHeader'
import Card from '../../components/admin/ui/Card'
import { fetchAlerts, fetchUsageSummary, fetchUsageTotals } from '../../lib/api/adminClient'

function fmtCost(v: number) {
  return `$${v.toFixed(4)}`
}

function fmtNum(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
}

export default function Overview() {
  const [tenantId, setTenantId] = useState('')
  const [totals, setTotals] = useState<Record<string, number>>({})
  const [trend, setTrend] = useState<Record<string, unknown>[]>([])
  const [openAlerts, setOpenAlerts] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10)

    setLoading(true)
    Promise.allSettled([
      fetchUsageTotals({ tenant_id: tenantId || undefined }),
      fetchUsageSummary({ from: thirtyDaysAgo, to: today, tenant_id: tenantId || undefined }),
      fetchAlerts({ status: 'open', limit: 1 }),
    ])
      .then(([totRes, sumRes, alertsRes]) => {
        if (totRes.status === 'fulfilled') {
          setTotals(totRes.value.totals ?? {})
        } else {
          toast.error(`Totals: ${totRes.reason?.message ?? 'failed'}`)
        }
        if (sumRes.status === 'fulfilled') {
          const byDate: Record<string, { date: string; cost_usd: number; llm_calls: number }> = {}
          for (const row of sumRes.value.data ?? []) {
            const d = row.date as string
            if (!byDate[d]) byDate[d] = { date: d, cost_usd: 0, llm_calls: 0 }
            byDate[d].cost_usd += Number(row.cost_usd ?? 0)
            byDate[d].llm_calls += Number(row.llm_calls ?? 0)
          }
          setTrend(
            Object.values(byDate)
              .sort((a, b) => a.date.localeCompare(b.date))
              .map(r => ({ ...r, cost_usd: Number(r.cost_usd.toFixed(6)) }))
          )
        } else {
          toast.error(`Trend: ${sumRes.reason?.message ?? 'failed'}`)
        }
        if (alertsRes.status === 'fulfilled') {
          setOpenAlerts(alertsRes.value.total ?? 0)
        }
      })
      .finally(() => setLoading(false))
  }, [tenantId])

  const errorRate =
    totals.llm_calls > 0 ? ((totals.errors / totals.llm_calls) * 100).toFixed(1) + '%' : '—'

  return (
    <div className="admin-page">
      <PageHeader
        title="Overview"
        description="Usage, cost, and health across your tenants for the last 30 days."
        actions={<TenantSelector value={tenantId} onChange={setTenantId} />}
      />

      <div className="kpi-grid">
        <KPICard
          label="LLM Calls (MTD)"
          value={fmtNum(totals.llm_calls ?? 0)}
          icon={<Bot size={18} strokeWidth={2} />}
          loading={loading}
        />
        <KPICard
          label="Cost (MTD)"
          value={fmtCost(totals.cost_usd ?? 0)}
          accent="yellow"
          icon={<Coins size={18} strokeWidth={2} />}
          loading={loading}
        />
        <KPICard
          label="Error Rate"
          value={errorRate}
          accent={totals.errors > 0 ? 'red' : 'green'}
          icon={<AlertCircle size={18} strokeWidth={2} />}
          loading={loading}
        />
        <KPICard
          label="Open Alerts"
          value={openAlerts}
          accent={openAlerts > 0 ? 'red' : 'green'}
          icon={<Bell size={18} strokeWidth={2} />}
          loading={loading}
        />
        <KPICard
          label="Documents (MTD)"
          value={fmtNum(totals.documents ?? 0)}
          icon={<FileText size={18} strokeWidth={2} />}
          loading={loading}
        />
        <KPICard
          label="Submissions (MTD)"
          value={fmtNum(totals.submissions ?? 0)}
          icon={<Send size={18} strokeWidth={2} />}
          loading={loading}
        />
      </div>

      <Card title="Daily Cost (30 days)" icon={<TrendingUp size={16} strokeWidth={2} />}>
        <MetricChart
          type="line"
          data={trend}
          xKey="date"
          series={[{ key: 'cost_usd', label: 'Cost USD', color: '#f59e0b' }]}
          yFormatter={fmtCost}
          loading={loading}
        />
      </Card>

      <Card title="Daily LLM Calls (30 days)" icon={<BarChart3 size={16} strokeWidth={2} />}>
        <MetricChart
          type="bar"
          data={trend}
          xKey="date"
          series={[{ key: 'llm_calls', label: 'LLM Calls', color: '#6366f1' }]}
          yFormatter={fmtNum}
          loading={loading}
        />
      </Card>
    </div>
  )
}
