import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { useT } from '../../i18n/LanguageContext'
import { showToast } from '../../lib/toast'
import { parseNum, fmt, round2 } from '../../lib/format'
import { saveAPVendorMapping } from '../../lib/api/config'
import { appKey } from '../../lib/storage'
import { useAPExtraction } from './useAPExtraction'
import type { APLineItem } from './useAPExtraction'
import { useAPVendor } from './useAPVendor'
import { useAPValidation, reconcileRows, repairDocFigure } from './useAPValidation'
import { recalcRow, syncLineTotals, resolveTaxProfileForRate } from '../../lib/apTax'
import { groupSelected } from '../../lib/apGroup'
import { useAPSubmission } from './useAPSubmission'
import { fetchTaxProfiles } from '../../lib/api/carmen'
import type { TaxProfileItem } from '../../lib/api/carmen'
import type { ModalState } from '../../types/modal'

export function useAPInvoice() {
  const { t } = useT()

  const [step, setStep] = useState(1)
  const [modal, setModal] = useState<ModalState>({ show: false })
  // groupSources maps a _groupId to the original source rows that were merged into that grouped row.
  // Source rows are always flat (never contain other _groupId rows) so ungroup is always one level.
  const [groupSources, setGroupSources] = useState<Record<string, APLineItem[]>>({})
  const groupIdCounter = useRef(0)
  const [taxProfiles, setTaxProfiles] = useState<TaxProfileItem[]>([])

  const extraction = useAPExtraction({ setStep, setModal })

  const vendor = useAPVendor({ headerData: extraction.headerData })

  const validation = useAPValidation({
    headerData: extraction.headerData,
    lineItems: extraction.lineItems,
    fieldMappings: extraction.fieldMappings,
    t,
  })

  const submission = useAPSubmission({
    setStep,
    setModal,
    headerData: extraction.headerData,
    lineItems: extraction.lineItems,
    setLineItems: extraction.setLineItems,
    systemVendor: vendor.systemVendor,
    taxProfiles,
    apInvoiceId: extraction.apInvoiceId,
    updateHeader: extraction.updateHeader,
  })

  useEffect(() => {
    vendor.loadVendors()
    fetchTaxProfiles()
      .then(setTaxProfiles)
      .catch(() => {})
  }, [vendor.loadVendors])

  useEffect(() => {
    if (vendor.showVendorDrop) return
    vendor.autoMatchVendor(false)
  }, [
    extraction.headerData.vendorTaxId,
    vendor.vendorDbByTax,
    vendor.showVendorDrop,
    vendor.autoMatchVendor,
  ])

  // Auto-match each taxable line's Tax Profile to its extracted rate, preferring the vendor's
  // default profile among same-rate profiles (resolveTaxProfileForRate). When NO profile defines
  // the line's rate, the extracted rate is kept and the profile is left blank — we never silently
  // rewrite a valid rate (e.g. 10%) to the vendor default; the UI surfaces an "unmatched rate"
  // warning instead. None lines are left untouched. Rows the user has manually edited
  // (_taxProfileTouched) are skipped so the choice sticks. The effect re-runs once the vendor
  // resolves (its default profile lands) and upgrades untouched lines from the arbitrary
  // first-match to the vendor's profile. The `changed` flag prevents a render loop.
  const vendorTaxProfile = vendor.systemVendor.taxProfileCode1
  useEffect(() => {
    if (!taxProfiles.length) return

    extraction.setLineItems(prev => {
      if (!prev.length) return prev
      let changed = false
      const next = prev.map(it => {
        if (it._taxProfileTouched) return it
        if (it.taxType === 'None') {
          if (it.taxProfileCode1 !== '') {
            changed = true
            return { ...it, taxProfileCode1: '' }
          }
          return it
        }
        const rate = parseNum(it.taxPct)
        const desired = resolveTaxProfileForRate(rate, taxProfiles, vendorTaxProfile)
        if (it.taxProfileCode1 !== desired) {
          changed = true
          return { ...it, taxProfileCode1: desired }
        }
        return it
      })
      return changed ? next : prev
    })
  }, [taxProfiles, extraction.lineItems.length, vendorTaxProfile, extraction.setLineItems])

  const confirmMapping = () => {
    const mappedValues = Object.values(extraction.fieldMappings)
    if (!mappedValues.includes('description') || !mappedValues.includes('lineTotal')) {
      showToast(t('ap.warnMissingMapping'), 'warning')
      return
    }
    const taxId = extraction.headerData.vendorTaxId
    if (taxId) {
      saveAPVendorMapping(taxId, extraction.fieldMappings).catch(() => {})
      try {
        const savedAll = JSON.parse(
          localStorage.getItem(appKey('ap_invoice_mapping')) || '{}'
        ) as Record<string, unknown>
        savedAll[taxId] = extraction.fieldMappings
        localStorage.setItem(appKey('ap_invoice_mapping'), JSON.stringify(savedAll))
      } catch {
        /* ignore */
      }
    }
    showToast(t('ap.colSaved'), 'success')
    const repair = repairDocFigure({
      tgtSubTotal: validation.tgtSubTotal,
      tgtTax: validation.tgtTax,
      tgtGrand: validation.tgtGrand,
      sumSub: validation.sumLineSubTotal,
      sumTax: validation.sumTax,
    })
    if (repair?.confident) applyDocRepair(repair, true)
    setStep(3)
  }

  const goToAccount = () => {
    if (!vendor.systemVendor.code) {
      showToast(t('ap.warnSelectVendor'), 'warning')
      return
    }
    if (!validation.isValid) {
      setModal({
        show: true,
        type: 'warning',
        title: t('ap.mismatchTitle'),
        message: t('ap.warnMismatch'),
        confirmText: t('ap.proceed'),
        cancelText: t('ap.backEdit'),
        onConfirm: () => {
          setModal({ show: false })
          setStep(4)
          submission.loadGLData()
        },
        onCancel: () => setModal({ show: false }),
      })
    } else {
      setStep(4)
      submission.loadGLData()
    }
  }

  // Adjust button — pin-based. Because every row keeps lineTotal = lineSubTotal + taxAmt, the
  // summary has only two free quantities (Σsub, Σtax) and Σgrand ≡ Σsub + Σtax. Each adjust moves
  // ONLY its own amount field on the plug row(s) and lets the total follow via syncLineTotals — it
  // never re-derives a sibling field from the rate, so the diffs no longer fight each other:
  //   • lineSubTotal (Sub) → plug net subtotal; taxAmt untouched (Σtax unchanged).
  //   • taxAmt (Tax)       → plug tax; lineSubTotal untouched (Σsub unchanged).
  //   • lineTotal (Grand)  → MASTER RECONCILE: land Σsub on docSub AND Σtax on docTax in one pass,
  //                          so grand = docSub + docTax follows and every diff clears in one click.
  //   • discountAmt        → informational; keeps the single-field write + reconcileRows path.
  // Master reconcile: land Σsub on subTarget AND Σtax on taxTarget in one pass, so grand =
  // subTarget + taxTarget follows and every summary diff clears at once. Shared by the Grand-total
  // Adjust button and fixDocFigures.
  const reconcileTableToDoc = useCallback(
    (subTarget: number, taxTarget: number) => {
      const items = extraction.lineItems
      if (!items.length) return
      let updated = validation.adjustField(
        subTarget,
        validation.sumLineSubTotal,
        'lineSubTotal',
        items
      )
      // The sub step writes only lineSubTotal, so Σtax is still validation.sumTax for the tax step.
      updated = validation.adjustField(taxTarget, validation.sumTax, 'taxAmt', updated)
      extraction.setLineItems(syncLineTotals(updated))
    },
    [
      extraction.lineItems,
      validation.adjustField,
      validation.sumLineSubTotal,
      validation.sumTax,
      extraction.setLineItems,
    ]
  )

  const adjustField = (tgt: unknown, sumCur: unknown, itemKey: string) => {
    const items = extraction.lineItems
    if (!items.length) return

    if (itemKey === 'lineSubTotal' || itemKey === 'taxAmt') {
      const updated = validation.adjustField(tgt, sumCur, itemKey, items)
      extraction.setLineItems(syncLineTotals(updated))
      return
    }

    if (itemKey === 'lineTotal') {
      reconcileTableToDoc(
        round2(extraction.headerData.subTotal),
        round2(extraction.headerData.taxAmount)
      )
      return
    }

    const updated = validation.adjustField(tgt, sumCur, itemKey, items)
    extraction.setLineItems(reconcileRows(updated))
  }

  // The document's printed totals don't add up (grand ≠ sub + tax) — the signature of a misread
  // digit. Repair the outlier figure (chosen via the line-item sums) so the document becomes
  // self-consistent again, keep it as the trusted "From Document" anchor, then reconcile the table
  // to it. One click takes the user from the dead-end to fully matched. `auto` only changes the
  // toast wording (system did it vs user clicked).
  const applyDocRepair = useCallback(
    (repair: ReturnType<typeof repairDocFigure>, auto: boolean) => {
      if (!repair) return
      // Write the corrected figure to the immutable "From Document" header value.
      extraction.blurHeader(repair.field, fmt(repair.value))
      // Reconcile the table against the now-consistent document. blurHeader's state update is async,
      // so derive the post-repair sub/tax targets locally instead of reading headerData back.
      const subTarget = repair.field === 'subTotal' ? repair.value : validation.tgtSubTotal
      const taxTarget = repair.field === 'taxAmount' ? repair.value : validation.tgtTax
      reconcileTableToDoc(subTarget, taxTarget)
      const label =
        repair.field === 'taxAmount'
          ? t('ap.tax')
          : repair.field === 'subTotal'
            ? t('ap.subTotal')
            : t('ap.grandTotal')
      showToast(`${auto ? t('ap.docAutoFixedToast') : t('ap.docFixedToast')} ${label}`, 'success')
    },
    [extraction.blurHeader, validation.tgtSubTotal, validation.tgtTax, reconcileTableToDoc, t]
  )

  const fixDocFigures = () =>
    applyDocRepair(
      repairDocFigure({
        tgtSubTotal: validation.tgtSubTotal,
        tgtTax: validation.tgtTax,
        tgtGrand: validation.tgtGrand,
        sumSub: validation.sumLineSubTotal,
        sumTax: validation.sumTax,
      }),
      false
    )

  // Hybrid auto-fix: when entering the Review step, silently repair the document ONLY for
  // high-confidence cases (unambiguous outlier + a small rounding/last-digit gap). Ambiguous or
  // large gaps stay manual (the banner + button). Done during transition to step 3 in confirmMapping.

  // Wraps extraction.blurHeader so that editing header taxAmount also propagates
  // to line items. When the user sets tax to 0, all lines are zeroed. When non-zero,
  // the standard diff-adjust (last item) is used — same as clicking the Adjust button.
  const blurHeader = (key: string, val: string) => {
    extraction.blurHeader(key, val)
    if (key !== 'taxAmount') return
    const tgt = parseNum(val)
    const sum = validation.sumTax
    if (tgt === sum) return
    if (tgt === 0) {
      // Zero VAT: make every row non-VAT but PRESERVE its net subtotal — collapse lineTotal onto
      // lineSubTotal instead of re-anchoring on unitPrice (which is gross for Include rows and
      // would inflate the line to its gross amount). Clear the profile to match None elsewhere.
      extraction.setLineItems(prev =>
        prev.map(item => ({
          ...item,
          taxType: 'None' as const,
          taxPct: '0.00',
          taxAmt: '0.00',
          taxProfileCode1: '',
          lineTotal: fmt(item.lineSubTotal),
        }))
      )
      return
    }
    // adjustField only writes taxAmt; reconcile per-line totals so they stay consistent.
    const adjusted = validation.adjustField(tgt, sum, 'taxAmt', extraction.lineItems)
    extraction.setLineItems(reconcileRows(adjusted))
    // Keep the "From Document" header values fixed: blurHeader above already stored the
    // user-typed taxAmount. Do not re-sync taxAmount/grandTotal from line sums — that would
    // mutate the immutable document totals and hide any remaining grand-total diff.
  }

  // Fields whose blur triggers a full line recalculation.
  const RECALC_TRIGGERS = new Set(['qty', 'unitPrice', 'discountPct', 'discountAmt', 'taxPct'])

  // recalcRow (the per-row Include/Exclude/None formula) lives in lib/apTax so the hook,
  // validation, and Adjust all share one implementation. See ../../lib/apTax.

  // Drop-in replacement for extraction.blurItem for table cells.
  // Formats the edited value and, for driver fields, recalculates all dependent amounts
  // in a single setLineItems call so there is no stale-state race.
  const blurLineItem = (rowIndex: number, field: string, rawValue: string) => {
    const item = extraction.lineItems[rowIndex]
    if (!item) return

    // Always format the edited field first
    const formattedValue = fmt(rawValue)

    if (!RECALC_TRIGGERS.has(field)) {
      // Non-driver field: just format in place
      extraction.setLineItems(prev =>
        prev.map((it, i) => (i === rowIndex ? { ...it, [field]: formattedValue } : it))
      )
      return
    }

    // Build a snapshot of the row with the newly formatted value applied
    const snap = { ...item, [field]: formattedValue }
    const resolvedSnap =
      field === 'discountPct'
        ? {
            ...snap,
            discountAmt: fmt(
              round2(
                ((parseNum(snap.qty) || 1) *
                  parseNum(snap.unitPrice) *
                  parseNum(snap.discountPct)) /
                  100
              )
            ),
          }
        : snap

    extraction.setLineItems(prev =>
      prev.map((it, i) => (i === rowIndex ? recalcRow(resolvedSnap) : it))
    )
    // Do NOT sync header totals here. headerData.{subTotal,taxAmount,grandTotal} are the
    // immutable "From Document" values; the "From Table" column recomputes reactively via
    // useAPValidation. Overwriting them hid the reconciliation diff (and the submit gate).
  }

  // Single entry point keeping the three per-line tax fields interlocked, then recalcs the row in
  // one commit. Every tax <select> in the review table routes through here with just the changed
  // field; this function derives the dependent fields:
  //   • profile NONE (or taxType None)       → non-VAT: clear profile, taxPct 0
  //   • profile = real code                 → taxPct := that profile's rate; un-None to Exclude
  //   • profile '' (—)                       → taxable, no specific profile, keep current rate (no vendor default)
  //   • taxPct = rate                        → profile := first profile with that rate (keep current if it matches)
  const applyLineTax = (
    rowIndex: number,
    patch: { taxType?: 'Include' | 'Exclude' | 'None'; taxProfileCode1?: string; taxPct?: string }
  ) => {
    const rateOf = (code: string) => taxProfiles.find(p => p.code === code)?.rate ?? null
    const codeForRate = (rate: number) =>
      taxProfiles.find(p => p.rate != null && Math.abs(p.rate - rate) < 0.01)?.code || ''

    const headerTaxType = extraction.headerData.taxType

    extraction.setLineItems(prev =>
      prev.map((it, i) => {
        if (i !== rowIndex) return it
        const merged = { ...it, ...patch }
        const prevType = (it.taxType || 'Exclude') as 'Include' | 'Exclude' | 'None'

        // Derive the effective taxType, honouring profile-driven None.
        let taxType = (merged.taxType || 'Exclude') as 'Include' | 'Exclude' | 'None'
        if (patch.taxProfileCode1 !== undefined) {
          if (patch.taxProfileCode1 === 'NONE') {
            taxType = 'None'
            merged.taxProfileCode1 = ''
          } else if (patch.taxProfileCode1 === '') {
            if (taxType === 'None') {
              // Restore to the document-level tax type when selecting "—" on a None line
              taxType = headerTaxType === 'Include' ? 'Include' : 'Exclude'
            }
            merged.taxProfileCode1 = ''
          } else if (taxType === 'None') {
            // Restore to the document-level tax type (Include/Exclude) when un-Noning a line
            // by picking a profile; fall back to Exclude if the header is also None/missing.
            taxType = headerTaxType === 'Include' ? 'Include' : 'Exclude'
          }
        }

        if (taxType === 'None') {
          return recalcRow({ ...merged, taxType: 'None', taxProfileCode1: '', taxPct: '0' })
        }

        // Pure Include ↔ Exclude toggle (only taxType changed, neither side None): pin the net
        // subtotal and re-derive tax/total from the rate. recalcRow re-anchors on unitPrice, whose
        // gross/net meaning differs by tax type, so going through it here would make the line jump
        // to the stored unitPrice's gross — pinning the subtotal keeps the toggle non-destructive.
        const isToggle =
          patch.taxType !== undefined &&
          patch.taxProfileCode1 === undefined &&
          patch.taxPct === undefined &&
          prevType !== 'None'
        if (isToggle) {
          const r = Math.max(0, parseNum(merged.taxPct))
          const sub = round2(merged.lineSubTotal)
          const taxAmt = round2((sub * r) / 100)
          return {
            ...merged,
            taxType,
            lineSubTotal: fmt(sub),
            taxAmt: fmt(taxAmt),
            lineTotal: fmt(sub + taxAmt),
          }
        }

        let code = merged.taxProfileCode1 || ''
        let rate = parseNum(merged.taxPct)
        if (patch.taxProfileCode1) {
          const r = rateOf(code) // profile drives the rate
          if (r != null) rate = r
        } else if (patch.taxPct !== undefined) {
          // Rate drives the profile. When no profile defines this rate, blank the profile (keep the
          // rate) rather than holding a stale code — the line stays taxable and the UI warns.
          if (rateOf(code) !== rate) code = codeForRate(rate)
        }
        // No `!code` fallback: picking "—" (or un-Noning with no profile) leaves the line taxable
        // with no specific profile and its current rate — we never silently inject the vendor
        // default (matches auto-match / grouping / submission, which also dropped that fallback).

        return recalcRow({ ...merged, taxType, taxProfileCode1: code, taxPct: String(rate) })
      })
    )
  }

  // Tax Type select routes through the shared interlock.
  const changeLineTaxType = (rowIndex: number, newTaxType: 'Include' | 'Exclude' | 'None') =>
    applyLineTax(rowIndex, { taxType: newTaxType })

  // Derived: true when any row in the current list is a grouped row.
  const isGrouped = extraction.lineItems.some(it => it._groupId)

  // Derived: how many rows would be in the list after fully expanding all groups.
  const originalLineItemsCount = extraction.lineItems.reduce(
    (n, it) =>
      n + (it._groupId && groupSources[it._groupId] ? groupSources[it._groupId].length : 1),
    0
  )

  // Flatten the source rows behind each selected item. If an item is itself a grouped row we
  // substitute its original source rows (making nested-group→merge always produce flat sources).
  const flattenSources = (items: APLineItem[]): APLineItem[] =>
    items.flatMap(it =>
      it._groupId && groupSources[it._groupId] ? groupSources[it._groupId] : [it]
    )

  // Group by description: merge the user-selected rows into named grouped rows.
  // Items may span multiple tax profiles — each distinct (taxType, profile) becomes one row,
  // all sharing the user-supplied description. Leaves non-selected rows untouched.
  const groupByDescription = (indices: number[], description: string): boolean => {
    const items = extraction.lineItems
    // Drop duplicate / out-of-range indices: the modal can hand us stale indices captured against a
    // longer list (a previous group shrank it), and a bad index would surface undefined rows.
    const sorted = [...new Set(indices)]
      .filter(i => i >= 0 && i < items.length)
      .sort((a, b) => a - b)
    if (sorted.length < 2) return false
    const selected = sorted.map(i => items[i])
    const desc = description.trim() || items[sorted[0]]?.description || t('ap.groupedItems')
    const buckets = groupSelected(selected, desc)

    const newSources: Record<string, APLineItem[]> = {}
    const absorbedIds = new Set(
      selected.flatMap(it => (it._groupId ? [it._groupId] : [])) as string[]
    )
    const mergedRows: APLineItem[] = buckets.map(({ row, bucket }) => {
      const gid = `g_${++groupIdCounter.current}`
      newSources[gid] = flattenSources(bucket)
      return { ...row, _uid: crypto.randomUUID(), _groupId: gid }
    })

    setGroupSources(prev => {
      const next = { ...prev }
      absorbedIds.forEach(id => delete next[id])
      Object.assign(next, newSources)
      return next
    })

    const drop = new Set(sorted)
    const insertAt = sorted[0]
    const next: APLineItem[] = []
    items.forEach((it, i) => {
      if (i === insertAt) mergedRows.forEach(r => next.push(r))
      if (!drop.has(i)) next.push(it)
    })
    extraction.setLineItems(next)
    return true
  }

  const removeItemWithUndo = (idx: number) => {
    const item = extraction.lineItems[idx]
    if (!item) return
    extraction.removeItem(idx)
    toast.dismiss()
    toast(t('ap.itemDeleted'), {
      duration: 5000,
      action: {
        label: t('ap.undo'),
        onClick: () => {
          extraction.setLineItems(prev => {
            const next = [...prev]
            next.splice(idx, 0, item)
            return next
          })
        },
      },
    })
  }

  const ungroupItems = () => {
    extraction.setLineItems(prev =>
      prev.flatMap(it =>
        it._groupId && groupSources[it._groupId] ? groupSources[it._groupId] : [it]
      )
    )
    setGroupSources({})
  }

  const handleReset = () => {
    extraction.resetExtraction()
    vendor.resetVendor()
    submission.resetGLLoaded()
    setGroupSources({})
    setStep(1)
    setModal({ show: false })
  }

  return {
    step,
    setStep,
    file: extraction.file,
    previewUrl: extraction.previewUrl,
    previewType: extraction.previewType,
    fileInputRef: extraction.fileInputRef,
    loading: extraction.loading,
    status: extraction.status,
    elapsed: extraction.elapsed,
    extractionStatus: extraction.extractionStatus,
    error: extraction.error,
    setError: extraction.setError,
    warnings: extraction.warnings,
    suggestLoading: submission.suggestLoading,
    headerData: extraction.headerData,
    lineItems: extraction.lineItems,
    fieldMappings: extraction.fieldMappings,
    setFieldMappings: extraction.setFieldMappings,
    masterAccounts: submission.masterAccounts,
    masterDepts: submission.masterDepts,
    systemVendor: vendor.systemVendor,
    setSystemVendor: vendor.setSystemVendor,
    vendorSearch: vendor.vendorSearch,
    setVendorSearch: vendor.setVendorSearch,
    showVendorDrop: vendor.showVendorDrop,
    setShowVendorDrop: vendor.setShowVendorDrop,
    filteredVendors: vendor.filteredVendors,
    vendorRefreshing: vendor.vendorRefreshing,
    refreshVendors: vendor.refreshVendors,
    taxProfiles,
    modal,
    setModal,
    sumLineSubTotal: validation.sumLineSubTotal,
    sumLineTotal: validation.sumLineTotal,
    sumDiscount: validation.sumDiscount,
    sumTax: validation.sumTax,
    tgtSubTotal: validation.tgtSubTotal,
    tgtDiscount: validation.tgtDiscount,
    tgtTax: validation.tgtTax,
    tgtGrand: validation.tgtGrand,
    isSubDiff: validation.isSubDiff,
    isDiscDiff: validation.isDiscDiff,
    isTaxDiff: validation.isTaxDiff,
    isGrandDiff: validation.isGrandDiff,
    isDocInconsistent: validation.isDocInconsistent,
    isInclude: validation.isInclude,
    calcGrandFromLines: validation.calcGrandFromLines,
    validationErrors: validation.validationErrors,
    isValid: validation.isValid,
    availableFields: validation.availableFields,
    activeCols: validation.activeCols,
    handleFileChange: extraction.handleFileChange,
    updateHeader: extraction.updateHeader,
    blurHeader,
    updateItem: extraction.updateItem,
    blurItem: extraction.blurItem,
    removeItem: removeItemWithUndo,
    confirmMapping,
    goToAccount,
    handleAISuggest: submission.handleAISuggest,
    handleAcceptAll: submission.handleAcceptAll,
    hasSuggestions: submission.hasSuggestions,
    allMapped: submission.allMapped,
    handleConfirmSuggest: submission.handleConfirmSuggest,
    handleRejectSuggest: submission.handleRejectSuggest,
    handleGenerate: submission.handleGenerate,
    isSubmitting: submission.isSubmitting,
    handleReset,
    adjustField,
    fixDocFigures,
    blurLineItem,
    changeLineTaxType,
    applyLineTax,
    invoiceSeq: submission.invoiceSeq,
    isDuplicate: extraction.isDuplicate,
    pdfInfoLoading: extraction.pdfInfoLoading,
    imageMerging: extraction.imageMerging,
    imageCount: extraction.imageCount,
    pdfSelector: extraction.pdfSelector,
    selectedPageThumbs: extraction.selectedPageThumbs,
    confirmPageSelection: extraction.confirmPageSelection,
    cancelPageSelection: extraction.cancelPageSelection,
    isGrouped,
    groupByDescription,
    ungroupItems,
    originalLineItemsCount,
  }
}
