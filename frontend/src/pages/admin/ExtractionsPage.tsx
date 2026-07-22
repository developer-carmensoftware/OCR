import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import DataTable, { type Column } from '../../components/admin/DataTable'
import TenantSelector from '../../components/admin/TenantSelector'
import DateRangePicker from '../../components/admin/DateRangePicker'
import PageHeader from '../../components/admin/ui/PageHeader'
import Tabs from '../../components/admin/ui/Tabs'
import EmptyState from '../../components/admin/ui/EmptyState'
import { fetchExtractionFailures, type ExtractionFailureRow } from '../../lib/api/adminClient'
import { useT } from '../../i18n/LanguageContext'
import { fmtDateTime } from '../../lib/dates'

/**
 * Why an extraction failed. /error-breakdown reports how MANY failed; this reports
 * why, and whose — the gap that let a locked-PDF wall sit behind an `errors: 4`
 * cell for a month with nothing to click.
 *
 * Grouping is client-side on purpose: pilot volume is ~11 failures/month (~220 at
 * 20x beta scale), so one bounded fetch feeds both tabs and regrouping costs no
 * round-trip.
 */

/**
 * Ordered — first match wins. Matches BOTH the raw parser text written before the
 * LLMParseError guard AND the friendly string written after it; once error_message
 * became a user-facing sentence, the raw text lives only in the server log, so the
 * friendly alternative is the only thing that keeps this page seeing new failures.
 */
const ERROR_RULES: [string, RegExp][] = [
  ['pdfEncrypted', /document closed or encrypted|password[- ]protected/i],
  ['pdfUnreadable', /cannot open|no pages|corrupt|broken/i],
  [
    'llmBadJson',
    /unterminated string|expecting value|expecting .{1,12} delimiter|expecting property name|extra data|invalid control character|could not read this document/i,
  ],
  ['llmUnavailable', /timed? out|timeout|service unavailable|503|rate.?limit/i],
  ['quotaExhausted', /quota|credit/i],
  ['carmenDown', /carmen/i],
]

export function classify(msg: string | null | undefined): string {
  if (!msg) return 'unknown'
  for (const [key, pattern] of ERROR_RULES) {
    if (pattern.test(msg)) return key
  }
  return 'other'
}

interface FailureGroup {
  id: string
  cause: string
  failures: number
  bu_count: number
  modules: string
  first_seen: string | null
  last_seen: string | null
  rows: ExtractionFailureRow[]
}

function groupByCause(rows: ExtractionFailureRow[]): FailureGroup[] {
  const byCause = new Map<string, ExtractionFailureRow[]>()
  for (const r of rows) {
    const cause = classify(r.error_message)
    const bucket = byCause.get(cause)
    if (bucket) bucket.push(r)
    else byCause.set(cause, [r])
  }
  return [...byCause.entries()]
    .map(([cause, groupRows]) => {
      const times = groupRows.map(r => r.created_at).filter((t): t is string => !!t)
      return {
        id: cause,
        cause,
        failures: groupRows.length,
        // Distinct BUs, not a sum — one BU hitting the same cause twice is one BU.
        bu_count: new Set(groupRows.map(r => r.tenant_id)).size,
        modules: [...new Set(groupRows.map(r => r.module_id))].join(', '),
        first_seen: times.length ? times.reduce((a, b) => (a < b ? a : b)) : null,
        last_seen: times.length ? times.reduce((a, b) => (a > b ? a : b)) : null,
        rows: groupRows,
      }
    })
    .sort((a, b) => b.failures - a.failures)
}

const fmtDate = fmtDateTime
const monthStart = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
const todayStr = () => new Date().toISOString().slice(0, 10)

function causeLabel(t: ReturnType<typeof useT>['t'], cause: string): string {
  const LABELS: Record<string, string> = {
    pdfEncrypted: t('admin.extractions.class.pdfEncrypted'),
    pdfUnreadable: t('admin.extractions.class.pdfUnreadable'),
    llmBadJson: t('admin.extractions.class.llmBadJson'),
    llmUnavailable: t('admin.extractions.class.llmUnavailable'),
    quotaExhausted: t('admin.extractions.class.quotaExhausted'),
    carmenDown: t('admin.extractions.class.carmenDown'),
    other: t('admin.extractions.class.other'),
    unknown: t('admin.extractions.class.unknown'),
  }
  return LABELS[cause] ?? cause
}

