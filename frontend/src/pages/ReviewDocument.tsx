import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import AppHeader from '../components/common/AppHeader'
import UsageIndicator from '../components/common/UsageIndicator'
import CustomModal from '../components/common/CustomModal'
import SwapLabel from '../components/common/SwapLabel'
import PageSkeleton from '../components/common/PageSkeleton'
import HeaderCard from '../components/credit-card/HeaderCard'
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

const QUEUE = '#/CreditCardOCR'

function docIdFromHash(): string | null {
  const q = window.location.hash.split('?')[1]
  return q ? new URLSearchParams(q).get('id') : null
}

/** How much a section should stop someone. `stop` disables Approve; `warn` does not. */
type Severity = 'ok' | 'warn' | 'stop'

const MARK: Record<Severity, { icon: typeof Check; cls: string }> = {
  ok: { icon: Check, cls: 'rd-mark--ok' },
  warn: { icon: AlertTriangle, cls: 'rd-mark--warn' },
  stop: { icon: AlertCircle, cls: 'rd-mark--stop' },
}

function Section({
  id,
  title,
  summary,
  severity,
  open,
  onToggle,
  children,
}: {
  id: string
  title: string
  summary: string
  severity: Severity
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const Icon = MARK[severity].icon
  return (
    <section className={`rd-section${open ? ' rd-section--open' : ''}`}>
      <h2 className="rd-section-h">
        <button
          type="button"
          className="rd-section-btn"
          aria-expanded={open}
          aria-controls={`rd-body-${id}`}
          onClick={onToggle}
        >
          <ChevronRight size={16} className="rd-caret" aria-hidden="true" />
          <span className="rd-section-title">{title}</span>
          {/* The header states the problem rather than only flagging one: a collapsed
              section still has to answer "is this right?" without being opened. */}
          <span className="rd-section-summary">{summary}</span>
          <Icon size={16} className={`rd-mark ${MARK[severity].cls}`} aria-hidden="true" />
        </button>
      </h2>
      {/* Hidden, not unmounted: AccountingReview is what computes the rows Approve posts,
          so a collapsed section would answer for details the reviewer has since edited. */}
      <div className="rd-section-body" id={`rd-body-${id}`} hidden={!open}>
        {children}
      </div>
    </section>
  )
}

export default function ReviewDocument() {
  const { t } = useT()
  const [id] = useState(docIdFromHash)
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

  // Whether AccountingReview has answered yet. Until it has, `blocked` is only the
  // pessimistic default, and opening GL on it flashes the section open and shut.
  const [accReady, setAccReady] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  // A ref, not state: the auto-expand effect must read whether the reviewer has taken over
  // *now*, not as of the render it was scheduled in — otherwise a click landing in the same
  // tick as the GL verdict is undone by the effect that was already queued.
  const touched = useRef(false)
  const [busy, setBusy] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!id) {
      setLoading(false)
      setGone(true)
      return
    }
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

  // Auto-expand only what has a problem, once, when the document lands. A clean document
  // opens fully collapsed and is two clicks from posted; re-running this on every edit
  // would fight the reviewer as they fix things.
  useEffect(() => {
    if (!doc || touched.current || !accReady) return
    setOpen({
      doc: !headerData.DocNo,
      lines: badLines.length > 0,
      gl: acc.blocked || acc.unmappedFields.length > 0,
      tax: false,
    })
  }, [doc, accReady, headerData.DocNo, badLines.length, acc.blocked, acc.unmappedFields.length])

  const toggle = (k: string) => {
    touched.current = true
    setOpen(o => ({ ...o, [k]: !o[k] }))
  }

  const updateHeader = (key: string, value: string) => setHeaderData(h => ({ ...h, [key]: value }))
  const updateDetail = (i: number, col: string, value: string) =>
    setDetails(d => d.map((row, n) => (n === i ? { ...row, [col]: value } : row)))
  const onState = useCallback((s: AccountingState) => {
    setAcc(s)
    setAccReady(true)
  }, [])

  async function approve() {
    if (!id || !doc) return
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
      window.location.hash = QUEUE
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 409) {
        // Someone else in the BU got there first. Nothing to fix here.
        showToast(t('review.alreadyHandled'), 'warning')
        window.location.hash = QUEUE
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
    if (!id) return
    setBusy(true)
    try {
      await rejectDocument(id, reason.trim() || undefined)
      showToast(t('review.rejected'), 'success')
      window.location.hash = QUEUE
    } catch {
      showToast(t('review.rejectFailed'), 'error')
      setBusy(false)
      setRejecting(false)
    }
  }

  if (loading) return <PageSkeleton />

  if (gone || !doc) {
    return (
      <div className="app-container">
        <AppHeader module="credit-card" moduleName={t('review.title')} />
        <div className="rq-empty">
          <AlertTriangle size={36} className="rq-empty-icon rq-empty-icon--bad" aria-hidden />
          <h2 className="rq-empty-title">{t('review.goneTitle')}</h2>
          <p className="rq-empty-body">{t('review.goneBody')}</p>
          <a className="btn btn-outline" href={QUEUE}>
            {t('review.backToQueue')}
          </a>
        </div>
      </div>
    )
  }

  const sum = (k: keyof DetailRow) => details.reduce((n, d) => n + parseNum(d[k]), 0)

  return (
    <div className="app-container">
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

      <AppHeader
        module="credit-card"
        moduleName={t('review.title')}
        eyebrow="Carmen Cloud · Credit Card"
        onBack={() => {
          window.location.hash = QUEUE
        }}
        backLabel={t('review.backToQueue')}
      >
        <UsageIndicator />
      </AppHeader>

      <div className="rd-title">
        <span className="rd-title-bank">{bank || doc.bank_code || t('review.unknownBank')}</span>
        <span className="text-mono">{headerData.DocNo || '—'}</span>
        <span className="text-mono rd-title-date">{headerData.DocDate || '—'}</span>
      </div>

      {warnings.length > 0 && (
        <div className="mapping-alert">
          <AlertTriangle size={16} />
          <span className="cc-alert-text">{warnings.join(' · ')}</span>
        </div>
      )}

      <Section
        id="doc"
        title={t('review.secDocument')}
        summary={
          headerData.DocNo
            ? `${headerData.DocNo} · ${headerData.DocDate}`
            : t('review.secDocumentMissing')
        }
        severity={docSeverity}
        open={!!open.doc}
        onToggle={() => toggle('doc')}
      >
        <HeaderCard headerData={headerData} onUpdate={updateHeader} />
      </Section>

      <Section
        id="lines"
        title={t('review.secLines')}
        summary={
          badLines.length
            ? t('review.secLinesBad', { lines: badLines.map(b => b.line).join(', ') })
            : t('review.secLinesOk', { count: String(details.length), total: fmt(sum('PayAmt')) })
        }
        severity={lineSeverity}
        open={!!open.lines}
        onToggle={() => toggle('lines')}
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
      </Section>

      <Section
        id="gl"
        title={t('review.secGl')}
        summary={
          acc.blocked
            ? t('review.secGlBlocked')
            : acc.unmappedFields.length
              ? t('review.secGlGuessed', { fields: acc.unmappedFields.join(', ') })
              : t('review.secGlOk', { count: String(acc.rows.length) })
        }
        severity={glSeverity}
        open={!!open.gl}
        onToggle={() => toggle('gl')}
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
      </Section>

      <Section
        id="tax"
        title={t('review.secTax')}
        summary={postInputTax ? t('review.secTaxOn') : t('review.secTaxOff')}
        severity="ok"
        open={!!open.tax}
        onToggle={() => toggle('tax')}
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
      </Section>

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
          {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          <SwapLabel active={busy} idle={t('review.approve')} busy={t('review.approving')} />
        </button>
      </div>
    </div>
  )
}
