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

interface Props {
  row: ReviewDocument
  onOpen: (id: string) => void
}

export default function QueueRow({ row, onOpen }: Props) {
  const { t } = useT()
  const reason = reasonKey(row.flags)

  return (
    <li className="rq-row">
      {/* A real button, not a div with onClick: this is the row's only action and it has
          to be reachable by keyboard and announced as activatable. */}
      <button type="button" className="rq-row-btn" onClick={() => onOpen(row.id)}>
        <span className="rq-row-main">
          <span className="rq-bank">{row.bank_code || t('review.unknownBank')}</span>
          {/* Mono on everything the reviewer has to verify — DESIGN.md's Mono Signal Rule. */}
          <span className="rq-date text-mono">{row.doc_date || '—'}</span>
          <span className="rq-docno text-mono">{row.doc_no || '—'}</span>
          <span className="rq-amount text-mono">{fmt(row.total)}</span>
          <ChevronRight size={16} className="rq-chevron" aria-hidden="true" />
        </span>
        <span className="rq-row-sub">
          <span className="rq-file" title={row.attachment}>
            {row.attachment}
          </span>
          <span className="rq-dot" aria-hidden="true">
            ·
          </span>
          <span>{t('review.lineCount', { count: String(row.line_count) })}</span>
          <span className="rq-dot" aria-hidden="true">
            ·
          </span>
          <span className={`rq-reason rq-reason--${reason.tone}`}>{t(reason.key)}</span>
        </span>
      </button>
    </li>
  )
}
