import { useId, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Dialog from '@/shared/components/ui/Dialog'
import Button from '@/shared/components/ui/Button'
import { revokeApiKey, type ApiKeyRow } from '@/features/admin/api/apiKeys'
import { relativeAge } from '@/features/admin/lib/emailStatus'
import { usedRecently } from '@/features/admin/lib/apiKeys'
import { useT } from '@/i18n/LanguageContext'
import { fmtDateTime } from '@/shared/lib/date'

interface Props {
  row: ApiKeyRow
  onClose: () => void
  onRevoked: () => void
  /** Where focus goes on close; the row's Revoke button is gone once this succeeds. */
  returnFocus?: () => HTMLElement | null
}

/** Revoking is immediate and final, so the dialog shows what will stop before it asks. */
export default function RevokeKeyDialog({ row, onClose, onRevoked, returnFocus }: Props) {
  const { t } = useT()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const reasonId = useId()
  const age = relativeAge(row.last_used_at)
  const ago = age ? t(age.key, age.vars) : t('admin.apiKeys.never')

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await revokeApiKey(row.id, reason.trim() || undefined)
      onRevoked()
    } catch (err) {
      setError((err as Error).message)
      dialogRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      ref={dialogRef}
      title={t('admin.apiKeys.revokeDialog.title')}
      onDismiss={busy ? null : onClose}
      initialFocus={() => document.getElementById(reasonId)}
      returnFocus={returnFocus}
      error={error}
      className="apikeys-dialog"
      footer={
        <>
          <span className="ui-dialog__spacer" />
          <Button size="sm" onClick={onClose} disabled={busy}>
            {t('admin.apiKeys.revokeDialog.cancel')}
          </Button>
          <Button size="sm" variant="danger" onClick={submit} disabled={busy}>
            {busy
              ? t('admin.apiKeys.revokeDialog.submitting')
              : t('admin.apiKeys.revokeDialog.submit')}
          </Button>
        </>
      }
    >
      <p className="apikeys-lede">{t('admin.apiKeys.revokeDialog.lede')}</p>

      <dl className="apikeys-pairs apikeys-pairs--summary">
        <div>
          <dt>{t('admin.apiKeys.col.name')}</dt>
          <dd>{row.name}</dd>
        </div>
        <div>
          <dt>{t('admin.apiKeys.revokeDialog.key')}</dt>
          <dd>
            <code>{row.key_prefix}…</code>
          </dd>
        </div>
        <div>
          <dt>{t('admin.apiKeys.col.bu')}</dt>
          <dd>
            {row.bu_code ? (
              <>
                <code>{row.bu_code}</code>
                {row.tenant_host && <span className="apikeys-muted">{row.tenant_host}</span>}
              </>
            ) : (
              <span className="apikeys-muted">{t('admin.apiKeys.noBu')}</span>
            )}
          </dd>
        </div>
        <div>
          <dt>{t('admin.apiKeys.col.lastUsed')}</dt>
          <dd>
            <time title={fmtDateTime(row.last_used_at)}>{ago}</time>
          </dd>
        </div>
      </dl>

      {usedRecently(row.last_used_at) && (
        <div className="apikeys-callout" role="note">
          <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
          <p>{t('admin.apiKeys.revokeDialog.recent', { ago })}</p>
        </div>
      )}

      <div className="ui-field">
        <label htmlFor={reasonId} className="ui-field__label">
          {t('admin.apiKeys.revokeDialog.reason')}{' '}
          <span className="apikeys-muted">({t('admin.apiKeys.revokeDialog.optional')})</span>
        </label>
        <textarea
          id={reasonId}
          className="admin-form-input apikeys-reason"
          rows={3}
          maxLength={500}
          placeholder={t('admin.apiKeys.revokeDialog.reasonPlaceholder')}
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
      </div>
    </Dialog>
  )
}
