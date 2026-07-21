import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Bell, Bot, Coins, FileText, AlertCircle, Send, TrendingUp, BarChart3 } from 'lucide-react'
import KPICard from '../../components/admin/KPICard'
import MetricChart from '../../components/admin/MetricChart'
import TenantSelector from '../../components/admin/TenantSelector'
import PageHeader from '../../components/admin/ui/PageHeader'
import Card from '../../components/admin/ui/Card'
import { fetchAlerts, fetchUsageSummary, fetchUsageTotals } from '../../lib/api/adminClient'
import { useT } from '../../i18n/LanguageContext'

function fmtCost(v: number) {
  return `$${v.toFixed(4)}`
}

function fmtNum(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
}

export default function Overview() {
  const { t } = useT()
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
          toast.error(
            t('admin.overview.toast.totalsFailed', { error: totRes.reason?.message ?? 'failed' })
          )
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
          toast.error(
            t('admin.overview.toast.trendFailed', { error: sumRes.reason?.message ?? 'failed' })
          )
        }
        if (alertsRes.status === 'fulfilled') {
          setOpenAlerts(alertsRes.value.total ?? 0)
        }
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  // errors counts FAILED ocr_tasks, so the denominator must be documents. It used to be
  // llm_calls, which is extract + GL-suggestion calls: the suggestions inflated the
  // denominator and quietly understated the real failure rate.
  const errorRate =
    totals.documents > 0 ? ((totals.errors / totals.documents) * 100).toFixed(1) + '%' : '—'

  return (
    <div className="admin-page">
      <PageHeader
        title={t('admin.overview.title')}
        description={t('admin.overview.description')}
        actions={<TenantSelector value={tenantId} onChange={setTenantId} />}
      />

      <div className="kpi-grid">
        <KPICard
          label={t('admin.overview.kpi.llmCalls')}
          value={fmtNum(totals.llm_calls ?? 0)}
          icon={<Bot size={18} strokeWidth={2} />}
          loading={loading}
        />
        <KPICard
          label={t('admin.overview.kpi.cost')}
          value={fmtCost(totals.cost_usd ?? 0)}
          accent="yellow"
          icon={<Coins size={18} strokeWidth={2} />}
          loading={loading}
        />
        <KPICard
          label={t('admin.overview.kpi.errorRate')}
          value={errorRate}
          accent={totals.errors > 0 ? 'red' : 'green'}
          icon={<AlertCircle size={18} strokeWidth={2} />}
          loading={loading}
        />
        <KPICard
          label={t('admin.overview.kpi.openAlerts')}
          value={openAlerts}
          accent={openAlerts > 0 ? 'red' : 'green'}
          icon={<Bell size={18} strokeWidth={2} />}
          loading={loading}
        />
        <KPICard
          label={t('admin.overview.kpi.documents')}
          value={fmtNum(totals.documents ?? 0)}
          icon={<FileText size={18} strokeWidth={2} />}
          loading={loading}
        />
        <KPICard
          label={t('admin.overview.kpi.submissions')}
          value={fmtNum(totals.submissions ?? 0)}
          icon={<Send size={18} strokeWidth={2} />}
          loading={loading}
        />
      </div>

      <Card
        title={t('admin.overview.chart.dailyCost')}
        icon={<TrendingUp size={16} strokeWidth={2} />}
      >
        <MetricChart
          type="line"
          data={trend}
          xKey="date"
          series={[
            { key: 'cost_usd', label: t('admin.overview.series.costUsd'), color: '#f59e0b' },
          ]}
          yFormatter={fmtCost}
          loading={loading}
        />
      </Card>

      <Card
        title={t('admin.overview.chart.dailyLlmCalls')}
        icon={<BarChart3 size={16} strokeWidth={2} />}
      >
        <MetricChart
          type="bar"
          data={trend}
          xKey="date"
          series={[
            { key: 'llm_calls', label: t('admin.overview.series.llmCalls'), color: '#6366f1' },
          ]}
          yFormatter={fmtNum}
          loading={loading}
        />
      </Card>
    </div>
  )
}
