import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Plus } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '@/shared/components/ui/PageHeader'
import Button from '@/shared/components/ui/Button'
import CreateKeyDialog from '@/shared/components/apiKeys/CreateKeyDialog'
import RevokeKeyDialog from '@/shared/components/apiKeys/RevokeKeyDialog'
import StatusLine from '@/shared/components/apiKeys/StatusLine'
import Switch from '@/shared/components/ui/Switch'
import CustomSearchSelect from '@/shared/components/common/CustomSearchSelect'
import { CARMEN_POSTING_TOKEN_KEY } from '@/shared/api/client'
import { fetchGLPrefixes } from '@/shared/api/carmen'
import { pmsEventsUrl, type ApiKeyRow, type FeedStatus } from '@/shared/lib/apiKeys'
import { timeAgo } from '@/shared/lib/orderHelpers'
import { fmtDateTime, formatDate } from '@/shared/lib/date'
import { useAuth } from '@/shared/contexts/AuthContext'
import { FixedLanguage, useT } from '@/i18n/LanguageContext'
import { createPmsKey, fetchPmsKeys, revokePmsKey } from '@/features/pms/api/pmsKeys'
import {
  getPmsSettings,
  putPmsCredential,
  putPmsSettings,
  type PmsSettings,
} from '@/features/pms/api/pmsSettings'

const MAX_ACTIVE = 2

const hostOf = (uri: string | undefined) => {
  try {
    return uri ? new URL(uri).host : null
  } catch {
    return null
  }
}

/**
 * #/pms — a business unit's own PMS keys (CA-117) and how its PMS days post (CA-119).
 * Carmen's menu opens it with the SSO link, so the session already names the BU: there is
 * no tenant to pick and none to get wrong. That link's token is also stored here as the
 * BU's Carmen credential, the one PMS days are read and posted with (decision #42).
 * English only, like the other settings screen Carmen's menu opens (email-settings).
 */
export default function PmsPage() {
  return (
    <FixedLanguage lang="en">
      <PmsKeys />
    </FixedLanguage>
  )
}

function PmsKeys() {
  const { t } = useT()
  const { user } = useAuth()
  const endpoint = useMemo(() => pmsEventsUrl(), [])
  const host = hostOf(user?.uri)
  const [rows, setRows] = useState<ApiKeyRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<ApiKeyRow | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // A successful revoke removes the row's Revoke button, so focus returns to the list.
  const revoked = useRef(false)

  const load = useCallback(() => {
    setFailed(false)
    fetchPmsKeys()
      .then(page => setRows(page.data))
      .catch(() => setFailed(true))
  }, [])
  useEffect(load, [load])

  const active = (rows ?? []).filter(r => !r.revoked_at)
  const atCap = active.length >= MAX_ACTIVE
  const status: FeedStatus | 'error' | null = failed
    ? 'error'
    : rows === null
      ? null
      : {
          active: active.length,
          // ISO timestamps in one zone compare as strings.
          lastCall: active.reduce<string | null>(
            (max, r) => (r.last_used_at && (!max || r.last_used_at > max) ? r.last_used_at : max),
            null
          ),
        }

  return (
    <div className="pms-page">
      <PageHeader
        title={t('apiKeys.pms.title')}
        description={t('apiKeys.pms.description')}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)} disabled={atCap || !rows}>
            <Plus size={16} strokeWidth={2.25} aria-hidden="true" />
            {t('apiKeys.create')}
          </Button>
        }
      />
      {user?.bu && (
        <p className="pms-context">
          {t('apiKeys.pms.context')} <strong>{user.bu}</strong>
          {host && <> · {host}</>}
        </p>
      )}

      <StatusLine status={status} endpoint={endpoint} onCreate={() => setCreating(true)} />

      <PostingSettings />

      <section className="pms-keys" aria-labelledby="pms-keys-title">
        <div className="pms-keys__head">
          <h2 id="pms-keys-title" className="pms-keys__title">
            {t('apiKeys.pms.keysTitle')}
          </h2>
          {atCap && <p className="pms-keys__hint">{t('apiKeys.pms.capHint')}</p>}
        </div>
        {/* Focusable so a revoke, which removes the row's own button, has somewhere to leave
            the keyboard other than <body>. */}
        <div ref={listRef} className="ui-card pms-keys__card" tabIndex={-1}>
          {failed ? (
            <div className="pms-keys__note" role="alert">
              {t('apiKeys.pms.loadFailed')}{' '}
              <Button size="sm" onClick={load}>
                {t('apiKeys.pms.retry')}
              </Button>
            </div>
          ) : rows === null ? (
            <p className="pms-keys__note" aria-busy="true">
              {t('apiKeys.pms.loading')}
            </p>
          ) : rows.length === 0 ? (
            <p className="pms-keys__note">{t('apiKeys.pms.empty')}</p>
          ) : (
            <KeyTable
              rows={rows}
              onRevoke={r => {
                revoked.current = false
                setRevoking(r)
              }}
            />
          )}
        </div>
      </section>

      {creating && (
        <CreateKeyDialog
          endpoint={endpoint}
          handoff="compact"
          fixedTenant={{ buCode: user?.bu ?? null, host }}
          create={name => createPmsKey(name)}
          onCreated={load}
          onClose={() => {
            setCreating(false)
            load()
          }}
        />
      )}
      {revoking && (
        <RevokeKeyDialog
          row={revoking}
          revoke={revokePmsKey}
          onClose={() => setRevoking(null)}
          returnFocus={() => (revoked.current ? listRef.current : null)}
          onRevoked={() => {
            revoked.current = true
            setRevoking(null)
            toast.success(t('apiKeys.toast.revoked'))
            load()
          }}
        />
      )}
    </div>
  )
}

