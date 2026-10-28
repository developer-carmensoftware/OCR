import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
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

interface Props {
  id: string
  /** Dismissed without deciding — the day is still waiting. */
  onClose: () => void
  /** Approved, rejected, or found to be gone: the queue behind this is now stale. */
  onDone: () => void
}

const dmy = (iso: string) => iso.split('-').reverse().join('/')
const weekday = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })

/** A section's one-line header: a state icon (or nothing), the title, one readout. */
function Head({
  id,
  title,
  state,
  children,
}: {
  id: string
  title: string
  state?: 'ok' | 'warn'
  children: ReactNode
}) {
  const Icon = state === 'ok' ? CheckCircle2 : AlertTriangle
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
 * is one table, laid out as Carmen's own mapping screen: Code, Description, DeptCode, AccCode,
 * AccDesc. The rows Carmen's mapping table cannot place yet come first, with pickers; the
 * rest read as Carmen maps them. No amounts: debit, credit and totals are Carmen's engine's,
 * by the BU's PMS setting in Carmen (decision-log #43), and nothing here could change them.
 * Approve writes the new accounts into Carmen.
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

  // Ctrl/⌘+Enter approves, as a mail client sends. On the document, like useDialogFocus's
  // keys: a picker that just closed leaves focus on <body>. A key a picker already used
  // (Enter on an option) is not ours, and nothing approves behind a confirmation.
  const canApprove = !!day && !r.busy && !r.blockReason && !r.rejecting && !r.discarding
  const approveByKey = useRef<(() => void) | null>(null)
  // A layout effect, so the key is armed in the same commit that shows the day: a passive one
  // could run after a key pressed the moment the table appeared.
  useLayoutEffect(() => {
    approveByKey.current = canApprove ? r.approve : null
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey) || e.defaultPrevented) return
      if (!approveByKey.current) return
      e.preventDefault()
      approveByKey.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // An account by its one short name, as Carmen's AccDesc column prints it.
  const accShort = (code?: string | null) => masters.accounts.find(a => a.code === code)?.name ?? ''
  const deptOptions = masters.departments.map(d => ({ code: d.code, name: d.name, name2: d.name2 }))

  // The rows Carmen's table already places, one per key: with no amount on screen, a key the
  // PMS wrote twice would read the same twice. A Map keeps each key at its first position.
  const mappedRows = day
    ? [...new Map(day.rows.filter(row => row.acc).map(row => [row.key, row])).values()]
    : []
  // The key columns (Code, Description for Comanche), as Carmen's mapping screen shows them.
  // Not `jv-desc` on the code: on a phone that class makes a cell the card's unlabelled
  // title, and the row's title is its description.
  const keyCells = (values: Record<string, string>) =>
    (day?.key_columns ?? []).map((col, c) => (
      <td key={col} className={c === 0 ? 'text-mono' : 'jv-desc'} data-label={col}>
        {c === 0 ? values[col] : <span className="jv-desc-in">{values[col]}</span>}
      </td>
    ))

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

              <section className="pms-sec" aria-labelledby="pms-acc">
                <Head id="pms-acc" title={t('pms.accounts')} state={r.blockReason ? 'warn' : 'ok'}>
                  {t('pms.rowCount', { n: day.new_codes.length + mappedRows.length })}
                </Head>
                <table className="jv-table" aria-labelledby="pms-acc">
                  <thead>
                    <tr>
                      {day.key_columns.map((col, c) => (
                        <th scope="col" key={col} className={c === 0 ? 'pms-w-code' : undefined}>
                          {col}
                        </th>
                      ))}
                      <th scope="col" className="pms-w-dept">
                        {t('pms.colDept')}
                      </th>
                      <th scope="col" className="pms-w-acc">
                        {t('pms.colAccount')}
                      </th>
                      <th scope="col" className="pms-w-name">
                        {t('pms.colAccDesc')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* The rows to decide first, so a long day never buries them. */}
                    {day.new_codes.map(c => {
                      const p = r.picks[c.key] ?? { dept: '', acc: '' }
                      const ai = r.isAiPick(c.key)
                      const changed = !ai && (p.dept !== (c.dept ?? '') || p.acc !== (c.acc ?? ''))
                      return (
                        <tr
                          key={c.key}
                          className={`jv-row${p.acc && p.dept ? '' : ' jv-row--needed'}${changed ? ' jv-row--changed' : ''}`}
                        >
                          {keyCells(c.values)}
                          <td data-label={t('pms.colDept')}>
                            <CustomSearchSelect
                              value={p.dept || null}
                              onChange={v => r.setPick(c.key, 'dept', v)}
                              options={deptOptions}
                              placeholder={t('pms.deptPlaceholder')}
                              hasError={!p.dept}
                              aria-label={t('pms.deptFor', { code: c.label })}
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
                              aria-label={t('pms.accountFor', { code: c.label })}
                            />
                          </td>
                          {/* The picked account by name (the picker shows only its number),
                              then whose answer it is: the AI's, or a person's with Undo. */}
                          <td data-label={t('pms.colAccDesc')}>
                            <span className="pms-accdesc">
                              {accShort(p.acc)}
                              {ai && (
                                <span className="jv-tag jv-tag--ai pms-tag-ai">
                                  <Sparkles size={11} strokeWidth={2.25} aria-hidden="true" />
                                  {t('pms.aiTag')}
                                </span>
                              )}
                              {changed && c.acc && (
                                <button
                                  type="button"
                                  className="jv-tag jv-tag--undo"
                                  onClick={() => r.undo(c.key)}
                                  aria-label={t('pms.undoFor', { code: c.label })}
                                >
                                  <Undo2 size={11} strokeWidth={2.25} aria-hidden="true" />
                                  {t('pms.undo')}
                                </button>
                              )}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    {/* As Carmen maps them: Carmen's own screen edits these, not this one. */}
                    {mappedRows.map(row => (
                      <tr className="jv-row" key={row.key}>
                        {keyCells(row.values)}
                        <td className="text-mono" data-label={t('pms.colDept')}>
                          {row.dept}
                        </td>
                        <td className="text-mono" data-label={t('pms.colAccount')}>
                          {row.acc}
                        </td>
                        <td data-label={t('pms.colAccDesc')}>{row.name || accShort(row.acc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                <p className="rd-blocked" id="pms-blocked" role="status">
                  <AlertTriangle size={14} aria-hidden="true" />
                  {r.blockReason}
                </p>
              ) : (
                // What Approve leaves behind, said before it is pressed: the new rows' accounts
                // stay in Carmen's mapping for every later day. With no tick (decision-log
                // #47) this and the AI tag are the warning. A day with nothing new needs none.
                !r.postError &&
                day.new_codes.length > 0 && (
                  <p className="rd-blocked rd-blocked--note" role="status">
                    <Info size={14} aria-hidden="true" />
                    {t('pms.saves', {
                      n: day.new_codes.length,
                      interface: day.interface,
                      date: dmy(day.doc_date),
                    })}
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
                  aria-keyshortcuts="Control+Enter"
                  title="Ctrl+Enter"
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
