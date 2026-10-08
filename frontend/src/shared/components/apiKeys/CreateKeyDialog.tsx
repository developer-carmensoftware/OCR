import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import Dialog from '@/shared/components/ui/Dialog'
import Button from '@/shared/components/ui/Button'
import CopyButton from '@/shared/components/ui/CopyButton'
import UrlText from '@/shared/components/apiKeys/UrlText'
import { carmenSetupText, type IssuedApiKey } from '@/shared/lib/apiKeys'
import { useT } from '@/i18n/LanguageContext'

const DEFAULT_NAME = 'PMS webhook'
const PMS_SCOPE = 'pms:events'

export interface TenantField {
  id: string
  value: string
  onChange: (tenantId: string) => void
  label: string
  placeholder: string
}

interface Props {
  endpoint: string
  /** Creates the key. `tenantId` is passed only when the dialog picks the business unit. */
  create: (name: string, tenantId?: string) => Promise<IssuedApiKey>
  /** A business-unit picker (admin). Without one, the key is for `fixedTenant`. */
  renderTenantField?: (field: TenantField) => ReactNode
  fixedTenant?: { buCode: string | null; host: string | null }
  /** 'full': the Send-to-Carmen block and Copy setup, for an admin handing the key to
   *  Carmen's developers. 'compact': the key and the endpoint, for a user pasting the key
   *  into Carmen's PMS settings themselves. */
  handoff: 'full' | 'compact'
  onClose: () => void
  /** The key exists from this moment, whether or not anyone ever presses Done. */
  onCreated: (key: IssuedApiKey) => void
}

/**
 * Create a key, then show it once. One dialog, two steps: the form, then "Save your API key".
 * The second step closes only on Done — Escape and the backdrop would throw away the one
 * copy of the key.
 */
