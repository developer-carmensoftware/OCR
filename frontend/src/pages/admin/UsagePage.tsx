import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable, { type Column } from '../../components/admin/DataTable'
import PeriodPicker, { granularityFor, today } from '../../components/admin/PeriodPicker'
import MetricChart from '../../components/admin/MetricChart'
import TenantSelector from '../../components/admin/TenantSelector'
import { fetchUsageSummary } from '../../lib/api/adminClient'
import { useT } from '../../i18n/LanguageContext'

interface UsageRow {
  date: string
  module_id: string
  tenant_id: string
  tenant_name?: string | null
  documents: number
  submissions: number
  llm_calls: number
  /** Vision calls — one per document. Null at monthly granularity. */
  extract_calls: number | null
  /** GL-mapping suggestions. Nobody presses a button for these; they ride along with a document. */
  suggest_calls: number | null
  tokens: number
  cost_usd: number
  errors: number
  avg_llm_latency_ms: number | null
}

function getCols(t: ReturnType<typeof useT>['t']): Column<UsageRow>[] {
  return [
    { key: 'date', label: t('admin.usage.col.date'), sortable: true, defaultDesc: true },
    { key: 'module_id', label: t('admin.usage.col.module'), sortable: true },
    {
      // `tenant_name`, not `tenant_id`: the cell shows the name, and keying the sort on
      // the id ordered the table by UUID.
      key: 'tenant_name',
      label: t('admin.usage.col.tenant'),
      sortable: true,
      render: r => r.tenant_name ?? r.tenant_id,
    },
    { key: 'documents', label: t('admin.usage.col.docs'), sortable: true, align: 'right' },
    // llm_calls is extract + suggest. Split so "how much did they use" (extract, which
    // tracks documents) is never read off a number the GL suggestions inflate.
    // Null at monthly granularity — the rollup never captured the split, and a 0 there
    // would read as "nobody ran an extraction that month".
    {
      key: 'extract_calls',
      label: t('admin.usage.col.extractCalls'),
      sortable: true,
      align: 'right',
      render: r => (r.extract_calls == null ? '—' : String(r.extract_calls)),
    },
    {
      key: 'suggest_calls',
      label: t('admin.usage.col.suggestCalls'),
      sortable: true,
      align: 'right',
      render: r => (r.suggest_calls == null ? '—' : String(r.suggest_calls)),
    },
    { key: 'tokens', label: t('admin.usage.col.tokens'), sortable: true, align: 'right' },
    {
      key: 'cost_usd',
      label: t('admin.usage.col.cost'),
      sortable: true,
      align: 'right',
      render: r => `$${Number(r.cost_usd).toFixed(4)}`,
    },
    { key: 'errors', label: t('admin.usage.col.errors'), sortable: true, align: 'right' },
  ]
}

function monthStartStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function UsagePage() {
  const { t } = useT()
  const [period, setPeriod] = useState({ from: monthStartStr(), to: today() })
  const [tenantId, setTenantId] = useState('')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<UsageRow[]>([])
  const [loading, setLoading] = useState(false)
  const { from, to } = period
  // Past 92 days the daily query is unbounded in rows, so the API answers from the
  // monthly rollup instead. That is what makes a year of history reachable here at all
  // — it used to be a red "Date range too wide" toast.
  const granularity = granularityFor(period)

  useEffect(() => {
    setLoading(true)
    fetchUsageSummary({ from, to, granularity, tenant_id: tenantId || undefined })
      .then(r => setRows(r.data ?? []))
      .catch(e =>
        toast.error(t('admin.usage.toast.loadFailed', { error: e?.message ?? 'failed to load' }))
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, granularity, tenantId])

  // Build per-bucket chart data (sum across modules). One bucket is a day, or a month
  // once the range passes 92 days.
  const chartData = Object.values(
    rows.reduce<Record<string, { date: string; credit_card_ocr: number; ap_invoice: number }>>(
      (acc, r) => {
        if (!acc[r.date]) acc[r.date] = { date: r.date, credit_card_ocr: 0, ap_invoice: 0 }
        // extract_calls, not llm_calls: this chart is read as "how much are they using
        // it", and the GL suggestions riding along would roughly double it. The monthly
        // rollup has no split, so it falls back to llm_calls rather than plotting zero.
        const n = r.extract_calls ?? r.llm_calls
        if (r.module_id === 'credit_card_ocr') acc[r.date].credit_card_ocr += n
        else if (r.module_id === 'ap_invoice') acc[r.date].ap_invoice += n
        return acc
      },
      {}
    )
  ).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">{t('admin.usage.title')}</h2>
        <div className="admin-page-controls">
          <PeriodPicker value={period} onChange={setPeriod} showGranularityNote />
          <TenantSelector value={tenantId} onChange={setTenantId} />
        </div>
      </div>

      <div className="admin-chart-card">
        <h3 className="admin-chart-title">{t('admin.usage.chartTitle')}</h3>
        <MetricChart
          type="stacked-bar"
          data={chartData}
          xKey="date"
          series={[
            {
              key: 'credit_card_ocr',
              label: t('admin.usage.series.creditCardOcr'),
              color: '#6366f1',
            },
            { key: 'ap_invoice', label: t('admin.usage.series.apInvoice'), color: '#22d3ee' },
          ]}
          loading={loading}
        />
      </div>

      <div className="admin-card">
        <DataTable
          columns={getCols(t)}
          rows={rows}
          loading={loading}
          emptyText={t('admin.usage.empty')}
          search={{
            value: search,
            onChange: setSearch,
            placeholder: t('admin.usage.searchPlaceholder'),
          }}
        />
      </div>
    </div>
  )
}
