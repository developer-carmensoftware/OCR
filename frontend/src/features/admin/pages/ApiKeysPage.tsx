import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KeyRound, Plus } from 'lucide-react'
import { toast } from 'sonner'
import DataTable, { type Column } from '@/features/admin/components/DataTable'
import TenantSearch from '@/features/admin/components/apiKeys/TenantSearch'
import UrlText from '@/features/admin/components/apiKeys/UrlText'
import CopyButton from '@/features/admin/components/CopyButton'
import Tabs from '@/features/admin/components/ui/Tabs'
import EmptyState from '@/features/admin/components/ui/EmptyState'
import CreateKeyDialog from '@/features/admin/components/apiKeys/CreateKeyDialog'
import RevokeKeyDialog from '@/features/admin/components/apiKeys/RevokeKeyDialog'
import { fetchApiKeys, type ApiKeyRow } from '@/features/admin/api/apiKeys'
import { useTableQuery } from '@/features/admin/hooks/useTableQuery'
import { useTableData } from '@/features/admin/hooks/useTableData'
import { relativeAge } from '@/features/admin/lib/emailStatus'
import { pmsEventsUrl } from '@/features/admin/lib/apiKeys'
import PageHeader from '@/shared/components/ui/PageHeader'
import Button from '@/shared/components/ui/Button'
import { useT } from '@/i18n/LanguageContext'
import { fmtDateTime, formatDate } from '@/shared/lib/date'

/** A revoked key steps back by ink, never by opacity (DESIGN.md: opacity drops it under AA). */
const cell = (r: ApiKeyRow) => (r.revoked_at ? 'apikeys-cell is-revoked' : 'apikeys-cell')

/** Is Carmen's feed live: how many keys can call, and when one last did. */
interface FeedStatus {
  active: number
  lastCall: string | null
}

/**
 * Keys Carmen's PMS webhook authenticates with (CA-93). The status line answers "is it
 * live" before the list does; creating and revoking happen in dialogs, so the one-time
 * secret never sits on the page.
 */
