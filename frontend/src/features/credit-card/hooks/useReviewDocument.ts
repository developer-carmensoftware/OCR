import { useCallback, useEffect, useState } from 'react'
import type { DetailRow } from '@/features/credit-card/components/DetailTable'
import type { JvState, Overrides } from '@/features/credit-card/components/JvEditor'
import { useT } from '@/i18n/LanguageContext'
// The barrel, not './useAccountingConfig': ReviewDocument.test.tsx stands in for the
// accounting config by mocking this exact module.
import { useAccountingConfig } from '@/features/credit-card/hooks'
import { showToast } from '@/shared/lib/toast'
import { fmt } from '@/shared/lib/format'
import { toExtractedRows } from '@/shared/api/ocr'
import { normalizeDateStringToCE } from '@/shared/lib/date'
import { applyJvAmount, type JvRow } from '@/features/credit-card/lib/ccJv'
import { fixLinkProps, type ExtractionWarning } from '@/shared/lib/reviewReasons'
import { patchAccountingConfig } from '@/shared/api/config'
import {
  approveDocument,
  getPending,
  rejectDocument,
  type ItxOverrides,
  type ReviewDocumentDetail,
} from '@/features/credit-card/api/emailReview'
import { detectBankFromExtracted } from '@/shared/constants/banks'
import type { BankCode } from '@/shared/types/api'

/**
 * Everything `ReviewDocument` knows about one parked document: the loaded payload, every
 * correction the reviewer has made and not yet posted, whether closing has to ask, and
 * the two verbs — approve and reject. The page is left with the dialog and its chrome.
 *
 * Not in the `hooks/` barrel, the way `useReviewQueue` is not: the page imports it by
 * path, so a test that mocks the barrel for `useAccountingConfig` still gets this one.
 */
