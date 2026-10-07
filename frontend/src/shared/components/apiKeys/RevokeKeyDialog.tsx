import { useId, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Dialog from '@/shared/components/ui/Dialog'
import Button from '@/shared/components/ui/Button'
import { usedRecently, type ApiKeyRow } from '@/shared/lib/apiKeys'
import { timeAgo } from '@/shared/lib/orderHelpers'
import { useT } from '@/i18n/LanguageContext'
import { fmtDateTime } from '@/shared/lib/date'

interface Props {
  row: ApiKeyRow
  revoke: (id: string, reason?: string) => Promise<unknown>
  onClose: () => void
  onRevoked: () => void
  /** Where focus goes on close; the row's Revoke button is gone once this succeeds. */
  returnFocus?: () => HTMLElement | null
}

/** Revoking is immediate and final, so the dialog shows what will stop before it asks. */
export default function RevokeKeyDialog({ row, revoke, onClose, onRevoked, returnFocus }: Props) {
  const { t } = useT()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const reasonId = useId()
  const ago = row.last_used_at ? timeAgo(row.last_used_at, t) : t('apiKeys.never')

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await revoke(row.id, reason.trim() || undefined)
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
      title={t('apiKeys.revokeDialog.title')}
      onDismiss={busy ? null : onClose}
      initialFocus={() => document.getElementById(reasonId)}
      returnFocus={returnFocus}
      error={error}
      className="apikeys-dialog"
      footer={
        <>
          <span className="ui-dialog__spacer" />
          <Button size="sm" onClick={onClose} disabled={busy}>
            {t('apiKeys.revokeDialog.cancel')}
          </Button>
          <Button size="sm" variant="danger" onClick={submit} disabled={busy}>
            {busy ? t('apiKeys.revokeDialog.submitting') : t('apiKeys.revokeDialog.submit')}
          </Button>
        </>
      }
    >
      <p className="apikeys-lede">{t('apiKeys.revokeDialog.lede')}</p>

      <dl className="apikeys-pairs apikeys-pairs--summary">
        <div>
          <dt>{t('apiKeys.col.name')}</dt>
          <dd>{row.name}</dd>
        </div>
        <div>
          <dt>{t('apiKeys.revokeDialog.key')}</dt>
          <dd>
            <code>{row.key_prefix}…</code>
          </dd>
        </div>
        <div>
          <dt>{t('apiKeys.col.bu')}</dt>
          <dd>
            {row.bu_code ? (
              <>
                <code>{row.bu_code}</code>
                {row.tenant_host && <span className="apikeys-muted">{row.tenant_host}</span>}
              </>
            ) : (
              <span className="apikeys-muted">{t('apiKeys.noBu')}</span>
            )}
          </dd>
        </div>
        <div>
          <dt>{t('apiKeys.col.lastUsed')}</dt>
          <dd>
            <time title={fmtDateTime(row.last_used_at)}>{ago}</time>
          </dd>
        </div>
      </dl>

      {usedRecently(row.last_used_at) && (
        <div className="apikeys-callout" role="note">
          <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
          <p>{t('apiKeys.revokeDialog.recent', { ago })}</p>
        </div>
      )}

      <div className="ui-field">
        <label htmlFor={reasonId} className="ui-field__label">
          {t('apiKeys.revokeDialog.reason')}{' '}
          <span className="apikeys-muted">({t('apiKeys.revokeDialog.optional')})</span>
        </label>
        <textarea
          id={reasonId}
          className="admin-form-input apikeys-reason"
          rows={3}
          maxLength={500}
          placeholder={t('apiKeys.revokeDialog.reasonPlaceholder')}
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
      </div>
    </Dialog>
  )
}
