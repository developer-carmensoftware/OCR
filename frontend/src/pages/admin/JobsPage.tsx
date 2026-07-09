import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable, { type Column } from '../../components/admin/DataTable'
import { fetchJobs } from '../../lib/api/adminClient'

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

const COLS: Column<JobRow>[] = [
  {
    key: 'started_at',
    label: 'Started',
    sortable: true,
    render: r => r.started_at?.slice(0, 19).replace('T', ' ') ?? '—',
  },
  { key: 'job_name', label: 'Job', sortable: true },
  {
    key: 'status',
    label: 'Status',
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
    label: 'Duration',
    align: 'right',
    render: r => (r.duration_s != null ? `${r.duration_s}s` : '—'),
  },
  {
    key: 'rows_affected',
    label: 'Rows',
    align: 'right',
    render: r => (r.rows_affected != null ? String(r.rows_affected) : '—'),
  },
  {
    key: 'error_message',
    label: 'Error',
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

export default function JobsPage() {
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchJobs({ status: status || undefined, limit: 100 })
      .then(r => setRows(r.data ?? []))
      .catch(e => toast.error(`Jobs: ${e?.message ?? 'failed to load'}`))
      .finally(() => setLoading(false))
  }, [status])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">Job Runs</h2>
        <div className="admin-page-controls">
          <select
            className="admin-select"
            aria-label="Job status filter"
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="running">Running</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>
      <div className="admin-card">
        <DataTable columns={COLS} rows={rows} loading={loading} emptyText="No job runs found" />
      </div>
    </div>
  )
}
