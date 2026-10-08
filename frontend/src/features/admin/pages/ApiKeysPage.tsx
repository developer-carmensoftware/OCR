import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KeyRound, Plus } from 'lucide-react'
import { toast } from 'sonner'
import DataTable, { type Column } from '@/features/admin/components/DataTable'
import TenantSearch from '@/features/admin/components/apiKeys/TenantSearch'
import Tabs from '@/features/admin/components/ui/Tabs'
import EmptyState from '@/features/admin/components/ui/EmptyState'
import {
  createApiKey,
  fetchApiKeys,
  revokeApiKey,
  type ApiKeyRow,
} from '@/features/admin/api/apiKeys'
import { useTableQuery } from '@/features/admin/hooks/useTableQuery'
import { useTableData } from '@/features/admin/hooks/useTableData'
import CreateKeyDialog from '@/shared/components/apiKeys/CreateKeyDialog'
import RevokeKeyDialog from '@/shared/components/apiKeys/RevokeKeyDialog'
import StatusLine from '@/shared/components/apiKeys/StatusLine'
import { pmsEventsUrl, type FeedStatus } from '@/shared/lib/apiKeys'
import { timeAgo } from '@/shared/lib/orderHelpers'
import PageHeader from '@/shared/components/ui/PageHeader'
import Button from '@/shared/components/ui/Button'
import { useT } from '@/i18n/LanguageContext'
import { fmtDateTime, formatDate } from '@/shared/lib/date'

/** A revoked key steps back by ink, never by opacity (DESIGN.md: opacity drops it under AA). */
const cell = (r: ApiKeyRow) => (r.revoked_at ? 'apikeys-cell is-revoked' : 'apikeys-cell')

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
    'apiKeys.toast.loadFailed'
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

  const columns: Column<ApiKeyRow>[] = [
    {
      key: 'name',
      label: t('apiKeys.col.name'),
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
      label: t('apiKeys.col.bu'),
      width: '26%',
      render: r =>
        r.bu_code ? (
          <div className={cell(r)}>
            <div className="apikeys-bu">{r.bu_code}</div>
            <div className="apikeys-sub">{r.tenant_host}</div>
          </div>
        ) : (
          <span className="apikeys-muted">{t('apiKeys.noBu')}</span>
        ),
    },
    {
      key: 'revoked_at',
      label: t('apiKeys.col.status'),
      sortable: true,
      width: '12%',
      render: r => (
        <span
          className="apikeys-state"
          data-state={r.revoked_at ? 'revoked' : 'active'}
          title={r.revoke_reason ?? undefined}
        >
          <span className="apikeys-state__dot" aria-hidden="true" />
          {r.revoked_at ? t('apiKeys.state.revoked') : t('apiKeys.state.active')}
        </span>
      ),
    },
    {
      key: 'last_used_at',
      label: t('apiKeys.col.lastUsed'),
      sortable: true,
      defaultDesc: true,
      width: '16%',
      render: r =>
        r.last_used_at ? (
          <div className={cell(r)}>
            <time dateTime={r.last_used_at} title={fmtDateTime(r.last_used_at)}>
              {timeAgo(r.last_used_at, t)}
            </time>
            <div className="apikeys-sub apikeys-sub--mono">{r.last_used_ip}</div>
          </div>
        ) : (
          <span className="apikeys-muted">{t('apiKeys.never')}</span>
        ),
    },
    {
      key: 'created_at',
      label: t('apiKeys.col.created'),
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
      label: <span className="sr-only">{t('apiKeys.col.actions')}</span>,
      align: 'right',
      render: r =>
        r.revoked_at ? null : (
          <button
            type="button"
            className="apikeys-revoke"
            aria-label={t('apiKeys.revokeAria', { name: `${r.name} ${r.key_prefix}` })}
            onClick={() => {
              revoked.current = false
              setRevoking(r)
            }}
          >
            {t('apiKeys.revoke')}
          </button>
        ),
    },
  ]

  const filters = (
    <>
      <Tabs
        tabs={[
          { id: 'active', label: t('apiKeys.filter.active') },
          { id: 'all', label: t('apiKeys.filter.all') },
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
        title={t('apiKeys.title')}
        description={t('apiKeys.description')}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} strokeWidth={2.25} aria-hidden="true" />
            {t('apiKeys.create')}
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
              title={t('apiKeys.emptyTitle')}
              description={t('apiKeys.emptyDescription')}
            />
          </>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            loading={loading}
            emptyText={t('apiKeys.empty')}
            server={server(total)}
            toolbarStart={filters}
            search={{
              value: params.q,
              onChange: q => set({ q }),
              placeholder: t('apiKeys.searchPlaceholder'),
            }}
          />
        )}
      </div>

      {creating && (
        <CreateKeyDialog
          endpoint={endpoint}
          handoff="full"
          create={(name, tenantId) => createApiKey({ tenant_id: tenantId ?? '', name })}
          renderTenantField={f => (
            <TenantSearch
              id={f.id}
              value={f.value}
              onChange={f.onChange}
              ariaLabel={f.label}
              placeholder={f.placeholder}
            />
          )}
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
          revoke={revokeApiKey}
          onClose={() => setRevoking(null)}
          returnFocus={() => (revoked.current ? tableRef.current : null)}
          onRevoked={() => {
            revoked.current = true
            setRevoking(null)
            toast.success(t('apiKeys.toast.revoked'))
            refresh()
          }}
        />
      )}
    </div>
  )
}
