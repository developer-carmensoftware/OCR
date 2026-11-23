import { useState, useEffect } from 'react'
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Clock,
  ExternalLink,
  Play,
  Copy,
  Check,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import DataTable, { type Column } from '@/features/admin/components/DataTable'
import PeriodPicker, { daysAgo, endOfDay, today } from '@/features/admin/components/PeriodPicker'
import PageHeader from '@/shared/components/ui/PageHeader'
import Tabs from '@/features/admin/components/ui/Tabs'
import KPICard from '@/features/admin/components/KPICard'
import Badge from '@/shared/components/common/Badge'
import CustomModal from '@/shared/components/common/CustomModal'
import { fetchJobs, fetchJobsOverview, runJobNow } from '@/features/admin/api/monitoring'
import { useTableQuery } from '@/features/admin/hooks/useTableQuery'
import { useTableData } from '@/features/admin/hooks/useTableData'
import { useT } from '@/i18n/LanguageContext'
import { fmtDateTime } from '@/shared/lib/date'

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

interface JobOverviewItem {
  job_name: string
  title: string
  category: string
  type: string
  description: string
  schedule: string
  active: boolean
  is_failing?: boolean
  scheduler_heartbeat?: {
    last_fired_at: string | null
    status: string | null
  }
  stats: {
    total_runs: number
    success_runs: number
    failed_runs: number
  }
  stats_24h: {
    total_runs: number
    success_runs: number
    failed_runs: number
  }
  last_run: {
    id: number
    status: string | null
    started_at: string | null
    completed_at: string | null
    duration_s: number | null
    rows_affected: number | null
    error_message: string | null
    is_stale?: boolean
  } | null
}

interface JobsOverviewData {
  window?: '24h' | '7d' | '30d'
  summary: {
    total_jobs: number
    healthy_jobs: number
    failing_jobs: number
    total_runs: number
    failed_runs: number
    total_runs_24h: number
    failed_runs_24h: number
  }
  jobs: JobOverviewItem[]
}

interface ErrorModalState {
  jobName: string
  title: string
  startedAt?: string | null
  duration?: number | null
  error: string
}

