import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { AP_I18N } from '../../constants/apInvoice'
import { showToast } from '../../lib/toast'
import { parseNum, fmt, round2 } from '../../lib/format'
import { saveAPVendorMapping } from '../../lib/api/config'
import { useAPExtraction } from './useAPExtraction'
import type { APLineItem } from './useAPExtraction'
import { useAPVendor } from './useAPVendor'
import { useAPValidation, reconcileRows } from './useAPValidation'
import { recalcRow, syncLineTotals, resolveTaxProfileForRate } from '../../lib/apTax'
import { buildGroupedRow, groupByTaxProfile, allSameProfile } from '../../lib/apGroup'
import { useAPSubmission } from './useAPSubmission'
import { fetchTaxProfiles } from '../../lib/api/carmen'
import type { TaxProfileItem } from '../../lib/api/carmen'
import type { ModalState } from '../../types/modal'

export function useAPInvoice() {
  const t = AP_I18N

  const [step, setStep] = useState(1)
  const [modal, setModal] = useState<ModalState>({ show: false })
  const [isGrouped, setIsGrouped] = useState(false)
  const [originalLineItems, setOriginalLineItems] = useState<APLineItem[] | null>(null)
  const [taxProfiles, setTaxProfiles] = useState<TaxProfileItem[]>([])

  const extraction = useAPExtraction({ t, setStep, setModal })

  const vendor = useAPVendor({ t, headerData: extraction.headerData })

  const validation = useAPValidation({
    t,
    headerData: extraction.headerData,
    lineItems: extraction.lineItems,
    fieldMappings: extraction.fieldMappings,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (vendor.showVendorDrop) return
    vendor.autoMatchVendor(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraction.headerData.vendorTaxId, vendor.vendorDbByTax])

  useEffect(() => {
    if (step === 4) submission.loadGLData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxProfiles, extraction.lineItems.length, vendorTaxProfile])

  const confirmMapping = () => {
    const mappedValues = Object.values(extraction.fieldMappings)
    if (!mappedValues.includes('description') || !mappedValues.includes('lineTotal')) {
      showToast(t.warnMissingMapping, 'warning')
      return
    }
    const taxId = extraction.headerData.vendorTaxId
    if (taxId) {
      saveAPVendorMapping(
        taxId,
        extraction.fieldMappings as unknown as Parameters<typeof saveAPVendorMapping>[1]
      ).catch(() => {})
      try {
        const savedAll = JSON.parse(localStorage.getItem('ap_invoice_mapping') || '{}') as Record<
          string,
          unknown
        >
        savedAll[taxId] = extraction.fieldMappings
        localStorage.setItem('ap_invoice_mapping', JSON.stringify(savedAll))
      } catch {
        /* ignore */
      }
    }
    showToast('Column settings saved', 'success')
    setStep(3)
  }

  const goToAccount = () => {
    if (!vendor.systemVendor.code) {
      showToast(t.warnSelectVendor, 'warning')
      return
    }
    if (!validation.isValid) {
      setModal({
        show: true,
        type: 'warning',
        title: t.mismatchTitle,
        message: t.warnMismatch,
        confirmText: t.proceed,
        cancelText: t.backEdit,
        onConfirm: () => {
          setModal({ show: false })
          setStep(4)
        },
        onCancel: () => setModal({ show: false }),
      })
    } else {
      setStep(4)
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
  const adjustField = (tgt: unknown, sumCur: unknown, itemKey: string) => {
    const items = extraction.lineItems
    if (!items.length) return

    if (itemKey === 'lineSubTotal' || itemKey === 'taxAmt') {
      const updated = validation.adjustField(tgt, sumCur, itemKey, items)
      extraction.setLineItems(syncLineTotals(updated))
      return
    }

    if (itemKey === 'lineTotal') {
      // The sub step writes only lineSubTotal, so Σtax is still validation.sumTax for the tax step.
      let updated = validation.adjustField(
        round2(extraction.headerData.subTotal),
        validation.sumLineSubTotal,
        'lineSubTotal',
        items
      )
      updated = validation.adjustField(
        round2(extraction.headerData.taxAmount),
        validation.sumTax,
        'taxAmt',
        updated
      )
      extraction.setLineItems(syncLineTotals(updated))
      return
    }

    const updated = validation.adjustField(tgt, sumCur, itemKey, items)
    extraction.setLineItems(reconcileRows(updated))
  }

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

  // Group all: collapse into one row per distinct (taxType, tax profile). Reuses the same totals
  // aggregation as Group by description via the shared apGroup helpers.
  const groupAllItems = () => {
    const items = extraction.lineItems
    if (items.length <= 1) return
    const grouped = groupByTaxProfile(items)
    if (!originalLineItems) setOriginalLineItems(items)
    extraction.setLineItems(grouped)
    setIsGrouped(true)
  }

  // Group by description: merge the user-selected subset of rows into one row, named by the
  // user-supplied description (set in the Group modal). All selected rows must share one tax profile
  // — otherwise we reject with a toast and leave the table untouched. Partial and repeatable:
  // unselected rows stay individual, and originalLineItems is captured only on the first grouping so
  // Ungroup restores all.
  const groupByDescription = (indices: number[], description: string): boolean => {
    const items = extraction.lineItems
    if (indices.length < 2) return false
    const sorted = [...indices].sort((a, b) => a - b)
    const selected = sorted.map(i => items[i])
    if (!allSameProfile(selected)) {
      showToast(t.groupSameProfile, 'error')
      return false
    }
    const desc = description.trim() || items[sorted[0]]?.description || 'Grouped items'
    const merged = buildGroupedRow(selected, desc)
    const drop = new Set(sorted)
    const next: APLineItem[] = []
    items.forEach((it, i) => {
      if (i === sorted[0]) next.push(merged)
      else if (!drop.has(i)) next.push(it)
    })
    if (!originalLineItems) setOriginalLineItems(items)
    extraction.setLineItems(next)
    setIsGrouped(true)
    return true
  }

  const removeItemWithUndo = (idx: number) => {
    const item = extraction.lineItems[idx]
    if (!item) return
    extraction.removeItem(idx)
    toast.dismiss()
    toast('Item deleted', {
      duration: 5000,
      action: {
        label: 'Undo',
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
    if (originalLineItems) {
      extraction.setLineItems(originalLineItems)
      setOriginalLineItems(null)
    }
    setIsGrouped(false)
  }

  const handleReset = () => {
    extraction.resetExtraction()
    vendor.resetVendor()
    submission.resetGLLoaded()
    setIsGrouped(false)
    setOriginalLineItems(null)
    setStep(1)
    setModal({ show: false })
  }

  return {
    t,
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
    groupAllItems,
    groupByDescription,
    ungroupItems,
    originalLineItemsCount: originalLineItems?.length ?? 0,
  }
}
