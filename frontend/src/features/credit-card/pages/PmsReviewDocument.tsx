import { useEffect, useRef, type ReactNode } from 'react'
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

/** Carmen's name and name2 are often the same words twice. */
const nameOf = (a?: { name: string; name2?: string }) =>
  a ? [...new Set([a.name, a.name2].filter(Boolean))].join(' · ') : ''

const dmy = (iso: string) => iso.split('-').reverse().join('/')
const weekday = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })

/** "-2542.9" → "−2,542.90": the amount as the PMS wrote it, grouped, with a true minus. Its
 *  sign is the PMS's; which side it posts to is Carmen's engine's (decision-log #43). */
const fmtAmount = (amount: string) => {
  const n = Number(amount)
  if (amount === '' || !Number.isFinite(n)) return amount
  const s = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return n < 0 ? `−${s}` : s
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
 * shows only what a person decides here: an account for each row Carmen's mapping table
 * cannot place yet. Debit, credit and totals are Carmen's engine's, by the BU's PMS setting
 * in Carmen (decision-log #43), so the day is shown as the PMS wrote it, with what each row
 * maps to — a table to read, not an editor. Approve writes the new accounts into Carmen.
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
  useEffect(() => {
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

  const accName = (code?: string | null) => nameOf(masters.accounts.find(a => a.code === code))
  // The rows table names an account the way Carmen's mapping table does: one short name.
  const accShort = (code?: string | null) => masters.accounts.find(a => a.code === code)?.name ?? ''
  const deptOptions = masters.departments.map(d => ({ code: d.code, name: d.name, name2: d.name2 }))
  const counter = day
    ? [`${day.counter.dept}/${day.counter.acc}`, day.counter.name].filter(Boolean).join(' ')
    : ''

  const rowsTable = day && (
    <table className="jv-table">
      <thead>
        <tr>
          {day.key_columns.map((col, c) => (
            <th scope="col" key={col} className={c === 0 ? 'pms-w-code' : undefined}>
              {col}
            </th>
          ))}
          <th scope="col" className="jv-num pms-w-amt">
            {t('pms.colAmount')}
          </th>
          <th scope="col" className="pms-w-name">
            {t('pms.colAccount')}
          </th>
        </tr>
      </thead>
      <tbody>
        {day.rows.map((row, i) => {
          const pick = r.picks[row.key]
          const dept = row.dept ?? pick?.dept
          const acc = row.acc ?? pick?.acc
          return (
            <tr className="jv-row" key={i}>
              {day.key_columns.map((col, c) => (
                <td
                  key={col}
                  className={c === 0 ? 'text-mono pms-nowrap' : 'jv-desc'}
                  data-label={col}
                >
                  {c === 0 ? (
                    row.values[col]
                  ) : (
                    <span className="jv-desc-in">{row.values[col]}</span>
                  )}
                </td>
              ))}
              <td className="jv-num text-mono" data-label={t('pms.colAmount')}>
                {fmtAmount(row.amount)}
              </td>
              {/* Not `jv-desc`: on a phone that class makes a cell the card's unlabelled
                  title, and the row's title is its description, not its account. */}
              <td data-label={t('pms.colAccount')}>
                <span className="jv-desc-in">
                  {acc ? (
                    <>
                      <span className="text-mono">
                        {dept}/{acc}
                      </span>{' '}
                      {row.name || accShort(acc)}
                    </>
                  ) : (
                    '—'
                  )}
                  {row.acc ? null : <span className="jv-tag pms-tag-new">{t('pms.newTag')}</span>}
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
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

              {/* Who decides the sides, so nobody looks here for a balance: Carmen's own
                  setting, named as Carmen names it. */}
              <p className="pms-note">
                <Info size={14} aria-hidden="true" />
                <span>
                  {t('pms.carmenPosts', {
                    setting: day.setting_code,
                    postType: day.post_type,
                    counter,
                  })}
                </span>
              </p>

              <section className="pms-sec" aria-labelledby="pms-acc">
                <Head
                  id="pms-acc"
                  title={t('pms.accounts')}
                  state={r.unpickedCount || r.toCheck ? 'warn' : 'ok'}
                >
                  {/* Live from the picks: what is still open, then what Carmen already has. */}
                  {day.new_codes.length ? (
                    <>
                      <strong>{t('pms.newCount', { n: day.new_codes.length })}</strong>
                      <span className="pms-sep">·</span>
                      <span>
                        {r.unpickedCount
                          ? t('pms.needAccount', { n: r.unpickedCount })
                          : r.toCheck
                            ? t('pms.toCheck', { n: r.toCheck })
                            : t('pms.allHaveAccounts')}
                      </span>
                      <span className="pms-sep">·</span>
                      {t('pms.mappedInCarmen', { n: day.mapped_count })}
                    </>
                  ) : (
                    t('pms.allMapped', { n: day.mapped_count })
                  )}
                </Head>
                {day.new_codes.length > 0 && (
                  <table className="jv-table" aria-label={t('pms.newRows')}>
                    <thead>
                      <tr>
                        <th scope="col">{t('pms.colNewRow')}</th>
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
                        const [code, ...rest] = Object.values(c.values)
                        return (
                          <tr
                            key={c.key}
                            className={`jv-row${p.acc && p.dept ? '' : ' jv-row--needed'}${changed ? ' jv-row--changed' : ''}`}
                          >
                            <td className="jv-desc">
                              <span className="jv-desc-in">
                                <span className="pms-codecell">
                                  <span className="text-mono pms-code">{code}</span>
                                  <span className="pms-desc">{rest.join(' · ')}</span>
                                  <span className="pms-to">
                                    {p.acc && accName(p.acc) ? `→ ${accName(p.acc)}` : ' '}
                                  </span>
                                  {/* The AI's reason, as text: a hover title reached no
                                      keyboard, touch or screen reader. */}
                                  {ai && c.why && (
                                    <span className="pms-why">
                                      {t('pms.aiWhy', { why: c.why })}
                                    </span>
                                  )}
                                </span>
                                {ai && (
                                  <span className="jv-tag jv-tag--ai pms-tag-ai">
                                    <Sparkles size={11} strokeWidth={2.25} aria-hidden="true" />
                                    {t('pms.aiTag')}
                                  </span>
                                )}
                                {ai && c.confidence === 'low' && (
                                  <span className="jv-tag pms-tag-check">{t('pms.checkTag')}</span>
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
                            <td className="jv-num text-mono" data-label={t('pms.colAmount')}>
                              {fmtAmount(c.amount)}
                            </td>
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
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </section>

              <section className="pms-sec" aria-labelledby="pms-rows">
                <Head id="pms-rows" title={t('pms.pmsRows')}>
                  <span className="pms-n">{day.rows.length}</span>
                </Head>
                {/* A frame of its own, so the head stays put while the rows scroll under it
                    (sticky thead, review-queue.css). Focusable to scroll by keyboard, so it
                    needs a role to carry its name: a group, since the section is the region. */}
                <div className="pms-scroll" role="group" tabIndex={0} aria-labelledby="pms-rows">
                  {rowsTable}
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
                <p className="rd-blocked" id="pms-blocked" role="status">
                  <AlertTriangle size={14} aria-hidden="true" />
                  {r.blockReason}
                </p>
              ) : (
                !r.postError && (
                  <p className="rd-blocked rd-blocked--note" role="status">
                    <Info size={14} aria-hidden="true" />
                    {day.new_codes.length > 0
                      ? t('pms.saves', {
                          n: day.new_codes.length,
                          interface: day.interface,
                          date: dmy(day.doc_date),
                        })
                      : t('pms.postsAsIs', { interface: day.interface, date: dmy(day.doc_date) })}
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
