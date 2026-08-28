import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, AlertTriangle, Check, CheckCircle2, Loader2, X } from 'lucide-react'
import CustomModal from '../components/common/CustomModal'
import SwapLabel from '../components/common/SwapLabel'
import ReviewDocCard from '../components/credit-card/ReviewDocCard'
import DetailTable, { type DetailRow } from '../components/credit-card/DetailTable'
import AccountingReview, { type AccountingState } from '../components/credit-card/AccountingReview'
import { useT } from '../i18n/LanguageContext'
import { showToast } from '../lib/toast'
import { fmt, parseNum, round2 } from '../lib/format'
import { toExtractedRows } from '../lib/api/ocr'
import { normalizeDateStringToCE } from '../lib/date'
import {
  approveDocument,
  getPending,
  rejectDocument,
  type ReviewDocumentDetail,
} from '../lib/api/emailReview'
import { detectBankFromExtracted } from '../constants/banks'
import type { BankCode } from '../types/api'
import type { TKey } from '../i18n/dict'

/** How much a block should stop someone. `stop` disables Approve; `warn` does not. */
type Severity = 'ok' | 'warn' | 'stop'

const MARK: Record<Severity, { icon: typeof Check; cls: string }> = {
  ok: { icon: Check, cls: 'rd-mark--ok' },
  warn: { icon: AlertTriangle, cls: 'rd-mark--warn' },
  stop: { icon: AlertCircle, cls: 'rd-mark--stop' },
}

/**
 * One part of the document, always open.
 *
 * These used to be collapsible, and collapsing was the mistake: the reviewer's question is
 * "does this document add up", which is answered by seeing all four parts at once — not by
 * remembering which of them they have already expanded.
 */
function Block({
  title,
  summary,
  severity,
  children,
}: {
  title: string
  summary: string
  severity: Severity
  children: React.ReactNode
}) {
  const Icon = MARK[severity].icon
  return (
    <section className="rd-block">
      <h3 className="rd-block-h">
        <span className="rd-block-title">{title}</span>
        <span className="rd-block-summary">{summary}</span>
        <Icon size={16} className={`rd-mark ${MARK[severity].cls}`} aria-hidden="true" />
      </h3>
      <div className="rd-block-body">{children}</div>
    </section>
  )
}

