import { useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Dialog from '@/shared/components/ui/Dialog'
import Button from '@/shared/components/ui/Button'
import TenantSearch from '@/features/admin/components/apiKeys/TenantSearch'
import UrlText from '@/features/admin/components/apiKeys/UrlText'
import CopyButton from '@/features/admin/components/CopyButton'
import { createApiKey, type IssuedApiKey } from '@/features/admin/api/apiKeys'
import { carmenSetupText } from '@/features/admin/lib/apiKeys'
import { useT } from '@/i18n/LanguageContext'

const DEFAULT_NAME = 'PMS webhook'
const PMS_SCOPE = 'pms:events'

interface Props {
  endpoint: string
  onClose: () => void
  /** The key exists from this moment, whether or not the admin ever presses Done. */
  onCreated: (key: IssuedApiKey) => void
}

/**
 * Create a key, then show it once. One dialog, two steps: the form, then "Save your API key"
 * with everything Carmen needs. The second step closes only on Done — Escape and the backdrop
 * would throw away the one copy of the key.
 */
export default function CreateKeyDialog({ endpoint, onClose, onCreated }: Props) {
  const { t } = useT()
  const [tenantId, setTenantId] = useState('')
  const [name, setName] = useState(DEFAULT_NAME)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<IssuedApiKey | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const keyRef = useRef<HTMLInputElement>(null)
  const ids = { form: useId(), bu: useId(), name: useId(), key: useId(), handoff: useId() }
  const touched = tenantId !== '' || name !== DEFAULT_NAME

  const dismiss = () => {
    if (touched && !window.confirm(t('admin.apiKeys.createDialog.discard'))) return
    onClose()
  }

  // The Create button that held focus is gone once the key arrives; land on the key itself.
  useEffect(() => {
    if (issued) keyRef.current?.focus()
  }, [issued])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId || busy) return
    setBusy(true)
    setError(null)
    try {
      const key = await createApiKey({ tenant_id: tenantId, name: name.trim() || DEFAULT_NAME })
      setIssued(key)
      onCreated(key)
    } catch (err) {
      setError((err as Error).message)
      // The disabled button dropped focus to <body>; keep the keyboard in the dialog.
      dialogRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  if (issued) {
    return (
      <Dialog
        ref={dialogRef}
        title={t('admin.apiKeys.reveal.title')}
        onDismiss={null}
        className="apikeys-dialog"
        footer={
          <>
            <CopyButton
              value={carmenSetupText({
                buCode: issued.bu_code,
                host: issued.tenant_host,
                endpoint,
                key: issued.key,
              })}
              label={t('admin.apiKeys.reveal.copySetup')}
            />
            <span className="ui-dialog__spacer" />
            <Button size="sm" variant="primary" onClick={onClose}>
              {t('admin.apiKeys.reveal.done')}
            </Button>
          </>
        }
      >
        <div className="apikeys-reveal">
          <div className="apikeys-callout" role="note">
            <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
            <p>{t('admin.apiKeys.reveal.once')}</p>
          </div>

          <div className="ui-field">
            <label htmlFor={ids.key} className="ui-field__label">
              {t('admin.apiKeys.reveal.key')}
            </label>
            <div className="apikeys-secret">
              <input
                ref={keyRef}
                id={ids.key}
                className="apikeys-secret__value"
                value={issued.key}
                readOnly
                spellCheck={false}
                autoComplete="off"
                onFocus={e => e.currentTarget.select()}
              />
              <CopyButton value={issued.key} label={t('admin.apiKeys.reveal.copyKey')} />
            </div>
          </div>

          <section className="apikeys-handoff" aria-labelledby={ids.handoff}>
            <h3 id={ids.handoff} className="apikeys-handoff__title">
              {t('admin.apiKeys.reveal.handoff')}
              {issued.bu_code && (
                <span className="apikeys-handoff__bu">
                  {issued.bu_code}
                  {issued.tenant_host ? ` · ${issued.tenant_host}` : ''}
                </span>
              )}
            </h3>
            <dl className="apikeys-pairs">
              <div>
                <dt>{t('admin.apiKeys.reveal.endpoint')}</dt>
                <dd>
                  <span className="apikeys-method">POST</span>
                  <UrlText url={endpoint} />
                  <CopyButton value={endpoint} ariaLabel={t('admin.apiKeys.reveal.copyEndpoint')} />
                </dd>
              </div>
              <div>
                <dt>{t('admin.apiKeys.reveal.header')}</dt>
                <dd>
                  <code>Authorization: Bearer {issued.key_prefix}…</code>
                  <CopyButton
                    value={`Authorization: Bearer ${issued.key}`}
                    ariaLabel={t('admin.apiKeys.reveal.copyHeader')}
                  />
                </dd>
              </div>
              <div>
                <dt>{t('admin.apiKeys.reveal.body')}</dt>
                <dd>
                  <code>{'{ "event_id", "type", "data" }'}</code>
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog
      ref={dialogRef}
      title={t('admin.apiKeys.createDialog.title')}
      onDismiss={busy ? null : dismiss}
      initialFocus={() => document.getElementById(ids.bu)}
      error={error}
      className="apikeys-dialog"
      footer={
        <>
          <span className="ui-dialog__spacer" />
          <Button size="sm" onClick={dismiss} disabled={busy}>
            {t('admin.apiKeys.createDialog.cancel')}
          </Button>
          <Button
            size="sm"
            variant="primary"
            type="submit"
            form={ids.form}
            disabled={!tenantId || busy}
          >
            {busy
              ? t('admin.apiKeys.createDialog.submitting')
              : t('admin.apiKeys.createDialog.submit')}
          </Button>
        </>
      }
    >
      <form id={ids.form} onSubmit={submit}>
        <p className="apikeys-lede">{t('admin.apiKeys.createDialog.lede')}</p>
        <div className="ui-field">
          <label htmlFor={ids.bu} className="ui-field__label">
            {t('admin.apiKeys.createDialog.bu')}
          </label>
          <TenantSearch
            id={ids.bu}
            value={tenantId}
            onChange={setTenantId}
            ariaLabel={t('admin.apiKeys.createDialog.bu')}
            placeholder={t('admin.apiKeys.createDialog.buPlaceholder')}
          />
        </div>
        <div className="ui-field">
          <label htmlFor={ids.name} className="ui-field__label">
            {t('admin.apiKeys.createDialog.name')}
          </label>
          <input
            id={ids.name}
            className="admin-form-input"
            value={name}
            maxLength={100}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div className="ui-field">
          <span className="ui-field__label">{t('admin.apiKeys.createDialog.permission')}</span>
          <p className="apikeys-perm">
            <code className="apikeys-chip">{PMS_SCOPE}</code>
            {t('admin.apiKeys.createDialog.permissionText')}
          </p>
        </div>
      </form>
    </Dialog>
  )
}
