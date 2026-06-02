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

  // Auto-match each taxable line's Tax Profile to its extracted rate, falling back to the vendor
  // default. On an exact rate match the totals are already correct, so only the code is set. On a
  // vendor fallback the line's Tax% is snapped to the vendor profile's rate (and the row recalced)
  // so Tax% stays a valid dropdown option — Tax% can only ever be a configured profile rate.
  // None lines are left untouched (no profile = correct). The `changed` flag prevents a render
  // loop: lines with no resolvable code stay empty and are not retried until one is available.
  useEffect(() => {
    if (!taxProfiles.length) return
    const vendorDefault = vendor.systemVendor.taxProfileCode1 || ''
    const rateOf = (code: string) => taxProfiles.find(p => p.code === code)?.rate ?? null
    extraction.setLineItems(prev => {
      if (!prev.length) return prev
      let changed = false
      const next = prev.map(it => {
        if (it.taxType === 'None') return it
        if (it.taxProfileCode1) {
          const existingRate = rateOf(it.taxProfileCode1)
          if (existingRate == null || Math.abs(existingRate - parseNum(it.taxPct)) < 0.01) return it
        }
        const rate = parseNum(it.taxPct)
        const match = taxProfiles.find(p => p.rate != null && Math.abs(p.rate - rate) < 0.01)
        if (match) {
          changed = true
          return { ...it, taxProfileCode1: match.code }
        }
        if (vendorDefault) {
          changed = true
          const vr = rateOf(vendorDefault)
          return recalcRow({
            ...it,
            taxProfileCode1: vendorDefault,
            taxPct: vr != null ? String(vr) : it.taxPct,
          })
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

  // adjustField (validation) writes a single field onto the target row(s); reconcileRows
  // (shared, in useAPValidation) re-derives the dependent field per taxType so every row
  // stays internally consistent and fixing one summary line never opens another.
  const adjustField = (tgt: unknown, sumCur: unknown, itemKey: string) => {
    const updated = validation.adjustField(tgt, sumCur, itemKey, extraction.lineItems)
    // discountAmt is informational (lineSubTotal is already net); reconciling it is a no-op,
    // so a single reconcile pass is safe for every field.
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
    const adjusted =
      tgt === 0
        ? extraction.lineItems.map(item => ({
            ...item,
            taxAmt: '0.00',
            taxPct: '0.00',
            taxType: 'None' as const,
          }))
        : validation.adjustField(tgt, sum, 'taxAmt', extraction.lineItems)
    // adjustField only writes taxAmt; reconcile per-line totals so they stay consistent.
    extraction.setLineItems(reconcileRows(adjusted))
    // Keep the "From Document" header values fixed: blurHeader above already stored the
    // user-typed taxAmount. Do not re-sync taxAmount/grandTotal from line sums — that would
    // mutate the immutable document totals and hide any remaining grand-total diff.
  }

  // Fields whose blur triggers a full line recalculation.
  const RECALC_TRIGGERS = new Set(['qty', 'unitPrice', 'discountPct', 'discountAmt', 'taxPct'])

  // Pure per-row recalculation of lineSubTotal/taxAmt/lineTotal from qty/unitPrice/discount, the
  // row's taxType and its taxPct. taxPct is clamped >= 0 and forced to 0 for None. Uses
  // lineSubTotal + discountAmt as the net anchor when unitPrice is missing (e.g. grouped rows).
  const recalcRow = (item: APLineItem): APLineItem => {
    const qty = parseNum(item.qty) || 1
    const unitPrice = parseNum(item.unitPrice)
    const discountAmt = parseNum(item.discountAmt)
    const taxType = (item.taxType || 'Exclude') as 'Include' | 'Exclude' | 'None'
    const taxPct = taxType === 'None' ? 0 : Math.max(0, parseNum(item.taxPct))

    const afterDisc =
      unitPrice > 0
        ? round2(qty * unitPrice - discountAmt)
        : round2(parseNum(item.lineSubTotal) + discountAmt)

    let lineSubTotal: number, taxAmt: number, lineTotal: number
    if (taxType === 'None') {
      lineSubTotal = afterDisc
      taxAmt = 0
      lineTotal = afterDisc
    } else if (taxType === 'Include') {
      lineSubTotal = round2((afterDisc * 100) / (100 + taxPct))
      taxAmt = round2(afterDisc - lineSubTotal)
      lineTotal = afterDisc
    } else {
      lineSubTotal = afterDisc
      taxAmt = round2((lineSubTotal * taxPct) / 100)
      lineTotal = round2(lineSubTotal + taxAmt)
    }

    return {
      ...item,
      taxType,
      taxPct: fmt(taxPct),
      lineSubTotal: fmt(lineSubTotal),
      taxAmt: fmt(taxAmt),
      lineTotal: fmt(lineTotal),
    }
  }

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

        let code = merged.taxProfileCode1 || ''
        let rate = parseNum(merged.taxPct)
        if (patch.taxProfileCode1) {
          const r = rateOf(code) // profile drives the rate
          if (r != null) rate = r
        } else if (patch.taxPct !== undefined) {
          if (rateOf(code) !== rate) code = codeForRate(rate) || code // rate drives the profile
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