interface Props {
  id: string
  /** Dismissed without deciding — the document is still waiting. */
  onClose: () => void
  /** Approved, rejected, or found to be gone: the queue behind this is now stale. */
  onDone: () => void
}

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
  const [acc, setAcc] = useState<AccountingState>({
    rows: [],
    blocked: true,
    unmappedFields: [],
  })

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
      // The date picker is a layer above this one and closes on Escape too; both listen on
      // `document`, so the innermost open thing has to be checked for rather than trusted
      // to stop the event.
      if (document.querySelector('.date-input-popover')) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, rejecting, onClose])

  // Every layout satisfies gross = commission + tax + net per line, so a line that breaks
  // it was misread. Same arithmetic the backend flagged at park time, recomputed here
  // because the reviewer is editing and the stored flag went stale the moment they typed.
  const badLines = useMemo(
    () =>
      details
        .map((d, i) => ({
          line: i + 1,
          diff: round2(
            parseNum(d.PayAmt) - (parseNum(d.CommisAmt) + parseNum(d.TaxAmt) + parseNum(d.Total))
          ),
        }))
        .filter(r => Math.abs(r.diff) > 0.01),
    [details]
  )

  const docSeverity: Severity = headerData.DocNo ? 'ok' : 'warn'
  const lineSeverity: Severity = badLines.length ? 'warn' : 'ok'
  const glSeverity: Severity = acc.blocked ? 'stop' : acc.unmappedFields.length ? 'warn' : 'ok'

  const sum = (k: keyof DetailRow) => details.reduce((n, d) => n + parseNum(d[k]), 0)

  const updateHeader = (key: string, value: string) => setHeaderData(h => ({ ...h, [key]: value }))
  const updateDetail = (i: number, col: string, value: string) =>
    setDetails(d => d.map((row, n) => (n === i ? { ...row, [col]: value } : row)))
  const onState = useCallback((s: AccountingState) => setAcc(s), [])

  async function approve() {
    if (!doc) return
    setBusy(true)
    setPostError(null)
    try {
      const res = await approveDocument(id, {
        extracted: {
          ...(doc.extracted as Record<string, unknown>),
          doc_no: headerData.DocNo,
          doc_date: headerData.DocDate,
          branch_no: headerData.BranchNo,
          company_name: headerData.CompanyName,
          details: details.map(d => ({
            transaction: d.Transaction || '',
            pay_amt: d.PayAmt || '',
            commis_amt: d.CommisAmt || '',
            tax_amt: d.TaxAmt || '',
            total: d.Total || '',
          })),
        },
        rows: acc.rows,
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
          /* The four numbers the decision turns on, out of the Lines block and above the
             scroll: a reviewer should not have to scroll past a table to find the total
             they are approving. */
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
            <div className="rd-modal-body">
              {warnings.length > 0 && (
                <div className="mapping-alert">
                  <AlertTriangle size={16} />
                  <span className="cc-alert-text">{warnings.join(' · ')}</span>
                </div>
              )}

              <Block
                title={t('review.secDocument')}
                summary={
                  headerData.DocNo
                    ? `${headerData.DocNo} · ${headerData.DocDate}`
                    : t('review.secDocumentMissing')
                }
                severity={docSeverity}
              >
                <ReviewDocCard headerData={headerData} onUpdate={updateHeader} />
              </Block>

              <Block
                title={t('review.secLines')}
                summary={
                  badLines.length
                    ? t('review.secLinesBad', { lines: badLines.map(b => b.line).join(', ') })
                    : t('review.secLinesOk', {
                        count: String(details.length),
                        total: fmt(sum('PayAmt')),
                      })
                }
                severity={lineSeverity}
              >
                <DetailTable
                  details={details}
                  onUpdate={updateDetail}
                  onAddRow={() =>
                    setDetails(d => [
                      ...d,
                      {
                        Transaction: '',
                        PayAmt: '',
                        CommisAmt: '',
                        TaxAmt: '',
                        Total: '',
                        _uid: crypto.randomUUID(),
                      },
                    ])
                  }
                  onDeleteRow={i => setDetails(d => d.filter((_, n) => n !== i))}
                />
              </Block>

              <Block
                title={t('review.secGl')}
                summary={
                  acc.blocked
                    ? t('review.secGlBlocked')
                    : acc.unmappedFields.length
                      ? t('review.secGlGuessed', { fields: acc.unmappedFields.join(', ') })
                      : t('review.secGlOk', { count: String(acc.rows.length) })
                }
                severity={glSeverity}
              >
                <AccountingReview
                  embedded
                  details={details}
                  headerData={headerData}
                  bank={bank}
                  onBack={() => undefined}
                  onSubmit={() => undefined}
                  onGoMapping={() => window.open('#/CreditCardOCR/mapping', '_blank')}
                  onState={onState}
                />
              </Block>

              <Block
                title={t('review.secTax')}
                summary={postInputTax ? t('review.secTaxOn') : t('review.secTaxOff')}
                severity="ok"
              >
                <label className="rd-check">
                  <input
                    type="checkbox"
                    checked={postInputTax}
                    onChange={e => setPostInputTax(e.target.checked)}
                  />
                  <span>
                    <strong>{t('review.secTaxLabel')}</strong>
                    <br />
                    <span className="rd-check-hint">{t('review.secTaxHint')}</span>
                  </span>
                </label>
              </Block>
            </div>

            <footer className="rd-modal-foot">
              {postError && (
                <div className="mapping-alert is-danger" role="alert">
                  <AlertCircle size={16} />
                  <span className="cc-alert-text">{postError}</span>
                </div>
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
                <div className="form-actions-sep" />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={approve}
                  disabled={busy || acc.blocked}
                >
                  {busy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
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