function timeAgo(iso: string | null | undefined): string | null {
  if (!iso) return null
  const diffMs = Date.now() - new Date(iso).getTime()
  if (diffMs < 0) return 'just now'
  const secs = Math.floor(diffMs / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatNextRun(schedule: string): string | null {
  if (!schedule || schedule === '—') return null
  const parts = schedule.trim().split(/\s+/)
  if (parts.length < 5) return null
  const [min, hour] = parts

  if (min === '*' && hour === '*') return 'every minute'
  if (min.startsWith('*/')) {
    const step = min.replace('*/', '')
    return `every ${step}m`
  }
  if (!min.includes('*') && !hour.includes('*')) {
    const pad = (n: string) => n.padStart(2, '0')
    return `daily at ${pad(hour)}:${pad(min)} UTC`
  }
  return null
}

export default function JobsPage() {
  const { t } = useT()
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>('overview')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedWindow, setSelectedWindow] = useState<'24h' | '7d' | '30d'>('24h')
  const [overview, setOverview] = useState<JobsOverviewData | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null)
  const [jobToConfirm, setJobToConfirm] = useState<JobOverviewItem | null>(null)
  const [errorModal, setErrorModal] = useState<ErrorModalState | null>(null)
  const [copied, setCopied] = useState(false)

  const { params, set, server } = useTableQuery({
    defaultSort: 'started_at',
    filters: { status: '', from: daysAgo(7), to: today(), job_name: '' },
  })

  const {
    rows,
    total,
    loading: logsLoading,
    reload: reloadLogs,
  } = useTableData<JobRow>(
    () =>
      fetchJobs({
        status: params.status || undefined,
        job_name: params.job_name || undefined,
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

  const loadOverview = async (win = selectedWindow) => {
    try {
      setOverviewLoading(true)
      const data = await fetchJobsOverview(win)
      setOverview(data)
    } catch (err) {
      console.error('Failed to load jobs overview:', err)
    } finally {
      setOverviewLoading(false)
    }
  }

  useEffect(() => {
    loadOverview(selectedWindow)
  }, [selectedWindow])

  const handleFilterJobLogs = (jobName: string) => {
    set({ job_name: jobName, q: '' })
    setActiveTab('logs')
  }

  const handleTriggerRun = async (job: JobOverviewItem) => {
    setJobToConfirm(null)
    try {
      setTriggeringJob(job.job_name)
      await runJobNow(job.job_name)
      toast.success(t('admin.jobs.toast.runSuccess', { jobName: job.title }))
      loadOverview()
      reloadLogs()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(t('admin.jobs.toast.runFailed', { jobName: job.title, error: msg }))
    } finally {
      setTriggeringJob(null)
    }
  }

  const handleCopyError = () => {
    if (!errorModal) return
    navigator.clipboard.writeText(errorModal.error)
    setCopied(true)
    toast.success(t('admin.jobs.errorModal.copied'))
    setTimeout(() => setCopied(false), 2000)
  }

  const filteredJobs =
    overview?.jobs.filter(job => {
      if (selectedCategory === 'all') return true
      return job.category === selectedCategory
    }) || []

  const overviewCols: Column<JobOverviewItem>[] = [
    {
      key: 'job_name',
      label: t('admin.jobs.col.jobName'),
      width: '28%',
      render: r => {
        const nextSchedule = formatNextRun(r.schedule)
        return (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{r.title}</div>
            <div className="admin-mono" style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
              {r.job_name}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-3)',
                marginTop: '0.2rem',
                whiteSpace: 'normal',
                lineHeight: 1.35,
              }}
              title={r.description}
            >
              {r.description}
            </div>
            {nextSchedule && (
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--primary)',
                  fontWeight: 500,
                  marginTop: '0.25rem',
                }}
              >
                {t('admin.jobs.nextRun', { time: nextSchedule })}
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'type',
      label: t('admin.jobs.col.type'),
      width: '110px',
      render: r => (
        <Badge variant={r.type === 'http' ? 'info' : r.type === 'procedure' ? 'warn' : 'neutral'}>
          {r.type === 'http'
            ? t('admin.jobs.type.http')
            : r.type === 'procedure'
              ? t('admin.jobs.type.procedure')
              : t('admin.jobs.type.sql')}
        </Badge>
      ),
    },
    {
      key: 'schedule',
      label: t('admin.jobs.col.schedule'),
      width: '110px',
      render: r => <span className="jobs-cron-tag">{r.schedule}</span>,
    },
    {
      key: 'last_run',
      label: t('admin.jobs.col.lastRun'),
      width: '180px',
      render: r => {
        const heartbeat = r.scheduler_heartbeat
        const cronAgo = timeAgo(heartbeat?.last_fired_at)
        const isSuccess = r.last_run?.status === 'success'
        const isFail = r.last_run?.status === 'failed'
        const isStale = r.last_run?.is_stale

        return (
          <div style={{ maxWidth: '170px', minWidth: 0, overflow: 'hidden' }}>
            {r.last_run ? (
              <>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}
                >
                  {isStale && isFail ? (
                    <span title="Error occurred in previous period, scheduler currently active">
                      <Badge variant="warn">{t('admin.jobs.badge.staleFailed')}</Badge>
                    </span>
                  ) : (
                    <Badge variant={isSuccess ? 'ok' : isFail ? 'error' : 'warn'}>
                      {r.last_run.status ?? '—'}
                    </Badge>
                  )}
                  {r.last_run.duration_s != null && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                      {r.last_run.duration_s}s
                    </span>
                  )}
                </div>
                <div
                  className="admin-mono"
                  style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}
                >
                  {fmtDateTime(r.last_run.started_at)}
                </div>
                {r.last_run.error_message && (
                  <button
                    type="button"
                    onClick={() =>
                      setErrorModal({
                        jobName: r.job_name,
                        title: r.title,
                        startedAt: r.last_run?.started_at,
                        duration: r.last_run?.duration_s,
                        error: r.last_run?.error_message || '',
                      })
                    }
                    className="admin-mono text-red"
                    style={{
                      fontSize: '0.75rem',
                      marginTop: '0.15rem',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      textDecoration: 'underline dotted',
                      display: 'block',
                      maxWidth: '160px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title="Click to view full error"
                  >
                    {r.last_run.error_message}
                  </button>
                )}
              </>
            ) : (
              <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>
                {t('admin.jobs.heartbeat.idleOk')}
              </span>
            )}

            {/* Cron Heartbeat info (Resolves Quiet vs Dead) */}
            {cronAgo && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.72rem',
                  color: heartbeat?.status === 'failed' ? 'var(--rose-text)' : 'var(--text-3)',
                  marginTop: '0.3rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={`pg_cron last triggered at ${heartbeat?.last_fired_at}`}
              >
                <Info size={11} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t('admin.jobs.heartbeat.cronFired', { time: cronAgo })}
                </span>
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'stats',
      label: `${t('admin.jobs.col.stats24h').replace('(24 ชม.)', '').replace('(24h)', '')} (${selectedWindow})`,
      width: '110px',
      render: r => {
        const stats = r.stats || r.stats_24h
        return (
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>
              {stats.total_runs}{' '}
              <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: '0.75rem' }}>
                runs
              </span>
            </div>
            {stats.total_runs > 0 && (
              <div style={{ fontSize: '0.75rem', marginTop: '0.15rem' }}>
                <span style={{ color: 'var(--emerald-text)', fontWeight: 600 }}>
                  {stats.success_runs} ok
                </span>
                {stats.failed_runs > 0 && (
                  <span
                    style={{ color: 'var(--rose-text)', fontWeight: 600, marginLeft: '0.35rem' }}
                  >
                    • {stats.failed_runs} fail
                  </span>
                )}
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'actions',
      label: t('admin.jobs.col.actions'),
      width: '210px',
      render: r => {
        const isRunning = triggeringJob === r.job_name
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setJobToConfirm(r)}
              disabled={isRunning || !r.active}
              title={t('admin.jobs.action.runNow')}
            >
              {isRunning ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
              {isRunning ? t('admin.jobs.action.running') : t('admin.jobs.action.runNow')}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => handleFilterJobLogs(r.job_name)}
              title={t('admin.jobs.action.viewLogs')}
            >
              <ExternalLink size={12} />
              {t('admin.jobs.action.viewLogs')}
            </button>
          </div>
        )
      },
    },
  ]

  const logCols: Column<JobRow>[] = [
    {
      key: 'started_at',
      label: t('admin.jobs.col.started'),
      sortable: true,
      defaultDesc: true,
      width: '18%',
      render: r => (
        <span className="admin-mono" style={{ fontSize: '0.82rem' }}>
          {fmtDateTime(r.started_at)}
        </span>
      ),
    },
    {
      key: 'job_name',
      label: t('admin.jobs.col.job'),
      sortable: true,
      width: '20%',
      render: r => <span className="admin-mono font-medium">{r.job_name}</span>,
    },
    {
      key: 'status',
      label: t('admin.jobs.col.status'),
      sortable: true,
      width: '12%',
      render: r => (
        <Badge variant={r.status === 'success' ? 'ok' : r.status === 'failed' ? 'error' : 'warn'}>
          {r.status ?? '—'}
        </Badge>
      ),
    },
    {
      key: 'duration_s',
      label: t('admin.jobs.col.duration'),
      align: 'right',
      width: '10%',
      render: r => (r.duration_s != null ? `${r.duration_s}s` : '—'),
    },
    {
      key: 'rows_affected',
      label: t('admin.jobs.col.rows'),
      sortable: true,
      align: 'right',
      width: '10%',
      render: r => (r.rows_affected != null ? String(r.rows_affected) : '—'),
    },
    {
      key: 'error_message',
      label: t('admin.jobs.col.error'),
      width: '30%',
      render: r =>
        r.error_message ? (
          <button
            type="button"
            onClick={() =>
              setErrorModal({
                jobName: r.job_name,
                title: r.job_name,
                startedAt: r.started_at,
                duration: r.duration_s,
                error: r.error_message || '',
              })
            }
            className="text-red admin-mono admin-cell-clip"
            style={{
              textAlign: 'left',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textDecoration: 'underline dotted',
            }}
            title="Click to view full error"
          >
            {r.error_message}
          </button>
        ) : (
          '—'
        ),
    },
  ]

  return (
    <div className="admin-page">
      <PageHeader
        title={t('admin.jobs.title')}
        description={t('admin.jobs.subtitle')}
        actions={
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              loadOverview()
              reloadLogs()
            }}
            disabled={overviewLoading || logsLoading}
          >
            <RefreshCw
              size={14}
              style={{
                animation: overviewLoading || logsLoading ? 'spin 1s linear infinite' : 'none',
              }}
            />
            Refresh
          </button>
        }
      />

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <KPICard
          label={t('admin.jobs.summary.total')}
          value={overview?.summary.total_jobs ?? '—'}
          icon={<Layers size={16} />}
          loading={overviewLoading && !overview}
        />
        <KPICard
          label={t('admin.jobs.summary.healthy')}
          value={overview?.summary.healthy_jobs ?? '—'}
          accent="green"
          icon={<CheckCircle2 size={16} />}
          loading={overviewLoading && !overview}
        />
        <KPICard
          label={t('admin.jobs.summary.failing')}
          value={overview?.summary.failing_jobs ?? '—'}
          accent={overview && overview.summary.failing_jobs > 0 ? 'red' : 'default'}
          icon={<AlertTriangle size={16} />}
          loading={overviewLoading && !overview}
        />
        <KPICard
          label={t('admin.jobs.summary.runs', { window: selectedWindow })}
          value={overview?.summary.total_runs ?? overview?.summary.total_runs_24h ?? '—'}
          sub={
            overview && (overview.summary.failed_runs > 0 || overview.summary.failed_runs_24h > 0)
              ? `${overview.summary.failed_runs ?? overview.summary.failed_runs_24h} failed`
              : undefined
          }
          accent={
            overview && (overview.summary.failed_runs > 0 || overview.summary.failed_runs_24h > 0)
              ? 'yellow'
              : 'default'
          }
          icon={<Clock size={16} />}
          loading={overviewLoading && !overview}
        />
      </div>

      {/* Primary Navigation Tabs */}
      <Tabs
        tabs={[
          { id: 'overview', label: t('admin.jobs.tab.overview') },
          { id: 'logs', label: t('admin.jobs.tab.logs') },
        ]}
        active={activeTab}
        onChange={id => setActiveTab(id as 'overview' | 'logs')}
      />

      {activeTab === 'overview' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Category Filter Toolbar & Window Selector */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div className="jobs-filter-group">
              {[
                { id: 'all', label: t('admin.jobs.filter.categoryAll') },
                { id: 'business', label: t('admin.jobs.filter.categoryBusiness') },
                { id: 'analytics', label: t('admin.jobs.filter.categoryAnalytics') },
                { id: 'maintenance', label: t('admin.jobs.filter.categoryMaintenance') },
                { id: 'integration', label: t('admin.jobs.filter.categoryIntegration') },
              ].map(cat => {
                const isSelected = selectedCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`jobs-category-pill${isSelected ? ' active' : ''}`}
                  >
                    {cat.label}
                  </button>
                )
              })}
            </div>

            {/* Window Pills: 24h / 7d / 30d */}
            <div className="jobs-window-group" role="group" aria-label="Window range selector">
              {(['24h', '7d', '30d'] as const).map(win => {
                const isCurrent = selectedWindow === win
                return (
                  <button
                    key={win}
                    type="button"
                    onClick={() => setSelectedWindow(win)}
                    className={`jobs-window-pill${isCurrent ? ' active' : ''}`}
                  >
                    {t(`admin.jobs.window.${win}`)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Job Overview DataTable */}
          <div className="admin-card">
            <DataTable
              columns={overviewCols}
              rows={filteredJobs}
              loading={overviewLoading}
              emptyText={t('admin.jobs.empty')}
            />
          </div>
        </div>
      ) : (
        /* Logs Tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="admin-page-controls" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {params.job_name && (
                <div className="jobs-filter-badge">
                  <span>
                    Job: <strong className="admin-mono">{params.job_name}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => set({ job_name: '' })}
                    className="jobs-filter-badge-clear"
                    title="Clear filter"
                  >
                    ×
                  </button>
                </div>
              )}
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
            </div>
            <PeriodPicker
              value={{ from: params.from, to: params.to }}
              onChange={p => set({ from: p.from, to: p.to })}
            />
          </div>

          <div className="admin-card">
            <DataTable
              columns={logCols}
              rows={rows}
              loading={logsLoading}
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
      )}

      {/* Error Details Modal */}
      {errorModal && (
        <CustomModal
          show={true}
          type="error"
          wide
          onCancel={() => setErrorModal(null)}
          title={t('admin.jobs.errorModal.title')}
          cancelText={t('admin.jobs.errorModal.close')}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              textAlign: 'left',
            }}
          >
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text)' }}>
                  {errorModal.title}
                </div>
                <div className="admin-mono" style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>
                  {errorModal.jobName}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Badge variant="error">FAILED</Badge>
                {errorModal.duration != null && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.2rem' }}>
                    {errorModal.duration}s
                  </div>
                )}
              </div>
            </div>

            {errorModal.startedAt && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>
                Started: <span className="admin-mono">{fmtDateTime(errorModal.startedAt)}</span>
              </div>
            )}

            <div className="jobs-error-box">{errorModal.error}</div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleCopyError}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {t('admin.jobs.errorModal.copy')}
              </button>
            </div>
          </div>
        </CustomModal>
      )}

      {/* Confirmation Modal for Run Now */}
      {jobToConfirm && (
        <CustomModal
          show={true}
          type="warning"
          title={t('admin.jobs.action.runNow')}
          message={t('admin.jobs.confirmRun', { jobName: jobToConfirm.title })}
          confirmText={t('admin.jobs.action.runNow')}
          cancelText={t('admin.jobs.errorModal.close')}
          onConfirm={() => handleTriggerRun(jobToConfirm)}
          onCancel={() => setJobToConfirm(null)}
          busy={triggeringJob === jobToConfirm.job_name}
        />
      )}
    </div>
  )
}
