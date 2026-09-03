import { ExternalLink } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import { fmt } from '../../lib/format'
import { glFieldLabel, glFieldList } from '../../lib/glFieldLabels'
import { FIX, REASON_KEY } from '../../lib/reviewReasons'
import { getCarmenUrl } from '../../lib/url'
import type { ReviewDocument } from '../../lib/api/emailReview'
import type { TKey } from '../../i18n/dict'

/**
 * The reason line, in priority order. One phrase, never a list.
 *
 * With review on, most parked documents are fine; the reviewer's real job is finding the
 * two that are not. A row that cannot say why it might be wrong makes them open all
 * fourteen. Ordered by how much it should stop someone: a missing mapping cannot post at
 * all, an unbalanced JV cannot either, a guessed mapping posts but may post to the wrong
 * account, warnings are advisory.
 *
 * **The mapping reasons name the fields.** "GL mapping guessed" told the reviewer a rule
 * was invented and then made them open the document to find out which — the row already
 * carries `guessed` and `unmapped`, so it can say. Documents parked before those were
 * recorded have empty lists and fall back to the bare phrase.
 */
function reasonFor(row: ReviewDocument): { key: TKey; tone: string; fields: string[] } {
  const f = row.flags
  if (f.includes('mapping_missing'))
    return { key: 'review.reasonMissingMapping', tone: 'bad', fields: row.unmapped || [] }
  if (f.includes('unbalanced')) return { key: 'review.reasonUnbalanced', tone: 'bad', fields: [] }
  if (f.includes('mapping_guessed'))
    return { key: 'review.reasonGuessed', tone: 'warn', fields: row.guessed || [] }
  if (f.includes('warnings')) return { key: 'review.reasonWarnings', tone: 'warn', fields: [] }
  // Green, and phrased as the next action rather than as the absence of a problem. This is
  // the row a reviewer should spend the least time on, so it gets the strongest "skip me"
  // signal the column has. It cannot be misread as already-posted: the pill beside it still
  // says Review, in amber.
  return { key: 'review.reasonClean', tone: 'ok', fields: [] }
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
  // Its own word, not "Skipped". `received` is the state every row is CLAIMED into — the
  // backlog cap writes no row at all — so one still sitting here is a message the pipeline
  // picked up and never finished. Wearing the calm grey of "your filename rule threw this
  // out" made a crashed run and a deliberate filter look identical.
  received: { key: 'review.statusStuck', tone: 'warn' },
}

interface Props {
  row: ReviewDocument
  onOpen: (id: string) => void
}