export default function CreateKeyDialog({
  endpoint,
  create,
  renderTenantField,
  fixedTenant,
  handoff,
  onClose,
  onCreated,
}: Props) {
  const { t } = useT()
  const [tenantId, setTenantId] = useState('')
  const [name, setName] = useState(DEFAULT_NAME)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<IssuedApiKey | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const keyRef = useRef<HTMLInputElement>(null)
  const ids = { form: useId(), bu: useId(), name: useId(), key: useId(), handoff: useId() }
  const picking = !!renderTenantField
  const touched = tenantId !== '' || name !== DEFAULT_NAME

  const dismiss = () => {
    if (touched && !window.confirm(t('apiKeys.createDialog.discard'))) return
    onClose()
  }

  // The Create button that held focus is gone once the key arrives; land on the key itself.
  useEffect(() => {
    if (issued) keyRef.current?.focus()
  }, [issued])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((picking && !tenantId) || busy) return
    setBusy(true)
    setError(null)
    try {
      const key = await create(name.trim() || DEFAULT_NAME, picking ? tenantId : undefined)
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
    const endpointRow = (
      <div>
        <dt>{t('apiKeys.reveal.endpoint')}</dt>
        <dd>
          <span className="apikeys-method">POST</span>
          <UrlText url={endpoint} />
          <CopyButton value={endpoint} ariaLabel={t('apiKeys.reveal.copyEndpoint')} />
        </dd>
      </div>
    )
    return (
      <Dialog
        ref={dialogRef}
        title={t('apiKeys.reveal.title')}
        onDismiss={null}
        className="apikeys-dialog"
        footer={
          <>
            {handoff === 'full' && (
              <CopyButton
                value={carmenSetupText({
                  buCode: issued.bu_code,
                  host: issued.tenant_host,
                  endpoint,
                  key: issued.key,
                })}
                label={t('apiKeys.reveal.copySetup')}
              />
            )}
            <span className="ui-dialog__spacer" />
            <Button size="sm" variant="primary" onClick={onClose}>
              {t('apiKeys.reveal.done')}
            </Button>
          </>
        }
      >
        <div className="apikeys-reveal">
          <div className="apikeys-callout" role="note">
            <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
            <p>{t('apiKeys.reveal.once')}</p>
          </div>

          <div className="ui-field">
            <label htmlFor={ids.key} className="ui-field__label">
              {t('apiKeys.reveal.key')}
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
              <CopyButton value={issued.key} label={t('apiKeys.reveal.copyKey')} />
            </div>
          </div>

          {handoff === 'compact' ? (
            <section className="apikeys-handoff" aria-labelledby={ids.handoff}>
              <p id={ids.handoff} className="apikeys-lede">
                {t('apiKeys.reveal.pasteHint')}
              </p>
              <dl className="apikeys-pairs">{endpointRow}</dl>
            </section>
          ) : (
            <section className="apikeys-handoff" aria-labelledby={ids.handoff}>
              <h3 id={ids.handoff} className="apikeys-handoff__title">
                {t('apiKeys.reveal.handoff')}
                {issued.bu_code && (
                  <span className="apikeys-handoff__bu">
                    {issued.bu_code}
                    {issued.tenant_host ? ` · ${issued.tenant_host}` : ''}
                  </span>
                )}
              </h3>
              <dl className="apikeys-pairs">
                {endpointRow}
                <div>
                  <dt>{t('apiKeys.reveal.header')}</dt>
                  <dd>
                    <code>Authorization: Bearer {issued.key_prefix}…</code>
                    <CopyButton
                      value={`Authorization: Bearer ${issued.key}`}
                      ariaLabel={t('apiKeys.reveal.copyHeader')}
                    />
                  </dd>
                </div>
                <div>
                  <dt>{t('apiKeys.reveal.body')}</dt>
                  <dd>
                    <code>{'{ "InterfaceType", "InterfaceName", "DocType", "DocDate" }'}</code>
                  </dd>
                </div>
              </dl>
            </section>
          )}
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog
      ref={dialogRef}
      title={t('apiKeys.createDialog.title')}
      onDismiss={busy ? null : dismiss}
      initialFocus={() => document.getElementById(picking ? ids.bu : ids.name)}
      error={error}
      className="apikeys-dialog"
      footer={
        <>
          <span className="ui-dialog__spacer" />
          <Button size="sm" onClick={dismiss} disabled={busy}>
            {t('apiKeys.createDialog.cancel')}
          </Button>
          <Button
            size="sm"
            variant="primary"
            type="submit"
            form={ids.form}
            disabled={(picking && !tenantId) || busy}
          >
            {busy ? t('apiKeys.createDialog.submitting') : t('apiKeys.createDialog.submit')}
          </Button>
        </>
      }
    >
      <form id={ids.form} onSubmit={submit}>
        <p className="apikeys-lede">{t('apiKeys.createDialog.lede')}</p>
        {renderTenantField ? (
          <div className="ui-field">
            <label htmlFor={ids.bu} className="ui-field__label">
              {t('apiKeys.createDialog.bu')}
            </label>
            {renderTenantField({
              id: ids.bu,
              value: tenantId,
              onChange: setTenantId,
              label: t('apiKeys.createDialog.bu'),
              placeholder: t('apiKeys.createDialog.buPlaceholder'),
            })}
          </div>
        ) : (
          fixedTenant?.buCode && (
            <div className="ui-field">
              <span className="ui-field__label">{t('apiKeys.createDialog.bu')}</span>
              <p className="apikeys-perm">
                <code className="apikeys-chip">{fixedTenant.buCode}</code>
                {fixedTenant.host}
              </p>
            </div>
          )
        )}
        <div className="ui-field">
          <label htmlFor={ids.name} className="ui-field__label">
            {t('apiKeys.createDialog.name')}
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
          <span className="ui-field__label">{t('apiKeys.createDialog.permission')}</span>
          <p className="apikeys-perm">
            <code className="apikeys-chip">{PMS_SCOPE}</code>
            {t('apiKeys.createDialog.permissionText')}
          </p>
        </div>
      </form>
    </Dialog>
  )
}
