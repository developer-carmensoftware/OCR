import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { AP_I18N } from '../../constants/apInvoice'
import type { APLocale } from '../../constants/apInvoice'
import { showToast } from '../../lib/toast'
import { parseNum, fmt, round2 } from '../../lib/format'
import { saveAPVendorMapping } from '../../lib/api/config'
import { useAPExtraction } from './useAPExtraction'
import type { APLineItem } from './useAPExtraction'
import { useAPVendor } from './useAPVendor'
import { useAPValidation, reconcileRows } from './useAPValidation'
import { recalcRow, nudgeAnchorForTarget } from '../../lib/apTax'
import { useAPSubmission } from './useAPSubmission'
import { fetchTaxProfiles } from '../../lib/api/carmen'
import type { TaxProfileItem } from '../../lib/api/carmen'
import type { ModalState } from '../../types/modal'

export function useAPInvoice() {
  const [lang, setLang] = useState<APLocale>('en')
  const t = AP_I18N[lang]

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
  }, [extraction.headerData.vendorTaxId, lang, vendor.vendorDbByTax])

  useEffect(() => {
    if (step === 4) submission.loadGLData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Auto-match each taxable line's Tax Profile to its extracted rate. On an exact rate match the
  // code is set (totals already correct). When NO profile defines the line's rate, the extracted
  // rate is kept and the profile is left blank — we never silently rewrite a valid rate (e.g. 10%)
  // to the vendor default; the UI surfaces an "unmatched rate" warning instead. None lines are left
  // untouched. The `changed` flag prevents a render loop: unresolvable lines stay as-is.
  useEffect(() => {
    if (!taxProfiles.length) return
    const rateOf = (code: string) => taxProfiles.find(p => p.code === code)?.rate ?? null
    extraction.setLineItems(prev => {
      if (!prev.length) return prev
      let changed = false
      const next = prev.map(it => {
        if (it.taxType === 'None') return it
        // Keep an already-set profile when its rate still matches the line.
        if (it.taxProfileCode1) {
          const existingRate = rateOf(it.taxProfileCode1)
          if (existingRate == null || Math.abs(existingRate - parseNum(it.taxPct)) < 0.01) return it
        }
        const rate = parseNum(it.taxPct)
        const match = taxProfiles.find(p => p.rate != null && Math.abs(p.rate - rate) < 0.01)
        if (match && it.taxProfileCode1 !== match.code) {
          changed = true
          return { ...it, taxProfileCode1: match.code }
        }
        return it
      })
      return changed ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxProfiles, vendor.systemVendor.taxProfileCode1])

  const confirmMapping = () => {
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

  // Adjust button. Sub-Total / Grand-Total are rate-based: the diff is landed on the last taxable
  // row's net anchor and the row is re-derived through recalcRow, so it stays internally consistent
  // (sub + tax = total) and the targeted From-Table sum lands on the document value — when the
  // document itself is consistent (sub + tax = grand) the related diffs clear in one click.
  // taxAmt (genuine penny-rounding, tax ≠ sub×rate) and discountAmt (informational) keep the
  // single-field write + reconcileRows path.
  const adjustField = (tgt: unknown, sumCur: unknown, itemKey: string) => {
    const items = extraction.lineItems
    if (!items.length) return

    if (itemKey === 'lineSubTotal' || itemKey === 'lineTotal') {
      const diff = round2(tgt) - round2(sumCur)
      if (Math.abs(diff) < 0.005) return
      // Prefer the last taxable row so the rate recompute is meaningful; fall back to the last row.
      let idx = items.length - 1
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].taxType !== 'None' && parseNum(items[i].taxPct) > 0) {
          idx = i
          break
        }
      }
      const kind = itemKey === 'lineSubTotal' ? ('sub' as const) : ('grand' as const)
      extraction.setLineItems(prev =>
        prev.map((it, i) => (i === idx ? nudgeAnchorForTarget(it, kind, diff) : it))
      )
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
  //   • profile '' (or taxType None)        → non-VAT: clear profile, taxPct 0
  //   • profile = real code                 → taxPct := that profile's rate; un-None to Exclude
  //   • taxPct = rate                        → profile := first profile with that rate (keep current if it matches)
  //   • taxType None → Include/Exclude       → adopt the vendor default profile + its rate
  const applyLineTax = (
    rowIndex: number,
    patch: { taxType?: 'Include' | 'Exclude' | 'None'; taxProfileCode1?: string; taxPct?: string }
  ) => {
    const vendorDefault = vendor.systemVendor.taxProfileCode1 || ''
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
          if (patch.taxProfileCode1 === '') taxType = 'None'
          else if (taxType === 'None') {
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
        } else if (!code) {
          code = vendorDefault // None → taxable: adopt vendor default
          const r = rateOf(code)
          if (r != null) rate = r
        }

        return recalcRow({ ...merged, taxType, taxProfileCode1: code, taxPct: String(rate) })
      })
    )
  }

  // Tax Type select routes through the shared interlock.
  const changeLineTaxType = (rowIndex: number, newTaxType: 'Include' | 'Exclude' | 'None') =>
    applyLineTax(rowIndex, { taxType: newTaxType })

  // Builds a single line that represents the sum of `items`, keeping the row
  // internally consistent under the blurLineItem recalc rules:
  //   afterDisc = qty * unitPrice - discountAmt
  //   Exclude/None: lineSubTotal = afterDisc
  //   Include:      lineTotal    = afterDisc
  const buildGroupedRow = (items: APLineItem[], desc: string): APLineItem => {
    const sum = (key: keyof APLineItem) =>
      items.reduce((s, it) => s + parseNum(it[key] as string), 0)
    const sumLineTotal = sum('lineTotal')
    const sumLineSubTotal = sum('lineSubTotal')
    const sumTaxAmt = sum('taxAmt')
    const sumDiscount = sum('discountAmt')
    const taxType = items[0]?.taxType || 'Exclude'
    const taxPct = taxType === 'None' ? 0 : parseNum(items[0]?.taxPct as string) || 7
    const unitPrice =
      taxType === 'Include' ? sumLineTotal + sumDiscount : sumLineSubTotal + sumDiscount
    return {
      description: desc,
      category: '',
      qty: '1',
      unitPrice: fmt(unitPrice),
      discountPct: '0.00',
      discountAmt: fmt(sumDiscount),
      lineSubTotal: fmt(sumLineSubTotal),
      taxPct: fmt(taxPct),
      taxAmt: fmt(sumTaxAmt),
      taxType,
      lineTotal: fmt(sumLineTotal),
      deptCode: '',
      accountCode: '',
    }
  }

  const groupItems = (desc: string) => {
    const items = extraction.lineItems
    if (items.length <= 1) return
    setOriginalLineItems(items)
    extraction.setLineItems([buildGroupedRow(items, desc)])
    setIsGrouped(true)
  }

  const groupAllItems = () => {
    groupItems('Group all items')
  }

  const TAX_TYPE_LABELS: Record<string, string> = {
    Include: 'Items (Include VAT)',
    Exclude: 'Items (Exclude VAT)',
    None: 'Items (No VAT)',
  }

  const groupItemsByTaxType = () => {
    const items = extraction.lineItems
    if (items.length <= 1) return
    const groups = new Map<string, APLineItem[]>()
    for (const item of items) {
      const key = item.taxType || 'Exclude'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(item)
    }
    const grouped: APLineItem[] = Array.from(groups.entries()).map(([taxType, grpItems]) =>
      buildGroupedRow(grpItems, TAX_TYPE_LABELS[taxType] ?? `Items (${taxType})`)
    )
    setOriginalLineItems(items)
    extraction.setLineItems(grouped)
    setIsGrouped(true)
  }

  const hasMixedTaxTypes = useMemo(() => {
    const types = new Set(extraction.lineItems.map(it => it.taxType || 'Exclude'))
    return types.size > 1
  }, [extraction.lineItems])

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
    lang,
    setLang,
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
    isGrouped,
    groupAllItems,
    groupItemsByTaxType,
    hasMixedTaxTypes,
    ungroupItems,
    originalLineItemsCount: originalLineItems?.length ?? 0,
  }
}
