import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import CustomModal from './CustomModal'
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/dict'
import { OCR_BANK_MAP } from '../../constants/banks'
import { getCarmenUrl } from '../../lib/url'
import type { BankCode } from '../../types/api'
import type { BellItem } from '../../lib/api/notifications'
import '../../styles/components/notification-bell.css'

/**
 * What a `document_posted` / `document_failed` bell row opens.
 *
 * ponytail: a dialog, not a page. Everything worth showing already rides in the
 * notification payload, so there is nothing to fetch and nowhere to navigate —
 * the tenant side has no email-document list (that surface is admin-only).
 * Build one and this becomes a "View document" link in the same dialog.
 */

// The failure vocabulary the pipeline actually raises — the taxonomy in
// docs/email-automation/04-data-model.md. Anything outside it falls back rather
// than leaking a snake_case code into the UI.
const REASON_KEY: Record<string, TKey> = {
  tax_id_mismatch: 'notif.reason.taxIdMismatch',
  duplicate_document: 'notif.reason.duplicateDocument',
  mapping_incomplete: 'notif.reason.mappingIncomplete',
  unreadable_document: 'notif.reason.unreadableDocument',
  carmen_rejected: 'notif.reason.carmenRejected',
  carmen_unauthorized: 'notif.reason.carmenUnauthorized',
}

interface Props {
  /** The row to show, or null when nothing is open (the dialog then animates out). */
  item: BellItem | null
  onClose: () => void
}

export default function NotificationDetailModal({ item, onClose }: Props) {
  const { t, lang } = useT()

  // Hold the last row so the exit animation has something to render. Synced
  // during render, matching how CustomModal itself tracks its props.
  const [shown, setShown] = useState(item)
  if (item && item !== shown) setShown(item)
  if (!shown) return null

  const p = shown.payload as Record<string, string | null | undefined>
  const posted = shown.type === 'document_posted'
  const bankCode = p.bank_code || ''

  const rows: Array<[TKey, string]> = [
    ['notif.detail.document', p.attachment || '—'],
    ['notif.detail.bank', OCR_BANK_MAP[bankCode as BankCode] || bankCode || '—'],
    ['notif.detail.docNo', p.doc_no || '—'],
    ...(posted ? ([['notif.detail.jvNo', p.jv_no || '—']] as Array<[TKey, string]>) : []),
    [
      'notif.detail.time',
      new Date(shown.created_at).toLocaleString(lang === 'th' ? 'th-TH' : 'en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    ],
  ]

  const message = posted
    ? p.jv_no
      ? t('notif.detail.postedMsg', { jv: p.jv_no })
      : t('notif.detail.postedMsgNoJv')
    : t(REASON_KEY[p.reason_code || ''] ?? 'notif.reason.unknown')

  return (
    <CustomModal
      show={!!item}
      type={posted ? 'success' : 'error'}
      title={t(posted ? 'notif.detail.postedTitle' : 'notif.detail.failedTitle')}
      message={message}
      confirmText={t('notif.detail.close')}
      onConfirm={onClose}
    >
      <dl className="notif-detail">
        {rows.map(([key, value]) => (
          <div className="notif-detail__row" key={key}>
            <dt>{t(key)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {!posted && p.message && <p className="notif-detail__raw">{p.message}</p>}

      {/* A link, not CustomModal's onCancel slot: Escape fires onCancel, which would
          make dismissing the dialog open a Carmen tab. `jv_no` is Carmen's own JV id
          (the InternalMessage of the post), the same value the credit-card wizard
          hands to this route. */}
      {posted && p.jv_no && (
        <a
          className="btn btn-success notif-detail__jv"
          href={getCarmenUrl(`/glJv/${p.jv_no}/show`)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={15} strokeWidth={2} aria-hidden="true" />
          {t('notif.detail.openJv')}
        </a>
      )}
    </CustomModal>
  )
}