export default function QueueRow({ row, onOpen }: Props) {
  const { t } = useT()
  const pending = row.status === 'pending_review'
  const status = STATUS_META[row.status] ?? { key: 'review.statusSkipped' as TKey, tone: 'calm' }

  // Order is the order the reader asks: what state → which document → why → when → where it
  // went → what to press. The two narrow ones sit at the right edge, where JV's column of
  // em dashes costs least. Everything not given a width in review-queue.css — Document and
  // Message — splits the rest, because those are the only cells that were truncating.
  return (
    <tr className="rq-row">
      <td className="rq-c-status" data-label={t('review.colStatus')}>
        <span className={`rq-pill rq-pill--${status.tone}`}>{t(status.key)}</span>
      </td>

      <td className="rq-c-doc" data-label={t('review.colDocument')}>
        <span className="rq-bank">{row.bank_code || t('review.unknownBank')}</span>{' '}
        {/* Mono on everything the reviewer has to verify — DESIGN.md's Mono Signal Rule. */}
        <span className="rq-docno text-mono">{row.doc_no || '—'}</span>
        {/* No provenance marker here. It was a 6.5rem "Source" column, then a 12px envelope
            on this line, and both said the same one word on every row of two chips out of
            three — manual scans only exist as `posted` (MANUAL_FILTERS). On the one chip
            where the two do mix, the Message column already says which in a sentence
            ("scanned and posted by hand" vs "posted automatically"), so the glyph was
            unreadable where it was needed and constant where it was not. */}
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

      <td className="rq-c-msg" data-label={t('review.colMessage')}>
        <Message row={row} pending={pending} />
      </td>

      <td className="rq-c-when text-mono" data-label={t('review.colReceived')}>
        <span title={fullWhen(row.created_at)}>{formatWhen(row.created_at)}</span>
      </td>

      {/* The number, as data. It used to BE the link to Carmen, which made the one thing a
          reviewer wants to do with a JV number — select it, copy it, paste it into Carmen's
          own search — impossible without opening a tab. The action moved to the Actions
          column, where the rest of this row's buttons already live. The `title` is what a
          truncated number falls back to now that there is no link to hover. */}
      <td className="rq-c-jv text-mono" data-label={t('review.colJv')}>
        {row.jv_no ? (
          <span title={row.jv_no}>{row.jv_no}</span>
        ) : (
          <span className="rq-empty-cell">—</span>
        )}
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
 * Message column.
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

  // A posted row has somewhere to go: the JV it became, in Carmen. Same destination the
  // `document_posted` notification offers, built from the same helper so the two cannot
  // point at different Carmens. Manual scans reach it through `credit_cards.jv_no`, which
  // is NULL for anything posted before migration 20260831000000 — those get no button.
  //
  // Ahead of `FIX` because the two cannot collide: a row with a JV posted, and every code
  // in FIX is a reason it did not.
  if (row.jv_no) {
    return (
      <a
        className="btn btn-outline btn-sm"
        href={getCarmenUrl(`/glJv/${row.jv_no}/show`)}
        target="_blank"
        rel="noopener noreferrer"
        title={t('review.openJv')}
      >
        {t('review.actionOpenJv')}
        <ExternalLink size={12} strokeWidth={2} aria-hidden="true" />
      </a>
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

  // A pending row with a reason code is one the pipeline *stopped*, not one it parked at
  // the review fork — a foreign tax ID, a payment type nothing maps, a Carmen refusal. It
  // outranks every flag: `reasonFor` answers "why this might be worth opening", and this
  // answers "why this got no further", which is a stronger claim on the reviewer's time.
  // Amber, not rose: unlike the resolved rows wearing these same words, this one is still
  // open and still postable.
  if (pending && row.reason_code) {
    const key = REASON_KEY[row.reason_code]
    return (
      <span className="rq-reason rq-reason--warn" title={row.error_message || undefined}>
        {key ? t(key) : row.reason_code}
      </span>
    )
  }

  if (pending) {
    const reason = reasonFor(row)
    const named = reason.fields.length ? glFieldList(reason.fields) : ''
    return (
      <span
        className={`rq-reason rq-reason--${reason.tone}`}
        // The cell ellipsizes, so the full list lives here rather than being lost.
        title={reason.fields.length ? reason.fields.map(glFieldLabel).join(', ') : undefined}
      >
        {named ? `${t(reason.key)}: ${named}` : t(reason.key)}
      </span>
    )
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

  // Claimed and never finished. It has no reason_code to fall back on, and the generic
  // "no reason recorded" said the one thing that is not true about it: something did
  // happen, and it stopped halfway.
  if (row.status === 'received') {
    return <span className="rq-reason rq-reason--warn">{t('review.rcStuck')}</span>
  }

  const key = row.reason_code ? REASON_KEY[row.reason_code] : undefined
  const label = key ? t(key) : row.reason_code || t('review.rcUnknown')
  const tone = row.status === 'skipped' ? 'calm' : 'bad'
  return (
    <span className={`rq-reason rq-reason--${tone}`} title={row.error_message || undefined}>
      {row.status === 'rejected' && row.reviewed_by_name
        ? t('review.rejectedBy', { name: row.reviewed_by_name, reason: label })
        : label}
    </span>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')

/** When we handled it. A pending row's document date lives in the review modal; this
 *  column answers "how long has this been sitting here", which is the same question for
 *  every row regardless of status.
 *
 *  Two forms, not one. The full `31/08/2026 14:22` cost 9.5rem of a table whose two content
 *  columns were fighting for width, to print a date that is today's on every row that
 *  matters. Today gives the time, anything older gives the date; `fullWhen` is on the
 *  title so nothing is actually lost. */
function formatWhen(iso: string | null): string {
  const d = parseWhen(iso)
  if (!d) return '—'
  const now = new Date()
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  return sameDay
    ? `${pad(d.getHours())}:${pad(d.getMinutes())}`
    : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${pad(d.getFullYear() % 100)}`
}

/** The whole timestamp, for the cell's tooltip. */
function fullWhen(iso: string | null): string | undefined {
  const d = parseWhen(iso)
  if (!d) return undefined
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseWhen(iso: string | null): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}