export default function ApiKeysPage() {
  const { t } = useT()
  const endpoint = useMemo(() => pmsEventsUrl(), [])
  const { params, set, server } = useTableQuery({
    defaultSort: 'created_at',
    filters: { tenant_id: '', status: '' },
  })
  const showAll = params.status === 'all'
  const { rows, total, loading, reload } = useTableData<ApiKeyRow>(
    () =>
      fetchApiKeys({
        tenant_id: params.tenant_id || undefined,
        active_only: !showAll,
        q: params.q || undefined,
        sort: params.sort,
        dir: params.dir,
        limit: params.limit,
        offset: params.offset,
      }),
    [params],
    'admin.apiKeys.toast.loadFailed'
  )

  // `total` of the active keys, and the newest last_used_at among them (nulls sort last).
  const [status, setStatus] = useState<FeedStatus | 'error' | null>(null)
  const loadStatus = useCallback(() => {
    fetchApiKeys({ active_only: true, sort: 'last_used_at', dir: 'desc', limit: 1 })
      .then(r => setStatus({ active: r.total, lastCall: r.data[0]?.last_used_at ?? null }))
      .catch(() => setStatus('error'))
  }, [])
  useEffect(loadStatus, [loadStatus])

  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<ApiKeyRow | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  // A successful revoke removes the row's Revoke button, so focus returns to the table.
  const revoked = useRef(false)
  const refresh = () => {
    reload()
    loadStatus()
  }

  const ago = (iso: string | null) => {
    const age = relativeAge(iso)
    return age ? t(age.key, age.vars) : t('admin.apiKeys.never')
  }

  const columns: Column<ApiKeyRow>[] = [
    {
      key: 'name',
      label: t('admin.apiKeys.col.name'),
      sortable: true,
      width: '30%',
      render: r => (
        <div className={cell(r)}>
          <div className="apikeys-name">{r.name}</div>
          <div className="apikeys-sub apikeys-sub--mono">{r.key_prefix}…</div>
        </div>
      ),
    },
    {
      key: 'bu',
      label: t('admin.apiKeys.col.bu'),
      width: '26%',
      render: r =>
        r.bu_code ? (
          <div className={cell(r)}>
            <div className="apikeys-bu">{r.bu_code}</div>
            <div className="apikeys-sub">{r.tenant_host}</div>
          </div>
        ) : (
          <span className="apikeys-muted">{t('admin.apiKeys.noBu')}</span>
        ),
    },
    {
      key: 'revoked_at',
      label: t('admin.apiKeys.col.status'),
      sortable: true,
      width: '12%',
      render: r => (
        <span
          className="apikeys-state"
          data-state={r.revoked_at ? 'revoked' : 'active'}
          title={r.revoke_reason ?? undefined}
        >
          <span className="apikeys-state__dot" aria-hidden="true" />
          {r.revoked_at ? t('admin.apiKeys.state.revoked') : t('admin.apiKeys.state.active')}
        </span>
      ),
    },
    {
      key: 'last_used_at',
      label: t('admin.apiKeys.col.lastUsed'),
      sortable: true,
      defaultDesc: true,
      width: '16%',
      render: r =>
        r.last_used_at ? (
          <div className={cell(r)}>
            <time dateTime={r.last_used_at} title={fmtDateTime(r.last_used_at)}>
              {ago(r.last_used_at)}
            </time>
            <div className="apikeys-sub apikeys-sub--mono">{r.last_used_ip}</div>
          </div>
        ) : (
          <span className="apikeys-muted">{t('admin.apiKeys.never')}</span>
        ),
    },
    {
      key: 'created_at',
      label: t('admin.apiKeys.col.created'),
      sortable: true,
      defaultDesc: true,
      render: r => (
        <time
          className={`apikeys-date ${cell(r)}`}
          dateTime={r.created_at ?? undefined}
          title={fmtDateTime(r.created_at)}
        >
          {formatDate(r.created_at)}
        </time>
      ),
    },
    {
      key: '_actions',
      label: <span className="sr-only">{t('admin.apiKeys.col.actions')}</span>,
      align: 'right',
      render: r =>
        r.revoked_at ? null : (
          <button
            type="button"
            className="apikeys-revoke"
            aria-label={t('admin.apiKeys.revokeAria', { name: `${r.name} ${r.key_prefix}` })}
            onClick={() => {
              revoked.current = false
              setRevoking(r)
            }}
          >
            {t('admin.apiKeys.revoke')}
          </button>
        ),
    },
  ]

  const filters = (
    <>
      <Tabs
        tabs={[
          { id: 'active', label: t('admin.apiKeys.filter.active') },
          { id: 'all', label: t('admin.apiKeys.filter.all') },
        ]}
        active={showAll ? 'all' : 'active'}
        onChange={id => set({ status: id === 'all' ? 'all' : '' })}
      />
      <div className="apikeys-toolbar__end">
        <TenantSearch value={params.tenant_id} onChange={v => set({ tenant_id: v })} />
      </div>
    </>
  )

  // Nothing to list and nothing filtered away: teach the next step instead of an empty grid.
  const nothingYet = !loading && total === 0 && !showAll && !params.q && !params.tenant_id

  return (
    <div className="admin-page apikeys-page">
      <PageHeader
        title={t('admin.apiKeys.title')}
        description={t('admin.apiKeys.description')}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} strokeWidth={2.25} aria-hidden="true" />
            {t('admin.apiKeys.create')}
          </Button>
        }
      />

      <StatusLine status={status} endpoint={endpoint} onCreate={() => setCreating(true)} />

      {/* Focusable so a revoke, which removes the row's own button, has somewhere to leave
          the keyboard other than <body>. */}
      <div ref={tableRef} className="admin-card apikeys-table" tabIndex={-1}>
        {nothingYet ? (
          <>
            <div className="admin-table-toolbar admin-table-toolbar--split">{filters}</div>
            <EmptyState
              icon={<KeyRound size={22} strokeWidth={1.75} />}
              title={t('admin.apiKeys.emptyTitle')}
              description={t('admin.apiKeys.emptyDescription')}
            />
          </>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            loading={loading}
            emptyText={t('admin.apiKeys.empty')}
            server={server(total)}
            toolbarStart={filters}
            search={{
              value: params.q,
              onChange: q => set({ q }),
              placeholder: t('admin.apiKeys.searchPlaceholder'),
            }}
          />
        )}
      </div>

      {creating && (
        <CreateKeyDialog
          endpoint={endpoint}
          onClose={() => {
            setCreating(false)
            // Carmen may have called while the key was on screen: the row's Last used and
            // the status line must agree, so both reload.
            refresh()
          }}
          // The reveal step is the confirmation; a toast would only repeat it.
          onCreated={refresh}
        />
      )}
      {revoking && (
        <RevokeKeyDialog
          row={revoking}
          onClose={() => setRevoking(null)}
          returnFocus={() => (revoked.current ? tableRef.current : null)}
          onRevoked={() => {
            revoked.current = true
            setRevoking(null)
            toast.success(t('admin.apiKeys.toast.revoked'))
            refresh()
          }}
        />
      )}
    </div>
  )
}

