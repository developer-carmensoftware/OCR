import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, AlertTriangle, CheckCircle2, ExternalLink, Loader2, X } from 'lucide-react'
import CustomModal from '@/shared/components/common/CustomModal'
import SwapLabel from '@/shared/components/common/SwapLabel'
import JvHeaderCard from '@/features/credit-card/components/JvHeaderCard'
import InputTaxPanel from '@/features/credit-card/components/InputTaxPanel'
import JvEditor from '@/features/credit-card/components/JvEditor'
import ARReviewPane from '@/features/credit-card/components/ARReviewPane'
import { useT } from '@/i18n/LanguageContext'
import { useReviewDocument } from '@/features/credit-card/hooks/useReviewDocument'
import { useScrollLock } from '@/shared/hooks/useScrollLock'
import { FIX, fixLinkProps, stopText, warningText } from '@/shared/lib/reviewReasons'

interface Props {
  id: string
  /** Dismissed without deciding — the document is still waiting. */
  onClose: () => void
  /** Approved, rejected, or found to be gone: the queue behind this is now stale. */
  onDone: () => void
  /** The queue row's bank, so this bank's GL rules load alongside the document. */
  bankHint?: string | null
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
export default function ReviewDocument({ id, onClose, onDone, bankHint }: Props) {
  const { t } = useT()
  const {
    doc,
    loading,
    gone,
    headerData,
    details,
    warnings,
    postInputTax,
    itx,
    itxBlocked,
    setItxBlocked,
    overrides,
    aiKeys,
    prefix,
    description,
    descs,
    jv,
    config,
    configLoading,
    busy,
    postError,
    rejecting,
    setRejecting,
    reason,
    setReason,
    discarding,
    setDiscarding,
    bankCode,
    effectivePrefix,
    blockReason,
    isAR,
    arJv,
    arBlockReason,
    prefixFix,
    arSettingsLink,
    requestClose,
    updateHeader,
    updateAmount,
    onOverride,
    onUndo,
    onDesc,
    onJvState,
    onPrefix,
    onDescription,
    onPostInputTax,
    onItxOverride,
    approve,
    reject,
  } = useReviewDocument(id, onClose, onDone, bankHint)
  const modalRef = useRef<HTMLDivElement>(null)

  // Dialog chrome: focus moves in, focus goes back, the page behind stops scrolling, Tab
  // stays inside. CustomModal does all four for the confirmations it owns and this dialog
  // did none of them. Not shared code with it — CustomModal traps a fixed set of three
  // controls it renders itself, while this one's focusable set grows and shrinks as rows,
  // pickers and the input-tax panel appear.
  useScrollLock()
  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null
    return () => {
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

  // Where this document's cause gets fixed for good, if anywhere — the same map the queue
  // row reads, resolved here so the banner's button and the row's button cannot point at
  // different screens.
  const fix = doc?.reason_code ? FIX[doc.reason_code] : undefined
  const fixLink = fix && fixLinkProps(fix)

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
              bankCode || t('review.unknownBank')
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
            <span className="rq-empty-icon rq-empty-icon--bad" aria-hidden>
              <AlertTriangle size={36} />
            </span>
            <h2 className="rq-empty-title">{t('review.goneTitle')}</h2>
            <p className="rq-empty-body">{t('review.goneBody')}</p>
            <button type="button" className="btn btn-outline" onClick={onDone}>
              {t('review.back')}
            </button>
          </div>
        ) : (
          <>
            <div className="rd-body">
              {/* Why the robot stopped, above everything — including the extraction
                  warnings, which are about how well the document was *read* while this is
                  about what happened after.

                  Only some parked documents have one. A document that reached the ordinary
                  review fork carries no reason code and shows nothing here; one that hit a
                  foreign tax ID, an unmappable payment type or a Carmen refusal was going
                  to be thrown away before this change, and the reviewer needs to know that
                  before being asked to approve it.

                  Amber and not red: unlike the resolved rows wearing these same words, this
                  document is still open, still editable and still postable. The message
                  underneath is the pipeline's own — Carmen's verdict, the conflicting tax
                  ID, the "check whether the JV posted" caveat — and it is the only place
                  the reviewer will ever read it. */}
              {doc.reason_code && (
                <div className="mapping-alert">
                  <AlertTriangle size={16} />
                  <span className="cc-alert-text">
                    {/* `full`: the dialog has the width the cell does not, so a reason whose
                        phrase does not already carry its detail gets both — the conflicting
                        tax ID is the number the reviewer decides on. The two codes whose
                        detail *replaces* the phrase are not printed twice; that duplication
                        ("already handled · already posted to Carmen") is what moving to the
                        shared helper removed. */}
                    {stopText(doc, t, true)}
                  </span>
                  {/* Where it gets fixed for good, for the causes that have such a place.
                      The reviewer can still correct and post this one document without
                      leaving; this is for the next twenty — and a settings cause leaves for
                      Carmen's screen in a tab of its own, so this document stays open. */}
                  {fix && fixLink && (
                    <a className="btn btn-outline btn-sm rd-alert-fix" {...fixLink}>
                      {t(fix.key)}
                      {fixLink.target && (
                        <ExternalLink size={12} strokeWidth={2} aria-hidden="true" />
                      )}
                    </a>
                  )}
                </div>
              )}

              {/* A statement about the reading, not about the entry — so it sits with the
                  document rather than over the whole screen. */}
              {warnings.length > 0 && (
                <div className="mapping-alert">
                  <AlertTriangle size={16} />
                  <span className="cc-alert-text">
                    {warnings.map(w => warningText(w, t)).join(' · ')}
                  </span>
                </div>
              )}

              <section aria-label={t('review.paneDocument')}>
                <JvHeaderCard
                  headerData={headerData}
                  onUpdate={updateHeader}
                  config={config as Record<string, unknown> | null}
                  bank={bankCode}
                  prefix={prefix}
                  description={description}
                  onPrefix={onPrefix}
                  onDescription={onDescription}
                  /* None of these four reaches Carmen on the AR path: the server rebuilds
                     that JV from the document, and the config write is skipped. They
                     were four inputs that discarded what was typed into them. */
                  readOnly={isAR}
                  descriptionOverride={isAR ? arJv?.description : undefined}
                />
              </section>

              {isAR ? (
                <section aria-label={t('review.paneJv')}>
                  <ARReviewPane jv={arJv} details={details} />
                  {/* Named for its destination, so it needs no sentence in front of it —
                      see review-queue.css's history on `.rd-ar-hint` for why one isn't
                      there any more. `.btn.btn-outline.btn-sm` rather than a one-off class:
                      the same secondary-button weight `.rd-alert-fix` above already wears,
                      reused instead of re-invented. Right-aligned, on the same edge as
                      Approve/Reject below it — shorter mouse travel between "check the
                      settings" and "act on the document" than a flush-left placement. */}
                  <div className="rd-ar-hint">
                    <a className="btn btn-outline btn-sm" {...arSettingsLink}>
                      {t('review.arSettings')}
                    </a>
                  </div>
                </section>
              ) : (
                <>
                  <section aria-label={t('review.paneJv')}>
                    <JvEditor
                      details={details}
                      config={config as Record<string, unknown> | null}
                      configLoading={configLoading}
                      overrides={overrides}
                      onOverride={onOverride}
                      onUndo={onUndo}
                      guessedKeys={aiKeys}
                      unmappedKeys={doc.unmapped || []}
                      onAmount={updateAmount}
                      descs={descs}
                      onDesc={onDesc}
                      onState={onJvState}
                      bankCode={bankCode}
                    />
                  </section>

                  {/* The second document this approval files. Its own fields live with it
                  rather than in the JV header, which is the only place they were ever
                  wanted. */}
                  <section aria-label={t('review.secTax')}>
                    <InputTaxPanel
                      details={details}
                      headerData={headerData}
                      bank={bankCode}
                      enabled={postInputTax}
                      onEnabledChange={onPostInputTax}
                      onUpdate={updateHeader}
                      overrides={itx}
                      onOverride={onItxOverride}
                      onBlocked={setItxBlocked}
                    />
                  </section>
                </>
              )}
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
              {blockReason && !postError && (
                <p className="rd-blocked" id="rd-blocked" role="status">
                  <AlertTriangle size={14} aria-hidden="true" />
                  {blockReason}
                  {prefixFix && (
                    <a className="rd-blocked-fix" {...prefixFix}>
                      {t('review.actionSetPrefix')}
                    </a>
                  )}
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
                  disabled={
                    busy || (isAR ? !!arBlockReason : jv.blocked || !effectivePrefix || itxBlocked)
                  }
                  /* The sentence above is the reason the control is unavailable, so a
                     screen reader is given it along with the disabled state. */
                  aria-describedby={blockReason && !postError ? 'rd-blocked' : undefined}
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
