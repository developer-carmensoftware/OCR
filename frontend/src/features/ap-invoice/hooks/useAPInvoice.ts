import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useT } from '@/i18n/LanguageContext'
import { showToast } from '@/shared/lib/toast'
import { parseNum, fmt, round2 } from '@/shared/lib/format'
import { saveAPVendorMapping } from '@/shared/api/config'
import { appKey } from '@/shared/lib/storage'
import { clearDraft } from '@/shared/lib/draft'
import { useAPExtraction } from './useAPExtraction'
import { useAPVendor } from './useAPVendor'
import { useAPValidation, reconcileRows, repairDocFigure } from './useAPValidation'
import { useAPDraft } from './useAPDraft'
import { useAPGrouping } from './useAPGrouping'
import { applyTaxPatch, matchTaxProfiles, recalcRow, syncLineTotals } from '@/shared/lib/apTax'
import { isAccountAllowed } from '@/shared/lib/deptAccounts'
import { useAPSubmission } from './useAPSubmission'
import { fetchTaxProfiles } from '@/shared/api/carmen'
import type { TaxProfileItem } from '@/shared/api/carmen'
import type { ModalState } from '@/shared/types/modal'

export function useAPInvoice() {
  const { t } = useT()

  const [step, setStep] = useState(1)
  const [modal, setModal] = useState<ModalState>({ show: false })
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

  const grouping = useAPGrouping({ extraction, t })

  useEffect(() => {
    vendor.loadVendors()
    fetchTaxProfiles()
      .then(setTaxProfiles)
      .catch(() => {})
  }, [vendor.loadVendors])

  useAPDraft({
    step,
    setStep,
    setModal,
    extraction,
    vendor,
    groupSources: grouping.groupSources,
    setGroupSources: grouping.setGroupSources,
    loadGLData: submission.loadGLData,
  })

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

    if (!taxProfiles.length) return

    extraction.setLineItems(prev => matchTaxProfiles(prev, taxProfiles, vendorTaxProfile))
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

  // recalcRow (the per-row Include/Exclude/None formula) lives in shared/lib/apTax so the hook,
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
    const headerTaxType = extraction.headerData.taxType

    extraction.setLineItems(prev =>
      prev.map((it, i) =>
        i === rowIndex ? applyTaxPatch(it, patch, taxProfiles, headerTaxType) : it
      )
    )
  }

  // Tax Type select routes through the shared interlock.
  const changeLineTaxType = (rowIndex: number, newTaxType: 'Include' | 'Exclude' | 'None') =>
    applyLineTax(rowIndex, { taxType: newTaxType })

  // Changing a row's dept to one whose DefaultAccount forbids the current account clears it.
  const updateItemChecked = (idx: number, key: string, val: string) => {
    extraction.updateItem(idx, key, val)
    if (key === 'deptCode') {
      const acc = extraction.lineItems[idx]?.accountCode
      if (acc && !isAccountAllowed(val, acc, submission.masterDepts)) {
        extraction.updateItem(idx, 'accountCode', '')
      }
    }
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

  const handleReset = () => {
    extraction.resetExtraction()
    vendor.resetVendor()
    submission.resetGLLoaded()
    grouping.setGroupSources({})
    setStep(1)
    clearDraft('ap')
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
    updateItem: updateItemChecked,
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
    isGrouped: grouping.isGrouped,
    groupByDescription: grouping.groupByDescription,
    ungroupItems: grouping.ungroupItems,
    originalLineItemsCount: grouping.originalLineItemsCount,
  }
}