/** Module-level: closes over nothing but `t`. */
function getListCols(t: ReturnType<typeof useT>['t']): Column<ExtractionFailureRow>[] {
  return [
    {
      key: 'created_at',
      label: t('admin.extractions.col.time'),
      sortable: true,
      render: r => fmtDate(r.created_at),
    },
    {
      key: 'tenant_name',
      label: t('admin.extractions.col.tenant'),
      sortable: true,
      render: r => r.tenant_name ?? r.tenant_id,
    },
    { key: 'module_id', label: t('admin.extractions.col.module'), sortable: true },
    {
      key: 'original_filename',
      label: t('admin.extractions.col.file'),
      render: r => <span title={r.original_filename ?? ''}>{r.original_filename ?? '—'}</span>,
    },
    {
      key: 'error_message',
      label: t('admin.extractions.col.error'),
      render: r => (
        <span className="admin-mono-sm" title={r.error_message ?? ''}>
          {r.error_message ?? '—'}
        </span>
      ),
    },
    {
      key: 'total_tokens',
      label: t('admin.extractions.col.tokens'),
      sortable: true,
      align: 'right',
      // null = the model was never called; 0 = it was called and returned nothing.
      // That distinction is the whole diagnosis, so never collapse it to a dash.
      render: r =>
        r.total_tokens === null ? (
          <span className="text-muted" title={t('admin.extractions.detail.noLlmCall')}>
            —
          </span>
        ) : (
          String(r.total_tokens)
        ),
    },
    {
      key: 'duration_ms',
      label: t('admin.extractions.col.duration'),
      sortable: true,
      align: 'right',
      render: r => (r.duration_ms === null ? '—' : `${(r.duration_ms / 1000).toFixed(1)}s`),
    },
  ]
}

export default function ExtractionsPage() {
  const { t } = useT()
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(todayStr)
  const [tenantId, setTenantId] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [tab, setTab] = useState('grouped')
  const [rows, setRows] = useState<ExtractionFailureRow[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Not keyed on `tab` — both tabs render from this one array.
  useEffect(() => {
    setLoading(true)
    fetchExtractionFailures({
      from,
      to,
      tenant_id: tenantId || undefined,
      module_id: moduleId || undefined,
    })
      .then(r => setRows(r.data ?? []))
      .catch(e =>
        toast.error(
          t('admin.extractions.toast.loadFailed', { error: e?.message ?? 'failed to load' })
        )
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, tenantId, moduleId])

  const groups = useMemo(() => groupByCause(rows), [rows])

  // Inline, not module-level: closes over expandedId.
  const groupCols: Column<FailureGroup>[] = [
    {
      key: '_expand',
      label: <span className="sr-only">{t('admin.extractions.expandRow')}</span>,
      render: g => (
        <button
          type="button"
          className="admin-icon-btn"
          aria-label={
            expandedId === g.id ? t('admin.extractions.collapse') : t('admin.extractions.expand')
          }
          aria-expanded={expandedId === g.id}
          onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
        >
          {expandedId === g.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      ),
    },
    {
      key: 'cause',
      label: t('admin.extractions.col.cause'),
      sortable: true,
      render: g => causeLabel(t, g.cause),
    },
    { key: 'failures', label: t('admin.extractions.col.failures'), sortable: true, align: 'right' },
    { key: 'bu_count', label: t('admin.extractions.col.bus'), sortable: true, align: 'right' },
    { key: 'modules', label: t('admin.extractions.col.module') },
    {
      key: 'first_seen',
      label: t('admin.extractions.col.firstSeen'),
      sortable: true,
      render: g => fmtDate(g.first_seen),
    },
    {
      key: 'last_seen',
      label: t('admin.extractions.col.lastSeen'),
      sortable: true,
      render: g => fmtDate(g.last_seen),
    },
  ]

  const empty = !loading && rows.length === 0

  return (
    <div className="admin-page">
      <PageHeader
        title={t('admin.extractions.title')}
        description={t('admin.extractions.description')}
        actions={
          <>
            <select
              className="admin-select"
              aria-label={t('admin.extractions.moduleAria')}
              value={moduleId}
              onChange={e => setModuleId(e.target.value)}
            >
              <option value="">{t('admin.extractions.module.all')}</option>
              <option value="credit_card_ocr">{t('admin.extractions.module.creditCard')}</option>
              <option value="ap_invoice">{t('admin.extractions.module.apInvoice')}</option>
            </select>
            <TenantSelector value={tenantId} onChange={setTenantId} />
            <DateRangePicker
              from={from}
              to={to}
              onChange={(f, tt) => {
                setFrom(f)
                setTo(tt)
              }}
            />
          </>
        }
      />

      <Tabs
        tabs={[
          { id: 'grouped', label: t('admin.extractions.tab.grouped') },
          { id: 'list', label: t('admin.extractions.tab.list') },
        ]}
        active={tab}
        onChange={setTab}
      />

      {empty ? (
        <EmptyState title={t('admin.extractions.empty')} />
      ) : tab === 'grouped' ? (
        <DataTable
          columns={groupCols}
          rows={groups}
          loading={loading}
          expandedRowId={expandedId}
          renderExpandedRow={g => (
            <DataTable columns={getListCols(t)} rows={(g as FailureGroup).rows} pageSize={10} />
          )}
        />
      ) : (
        <DataTable columns={getListCols(t)} rows={rows} loading={loading} />
      )}
    </div>
  )
}