function KeyTable({ rows, onRevoke }: { rows: ApiKeyRow[]; onRevoke: (row: ApiKeyRow) => void }) {
  const { t } = useT()
  return (
    <table className="pms-table">
      <thead>
        <tr>
          <th scope="col">{t('apiKeys.col.name')}</th>
          <th scope="col">{t('apiKeys.col.status')}</th>
          <th scope="col">{t('apiKeys.col.lastUsed')}</th>
          <th scope="col">{t('apiKeys.col.created')}</th>
          <th scope="col">
            <span className="sr-only">{t('apiKeys.col.actions')}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => {
          const cell = r.revoked_at ? 'apikeys-cell is-revoked' : 'apikeys-cell'
          return (
            <tr key={r.id}>
              <td>
                <div className={cell}>
                  <div className="apikeys-name">{r.name}</div>
                  <div className="apikeys-sub apikeys-sub--mono">{r.key_prefix}…</div>
                </div>
              </td>
              <td>
                <span
                  className="apikeys-state"
                  data-state={r.revoked_at ? 'revoked' : 'active'}
                  title={r.revoke_reason ?? undefined}
                >
                  <span className="apikeys-state__dot" aria-hidden="true" />
                  {r.revoked_at ? t('apiKeys.state.revoked') : t('apiKeys.state.active')}
                </span>
              </td>
              <td>
                {r.last_used_at ? (
                  <time
                    className={cell}
                    dateTime={r.last_used_at}
                    title={fmtDateTime(r.last_used_at)}
                  >
                    {timeAgo(r.last_used_at, t)}
                  </time>
                ) : (
                  <span className="apikeys-muted">{t('apiKeys.never')}</span>
                )}
              </td>
              <td>
                <time
                  className={`apikeys-date ${cell}`}
                  dateTime={r.created_at ?? undefined}
                  title={fmtDateTime(r.created_at)}
                >
                  {formatDate(r.created_at)}
                </time>
              </td>
              <td className="pms-table__action">
                {!r.revoked_at && (
                  <button
                    type="button"
                    className="apikeys-revoke"
                    aria-label={t('apiKeys.revokeAria', { name: `${r.name} ${r.key_prefix}` })}
                    onClick={() => onRevoke(r)}
                  >
                    {t('apiKeys.revoke')}
                  </button>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/**
 * The JV prefix and the auto-post switch. Each saves the moment it changes — two settings,
 * neither a record, and nothing else on the page they could be half-saved with.
 *
 * Opening this page from Carmen's menu stores the link's token first (as email-settings
 * does): it is the credential PMS days are read and posted with, and the days that were
 * waiting for one are read again by the server as soon as it lands.
 */
function PostingSettings() {
  const { t } = useT()
  const [settings, setSettings] = useState<PmsSettings | null>(null)
  const [prefixes, setPrefixes] = useState<{ code: string; name: string }[]>([])
  const [accessError, setAccessError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      const fresh = sessionStorage.getItem(CARMEN_POSTING_TOKEN_KEY)
      if (fresh) {
        try {
          await putPmsCredential(fresh)
          sessionStorage.removeItem(CARMEN_POSTING_TOKEN_KEY)
        } catch (err) {
          // Kept: a reload tries again, and nothing else brings that token back.
          if (alive) setAccessError((err as Error).message)
        }
      }
      try {
        const loaded = await getPmsSettings()
        if (alive) setSettings(loaded)
      } catch (err) {
        if (alive) toast.error((err as Error).message)
      }
    })()
    fetchGLPrefixes()
      .then(list => {
        if (!alive) return
        setPrefixes(
          list
            .filter(x => x.PrefixName)
            .map(x => ({ code: x.PrefixName as string, name: (x.Description as string) || '' }))
        )
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const save = async (patch: Partial<Pick<PmsSettings, 'jv_prefix' | 'auto_post'>>) => {
    if (!settings) return
    setSaving(true)
    try {
      const next = await putPmsSettings({
        jv_prefix: patch.jv_prefix !== undefined ? patch.jv_prefix : settings.jv_prefix,
        auto_post: patch.auto_post !== undefined ? patch.auto_post : settings.auto_post,
      })
      setSettings(next)
      toast.success(t('apiKeys.pms.saved'))
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="pms-posting" aria-labelledby="pms-posting-title">
      <div className="pms-keys__head">
        <h2 id="pms-posting-title" className="pms-keys__title">
          {t('apiKeys.pms.postingTitle')}
        </h2>
        <p className="pms-keys__hint">{t('apiKeys.pms.postingDescription')}</p>
      </div>
      {(accessError || (settings && !settings.has_credential)) && (
        <div className="pms-posting__alert" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            {accessError
              ? t('apiKeys.pms.accessFailed', { msg: accessError })
              : t('apiKeys.pms.noAccess')}
          </span>
        </div>
      )}
      <div className="ui-card pms-posting__card">
        <div className="pms-posting__row">
          <div className="pms-posting__text">
            <span className="pms-posting__label">{t('apiKeys.pms.prefix')}</span>
            <p className="pms-posting__hint">{t('apiKeys.pms.prefixHint')}</p>
          </div>
          <div className="pms-posting__control">
            <CustomSearchSelect
              value={settings?.jv_prefix ?? null}
              onChange={code => void save({ jv_prefix: code })}
              options={prefixes}
              placeholder={t('apiKeys.pms.prefixPlaceholder')}
              hasError={!!settings && !settings.jv_prefix}
              aria-label={t('apiKeys.pms.prefix')}
            />
          </div>
        </div>
        <div className="pms-posting__row">
          <div className="pms-posting__text">
            <span className="pms-posting__label">{t('apiKeys.pms.autoPost')}</span>
            <p className="pms-posting__hint">{t('apiKeys.pms.autoPostHint')}</p>
          </div>
          <div className="pms-posting__control pms-posting__control--switch">
            <Switch
              checked={settings?.auto_post ?? false}
              onChange={v => void save({ auto_post: v })}
              disabled={!settings || saving}
              ariaLabel={t('apiKeys.pms.autoPost')}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
