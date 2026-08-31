import { ExternalLink, Mail, Upload } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import { fmt } from '../../lib/format'
import { getCarmenUrl } from '../../lib/url'
import type { ReviewDocument } from '../../lib/api/emailReview'
import type { TKey } from '../../i18n/dict'

/**
 * The reason line, in priority order. One phrase, never a list.
 *
 * With review on, most parked documents are fine; the reviewer's real job is finding the
 * two that are not. A row that cannot say why it might be wrong makes them open all
 * fourteen. Ordered by how much it should stop someone: an unbalanced JV cannot post at
 * all, a guessed mapping posts but may post to the wrong account, warnings are advisory.
 */
function reasonKey(flags: ReviewDocument['flags']): { key: TKey; tone: string } {
  if (flags.includes('unbalanced')) return { key: 'review.reasonUnbalanced', tone: 'bad' }
  if (flags.includes('mapping_guessed')) return { key: 'review.reasonGuessed', tone: 'warn' }
  if (flags.includes('warnings')) return { key: 'review.reasonWarnings', tone: 'warn' }
  return { key: 'review.reasonClean', tone: 'calm' }
}

/** The reason codes the pipeline actually writes. Anything unmapped falls back to the
 *  raw code rather than to a blank — an unfamiliar code is still a lead. */
const REASON_KEY: Record<string, TKey> = {
  sender_not_allowed: 'review.rcSenderNotAllowed',
  no_rule_match: 'review.rcNoRuleMatch',
  unsupported_attachment: 'review.rcUnsupported',
  unreadable_document: 'review.rcUnreadable',
  wrong_pdf_password: 'review.rcWrongPassword',
  tax_id_mismatch: 'review.rcTaxIdMismatch',
  duplicate_document: 'review.rcDuplicate',
  mapping_incomplete: 'review.rcMappingIncomplete',
  carmen_rejected: 'review.rcCarmenRejected',
  // Distinct from carmen_rejected on purpose: a dead credential and a bad JV are fixed by
  // different people on different screens, and a dead one fails EVERY document of the BU.
  carmen_unauthorized: 'review.rcCarmenUnauthorized',
  ingest_paused: 'review.rcIngestPaused',
  rejected_by_reviewer: 'review.rcRejectedByReviewer',
}

const SETTINGS = { key: 'review.actionOpenSettings' as TKey, href: '#/email-settings' }

/**
 * Where a person fixes each cause — and nothing at all for the ones they cannot.
 *
 * **Keyed on `reason_code`, not on `status`.** The skipped/failed split is about whether a
 * credit was charged (`status = "skipped" if charged is None else "failed"` in
 * `email_ingest_service.py`), which says nothing about whether anyone can act:
 * `sender_not_allowed` is `skipped` and is one field away from fixed, while
 * `carmen_rejected` is `failed` and there is nothing to press here. Filing the actionable
 * ones under the chip the design doc calls "mostly noise" is how eight `sender_not_allowed`
 * rows cost a day of diagnosis on 2026-08-28.
 *
 * Deliberately absent, because a button would be a lie: `carmen_rejected` (Carmen's own
 * complaint, fixed in Carmen), `duplicate_document` (already posted, nothing owed),
 * `unreadable_document` / `unsupported_attachment` (we cannot re-read a file we never
 * stored — the Upload button above is the whole answer), `rejected_by_reviewer` (terminal
 * by design).
 */
const FIX: Record<string, { key: TKey; href: string }> = {
  mapping_incomplete: { key: 'review.actionFixMapping', href: '#/CreditCardOCR/mapping' },
  // Its own word, not the generic one: this is not "a setting is off", it is "the pipeline
  // is down for this BU until someone re-pastes the token".
  carmen_unauthorized: { key: 'review.actionReconnect', href: '#/email-settings' },
  no_rule_match: SETTINGS,
  sender_not_allowed: SETTINGS,
  wrong_pdf_password: SETTINGS,
  ingest_paused: SETTINGS,
  tax_id_mismatch: SETTINGS,
}

/**
 * Ledger status → the pill the row wears. The same four buckets the filter chips use
 * (FILTERS in routers/credit_card_activity.py), so a chip and a pill can never disagree
 * about which group a row is in.
 */
const STATUS_META: Record<string, { key: TKey; tone: string }> = {
  pending_review: { key: 'review.statusReview', tone: 'warn' },
  posted: { key: 'review.statusSuccess', tone: 'ok' },
  failed: { key: 'review.statusFailed', tone: 'bad' },
  rejected: { key: 'review.statusFailed', tone: 'bad' },
  skipped: { key: 'review.statusSkipped', tone: 'calm' },
  received: { key: 'review.statusSkipped', tone: 'calm' },
}

interface Props {
  row: ReviewDocument
  onOpen: (id: string) => void
}

