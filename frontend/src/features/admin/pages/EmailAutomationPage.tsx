import { useEffect, useState } from 'react'
import { CheckCheck, ChevronDown, ChevronRight, Inbox, Loader2, Mailbox, Timer } from 'lucide-react'
import { toast } from 'sonner'
import DataTable, { type Column } from '@/features/admin/components/DataTable'
import KPICard from '@/features/admin/components/KPICard'
import TenantSelector from '@/features/admin/components/TenantSelector'
import PeriodPicker, { daysAgo } from '@/features/admin/components/PeriodPicker'
import PageHeader from '@/shared/components/ui/PageHeader'
import Tabs from '@/features/admin/components/ui/Tabs'
import Badge from '@/shared/components/common/Badge'
import EmptyState from '@/features/admin/components/ui/EmptyState'
import {
  fetchEmailBusinessUnits,
  fetchEmailDocuments,
  fetchEmailHealth,
  pollEmailNow,
  sweepEmailConfirmations,
  type EmailBusinessUnitRow,
  type EmailDocumentRow,
  type EmailIngestHealth,
} from '@/features/admin/api/email'
import { useT } from '@/i18n/LanguageContext'
import type { TKey } from '@/i18n/dict'
import { fmtDateTime } from '@/shared/lib/date'
import {
  REASON_CODES,
  reasonKey,
  STATUSES,
  statusTone,
  pollMessage,
  cronTone,
  relativeAge,
} from '@/features/admin/lib/emailStatus'

/**
 * What happened to the mail a customer forwarded.
 *
 * `email_documents` was write-only until this page: #/admin/extractions reads
 * `ocr_tasks`, so it sees only documents that got past `consume_document` — every
 * `no_rule_match` and `sender_not_allowed`, which is most of what goes wrong, was
 * invisible; #/admin/jobs reads `job_runs`, which carries no tenant for these jobs.
 * Both questions used to end at a SQL client.
 */