function StatusLine({
  status,
  endpoint,
  onCreate,
}: {
  status: FeedStatus | 'error' | null
  endpoint: string
  onCreate: () => void
}) {
  const { t } = useT()
  const live = status && status !== 'error'
  const tone = !live ? 'idle' : status.active === 0 ? 'warn' : status.lastCall ? 'ok' : 'idle'
  const age = live ? relativeAge(status.lastCall) : null

  return (
    <section
      className="apikeys-status"
      data-tone={tone}
      aria-label={t('admin.apiKeys.status.aria')}
    >
      <div className="apikeys-status__main">
        <p className="apikeys-status__text" aria-live="polite">
          <span className="apikeys-status__dot" aria-hidden="true" />
          {status === null && t('admin.apiKeys.status.loading')}
          {status === 'error' && t('admin.apiKeys.status.unknown')}
          {live && status.active === 0 && (
            <>
              <strong>{t('admin.apiKeys.status.none')}</strong>
              <span className="apikeys-status__meta">{t('admin.apiKeys.status.noneMeta')}</span>
            </>
          )}
          {live && status.active > 0 && (
            <>
              <strong>
                {status.active === 1
                  ? t('admin.apiKeys.status.keysOne')
                  : t('admin.apiKeys.status.keysOther', { n: status.active })}
              </strong>
              <span className="apikeys-status__meta">
                {age ? (
                  <time
                    dateTime={status.lastCall ?? undefined}
                    title={fmtDateTime(status.lastCall)}
                  >
                    {t('admin.apiKeys.status.lastCall', { ago: t(age.key, age.vars) })}
                  </time>
                ) : (
                  t('admin.apiKeys.status.noCalls')
                )}
              </span>
            </>
          )}
        </p>
        {/* DESIGN.md §5: when the answer is no, the strip names the next step as a pill. */}
        {live && status.active === 0 && (
          <button type="button" className="apikeys-step" onClick={onCreate}>
            {t('admin.apiKeys.create')}
          </button>
        )}
      </div>
      <div className="apikeys-status__endpoint">
        <span className="apikeys-status__label">{t('admin.apiKeys.status.endpoint')}</span>
        <span className="apikeys-method">POST</span>
        <UrlText url={endpoint} className="apikeys-url" />
        <CopyButton value={endpoint} ariaLabel={t('admin.apiKeys.status.copyEndpoint')} />
      </div>
    </section>
  )
}
