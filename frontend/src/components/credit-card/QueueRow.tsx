import { ChevronRight } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import { fmt } from '../../lib/format'
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
  ingest_paused: 'review.rcIngestPaused',
  rejected_by_reviewer: 'review.rcRejectedByReviewer',
}

interface Props {
  row: ReviewDocument
  onOpen: (id: string) => void
}

export default function QueueRow({ row, onOpen }: Props) {
  const { t } = useT()
  const pending = row.status === 'pending_review'

  // Only a pending document can be opened — every other row's payload has been cleared,
  // so there is nothing on the other side of the click.
  const Tag = pending ? 'button' : 'div'
  const clickProps = pending ? { type: 'button' as const, onClick: () => onOpen(row.id) } : {}

  return (
    <li className={`rq-row${pending ? '' : ' rq-row--static'}`}>
      <Tag className="rq-row-btn" {...clickProps}>
        <span className="rq-row-main">
          <span className="rq-bank">{row.bank_code || t('review.unknownBank')}</span>
          {/* Mono on everything the reviewer has to verify — DESIGN.md's Mono Signal Rule. */}
          <span className="rq-date text-mono">
            {pending ? row.doc_date || '—' : formatWhen(row.created_at)}
          </span>
          <span className="rq-docno text-mono">{row.doc_no || '—'}</span>

          {/* A resolved row has no amount: `_finish` cleared the payload it came from.
              Showing 0.00 there would be a wrong number, not a missing one — so the JV
              it became takes that column instead. */}
          {pending ? (
            <span className="rq-amount text-mono">{fmt(row.total)}</span>
          ) : (
            <span className="rq-jv text-mono">{row.jv_no || '—'}</span>
          )}

          {pending ? (
            <ChevronRight size={16} className="rq-chevron" aria-hidden="true" />
          ) : (
            <span className="rq-chevron" aria-hidden="true" />
          )}
        </span>

        <span className="rq-row-sub">
          <span className="rq-file" title={row.attachment}>
            {row.attachment}
          </span>
          <span className="rq-dot" aria-hidden="true">
            ·
          </span>
          {pending ? (
            <>
              <span>{t('review.lineCount', { count: String(row.line_count) })}</span>
              <span className="rq-dot" aria-hidden="true">
                ·
              </span>
              <span className={`rq-reason rq-reason--${reasonKey(row.flags).tone}`}>
                {t(reasonKey(row.flags).key)}
              </span>
            </>
          ) : (
            <ResolvedNote row={row} />
          )}
        </span>
      </Tag>
    </li>
  )
}

/** What happened to a document nobody can open any more. The whole story the ledger
 *  columns still hold: who decided, or what refused it. */
function ResolvedNote({ row }: { row: ReviewDocument }) {
  const { t } = useT()

  if (row.status === 'posted') {
    return (
      <span className="rq-reason rq-reason--ok">
        {row.reviewed_by_name
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

/** Resolved rows have no document date — the payload is gone — so they are stamped with
 *  when we handled them, which is the only date the ledger still knows. */
function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}