export function useReviewDocument(
  id: string,
  onClose: () => void,
  onDone: () => void,
  /** The queue row's `bank_code`, when the queue has the row — lets the GL rules load
   *  alongside the document instead of after it. */
  bankHint?: string | null
) {
  const { t } = useT()
  const [doc, setDoc] = useState<ReviewDocumentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [gone, setGone] = useState(false)

  const [headerData, setHeaderData] = useState<Record<string, string>>({})
  const [details, setDetails] = useState<DetailRow[]>([])
  const [bank, setBank] = useState<BankCode | ''>('')
  const [warnings, setWarnings] = useState<(ExtractionWarning | string)[]>([])
  const [postInputTax, setPostInputTax] = useState(true)
  /** The input-tax record cannot be filed as it stands. Approve posts both documents, so
   *  it stops for this the same way it stops for an unbalanced JV. */
  const [itxBlocked, setItxBlocked] = useState(false)
  // Corrections to the input-tax record's own fields. Per document, like the line
  // descriptions — none of it is a rule, and none of it is written to the BU config.
  const [itx, setItx] = useState<ItxOverrides>({})

  // GL rule corrections, not yet saved. Keyed by accounting-config field type, because
  // that is what a picker edits — see JvEditor's note on JvRow.key.
  //
  // Seeded from `doc.suggested`: since 2026-09-04 ingest keeps what the AI proposed on the
  // ledger row instead of writing it to the BU's config, so these pickers are the only
  // place those codes exist until this screen's approve saves them.
  const [overrides, setOverrides] = useState<Overrides>({})
  // Which of those rules is still the AI's answer rather than a person's. Live, not the
  // payload's `guessed` list: the AI also fills in here, for a type ingest could not map
  // and for one the reviewer introduces by retyping a Transaction cell, and a badge that
  // only knew about ingest called those the reviewer's own work.
  const [aiKeys, setAiKeys] = useState<string[]>([])
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
  // Which bank this posts against: what ingest stored on the row, which since 2026-09-03
  // is the document's own answer and not a filename rule's guess. Re-detecting in the
  // browser first put a weaker reading of the same payload ahead of it —
  // `detectBankFromExtracted` misses whenever the header carries only the short code. The
  // detection stays as the fallback for rows written before that change. Until the
  // document arrives, the queue row's copy of that same column stands in for it.
  //
  // Resolved once here: the JV pane and the config write already fell back this way, and
  // the input-tax panel took the bare detection and so lost the vendor's registered
  // identity — name, tax ID and address — for a bank sitting right there in the registry.
  const bankCode = (doc?.bank_code || bank || bankHint || '') as BankCode | ''
  // This bank's own GL rules: the JV is built from them and approve posts that JV.
  const { config, loading: configLoading } = useAccountingConfig(bankCode || undefined)

  const [busy, setBusy] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  /** Anything the reviewer has typed or re-mapped and not yet posted. Only used to decide
   *  whether closing needs to ask first. */
  const [dirty, setDirty] = useState(false)
  const [discarding, setDiscarding] = useState(false)

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
        setWarnings((ext.warnings as (ExtractionWarning | string)[]) || [])
        setBank((detectBankFromExtracted(ext as Record<string, string>) || '') as BankCode | '')
        // What the AI proposed at ingest, into the pickers as the starting answer. Not
        // `setDirty`: the reviewer has not done anything yet, and closing an untouched
        // document must not ask them whether to discard the machine's own suggestion.
        setOverrides(
          Object.fromEntries(
            Object.entries(d.suggested || {}).map(([k, m]) => [
              k,
              { dept: m.dept || '', acc: m.acc || '' },
            ])
          )
        )
        // From `guessed`, not from `suggested`: for a new row they are the same list, but a
        // document parked before 2026-09-04 has only the names — ingest saved its dept/acc
        // straight to the config back then, so the picker already shows them and the badge
        // is the one thing that would otherwise be lost.
        setAiKeys(d.guessed || [])
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
      // Whose answer this row is now holding. A person typing over the AI's pick takes the
      // row off the "check this" list; the AI filling a row the person left empty puts it on.
      setAiKeys(k => (byUser ? k.filter(x => x !== key) : k.includes(key) ? k : [...k, key]))
    },
    []
  )
  const onUndo = useCallback((key: string) => {
    setDirty(true)
    setOverrides(o => {
      const { [key]: _dropped, ...rest } = o
      return rest
    })
    setAiKeys(k => k.filter(x => x !== key))
  }, [])
  const onDesc = useCallback((id: string, value: string) => {
    setDirty(true)
    setDescs(d => ({ ...d, [id]: value }))
  }, [])
  const onJvState = useCallback((s: JvState) => setJv(s), [])

  // The header and input-tax edits, named here rather than inlined in the page, so every
  // way the reviewer changes something marks the document dirty in one place.
  // Header corrections are the reviewer's work as much as an amount is — BU config, lost on
  // close like everything else here until approve.
  const onPrefix = useCallback((v: string) => {
    setDirty(true)
    setPrefix(v)
  }, [])
  const onDescription = useCallback((v: string) => {
    setDirty(true)
    setDescription(v)
  }, [])
  const onPostInputTax = useCallback((on: boolean) => {
    setDirty(true)
    setPostInputTax(on)
  }, [])
  const onItxOverride = useCallback((patch: ItxOverrides) => {
    setDirty(true)
    setItx(o => ({ ...o, ...patch }))
  }, [])

  // Everything the approve will write back to the BU config: zero means skip the config
  // call entirely.
  const ruleCount =
    Object.keys(overrides).length + (prefix === null ? 0 : 1) + (description === null ? 0 : 1)

  // Why Approve cannot be pressed, resolved once so the sentence under the button and the
  // button's own disabled state cannot disagree. The JV comes first: it is the document
  // being posted, and the input-tax record is filed after it.
  // The book the JV posts into. `Prefix` is sent as `config.file_prefix or ""`
  // (`build_gljv_payload`), so an unset one does not fail loudly — it posts a JV into
  // whatever Carmen does with a blank book, which is not a decision to make by accident.
  // Read the same way JvHeaderCard displays it, so the field and the block agree.
  const effectivePrefix = prefix ?? ((config?.filePrefix as string) || '')

  // AR reconciliation is a different document with a different JV, and the browser has no
  // arithmetic builder for it: the server sent the rows, the server rebuilds the same rows
  // on approve, and this screen only shows them — read-only, since 2026-09-16. Every GL
  // account for this feature — the three fixed debit legs (decision #28) and the credit
  // mappings — is a bank-level setting fixed on the mapping page, not a per-document
  // correction. That is why the whole JvEditor / InputTaxPanel half of the modal is
  // replaced rather than disabled, but `ARReviewPane` itself is not.
  const arJv = doc?.doc_type === 'ar_reconcile' ? (doc.ar_jv ?? null) : null
  const isAR = doc?.doc_type === 'ar_reconcile'

  const arBlockReason = !arJv
    ? t('review.arNotConfigured')
    : arJv.unmapped.length > 0
      ? t('review.arUnmapped', { types: arJv.unmapped.join(', ') })
      : !arJv.balanced
        ? t('review.jvOffBy', { diff: fmt(Math.abs(arJv.total_debit - arJv.total_credit)) })
        : !effectivePrefix
          ? t('review.prefixRequired')
          : null

  const blockReason = isAR
    ? arBlockReason
    : jv.reason
      ? jv.reason === 'account'
        ? t('review.jvBlankAccount')
        : jv.reason === 'unbalanced'
          ? t('review.jvOffBy', { diff: fmt(Math.abs(jv.totalDr - jv.totalCr)) })
          : t('review.jvNothing')
      : !effectivePrefix
        ? t('review.prefixRequired')
        : itxBlocked
          ? t('review.itxBlocked')
          : null

  // The journal book is BU config, and on the AR path the field that used to hold it is
  // read-only — so the sentence naming it has to come with the door. Same `<a>` shape the
  // stop-reason banner uses, rather than a second kind of link on the same dialog. On the
  // fee-invoice path the picker is right there in the header and a link would be noise.
  const prefixFix =
    isAR && blockReason === t('review.prefixRequired')
      ? fixLinkProps({ href: '#/CreditCardOCR/mapping' })
      : null

  // Two doors behind one button, picked by what is wrong. No JV at all means this bank has
  // no active settlement rule — the switch, which Carmen's settings screen owns since
  // 2026-09-29, so that is where it opens. Otherwise the gap is an account, fixed on the
  // mapping page, and every value there is per bank, so the door carries this document's.
  const arSettingsLink = fixLinkProps({
    href: !arJv
      ? '/setting'
      : bankCode
        ? `#/CreditCardOCR/mapping?bank=${encodeURIComponent(bankCode)}`
        : '#/CreditCardOCR/mapping',
  })

  async function approve() {
    if (!doc) return
    setBusy(true)
    setPostError(null)

    // Rules first, JV second. If Carmen then refuses, the corrected rule still stands —
    // it was wrong before and is right now, independently of this document — and the
    // reviewer is standing here to retry. The other order can leave a rule silently
    // unsaved behind a JV that already posted.
    //
    // **This is now the only writer of an AI-suggested rule.** Ingest used to save its own
    // guess the moment it made it, so the second copy of a statement found the rule already
    // there, carried no flag, and auto-posted on something no human had read. `overrides`
    // arrives seeded with what the AI proposed, so pressing Approve is what turns it into
    // the BU's rule — once per payment type, by a person, which is the whole point.
    // Not on the AR path: its accounts are the bank's settlement mapping, fixed on the
    // mapping page, and nothing on this screen edits them.
    if (ruleCount && !isAR) {
      try {
        await patchAccountingConfig({
          mappings: Object.fromEntries(
            Object.entries(overrides).map(([k, m]) => [k, { dept: m.dept || '', acc: m.acc || '' }])
          ),
          ...(prefix === null ? {} : { file_prefix: prefix }),
          ...(description === null ? {} : { description }),
          // Which bank's wording the description belongs to. The server prefers a per-bank
          // entry over the BU-wide one, so it has to write whichever actually wins.
          bank_code: bankCode,
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
        // AR: the server rebuilds these from the BU's current mapping and ignores what is
        // sent, so sending the rows it just handed us keeps the request honest rather
        // than pretending the browser composed them.
        rows: isAR ? (arJv?.rows ?? []) : jv.rows,
        // AR always attempts it (decision #28): since the fee invoice that used to file
        // this claim is no longer processed once AR reconciliation covers a bank, the
        // settlement report claims the commission's VAT itself. No panel offers a
        // reviewer a choice here the way `postInputTax` does for a fee invoice, so this
        // is unconditional — matching the unattended path's own default.
        post_input_tax: isAR ? true : postInputTax,
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

  return {
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
  }
}