export default function QueueRow({ row, onOpen }: Props) {
  const { t } = useT()
  const pending = row.status === 'pending_review'
  // A posted row has somewhere to go: the JV it became, in Carmen. Same destination the
  // `document_posted` notification offers, built from the same helper so the two cannot
  // point at different Carmens. Manual scans reach it through `credit_cards.jv_no`, which
  // is NULL for anything posted before migration 20260831000000 — hence the `—`.
  const jvHref = row.jv_no ? getCarmenUrl(`/glJv/${row.jv_no}/show`) : null
  const status = STATUS_META[row.status] ?? { key: 'review.statusSkipped' as TKey, tone: 'calm' }
  const SourceIcon = row.source === 'manual' ? Upload : Mail

  return (
    <tr className="rq-row">
      <td className="rq-c-source" data-label={t('review.colSource')}>
        <span className="rq-source">
          <SourceIcon size={13} strokeWidth={2} aria-hidden="true" />
          {t(row.source === 'manual' ? 'review.sourceManual' : 'review.sourceEmail')}
        </span>
      </td>

      <td className="rq-c-doc" data-label={t('review.colDocument')}>
        <span className="rq-bank">{row.bank_code || t('review.unknownBank')}</span>{' '}
        {/* Mono on everything the reviewer has to verify — DESIGN.md's Mono Signal Rule. */}
        <span className="rq-docno text-mono">{row.doc_no || '—'}</span>
        <span className="rq-file" title={row.attachment}>
          {row.attachment}
          {/* The gross, which is what lands on the credit side of the JV — the number a
              reviewer scans for. Pending only: `_finish` clears the payload it comes from,
              so on a resolved row 0.00 would be a wrong value, not a missing one. */}
          {pending && (
            <>
              {' · '}
              <span className="rq-amount text-mono">{fmt(row.total)}</span>
            </>
          )}
        </span>
      </td>

      <td className="rq-c-when text-mono" data-label={t('review.colReceived')}>
        {formatWhen(row.created_at)}
      </td>

      <td className="rq-c-jv text-mono" data-label={t('review.colJv')}>
        {jvHref ? (
          <a href={jvHref} target="_blank" rel="noopener noreferrer" title={t('review.openJv')}>
            {row.jv_no}
            <ExternalLink size={12} strokeWidth={2} aria-hidden="true" />
          </a>
        ) : (
          <span className="rq-empty-cell">—</span>
        )}
      </td>

      <td className="rq-c-status" data-label={t('review.colStatus')}>
        <span className={`rq-pill rq-pill--${status.tone}`}>{t(status.key)}</span>
      </td>

      <td className="rq-c-msg" data-label={t('review.colMessage')}>
        <Message row={row} pending={pending} />
      </td>

      <td className="rq-c-act" data-label={t('review.colActions')}>
        <RowAction row={row} onOpen={onOpen} />
      </td>
    </tr>
  )
}

/**
 * The action, and only where there is one.
 *
 * A resolved row has no `review_payload` left — `_finish` clears it on every terminal
 * transition — so a "View" button on one would open nothing. Its story is already in the
 * Message column and its JV number is already a link.
 */
function RowAction({ row, onOpen }: Props) {
  const { t } = useT()

  // The only row that asks for a decision rather than a repair.
  if (row.status === 'pending_review') {
    return (
      <button type="button" className="btn btn-outline btn-sm" onClick={() => onOpen(row.id)}>
        {t('review.actionReview')}
      </button>
    )
  }
  const fix = row.reason_code ? FIX[row.reason_code] : undefined
  if (!fix) return null
  return (
    <a className="btn btn-outline btn-sm" href={fix.href}>
      {t(fix.key)}
    </a>
  )
}

/** Why this row might need you (while pending), or what happened to it (once resolved). */
function Message({ row, pending }: { row: ReviewDocument; pending: boolean }) {
  const { t } = useT()

  if (pending) {
    const reason = reasonKey(row.flags)
    return <span className={`rq-reason rq-reason--${reason.tone}`}>{t(reason.key)}</span>
  }

  if (row.status === 'posted') {
    return (
      <span className="rq-reason rq-reason--ok">
        {row.source === 'manual'
          ? t('review.postedManually')
          : row.reviewed_by_name
            ? t('review.postedBy', { name: row.reviewed_by_name })
            : t('review.postedAutomatically')}
        {/* The JV posted but its VAT record did not — the document is done either way,
            so this is a note, not a failure. */}
        {row.error_message ? ` · ${row.error_message}` : ''}
      </span>
    )
  }

  const key = row.reason_code ? REASON_KEY[row.reason_code] : undefined
  const label = key ? t(key) : row.reason_code || t('review.rcUnknown')
  const tone = row.status === 'skipped' || row.status === 'received' ? 'calm' : 'bad'
  return (
    <span className={`rq-reason rq-reason--${tone}`} title={row.error_message || undefined}>
      {row.status === 'rejected' && row.reviewed_by_name
        ? t('review.rejectedBy', { name: row.reviewed_by_name, reason: label })
        : label}
    </span>
  )
}

/** When we handled it. A pending row's document date lives in the review modal; this
 *  column answers "how long has this been sitting here", which is the same question for
 *  every row regardless of status. */
function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}
