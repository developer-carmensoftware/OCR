import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react'
import CustomModal from '../components/common/CustomModal'
import SwapLabel from '../components/common/SwapLabel'
import ReviewDocCard from '../components/credit-card/ReviewDocCard'
import type { DetailRow } from '../components/credit-card/DetailTable'
import JvEditor, { type JvState, type Overrides } from '../components/credit-card/JvEditor'
import { useT } from '../i18n/LanguageContext'
import { useAccountingConfig } from '../hooks/credit-card'
import { showToast } from '../lib/toast'
import { fmt, parseNum } from '../lib/format'
import { toExtractedRows } from '../lib/api/ocr'
import { normalizeDateStringToCE } from '../lib/date'
import { applyJvAmount, type JvRow } from '../lib/ccJv'
import { patchAccountingMappings } from '../lib/api/config'
import {
  approveDocument,
  getPending,
  rejectDocument,
  type ReviewDocumentDetail,
} from '../lib/api/emailReview'
import { detectBankFromExtracted } from '../constants/banks'
import type { BankCode } from '../types/api'
import type { TKey } from '../i18n/dict'

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

  // GL rule corrections, not yet saved. Keyed by accounting-config field type, because
  // that is what a picker edits — see JvEditor's note on JvRow.key.
  const [overrides, setOverrides] = useState<Overrides>({})
  const [jv, setJv] = useState<JvState>({ rows: [], blocked: true, totalDr: 0, totalCr: 0 })
  const { config, loading: configLoading } = useAccountingConfig()

  const [busy, setBusy] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

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

  // Escape closes, like every other dialog in the app — but never mid-post, where the
  // reviewer would lose the one place the Carmen error is about to appear.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy || rejecting) return
      // The date picker and the account dropdown are layers above this one and close on
      // Escape too; all listen on `document`, so the innermost open thing has to be
      // checked for rather than trusted to stop the event.
      if (document.querySelector('.date-input-popover, .css-select-panel')) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, rejecting, onClose])

  const sum = (k: keyof DetailRow) => details.reduce((n, d) => n + parseNum(d[k]), 0)

  const updateHeader = (key: string, value: string) => setHeaderData(h => ({ ...h, [key]: value }))

  // An amount typed on the JV goes back into the lines it was summed from. `details` is
  // not display: the input-tax record is filed from it, per line, so a figure that moved
  // only on the journal would post a VAT record that disagrees with it.
  const updateAmount = useCallback(
    (row: JvRow, next: number) => setDetails(d => applyJvAmount(d, row, next)),
    []
  )

  const onOverride = useCallback(
    (key: string, mapping: { dept?: string | null; acc?: string | null }) =>
      setOverrides(o => ({ ...o, [key]: { dept: mapping.dept || '', acc: mapping.acc || '' } })),
    []
  )
  const onUndo = useCallback(
    (key: string) =>
      setOverrides(o => {
        const { [key]: _dropped, ...rest } = o
        return rest
      }),
    []
  )
  const onJvState = useCallback((s: JvState) => setJv(s), [])

  const ruleCount = Object.keys(overrides).length

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
        await patchAccountingMappings(
          Object.fromEntries(
            Object.entries(overrides).map(([k, m]) => [k, { dept: m.dept || '', acc: m.acc || '' }])
          )
        )
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
          doc_name: headerData.DocName,
          branch_no: headerData.BranchNo,
          bank_name: headerData.BankName,
          bank_company_name: headerData.BankCompanyName,
          company_name: headerData.CompanyName,
          merchant_id: headerData.MerchantId,
          merchant_name: headerData.MerchantName,
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
    <div className="rd-overlay" role="presentation" onMouseDown={() => !busy && onClose()}>
      <div
        className="rd-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('review.title')}
        onMouseDown={e => e.stopPropagation()}
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

        <header className="rd-modal-head">
          <span className="rd-title-bank">{bank || doc?.bank_code || t('review.unknownBank')}</span>
          <span className="text-mono">{headerData.DocNo || '—'}</span>
          <span className="text-mono rd-title-date">{headerData.DocDate || '—'}</span>
          <button
            type="button"
            className="btn-icon rd-close"
            onClick={onClose}
            disabled={busy}
            aria-label={t('review.close')}
          >
            <X size={16} />
          </button>
        </header>

        {!loading && !gone && doc && (
          /* The reconciliation, pinned. Either pane can scroll under it without taking
             the numbers being compared off screen with it. */
          <div className="rd-sum">
            {(
              [
                ['review.sumGross', 'PayAmt', true],
                ['review.sumCommission', 'CommisAmt', false],
                ['review.sumTax', 'TaxAmt', false],
                ['review.sumNet', 'Total', false],
              ] as Array<[TKey, keyof DetailRow, boolean]>
            ).map(([label, col, lead]) => (
              <div key={col} className={`rd-sum-item${lead ? ' rd-sum-item--lead' : ''}`}>
                <span className="rd-sum-label">{t(label)}</span>
                <span className="rd-sum-value text-mono">{fmt(sum(col))}</span>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="rd-modal-body rd-loading">
            <Loader2 size={22} className="animate-spin" aria-hidden="true" />
          </div>
        ) : gone || !doc ? (
          <div className="rd-modal-body rq-empty">
            <AlertTriangle size={36} className="rq-empty-icon rq-empty-icon--bad" aria-hidden />
            <h2 className="rq-empty-title">{t('review.goneTitle')}</h2>
            <p className="rq-empty-body">{t('review.goneBody')}</p>
            <button type="button" className="btn btn-outline" onClick={onDone}>
              {t('review.backToQueue')}
            </button>
          </div>
        ) : (
          <>
            <div className="rd-panes">
              <section className="rd-pane" aria-label={t('review.paneDocument')}>
                {/* A statement about the reading, so it belongs to this pane rather than
                    spanning both. */}
                {warnings.length > 0 && (
                  <div className="mapping-alert">
                    <AlertTriangle size={16} />
                    <span className="cc-alert-text">{warnings.join(' · ')}</span>
                  </div>
                )}
                <ReviewDocCard headerData={headerData} onUpdate={updateHeader} />
              </section>

              <section className="rd-pane rd-pane--jv" aria-label={t('review.paneJv')}>
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
                  onState={onJvState}
                  bankCode={bank || doc.bank_code || ''}
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
                <label className="rd-check">
                  <input
                    type="checkbox"
                    checked={postInputTax}
                    onChange={e => setPostInputTax(e.target.checked)}
                  />
                  <span>{t('review.secTaxLabel')}</span>
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={approve}
                  disabled={busy || jv.blocked}
                >
                  {busy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  <SwapLabel
                    active={busy}
                    idle={
                      ruleCount
                        ? t('review.approveWithRules', { count: String(ruleCount) })
                        : t('review.approve')
                    }
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