export default function EmailAutomationPage() {
  const { t } = useT()
  const [tab, setTab] = useState('documents')
  const [health, setHealth] = useState<EmailIngestHealth | null>(null)
  const [rows, setRows] = useState<EmailDocumentRow[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [units, setUnits] = useState<EmailBusinessUnitRow[] | null>(null)
  const [unitsDenied, setUnitsDenied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'poll' | 'confirm' | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [tenantId, setTenantId] = useState('')
  const [status, setStatus] = useState('')
  const [reason, setReason] = useState('')
  const [docSearch, setDocSearch] = useState('')
  const [from, setFrom] = useState(daysAgo(7))
  const [to, setTo] = useState(daysAgo(0))

  const loadDocuments = () => {
    setLoading(true)
    fetchEmailDocuments({
      tenant_id: tenantId || undefined,
      status: status || undefined,
      reason_code: reason || undefined,
      from,
      to: `${to}T23:59:59`,
    })
      .then(r => {
        setRows(r.data ?? [])
        setCounts(r.counts ?? {})
      })
      .catch(e => toast.error(t('admin.email.toast.loadFailed', { error: e?.message ?? '' })))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchEmailHealth()
      .then(setHealth)
      .catch(() => setHealth(null))
    // Business units need configs:write; a viewer gets 403 and the tab explains itself
    // rather than firing an error toast for a permission they simply do not hold.
    fetchEmailBusinessUnits()
      .then(r => setUnits(r.data ?? []))
      .catch(() => setUnitsDenied(true))
  }, [])

  useEffect(() => {
    loadDocuments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, status, reason, from, to])

  const run = async (which: 'poll' | 'confirm') => {
    if (which === 'poll' && !window.confirm(t('admin.email.confirmPoll'))) return
    setBusy(which)
    try {
      const result = which === 'poll' ? await pollEmailNow() : await sweepEmailConfirmations()
      const { tone, key, vars } = pollMessage(result)
      toast[tone === 'error' ? 'error' : tone === 'success' ? 'success' : 'info'](t(key, vars))
      // Its own toast rather than another number in the line above: mail past the hold
      // window is never coming back on any poll, which is a different kind of news from
      // "held, will replay". The standing signal is the anomaly alert the poll raises.
      if (result.beyond_window)
        toast.warning(t('admin.email.toast.beyondWindow', { n: result.beyond_window }))
      loadDocuments()
      fetchEmailHealth()
        .then(setHealth)
        .catch(() => {})
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const cron = health?.cron ?? {}
  const ingest = cron['email-ingest']
  const confirm = cron['email-confirm']
  const ageLabel = (iso: string | null | undefined) => {
    const age = relativeAge(iso)
    return age ? t(age.key, age.vars) : null
  }
  const posted24 = health?.documents_24h?.posted ?? 0
  const failed24 = health?.documents_24h?.failed ?? 0

  const docCols: Column<EmailDocumentRow>[] = [
    {
      key: '_expand',
      label: <span className="sr-only">{t('admin.email.expandRow')}</span>,
      render: r => (
        <button
          type="button"
          className="admin-icon-btn"
          aria-label={expandedId === r.id ? t('admin.email.collapse') : t('admin.email.expand')}
          aria-expanded={expandedId === r.id}
          onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
        >
          {expandedId === r.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      ),
    },
    // Nine columns, none of them sortable until now — on a queue whose two real
    // questions are "what came in last" and "what keeps failing".
    {
      key: 'created_at',
      label: t('admin.email.col.time'),
      sortable: true,
      defaultDesc: true,
      render: r => fmtDateTime(r.created_at),
    },
    {
      key: 'tenant_name',
      label: t('admin.email.col.bu'),
      sortable: true,
      // "dev.carmen4.com/carmencloud (carmencloud)" — 41 characters of host plus bu.
      render: r => (
        <span className="admin-cell-clip admin-cell-clip--sm" title={r.tenant_name ?? r.tenant_id}>
          {r.tenant_name ?? r.tenant_id}
        </span>
      ),
    },
    {
      key: 'attachment',
      label: t('admin.email.col.attachment'),
      sortable: true,
      // Bank filenames run past 60 characters (`E-TAX_INVOICE_CARD_4510…_20260721.PDF`),
      // and `.admin-td` is nowrap, so one of them decided the width of the whole table.
      // Clipped with the full name on hover and in the expanded row.
      render: r => (
        <span className="admin-cell-clip" title={r.attachment}>
          {r.attachment || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('admin.email.col.status'),
      sortable: true,
      render: r => <Badge variant={statusTone(r.status)}>{r.status}</Badge>,
    },
    {
      key: 'reason_code',
      label: t('admin.email.col.reason'),
      sortable: true,
      render: r => {
        if (!r.reason_code) return '—'
        const key = reasonKey(r.reason_code)
        return key ? t(key) : r.reason_code
      },
    },
    {
      key: 'doc_no',
      label: t('admin.email.col.docNo'),
      sortable: true,
      render: r => r.doc_no ?? '—',
    },
    { key: 'jv_no', label: t('admin.email.col.jv'), sortable: true, render: r => r.jv_no ?? '—' },
    {
      key: 'charged_docs',
      label: t('admin.email.col.charged'),
      sortable: true,
      align: 'right',
      render: r => (r.charged_docs == null ? '—' : r.charged_docs),
    },
  ]

  const unitCols: Column<EmailBusinessUnitRow>[] = [
    {
      key: 'tenant_name',
      label: t('admin.email.col.bu'),
      render: r => (
        <span className="admin-cell-clip admin-cell-clip--sm" title={r.tenant_name}>
          {r.tenant_name}
        </span>
      ),
    },
    {
      key: 'enabled',
      label: t('admin.email.col.enabled'),
      render: r => (
        <Badge variant={r.enabled ? 'ok' : 'neutral'}>
          {r.enabled ? t('admin.email.on') : t('admin.email.off')}
        </Badge>
      ),
    },
    {
      key: 'ingest_address',
      label: t('admin.email.col.address'),
      render: r => (
        <span className="admin-cell-clip admin-mono" title={r.ingest_address ?? ''}>
          {r.ingest_address ?? '—'}
        </span>
      ),
    },
    {
      key: 'gmail_confirmed_at',
      label: t('admin.email.col.forwarding'),
      render: r =>
        r.gmail_confirmed_at ? (
          <Badge variant="ok">{fmtDateTime(r.gmail_confirmed_at)}</Badge>
        ) : (
          <Badge variant="warn">{t('admin.email.notConfirmed')}</Badge>
        ),
    },
    {
      key: 'token',
      label: t('admin.email.col.token'),
      render: r =>
        r.token.configured ? (
          <span className="admin-mono">{r.token.fingerprint ?? '—'}</span>
        ) : (
          <Badge variant="error">{t('admin.email.noToken')}</Badge>
        ),
    },
    {
      key: 'active_rules',
      label: t('admin.email.col.rules'),
      align: 'right',
      render: r => `${r.active_rules}/${r.rules}`,
    },
    {
      key: 'documents_total',
      label: t('admin.email.col.documents'),
      align: 'right',
      render: r => r.documents_total,
    },
    {
      key: 'last_received_at',
      label: t('admin.email.col.lastMail'),
      render: r => fmtDateTime(r.last_received_at),
    },
  ]

  const emptyDocs = !loading && rows.length === 0

  return (
    <div className="admin-page">
      <PageHeader
        title={t('admin.email.title')}
        description={t('admin.email.description')}
        actions={
          <>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => run('confirm')}
              disabled={busy !== null}
            >
              {busy === 'confirm' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCheck size={14} />
              )}
              {t('admin.email.action.confirm')}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => run('poll')}
              disabled={busy !== null}
            >
              {busy === 'poll' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Inbox size={14} />
              )}
              {t('admin.email.action.poll')}
            </button>
          </>
        }
      />

      <div className="kpi-grid">
        <KPICard
          label={t('admin.email.kpi.poll')}
          value={ageLabel(ingest?.last_run) ?? t('admin.email.kpi.notScheduled')}
          sub={ingest ? t('admin.email.kpi.every', { schedule: ingest.schedule }) : undefined}
          accent={cronTone(ingest)}
          icon={<Timer size={16} />}
          loading={!health}
        />
        <KPICard
          label={t('admin.email.kpi.confirm')}
          value={ageLabel(confirm?.last_run) ?? t('admin.email.kpi.notScheduled')}
          sub={
            health ? t('admin.email.kpi.awaiting', { n: health.awaiting_confirmation }) : undefined
          }
          accent={cronTone(confirm)}
          icon={<CheckCheck size={16} />}
          loading={!health}
        />
        <KPICard
          label={t('admin.email.kpi.mailbox')}
          // Folder, not address: it is the short half, and it is the half that answers
          // "are we watching the right place". The address goes in `sub`.
          value={health?.mailbox.folder ?? t('admin.email.kpi.noMailbox')}
          sub={health?.mailbox.address ?? undefined}
          accent={health?.mailbox.configured ? 'default' : 'red'}
          icon={<Mailbox size={16} />}
          loading={!health}
        />
        <KPICard
          label={t('admin.email.kpi.today')}
          value={posted24}
          sub={t('admin.email.kpi.failed', { n: failed24 })}
          accent={failed24 > 0 ? 'yellow' : 'green'}
          icon={<Inbox size={16} />}
          loading={!health}
        />
      </div>

      <Tabs
        tabs={[
          { id: 'documents', label: t('admin.email.tab.documents') },
          { id: 'units', label: t('admin.email.tab.units') },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'documents' ? (
        <>
          <div className="admin-page-controls">
            <TenantSelector value={tenantId} onChange={setTenantId} />
            <select
              className="admin-select"
              aria-label={t('admin.email.statusAria')}
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="">{t('admin.email.status.all')}</option>
              {STATUSES.map(s => (
                <option key={s} value={s}>
                  {s}
                  {counts[s] != null ? ` (${counts[s]})` : ''}
                </option>
              ))}
            </select>
            <select
              className="admin-select"
              aria-label={t('admin.email.reasonAria')}
              value={reason}
              onChange={e => setReason(e.target.value)}
            >
              <option value="">{t('admin.email.reason.all')}</option>
              {REASON_CODES.map(r => (
                <option key={r} value={r}>
                  {t(`admin.email.reason.${r}` as TKey)}
                </option>
              ))}
            </select>
            <PeriodPicker
              value={{ from, to }}
              onChange={p => {
                setFrom(p.from)
                setTo(p.to)
              }}
            />
          </div>

          {emptyDocs ? (
            <EmptyState
              title={t('admin.email.empty.title')}
              description={t('admin.email.empty.description')}
            />
          ) : (
            <DataTable
              columns={docCols}
              rows={rows.map(r => ({ ...r, id: r.id }))}
              loading={loading}
              search={{
                value: docSearch,
                onChange: setDocSearch,
                placeholder: t('admin.email.searchPlaceholder'),
              }}
              expandedRowId={expandedId}
              renderExpandedRow={r => {
                const row = r as EmailDocumentRow
                return (
                  <dl className="admin-detail-list">
                    <dt>{t('admin.email.detail.error')}</dt>
                    <dd>{row.error_message ?? '—'}</dd>
                    <dt>{t('admin.email.detail.messageId')}</dt>
                    <dd className="admin-mono">{row.message_id}</dd>
                    <dt>{t('admin.email.detail.bank')}</dt>
                    <dd>{row.bank_code ?? '—'}</dd>
                    <dt>{t('admin.email.detail.task')}</dt>
                    <dd className="admin-mono">{row.task_id ?? '—'}</dd>
                    <dt>{t('admin.email.detail.auth')}</dt>
                    <dd className="admin-mono">{row.auth_verdict ?? '—'}</dd>
                  </dl>
                )
              }}
            />
          )}
        </>
      ) : unitsDenied ? (
        <EmptyState
          title={t('admin.email.units.denied.title')}
          description={t('admin.email.units.denied.description')}
        />
      ) : (
        <DataTable columns={unitCols} rows={units ?? []} loading={units === null} />
      )}
    </div>
  )
}
