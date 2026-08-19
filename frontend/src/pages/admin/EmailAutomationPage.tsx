import { useEffect, useState } from 'react'
import { CheckCheck, ChevronDown, ChevronRight, Inbox, Loader2, Mailbox, Timer } from 'lucide-react'
import { toast } from 'sonner'
import DataTable, { type Column } from '../../components/admin/DataTable'
import KPICard from '../../components/admin/KPICard'
import TenantSelector from '../../components/admin/TenantSelector'
import DateRangePicker from '../../components/admin/DateRangePicker'
import PageHeader from '../../components/admin/ui/PageHeader'
import Tabs from '../../components/admin/ui/Tabs'
import Badge from '../../components/admin/ui/Badge'
import EmptyState from '../../components/admin/ui/EmptyState'
import {
  fetchEmailBusinessUnits,
  fetchEmailDocuments,
  fetchEmailHealth,
  pollEmailNow,
  sweepEmailConfirmations,
  type EmailBusinessUnitRow,
  type EmailDocumentRow,
  type EmailIngestHealth,
  type EmailPollResult,
} from '../../lib/api/adminClient'
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/dict'
import { fmtDateTime } from '../../lib/date'

/**
 * What happened to the mail a customer forwarded.
 *
 * `email_documents` was write-only until this page: #/admin/extractions reads
 * `ocr_tasks`, so it sees only documents that got past `consume_document` — every
 * `no_rule_match` and `sender_not_allowed`, which is most of what goes wrong, was
 * invisible; #/admin/jobs reads `job_runs`, which carries no tenant for these jobs.
 * Both questions used to end at a SQL client.
 */

/** The ten the pipeline actually writes. CARMEN_INTEGRATION §3.3 lists three more
 *  (`out_of_credits`, `bank_not_identified`, `unbalanced_jv`) that it never emits —
 *  offering them as filters would promise rows that cannot exist. */
const REASON_CODES = [
  'sender_not_allowed',
  'no_rule_match',
  'unreadable_document',
  'wrong_pdf_password',
  'tax_id_mismatch',
  'duplicate_document',
  'mapping_incomplete',
  'carmen_rejected',
  'unsupported_attachment',
  'ingest_paused',
] as const

/** A code the pipeline writes maps to a label; anything else shows as itself, so a
 *  reason added to the backend without a translation is visible rather than blank. */
function reasonKey(code: string): TKey | null {
  return (REASON_CODES as readonly string[]).includes(code)
    ? (`admin.email.reason.${code}` as TKey)
    : null
}

const STATUSES = ['posted', 'failed', 'skipped', 'received'] as const

/**
 * `received` is neutral rather than "in progress": every write path leaves a terminal
 * status, so a row still sitting on `received` means the process died mid-document.
 * Worth seeing plainly, not dressed up as pending.
 */
export function statusTone(status: string): 'ok' | 'warn' | 'error' | 'neutral' {
  if (status === 'posted') return 'ok'
  if (status === 'failed') return 'error'
  if (status === 'skipped') return 'warn'
  return 'neutral'
}

/**
 * The four shapes a poll answers with, in the operator's words.
 *
 * `running` is not an error: the request waits 25s, the poll keeps going under
 * `asyncio.shield`, and the documents arrive in the table on the next refresh. Saying
 * "failed" there would send someone hunting a problem that does not exist.
 */
export function pollMessage(r: EmailPollResult): {
  tone: 'success' | 'info' | 'error'
  key: TKey
  vars?: Record<string, string | number>
} {
  if (r.status === 'disabled') return { tone: 'error', key: 'admin.email.toast.disabled' }
  if (r.status === 'busy') return { tone: 'info', key: 'admin.email.toast.busy' }
  if (r.status === 'running') return { tone: 'info', key: 'admin.email.toast.running' }
  if (r.confirmed !== undefined)
    return {
      tone: r.confirmed ? 'success' : 'info',
      key: 'admin.email.toast.confirmed',
      vars: { confirmed: r.confirmed, checked: r.checked ?? 0 },
    }
  const messages = r.messages ?? 0
  if (!messages) return { tone: 'info', key: 'admin.email.toast.noMail' }
  return {
    tone: 'success',
    key: 'admin.email.toast.polled',
    vars: {
      messages,
      posted: r.posted ?? 0,
      failed: r.failed ?? 0,
      skipped: r.skipped ?? 0,
      // Mail put back unread because the BU is switched off, out of package or has the
      // module disabled. It is the only outcome that leaves no row in the table below,
      // so the count here is the only place a growing backlog is visible at all.
      held: r.retry_later ?? 0,
    },
  }
}

/** Green while a schedule is active and fired within twice its own interval. */
function cronTone(job: { active: boolean; last_status: string | null } | undefined) {
  if (!job || !job.active) return 'yellow' as const
  if (job.last_status && job.last_status !== 'succeeded') return 'red' as const
  return 'green' as const
}

/**
 * "3 min ago", not "2026-08-17 15:40:00".
 *
 * The tile answers one question — is this still running — and an absolute timestamp
 * makes the reader do the subtraction. It is also 19 characters of 1.6rem/800 type in
 * a 200px tile, which is how the card came to overflow in the first place. The exact
 * time stays one hover away in `title`.
 */
export function relativeAge(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return null
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return { key: 'admin.email.age.now' as TKey, vars: undefined }
  if (minutes < 60) return { key: 'admin.email.age.min' as TKey, vars: { n: minutes } }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { key: 'admin.email.age.hour' as TKey, vars: { n: hours } }
  return { key: 'admin.email.age.day' as TKey, vars: { n: Math.floor(hours / 24) } }
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

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
    { key: 'created_at', label: t('admin.email.col.time'), render: r => fmtDateTime(r.created_at) },
    {
      key: 'tenant_name',
      label: t('admin.email.col.bu'),
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
      render: r => <Badge status={statusTone(r.status)}>{r.status}</Badge>,
    },
    {
      key: 'reason_code',
      label: t('admin.email.col.reason'),
      render: r => {
        if (!r.reason_code) return '—'
        const key = reasonKey(r.reason_code)
        return key ? t(key) : r.reason_code
      },
    },
    { key: 'doc_no', label: t('admin.email.col.docNo'), render: r => r.doc_no ?? '—' },
    { key: 'jv_no', label: t('admin.email.col.jv'), render: r => r.jv_no ?? '—' },
    {
      key: 'charged_docs',
      label: t('admin.email.col.charged'),
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
        <Badge status={r.enabled ? 'ok' : 'neutral'}>
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
          <Badge status="ok">{fmtDateTime(r.gmail_confirmed_at)}</Badge>
        ) : (
          <Badge status="warn">{t('admin.email.notConfirmed')}</Badge>
        ),
    },
    {
      key: 'token',
      label: t('admin.email.col.token'),
      render: r =>
        r.token.configured ? (
          <span className="admin-mono">{r.token.fingerprint ?? '—'}</span>
        ) : (
          <Badge status="error">{t('admin.email.noToken')}</Badge>
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
            <DateRangePicker
              from={from}
              to={to}
              onChange={(f, tt) => {
                setFrom(f)
                setTo(tt)
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
