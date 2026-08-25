import DataTable, { type Column } from '../../components/admin/DataTable'
import PeriodPicker, { daysAgo, endOfDay, today } from '../../components/admin/PeriodPicker'
import { fetchJobs } from '../../lib/api/adminClient'
import { useTableQuery } from '../../hooks/admin/useTableQuery'
import { useTableData } from '../../hooks/admin/useTableData'
import { useT } from '../../i18n/LanguageContext'
import { fmtDateTime } from '../../lib/date'

interface JobRow {
  id: string
  job_name: string
  status: string | null
  started_at: string | null
  completed_at: string | null
  duration_s: number | null
  rows_affected: number | null
  error_message: string | null
}

function getCols(t: ReturnType<typeof useT>['t']): Column<JobRow>[] {
  return [
    {
      key: 'started_at',
      label: t('admin.jobs.col.started'),
      sortable: true,
      defaultDesc: true,
      render: r => fmtDateTime(r.started_at),
    },
    { key: 'job_name', label: t('admin.jobs.col.job'), sortable: true },
    {
      key: 'status',
      label: t('admin.jobs.col.status'),
      sortable: true,
      render: r => (
        <span
          className={`status-badge ${r.status === 'success' ? 'ok' : r.status === 'failed' ? 'error' : 'warn'}`}
        >
          {r.status ?? '—'}
        </span>
      ),
    },
    {
      key: 'duration_s',
      label: t('admin.jobs.col.duration'),
      align: 'right',
      render: r => (r.duration_s != null ? `${r.duration_s}s` : '—'),
    },
    {
      key: 'rows_affected',
      label: t('admin.jobs.col.rows'),
      sortable: true,
      align: 'right',
      render: r => (r.rows_affected != null ? String(r.rows_affected) : '—'),
    },
    {
      key: 'error_message',
      label: t('admin.jobs.col.error'),
      render: r =>
        r.error_message ? (
          <span className="text-red admin-mono" title={r.error_message}>
            {r.error_message.slice(0, 80)}
          </span>
        ) : (
          '—'
        ),
    },
  ]
}

export default function JobsPage() {
  const { t } = useT()
  const { params, set, server } = useTableQuery({
    defaultSort: 'started_at',
    filters: { status: '', from: daysAgo(7), to: today() },
  })
  const { rows, total, loading } = useTableData<JobRow>(
    () =>
      fetchJobs({
        status: params.status || undefined,
        from: params.from,
        to: endOfDay(params.to),
        q: params.q || undefined,
        sort: params.sort,
        dir: params.dir,
        limit: params.limit,
        offset: params.offset,
      }),
    [params],
    'admin.jobs.toast.loadFailed'
  )

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">{t('admin.jobs.title')}</h2>
        <div className="admin-page-controls">
          <select
            className="admin-select"
            aria-label={t('admin.jobs.statusFilterAria')}
            value={params.status}
            onChange={e => set({ status: e.target.value })}
          >
            <option value="">{t('admin.jobs.status.all')}</option>
            <option value="running">{t('admin.jobs.status.running')}</option>
            <option value="success">{t('admin.jobs.status.success')}</option>
            <option value="failed">{t('admin.jobs.status.failed')}</option>
          </select>
          <PeriodPicker
            value={{ from: params.from, to: params.to }}
            onChange={p => set({ from: p.from, to: p.to })}
          />
        </div>
      </div>
      <div className="admin-card">
        <DataTable
          columns={getCols(t)}
          rows={rows}
          loading={loading}
          emptyText={t('admin.jobs.empty')}
          server={server(total)}
          search={{
            value: params.q,
            onChange: q => set({ q }),
            placeholder: t('admin.jobs.searchPlaceholder'),
          }}
        />
      </div>
    </div>
  )
}
