import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react'
import CustomModal from '../components/common/CustomModal'
import SwapLabel from '../components/common/SwapLabel'
import JvHeaderCard from '../components/credit-card/JvHeaderCard'
import InputTaxPanel from '../components/credit-card/InputTaxPanel'
import type { DetailRow } from '../components/credit-card/DetailTable'
import JvEditor, { type JvState, type Overrides } from '../components/credit-card/JvEditor'
import { useT } from '../i18n/LanguageContext'
import { useAccountingConfig } from '../hooks/credit-card'
import { showToast } from '../lib/toast'
import { fmt } from '../lib/format'
import { toExtractedRows } from '../lib/api/ocr'
import { normalizeDateStringToCE } from '../lib/date'
import { applyJvAmount, type JvRow } from '../lib/ccJv'
import { patchAccountingConfig } from '../lib/api/config'
import {
  approveDocument,
  getPending,
  rejectDocument,
  type ItxOverrides,
  type ReviewDocumentDetail,
} from '../lib/api/emailReview'
import { detectBankFromExtracted } from '../constants/banks'
import type { BankCode } from '../types/api'

interface Props {
  id: string
  /** Dismissed without deciding — the document is still waiting. */
  onClose: () => void
  /** Approved, rejected, or found to be gone: the queue behind this is now stale. */
  onDone: () => void
}

/**
 * One parked document, as a modal over the queue.
 *
 * Rebuilt 2026-08-31. The first version stacked four equal blocks (Document / Lines / GL
 * mapping / Input tax), which was wrong about what this screen is for. Ingest fills every
 * field and saves every rule before a document parks here, so nothing on it is unfinished
 * data entry — the reviewer is checking a machine's decision. That is a comparison between
 * two things, so the screen is two panes: what the document says, and what will post. The
 * block frames and their ✓/⚠/⛔ headers are gone; a problem is marked on the thing that
 * has it.
 *
 * The GL rules are editable here rather than on `#/CreditCardOCR/mapping`. Leaving to fix
 * one meant losing the document you were reading.
 */
