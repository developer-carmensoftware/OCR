import { useState } from 'react'
import { toast } from 'sonner'
import DataTable, { type Column } from '@/features/admin/components/DataTable'
import TenantSelector from '@/features/admin/components/TenantSelector'
import {
  createApiKey,
  fetchApiKeys,
  revokeApiKey,
  type ApiKeyRow,
  type IssuedApiKey,
} from '@/features/admin/api/apiKeys'
import { useTableQuery } from '@/features/admin/hooks/useTableQuery'
import { useTableData } from '@/features/admin/hooks/useTableData'
import PageHeader from '@/shared/components/ui/PageHeader'
import Card from '@/shared/components/ui/Card'
import Button from '@/shared/components/ui/Button'
import { useT } from '@/i18n/LanguageContext'
import { fmtDateTime } from '@/shared/lib/date'

const DEFAULT_NAME = 'PMS webhook'

/**
 * Keys for Carmen's PMS webhook (CA-93). The plaintext exists in this page's state once,
 * right after Generate — the API keeps only its hash, so "Done" is the last chance to copy.
 */
export default function ApiKeysPage() {
  const { t } = useT()
  const { params, set, server } = useTableQuery({
    defaultSort: 'created_at',
    filters: { tenant_id: '', active_only: '' },
  })
  const { rows, total, loading, reload } = useTableData<ApiKeyRow>(
    () =>
      fetchApiKeys({
        tenant_id: params.tenant_id || undefined,
        active_only: params.active_only === '1',
        q: params.q || undefined,
        sort: params.sort,
        dir: params.dir,
        limit: params.limit,
        offset: params.offset,
      }),
    [params],
    'admin.apiKeys.toast.loadFailed'
  )

  const [showCreate, setShowCreate] = useState(false)
  const [createTenant, setCreateTenant] = useState('')
  const [createName, setCreateName] = useState(DEFAULT_NAME)
  const [creating, setCreating] = useState(false)
  const [issued, setIssued] = useState<IssuedApiKey | null>(null)

  const handleCreate = async () => {
    setCreating(true)
    try {
      const key = await createApiKey({
        tenant_id: createTenant,
        name: createName.trim() || DEFAULT_NAME,
      })
      setIssued(key)
      setShowCreate(false)
      setCreateTenant('')
      setCreateName(DEFAULT_NAME)
      toast.success(t('admin.apiKeys.toast.created'))
      reload()
    } catch (e) {
      toast.error(t('admin.apiKeys.toast.createFailed', { error: (e as Error).message }))
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async (value: string) => {
    await navigator.clipboard.writeText(value)
    toast.success(t('admin.apiKeys.issued.copied'))
  }

  const handleRevoke = async (row: ApiKeyRow) => {
    // prompt, not confirm: one dialog both confirms and takes the optional reason.
    const reason = window.prompt(t('admin.apiKeys.revokePrompt', { name: row.name }))
    if (reason === null) return
    try {
      await revokeApiKey(row.id, reason.trim() || undefined)
      toast.success(t('admin.apiKeys.toast.revoked'))
      reload()
    } catch (e) {
      toast.error(t('admin.apiKeys.toast.revokeFailed', { error: (e as Error).message }))
    }
  }

  const columns: Column<ApiKeyRow>[] = [
    {
      key: 'name',
      label: t('admin.apiKeys.col.name'),
      sortable: true,
      render: r => (
        <div>
          <div>{r.name}</div>
          <div className="admin-sub-text admin-mono">{r.key_prefix}…</div>
        </div>
      ),
    },
    {
      key: 'tenant_name',
      label: t('admin.apiKeys.col.tenant'),
      render: r => r.tenant_name ?? r.tenant_id ?? '—',
    },
    {
      key: 'revoked_at',
      label: t('admin.apiKeys.col.status'),
      sortable: true,
      render: r => (
        <span
          className={`status-badge ${r.revoked_at ? 'error' : 'ok'}`}
          title={r.revoke_reason ?? undefined}
        >
          {r.revoked_at ? t('admin.apiKeys.status.revoked') : t('admin.apiKeys.status.active')}
        </span>
      ),
    },
    {
      // The answer to "is Carmen actually calling?" — stamped on every accepted call.
      key: 'last_used_at',
      label: t('admin.apiKeys.col.lastUsed'),
      sortable: true,
      defaultDesc: true,
      render: r =>
        r.last_used_at ? (
          <div>
            <div>{fmtDateTime(r.last_used_at)}</div>
            <div className="admin-sub-text admin-mono">{r.last_used_ip}</div>
          </div>
        ) : (
          t('admin.apiKeys.never')
        ),
    },
    {
      key: 'created_at',
      label: t('admin.apiKeys.col.created'),
      sortable: true,
      defaultDesc: true,
      render: r => fmtDateTime(r.created_at),
    },
    {
      key: '_actions',
      label: <span className="sr-only">{t('admin.apiKeys.actionsAria')}</span>,
      render: r =>
        r.revoked_at ? null : (
          <button type="button" className="admin-btn-danger-sm" onClick={() => handleRevoke(r)}>
            {t('admin.apiKeys.revoke')}
          </button>
        ),
    },
  ]

  return (
    <div className="admin-page">
      <PageHeader
        title={t('admin.apiKeys.title')}
        description={t('admin.apiKeys.description')}
        actions={
          <Button variant="primary" onClick={() => setShowCreate(v => !v)}>
            {t('admin.apiKeys.generate')}
          </Button>
        }
      />

      {issued && (
        <Card title={t('admin.apiKeys.issued.title')}>
          <div className="quota-manage-list">
            <p>
              {t('admin.apiKeys.issued.warning', {
                tenant: issued.tenant_name ?? issued.tenant_id ?? '',
              })}
            </p>
            <code className="admin-mono" style={{ wordBreak: 'break-all' }}>
              {issued.key}
            </code>
            <div className="quota-manage-row">
              <Button variant="primary" onClick={() => handleCopy(issued.key)}>
                {t('admin.apiKeys.issued.copy')}
              </Button>
              <Button variant="outline" onClick={() => setIssued(null)}>
                {t('admin.apiKeys.issued.done')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {showCreate && (
        <Card title={t('admin.apiKeys.form.title')}>
          <div className="quota-manage-list">
            <TenantSelector value={createTenant} onChange={setCreateTenant} />
            <input
              type="text"
              className="admin-form-input"
              placeholder={t('admin.apiKeys.form.name')}
              aria-label={t('admin.apiKeys.form.name')}
              maxLength={100}
              value={createName}
              onChange={e => setCreateName(e.target.value)}
            />
            <div className="quota-manage-row">
              <Button variant="primary" disabled={creating || !createTenant} onClick={handleCreate}>
                {t('admin.apiKeys.form.create')}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                {t('admin.apiKeys.form.cancel')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="admin-page-header">
        <div className="admin-page-controls">
          <label className="admin-checkbox-label">
            <input
              type="checkbox"
              checked={params.active_only === '1'}
              onChange={e => set({ active_only: e.target.checked ? '1' : '' })}
            />
            {t('admin.apiKeys.activeOnly')}
          </label>
          <TenantSelector value={params.tenant_id} onChange={v => set({ tenant_id: v })} />
        </div>
      </div>

      <div className="admin-card">
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyText={t('admin.apiKeys.empty')}
          server={server(total)}
          search={{
            value: params.q,
            onChange: q => set({ q }),
            placeholder: t('admin.apiKeys.searchPlaceholder'),
          }}
        />
      </div>
    </div>
  )
}
