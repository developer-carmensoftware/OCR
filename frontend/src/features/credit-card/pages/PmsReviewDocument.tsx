import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Sparkles,
  Undo2,
  X,
  XCircle,
} from 'lucide-react'
import CustomModal from '@/shared/components/common/CustomModal'
import CustomSearchSelect from '@/shared/components/common/CustomSearchSelect'
import SwapLabel from '@/shared/components/common/SwapLabel'
import { useT } from '@/i18n/LanguageContext'
import { useDialogFocus } from '@/shared/hooks/useDialogFocus'
import { useScrollLock } from '@/shared/hooks/useScrollLock'
import { allowedAccountsForDept } from '@/shared/lib/deptAccounts'
import { stopText } from '@/shared/lib/reviewReasons'
import { usePmsReview } from '@/features/credit-card/hooks/usePmsReview'
import { fmtAmount, fmtCents, signedCents, toCents } from '@/features/credit-card/lib/pmsDay'

interface Props {
  id: string
  /** Dismissed without deciding — the day is still waiting. */
  onClose: () => void
  /** Approved, rejected, or found to be gone: the queue behind this is now stale. */
  onDone: () => void
}

/** Carmen's name and name2 are often the same words twice. */
const nameOf = (a?: { name: string; name2?: string }) =>
  a ? [...new Set([a.name, a.name2].filter(Boolean))].join(' · ') : ''

const dmy = (iso: string) => iso.split('-').reverse().join('/')
const weekday = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })

/** One column of a Dr/Cr pair: the amount on its own side, a dash on the other — the
 *  JV editor's convention, which the stacked phone layout hides (`jv-num--empty`). */
function Side({ cents, side, label }: { cents: number; side: 'debit' | 'credit'; label: string }) {
  const mine = side === 'debit' ? cents < 0 : cents > 0
  return mine ? (
    <td className="jv-num text-mono" data-label={label}>
      {fmtCents(cents)}
    </td>
  ) : (
    <td className="jv-num jv-num--empty">—</td>
  )
}

/** A section's one-line header: a state icon (or nothing), the title, one readout. */
function Head({
  id,
  title,
  state,
  children,
}: {
  id: string
  title: string
  state?: 'ok' | 'warn' | 'bad'
  children: ReactNode
}) {
  const Icon = state === 'ok' ? CheckCircle2 : state === 'warn' ? AlertTriangle : XCircle
  return (
    <header className={`pms-head${state ? ` pms-head--${state}` : ''}`}>
      {state ? <Icon size={16} aria-hidden="true" /> : <span />}
      <h3 className="pms-title" id={id}>
        {title}
      </h3>
      <span className="pms-val">{children}</span>
    </header>
  )
}

/**
 * One parked PMS day, as a modal over the queue (CA-119).
 *
 * The email review's shell — header, footer, Reject / Approve and post — with a body that
 * shows only what decides a day: does it balance, and does every code have an account. A
 * day has ~35 rows and ~15 JV lines, and none of them is re-keyed here, so the detail is a
 * table to read under two chips rather than an editor. The one input is an account for each
 * code this BU has never approved; Approve saves those as the BU's rules.
 */