export default function ReviewDocument({ id, onClose, onDone }: Props) {
  const { t } = useT()
  const [doc, setDoc] = useState<ReviewDocumentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [gone, setGone] = useState(false)

  const [headerData, setHeaderData] = useState<Record<string, string>>({})
  const [details, setDetails] = useState<DetailRow[]>([])
  const [bank, setBank] = useState<BankCode | ''>('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [postInputTax, setPostInputTax] = useState(true)
  // Corrections to the input-tax record's own fields. Per document, like the line
  // descriptions — none of it is a rule, and none of it is written to the BU config.
  const [itx, setItx] = useState<ItxOverrides>({})

  // GL rule corrections, not yet saved. Keyed by accounting-config field type, because
  // that is what a picker edits — see JvEditor's note on JvRow.key.
  const [overrides, setOverrides] = useState<Overrides>({})
  // Header corrections, same shape of thing as a mapping override: BU config, uncommitted
  // until approve. `null` means "not touched", which is what keeps the stored value showing
  // through rather than being replaced by an empty string on first render.
  const [prefix, setPrefix] = useState<string | null>(null)
  const [description, setDescription] = useState<string | null>(null)
  // Retyped GL line descriptions, keyed by leg. Per document — unlike the header
  // description above, nothing here is written back to the BU config.
  const [descs, setDescs] = useState<Record<string, string>>({})
  const [jv, setJv] = useState<JvState>({
    rows: [],
    blocked: true,
    reason: null,
    totalDr: 0,
    totalCr: 0,
  })
  const { config, loading: configLoading } = useAccountingConfig()

  const [busy, setBusy] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  /** Anything the reviewer has typed or re-mapped and not yet posted. Only used to decide
   *  whether closing needs to ask first. */
  const [dirty, setDirty] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    getPending(id)
      .then(d => {
        if (!alive) return
        setDoc(d)
        const ext = d.extracted as Record<string, unknown>
        setHeaderData({
          DateProcessed: new Date().toLocaleDateString('en-GB'),
          BankName: (ext.bank_name as string) || '',
          DocName: (ext.doc_name as string) || '',
          CompanyName: (ext.company_name as string) || '',
          DocDate: normalizeDateStringToCE((ext.doc_date as string) || ''),
          DocNo: (ext.doc_no as string) || '',
          MerchantName: (ext.merchant_name as string) || '',
          MerchantId: (ext.merchant_id as string) || '',
          BankCompanyName: (ext.bank_company_name as string) || '',
          BranchNo: (ext.branch_no as string) || '',
        })
        // The payload is the raw /extract shape, so details arrive snake_case — the same
        // bridge extractFromFile crosses, shared so the two cannot drift.
        setDetails(
          toExtractedRows((ext.details as Array<Record<string, string>>) || []).map(r => ({
            ...r,
            _uid: crypto.randomUUID(),
          }))
        )
        setWarnings((ext.warnings as string[]) || [])
        setBank((detectBankFromExtracted(ext as Record<string, string>) || '') as BankCode | '')
      })
      .catch(() => {
        if (alive) setGone(true)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [id])

  // Closing throws away corrected amounts and re-mapped GL rules, and the two ways to do
  // it by accident — a stray click on the page behind, a reflex Escape — are the two
  // cheapest gestures on the screen. Ask, but only when there is something to lose.
  const requestClose = useCallback(() => {
    if (busy) return
    if (dirty) setDiscarding(true)
    else onClose()
  }, [busy, dirty, onClose])

  // Dialog chrome: focus moves in, focus goes back, the page behind stops scrolling, Tab
  // stays inside. CustomModal does all four for the confirmations it owns and this dialog
  // did none of them. Not shared code with it — CustomModal traps a fixed set of three
  // controls it renders itself, while this one's focusable set grows and shrinks as rows,
  // pickers and the input-tax panel appear.
  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null
    const priorOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = priorOverflow
      returnTo?.focus?.()
    }
  }, [])

  // The dialog itself, not its first field: this screen is read before it is edited, and
  // landing in Document no. would put the caret past the warning above it.
  useEffect(() => {
    if (!loading) modalRef.current?.focus()
  }, [loading])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never mid-post, where the reviewer would lose the one place the Carmen error is
      // about to appear; and never under a confirmation, which runs its own trap.
      if (busy || rejecting || discarding) return
      // The date picker and the account dropdown are layers above this one and close on
      // Escape too; all listen on `document`, so the innermost open thing has to be
      // checked for rather than trusted to stop the event. Tab is left alone while one is
      // open for the same reason: the account list renders outside this dialog.
      if (document.querySelector('.date-input-popover, .css-select-panel')) return

      if (e.key === 'Escape') {
        requestClose()
        return
      }
      if (e.key !== 'Tab' || !modalRef.current) return

      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled'))
      if (!focusable.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      // The container holds focus on open, so Shift+Tab from it wraps to the end rather
      // than escaping to the browser chrome.
      if (
        e.shiftKey &&
        (document.activeElement === first || document.activeElement === modalRef.current)
      ) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, rejecting, discarding, requestClose])

  const updateHeader = (key: string, value: string) => {
    setDirty(true)
    setHeaderData(h => ({ ...h, [key]: value }))
  }

  // An amount typed on the JV goes back into the lines it was summed from. `details` is
  // not display: the input-tax record is filed from it, per line, so a figure that moved
  // only on the journal would post a VAT record that disagrees with it.
  const updateAmount = useCallback((row: JvRow, next: number) => {
    setDirty(true)
    setDetails(d => applyJvAmount(d, row, next))
  }, [])

  const onOverride = useCallback(
    (key: string, mapping: { dept?: string | null; acc?: string | null }, byUser = true) => {
      // The background suggestion for a payment type nothing could map is not the
      // reviewer's work, so it does not make closing ask — it is re-asked next time.
      if (byUser) setDirty(true)
      setOverrides(o => ({ ...o, [key]: { dept: mapping.dept || '', acc: mapping.acc || '' } }))
    },
    []
  )
  const onUndo = useCallback((key: string) => {
    setDirty(true)
    setOverrides(o => {
      const { [key]: _dropped, ...rest } = o
      return rest
    })
  }, [])
  const onDesc = useCallback((id: string, value: string) => {
    setDirty(true)
    setDescs(d => ({ ...d, [id]: value }))
  }, [])
  const onJvState = useCallback((s: JvState) => setJv(s), [])

  // Everything the approve will write back to the BU config, counted once so the footer
  // and the button agree.
  const ruleCount =
    Object.keys(overrides).length + (prefix === null ? 0 : 1) + (description === null ? 0 : 1)

  async function approve() {
    if (!doc) return
    setBusy(true)
    setPostError(null)

    // Rules first, JV second. If Carmen then refuses, the corrected rule still stands —
    // it was wrong before and is right now, independently of this document — and the
    // reviewer is standing here to retry. The other order can leave a rule silently
    // unsaved behind a JV that already posted.
    if (ruleCount) {
      try {
        await patchAccountingConfig({
          mappings: Object.fromEntries(
            Object.entries(overrides).map(([k, m]) => [k, { dept: m.dept || '', acc: m.acc || '' }])
          ),
          ...(prefix === null ? {} : { file_prefix: prefix }),
          ...(description === null ? {} : { description }),
          // Which bank's wording the description belongs to. The server prefers a per-bank
          // entry over the BU-wide one, so it has to write whichever actually wins.
          bank_code: bank || doc.bank_code || '',
        })
      } catch (e) {
        setPostError(t('review.ruleSaveFailed', { reason: (e as Error).message }))
        setBusy(false)
        return
      }
    }

    try {
      const res = await approveDocument(id, {
        extracted: {
          ...(doc.extracted as Record<string, unknown>),
          doc_no: headerData.DocNo,
          doc_date: headerData.DocDate,
          // The input-tax record's only document field, edited in its own panel.
          branch_no: headerData.BranchNo,
          details: details.map(d => ({
            transaction: d.Transaction || '',
            pay_amt: d.PayAmt || '',
            commis_amt: d.CommisAmt || '',
            tax_amt: d.TaxAmt || '',
            total: d.Total || '',
          })),
        },
        rows: jv.rows,
        post_input_tax: postInputTax,
        // Omitted entirely when nothing was touched, so the server derives the record the
        // same way the unattended path does.
        input_tax: Object.keys(itx).length ? itx : undefined,
      })
      showToast(
        res.tax_note
          ? t('review.postedWithTaxNote', { jv: res.jv_no })
          : t('review.postedOk', { jv: res.jv_no }),
        res.tax_note ? 'warning' : 'success'
      )
      onDone()
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 409) {
        // Someone else in the BU got there first. Nothing to fix here.
        showToast(t('review.alreadyHandled'), 'warning')
        onDone()
        return
      }
      // Carmen refuses JVs for reasons a human standing here can fix — a closed period, a
      // dept code it does not know — so the document stays reviewable and the message
      // stays on screen next to the thing that has to change.
      setPostError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function reject() {
    setBusy(true)
    try {
      await rejectDocument(id, reason.trim() || undefined)
      showToast(t('review.rejected'), 'success')
      onDone()
    } catch {
      showToast(t('review.rejectFailed'), 'error')
      setBusy(false)
      setRejecting(false)
    }
  }

  return createPortal(
    <div
      className="rd-overlay"
      role="presentation"
      /* Close only when the press landed on the backdrop itself.
       *
       * This used to be an unconditional `requestClose` here plus
       * `onMouseDown={e => e.stopPropagation()}` on the modal — and React's
       * stopPropagation stops the NATIVE event too, so `mousedown` never reached
       * `document`. Both `CustomSearchSelect` and `DateInput` close themselves from a
       * `document` listener, so every picker in this dialog stayed open once clicked away
       * from. Comparing target to currentTarget needs no propagation blocking at all. */
      onMouseDown={e => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div
        className="rd-modal"
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rd-title"
      >
        <CustomModal
          show={rejecting}
          type="warning"
          confirmVariant="danger"
          title={t('review.rejectTitle')}
          message={t('review.rejectMsg')}
          inputLabel={t('review.rejectReason')}
          inputValue={reason}
          onInputChange={setReason}
          inputPlaceholder={t('review.rejectReasonHint')}
          confirmText={t('review.rejectConfirm')}
          cancelText={t('modal.cancel')}
          busy={busy}
          onConfirm={reject}
          onCancel={() => setRejecting(false)}
        />

        <CustomModal
          show={discarding}
          type="warning"
          confirmVariant="danger"
          title={t('review.discardTitle')}
          message={t('review.discardMsg')}
          confirmText={t('review.discardConfirm')}
          cancelText={t('review.discardKeep')}
          onConfirm={onClose}
          onCancel={() => setDiscarding(false)}
        />

        <header className="rd-modal-head">
          {/* Skeleton, not the "Unknown" fallback: while the fetch is out nothing is known
              about the bank yet, and that fallback is an answer — it read as a document
              whose bank could not be identified. `aria-label` keeps the dialog named while
              the heading holds a placeholder. */}
          <h2
            className="rd-title-bank"
            id="rd-title"
            aria-label={loading ? t('review.loadingDocument') : undefined}
          >
            {loading ? (
              <span className="rq-skel rd-skel-bank" aria-hidden="true">
                &nbsp;
              </span>
            ) : (
              bank || doc?.bank_code || t('review.unknownBank')
            )}
          </h2>
          {/* The attachment this was read from. Nothing else on the dialog says which
              file it is, and the document number and date that used to sit here were a
              second copy of the two fields directly below them. */}
          {loading ? (
            <span className="rq-skel rd-skel-file" aria-hidden="true">
              &nbsp;
            </span>
          ) : (
            doc?.attachment && (
              <span className="rd-title-file" title={doc.attachment}>
                {doc.attachment}
              </span>
            )
          )}
          <button
            type="button"
            className="btn-icon rd-close"
            onClick={requestClose}
            disabled={busy}
            aria-label={t('review.close')}
          >
            <X size={16} />
          </button>
        </header>

        {loading ? (
          /* The shape it will hold — a row of header fields, the JV table, the collapsed
             input-tax line, the buttons — rather than a spinner the content lands around.
             The fields wear the real `.rd-f--*` width classes so the row cannot drift from
             the one JvHeaderCard renders. */
          <>
            <div className="rd-body" aria-busy="true">
              <span className="sr-only" role="status">
                {t('review.loadingDocument')}
              </span>
              <div className="rd-doc">
                {['rd-f--docno', 'rd-f--date', 'rd-f--prefix', 'rd-f--grow'].map(w => (
                  <span key={w} className={`rq-skel rd-skel-f rd-f ${w}`} aria-hidden="true">
                    &nbsp;
                  </span>
                ))}
              </div>
              <div className="rd-skel-rows">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className="rq-skel" aria-hidden="true">
                    &nbsp;
                  </span>
                ))}
              </div>
              <span className="rq-skel rd-skel-tax" aria-hidden="true">
                &nbsp;
              </span>
            </div>
            {/* Kept, so the dialog opens at the height it will hold and Reject/Approve do
                not appear from nowhere under the reviewer's cursor. */}
            <footer className="rd-modal-foot">
              <div className="rd-actions">
                <span className="rq-skel rd-skel-btn" aria-hidden="true">
                  &nbsp;
                </span>
                <span className="rq-skel rd-skel-btn" aria-hidden="true">
                  &nbsp;
                </span>
              </div>
            </footer>
          </>
        ) : gone || !doc ? (
          <div className="rq-empty rd-gone">
            <AlertTriangle size={36} className="rq-empty-icon rq-empty-icon--bad" aria-hidden />
            <h2 className="rq-empty-title">{t('review.goneTitle')}</h2>
            <p className="rq-empty-body">{t('review.goneBody')}</p>
            <button type="button" className="btn btn-outline" onClick={onDone}>
              {t('review.backToQueue')}
            </button>
          </div>
        ) : (
          <>
            <div className="rd-body">
              {/* A statement about the reading, not about the entry — so it sits with the
                  document rather than over the whole screen. */}
              {warnings.length > 0 && (
                <div className="mapping-alert">
                  <AlertTriangle size={16} />
                  <span className="cc-alert-text">{warnings.join(' · ')}</span>
                </div>
              )}

              <section aria-label={t('review.paneDocument')}>
                <JvHeaderCard
                  headerData={headerData}
                  onUpdate={updateHeader}
                  config={config as Record<string, unknown> | null}
                  bank={bank}
                  prefix={prefix}
                  description={description}
                  onPrefix={setPrefix}
                  onDescription={setDescription}
                />
              </section>

              <section aria-label={t('review.paneJv')}>
                <JvEditor
                  details={details}
                  config={config as Record<string, unknown> | null}
                  configLoading={configLoading}
                  overrides={overrides}
                  onOverride={onOverride}
                  onUndo={onUndo}
                  guessedKeys={doc.guessed || []}
                  unmappedKeys={doc.unmapped || []}
                  onAmount={updateAmount}
                  descs={descs}
                  onDesc={onDesc}
                  onState={onJvState}
                  bankCode={bank || doc.bank_code || ''}
                />
              </section>

              {/* The second document this approval files. Its own fields live with it
                  rather than in the JV header, which is the only place they were ever
                  wanted. */}
              <section aria-label={t('review.secTax')}>
                <InputTaxPanel
                  details={details}
                  headerData={headerData}
                  bank={bank}
                  enabled={postInputTax}
                  onEnabledChange={on => {
                    setDirty(true)
                    setPostInputTax(on)
                  }}
                  onUpdate={updateHeader}
                  overrides={itx}
                  onOverride={patch => {
                    setDirty(true)
                    setItx(o => ({ ...o, ...patch }))
                  }}
                />
              </section>
            </div>

            <footer className="rd-modal-foot">
              {postError && (
                <div className="mapping-alert is-danger" role="alert">
                  <AlertCircle size={16} />
                  <span className="cc-alert-text">{postError}</span>
                </div>
              )}
              {/* Why Approve cannot be pressed, at the button rather than left to be
                  inferred from a tinted row further up. The error above supersedes it:
                  a Carmen rejection is the more recent and more specific answer. */}
              {jv.reason && !postError && (
                <p className="rd-blocked" id="rd-blocked" role="status">
                  <AlertTriangle size={14} aria-hidden="true" />
                  {jv.reason === 'account'
                    ? t('review.jvBlankAccount')
                    : jv.reason === 'unbalanced'
                      ? t('review.jvOffBy', { diff: fmt(Math.abs(jv.totalDr - jv.totalCr)) })
                      : t('review.jvNothing')}
                </p>
              )}
              {/* Said before the button, not after: the rule change is a second, wider
                  consequence of pressing it, and the reviewer should know while deciding. */}
              {ruleCount > 0 && (
                <p className="rd-rules" role="status">
                  {t(ruleCount === 1 ? 'review.rulesChanged' : 'review.rulesChangedPlural', {
                    count: String(ruleCount),
                  })}
                </p>
              )}
              <div className="rd-actions">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => setRejecting(true)}
                  disabled={busy}
                >
                  {t('review.reject')}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={approve}
                  disabled={busy || jv.blocked}
                  /* The sentence above is the reason the control is unavailable, so a
                     screen reader is given it along with the disabled state. */
                  aria-describedby={jv.reason && !postError ? 'rd-blocked' : undefined}
                >
                  {busy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  {/* One label, whatever else is true. The rule count is stated once,
                      in the sentence above — a primary button that changes width while
                      the reviewer edits is a moving target, and "Approve JV · updates 2"
                      says less about what pressing it does than the sentence already
                      does. */}
                  <SwapLabel
                    active={busy}
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