export default function PmsReviewDocument({ id, onClose, onDone }: Props) {
  const { t } = useT()
  const r = usePmsReview(id, onClose, onDone)
  const modalRef = useRef<HTMLDivElement>(null)
  const { day, masters } = r

  useScrollLock()
  useDialogFocus(modalRef, {
    initialFocus: () => modalRef.current,
    // A confirmation on top runs its own Escape; mid-post there is nothing to close.
    onEscape: r.busy || r.rejecting || r.discarding ? null : r.requestClose,
  })

  const accName = (code?: string | null) => nameOf(masters.accounts.find(a => a.code === code))
  const deptOptions = masters.departments.map(d => ({ code: d.code, name: d.name, name2: d.name2 }))
  const dr = r.lines.reduce((s, l) => s + (l.cents < 0 ? -l.cents : 0), 0)
  const cr = r.lines.reduce((s, l) => s + (l.cents > 0 ? l.cents : 0), 0)
  const termCents = (day?.terms ?? []).map(x => ({ ...x, cents: toCents(x.amount) }))
  const termDr = termCents.reduce((s, x) => s + (x.cents < 0 ? -x.cents : 0), 0)
  const termCr = termCents.reduce((s, x) => s + (x.cents > 0 ? x.cents : 0), 0)
  const saved = day ? day.codes - day.new_codes.filter(c => !c.key.endsWith('|*')).length : 0
  const anyUnpickedByAi = day?.new_codes.some(c => !c.acc)

  const jvTable = (
    <table className="jv-table">
      <thead>
        <tr>
          <th scope="col" className="jv-c-dept">
            {t('pms.colDept')}
          </th>
          <th scope="col" className="jv-c-acc">
            {t('pms.colAccount')}
          </th>
          <th scope="col">{t('pms.colName')}</th>
          <th scope="col" className="jv-num pms-w-amt">
            {t('pms.colDebit')}
          </th>
          <th scope="col" className="jv-num pms-w-amt">
            {t('pms.colCredit')}
          </th>
        </tr>
      </thead>
      <tbody>
        {r.lines.map(l => (
          <tr className="jv-row" key={`${l.dept}|${l.acc}`}>
            <td className="text-mono" data-label={t('pms.colDept')}>
              {l.dept}
            </td>
            <td className="text-mono" data-label={t('pms.colAccount')}>
              {l.acc}
            </td>
            <td className="jv-desc">
              <span className="jv-desc-in">{accName(l.acc) || '—'}</span>
            </td>
            <Side cents={l.cents} side="debit" label={t('pms.colDebit')} />
            <Side cents={l.cents} side="credit" label={t('pms.colCredit')} />
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className={`jv-total${dr === cr ? '' : ' jv-total--bad'}`}>
          <td colSpan={3}>{dr === cr ? t('pms.balanced') : t('pms.notBalanced')}</td>
          <td className="jv-num text-mono" data-label={t('pms.colDebit')}>
            {fmtCents(dr)}
          </td>
          <td className="jv-num text-mono" data-label={t('pms.colCredit')}>
            {fmtCents(cr)}
          </td>
        </tr>
      </tfoot>
    </table>
  )

  const rowsTable = day && (
    <table className="jv-table">
      <thead>
        <tr>
          <th scope="col" className="pms-w-type">
            {t('pms.colType')}
          </th>
          <th scope="col" className="pms-w-code">
            {t('pms.colCode')}
          </th>
          <th scope="col">{t('pms.colDescription')}</th>
          <th scope="col" className="jv-num pms-w-amt">
            {t('pms.colAmount')}
          </th>
        </tr>
      </thead>
      <tbody>
        {day.rows.map((row, i) => (
          <tr className="jv-row" key={i}>
            <td data-label={t('pms.colType')}>{row.type}</td>
            <td className="text-mono pms-nowrap" data-label={t('pms.colCode')}>
              {row.code}
            </td>
            <td className="jv-desc">
              <span className="jv-desc-in">{row.desc}</span>
            </td>
            <td className="jv-num text-mono" data-label={t('pms.colAmount')}>
              {toCents(row.amount) < 0 ? '−' : ''}
              {fmtAmount(row.amount)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className={`jv-total${r.balanced ? '' : ' jv-total--bad'}`}>
          <td colSpan={3}>{t('pms.net')}</td>
          <td className="jv-num text-mono" data-label={t('pms.colAmount')}>
            {fmtCents(day.rows.reduce((s, x) => s + signedCents(x), 0))}
          </td>
        </tr>
      </tfoot>
    </table>
  )

  return createPortal(
    <div
      className="rd-overlay"
      role="presentation"
      // Close only when the press landed on the backdrop itself — see ReviewDocument.
      onMouseDown={e => {
        if (e.target === e.currentTarget) r.requestClose()
      }}
    >
      <div
        className="rd-modal"
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pms-title"
      >
        <CustomModal
          show={r.rejecting}
          type="warning"
          confirmVariant="danger"
          title={t('pms.rejectTitle')}
          message={t('pms.rejectMsg')}
          inputLabel={t('review.rejectReason')}
          inputValue={r.reason}
          onInputChange={r.setReason}
          inputPlaceholder={t('pms.rejectHint')}
          confirmText={t('pms.rejectConfirm')}
          cancelText={t('modal.cancel')}
          busy={r.busy}
          onConfirm={r.reject}
          onCancel={() => r.setRejecting(false)}
        />
        <CustomModal
          show={r.discarding}
          type="warning"
          confirmVariant="danger"
          title={t('review.discardTitle')}
          message={t('review.discardMsg')}
          confirmText={t('review.discardConfirm')}
          cancelText={t('review.discardKeep')}
          onConfirm={onClose}
          onCancel={() => r.setDiscarding(false)}
        />

        <header className="rd-modal-head">
          <h2
            className="rd-title-bank"
            id="pms-title"
            aria-label={r.loading ? t('pms.loading') : undefined}
          >
            PMS
          </h2>
          {day && (
            <span className="rd-title-file">
              {day.interface} · {day.doc_type} ·{' '}
              <span className="rd-title-date">
                <span className="text-mono">{dmy(day.doc_date)}</span> {weekday(day.doc_date)}
              </span>
            </span>
          )}
          <button
            type="button"
            className="btn-icon rd-close"
            onClick={r.requestClose}
            disabled={r.busy}
            aria-label={t('review.close')}
          >
            <X size={16} />
          </button>
        </header>

        {r.loading ? (
          <div className="rd-body" aria-busy="true">
            <span className="sr-only" role="status">
              {t('pms.loading')}
            </span>
            <div className="rd-skel-rows">
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className="rq-skel" aria-hidden="true">
                  &nbsp;
                </span>
              ))}
            </div>
          </div>
        ) : r.gone || !day ? (
          <div className="rq-empty rd-gone">
            <span className="rq-empty-icon rq-empty-icon--bad" aria-hidden>
              <AlertTriangle size={36} />
            </span>
            <h2 className="rq-empty-title">{t('pms.goneTitle')}</h2>
            <p className="rq-empty-body">{t('pms.goneBody')}</p>
            <button type="button" className="btn btn-outline" onClick={onDone}>
              {t('review.back')}
            </button>
          </div>
        ) : (
          <>
            <div className="rd-body">
              {/* Why the pipeline stopped, when it did (Carmen refused an unattended post).
                  A day parked only for review carries no reason and shows nothing here. */}
              {day.reason_code && (
                <div className="mapping-alert">
                  <AlertTriangle size={16} />
                  <span className="cc-alert-text">{stopText(day, t, true)}</span>
                </div>
              )}

              <section className="pms-sec" aria-labelledby="pms-bal">
                <Head id="pms-bal" title={t('pms.balance')} state={r.balanced ? 'ok' : 'bad'}>
                  {!r.balanced && (
                    <>
                      <span className="pms-off">
                        {t('pms.offBy', { amount: fmtAmount(day.off) })}
                      </span>
                      <span className="pms-sep">·</span>
                    </>
                  )}
                  Dr <span className="text-mono">{fmtCents(termDr)}</span>
                  <span className="pms-sep">{r.balanced ? '=' : '·'}</span>
                  Cr <span className="text-mono">{fmtCents(termCr)}</span>
                </Head>
                <table className="jv-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('pms.colType')}</th>
                      <th scope="col" className="jv-num pms-w-amt">
                        {t('pms.colDebit')}
                      </th>
                      <th scope="col" className="jv-num pms-w-amt">
                        {t('pms.colCredit')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {termCents.map(x => (
                      <tr className="jv-row" key={x.type}>
                        <td className="jv-desc">
                          <span className="jv-desc-in">
                            {x.type === 'Guest Ledger' ? t('pms.guestLedgerReversed') : x.type}
                          </span>
                        </td>
                        <Side cents={x.cents} side="debit" label={t('pms.colDebit')} />
                        <Side cents={x.cents} side="credit" label={t('pms.colCredit')} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="pms-sec" aria-labelledby="pms-acc">
                <Head
                  id="pms-acc"
                  title={t('pms.accounts')}
                  state={day.new_codes.length ? 'warn' : 'ok'}
                >
                  {day.new_codes.length ? (
                    <>
                      <strong>
                        {t(anyUnpickedByAi ? 'pms.newUnmapped' : 'pms.newMappedByAi', {
                          n: day.new_codes.length,
                        })}
                      </strong>
                      <span className="pms-sep">·</span>
                      {t('pms.saved', { n: saved })}
                    </>
                  ) : (
                    t('pms.allSaved', { n: day.codes })
                  )}
                </Head>
                {day.new_codes.length > 0 && (
                  <table className="jv-table" aria-label={t('pms.colNewCode')}>
                    <thead>
                      <tr>
                        <th scope="col">{t('pms.colNewCode')}</th>
                        <th scope="col" className="jv-num pms-w-amt">
                          {t('pms.colAmount')}
                        </th>
                        <th scope="col" className="pms-w-dept">
                          {t('pms.colDept')}
                        </th>
                        <th scope="col" className="pms-w-acc">
                          {t('pms.colAccount')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {day.new_codes.map(c => {
                        const p = r.picks[c.key] ?? { dept: '', acc: '' }
                        const ai = r.isAiPick(c.key)
                        const changed =
                          !ai && (p.dept !== (c.dept ?? '') || p.acc !== (c.acc ?? ''))
                        const cents = toCents(c.amount)
                        return (
                          <tr
                            key={c.key}
                            className={`jv-row${p.acc && p.dept ? '' : ' jv-row--needed'}${changed ? ' jv-row--changed' : ''}`}
                          >
                            <td className="jv-desc">
                              <span className="jv-desc-in">
                                <span className="pms-codecell">
                                  <span className="text-mono pms-code">{c.code}</span>
                                  <span className="pms-desc">{c.description}</span>
                                  <span className="pms-to" title={accName(p.acc)}>
                                    {p.acc && accName(p.acc) ? `→ ${accName(p.acc)}` : ' '}
                                  </span>
                                </span>
                                {ai && (
                                  <span
                                    className="jv-tag jv-tag--ai"
                                    title={[t('pms.aiHint'), c.why].filter(Boolean).join(' ')}
                                  >
                                    <Sparkles size={11} strokeWidth={2.25} aria-hidden="true" />
                                    {t('pms.aiTag')}
                                  </span>
                                )}
                                {changed && c.acc && (
                                  <button
                                    type="button"
                                    className="jv-tag jv-tag--undo"
                                    onClick={() => r.undo(c.key)}
                                  >
                                    <Undo2 size={11} strokeWidth={2.25} aria-hidden="true" />
                                    {t('pms.undo')}
                                  </button>
                                )}
                              </span>
                            </td>
                            <td className="jv-num text-mono" data-label={t('pms.colAmount')}>
                              <span>
                                {fmtCents(cents)}
                                <span className="pms-dir">{cents < 0 ? 'Dr' : 'Cr'}</span>
                              </span>
                            </td>
                            <td data-label={t('pms.colDept')}>
                              <CustomSearchSelect
                                value={p.dept || null}
                                onChange={v => r.setPick(c.key, 'dept', v)}
                                options={deptOptions}
                                placeholder={t('pms.deptPlaceholder')}
                                hasError={!p.dept}
                                aria-label={t('pms.deptFor', { code: c.code })}
                              />
                            </td>
                            <td data-label={t('pms.colAccount')}>
                              <CustomSearchSelect
                                value={p.acc || null}
                                onChange={v => r.setPick(c.key, 'acc', v)}
                                options={allowedAccountsForDept(
                                  p.dept,
                                  masters.departments,
                                  masters.accounts
                                )}
                                placeholder={t('pms.accountPlaceholder')}
                                hasError={!p.acc}
                                aria-label={t('pms.accountFor', { code: c.code })}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </section>

              <section className="pms-sec" aria-label={t('pms.details')}>
                <div className="pms-chips" role="tablist" aria-label={t('pms.details')}>
                  {(
                    [
                      ['jv', t('pms.jvLines'), r.lines.length],
                      ['rows', t('pms.pmsRows'), day.rows.length],
                    ] as const
                  ).map(([key, label, n]) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      id={`pms-tab-${key}`}
                      className="pms-chip"
                      aria-selected={r.detail === key}
                      aria-controls="pms-detail"
                      tabIndex={r.detail === key ? 0 : -1}
                      onClick={() => r.setDetail(key)}
                      onKeyDown={e => {
                        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
                        const next = r.detail === 'jv' ? 'rows' : 'jv'
                        r.setDetail(next)
                        document.getElementById(`pms-tab-${next}`)?.focus()
                      }}
                    >
                      {label} <span className="pms-n">{n}</span>
                    </button>
                  ))}
                </div>
                {/* A frame of its own, so the head and the total stay put while the rows
                    scroll under them (sticky thead / tfoot, review-queue.css). */}
                <div
                  className="pms-scroll"
                  id="pms-detail"
                  role="tabpanel"
                  aria-labelledby={`pms-tab-${r.detail}`}
                  tabIndex={0}
                >
                  {r.detail === 'jv' ? jvTable : rowsTable}
                </div>
              </section>
            </div>

            <footer className="rd-modal-foot">
              {r.postError && (
                <div className="mapping-alert is-danger" role="alert">
                  <AlertCircle size={16} />
                  <span className="cc-alert-text">{r.postError}</span>
                </div>
              )}
              {r.blockReason && !r.postError ? (
                <p
                  className={`rd-blocked${r.balanced ? '' : ' rd-blocked--bad'}`}
                  id="pms-blocked"
                  role="status"
                >
                  {r.balanced ? (
                    <AlertTriangle size={14} aria-hidden="true" />
                  ) : (
                    <XCircle size={14} aria-hidden="true" />
                  )}
                  {r.blockReason}
                </p>
              ) : (
                day.new_codes.length > 0 &&
                !r.postError && (
                  <p className="rd-blocked rd-blocked--note" role="status">
                    <Info size={14} aria-hidden="true" />
                    {t('pms.saves')}
                  </p>
                )
              )}
              <div className="rd-actions">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => r.setRejecting(true)}
                  disabled={r.busy}
                >
                  {t('review.reject')}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={r.approve}
                  disabled={r.busy || !!r.blockReason}
                  aria-describedby={r.blockReason && !r.postError ? 'pms-blocked' : undefined}
                >
                  {r.busy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  <SwapLabel
                    active={r.busy}
                    idle={t('review.approve')}
                    busy={t('review.approving')}
                  />
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
