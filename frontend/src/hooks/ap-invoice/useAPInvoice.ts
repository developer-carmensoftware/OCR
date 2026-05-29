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
import { useAPValidation } from './useAPValidation'
import { useAPSubmission } from './useAPSubmission'
import type { ModalState } from '../../types/modal'

export function useAPInvoice() {
  const [lang, setLang] = useState<APLocale>('en')
  const t = AP_I18N[lang]

  const [step, setStep] = useState(1)
  const [modal, setModal] = useState<ModalState>({ show: false })
  const [isGrouped, setIsGrouped] = useState(false)
  const [originalLineItems, setOriginalLineItems] = useState<APLineItem[] | null>(null)

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
    apInvoiceId: extraction.apInvoiceId,
    updateHeader: extraction.updateHeader,
  })

  useEffect(() => {
    vendor.loadVendors()
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

  const adjustField = (
    tgt: unknown,
    sumCur: unknown,
    itemKey: string,
    adjustTotal = false,
    isDiscount = false
  ) => {
    const updated = validation.adjustField(
      tgt,
      sumCur,
      itemKey,
      extraction.lineItems,
      adjustTotal,
      isDiscount
    )
    extraction.setLineItems(updated)
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
        ? extraction.lineItems.map(item => ({ ...item, taxAmt: '0.00', taxPct: '0.00' }))
        : validation.adjustField(tgt, sum, 'taxAmt', extraction.lineItems)
    // adjustField only writes taxAmt; reconcile lineTotal = lineSubTotal + taxAmt
    // so per-line totals stay consistent.
    const updated = adjusted.map(item => ({
      ...item,
      lineTotal: fmt(parseNum(item.lineSubTotal) + parseNum(item.taxAmt)),
    }))
    extraction.setLineItems(updated)
    // Keep the "From Document" header values fixed: blurHeader (line 130) already stored the
    // user-typed taxAmount. Do not re-sync taxAmount/grandTotal from line sums — that would
    // mutate the immutable document totals and hide any remaining grand-total diff.
  }

  // Fields whose blur triggers a full line recalculation.
  const RECALC_TRIGGERS = new Set(['qty', 'unitPrice', 'discountPct', 'discountAmt', 'taxPct'])

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

    const qty = parseNum(snap.qty) || 1
    const unitPrice = parseNum(snap.unitPrice)
    const taxType = (snap.taxType || 'Exclude') as 'Include' | 'Exclude' | 'None'
    // Clamp to >= 0 so the Include formula's (100 + taxPct) denominator can never hit 0
    // (taxPct <= -100 would otherwise produce Infinity/NaN).
    const taxPct = taxType === 'None' ? 0 : Math.max(0, parseNum(snap.taxPct) || 7)

    // discountPct → derive discountAmt; otherwise read discountAmt directly
    const discountAmt =
      field === 'discountPct'
        ? round2((qty * unitPrice * parseNum(snap.discountPct)) / 100)
        : parseNum(snap.discountAmt)

    const afterDisc = round2(qty * unitPrice - discountAmt)

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

    const updatedItem = {
      ...snap,
      [field]: formattedValue,
      discountAmt: fmt(discountAmt),
      lineSubTotal: fmt(lineSubTotal),
      taxAmt: fmt(taxAmt),
      lineTotal: fmt(lineTotal),
    }

    const updatedItems = extraction.lineItems.map((it, i) => (i === rowIndex ? updatedItem : it))
    extraction.setLineItems(updatedItems)
    // Do NOT sync header totals here. headerData.{subTotal,taxAmount,grandTotal} are the
    // immutable "From Document" values; the "From Table" column recomputes reactively via
    // useAPValidation. Overwriting them hid the reconciliation diff (and the submit gate).
  }

  // Recalculates only the changed row; leaves all other rows untouched.
  const changeLineTaxType = (rowIndex: number, newTaxType: 'Include' | 'Exclude' | 'None') => {
    const updatedItems = extraction.lineItems.map((item, i) => {
      if (i !== rowIndex) return item

      const qty = parseNum(item.qty) || 1
      const unitPrice = parseNum(item.unitPrice)
      const discountAmt = parseNum(item.discountAmt)
      // Clamp to >= 0 so the Include formula's (100 + taxPct) denominator can never hit 0.
      const taxPct = newTaxType === 'None' ? 0 : Math.max(0, parseNum(item.taxPct) || 7)

      // Use lineSubTotal + discountAmt as the invariant net value across all tax types.
      // lineSubTotal is always "before VAT", so it's the safe anchor when unitPrice is missing.
      const afterDisc =
        unitPrice > 0
          ? round2(qty * unitPrice - discountAmt)
          : round2(parseNum(item.lineSubTotal) + discountAmt)

      let lineSubTotal: number, taxAmt: number, lineTotal: number, newTaxPct: number

      if (newTaxType === 'None') {
        lineSubTotal = afterDisc
        taxAmt = 0
        lineTotal = afterDisc
        newTaxPct = 0
      } else if (newTaxType === 'Include') {
        newTaxPct = taxPct
        lineSubTotal = round2((afterDisc * 100) / (100 + taxPct))
        taxAmt = round2(afterDisc - lineSubTotal)
        lineTotal = afterDisc
      } else {
        newTaxPct = taxPct
        lineSubTotal = afterDisc
        taxAmt = round2((lineSubTotal * taxPct) / 100)
        lineTotal = round2(lineSubTotal + taxAmt)
      }

      return {
        ...item,
        lineSubTotal: fmt(lineSubTotal),
        taxAmt: fmt(taxAmt),
        lineTotal: fmt(lineTotal),
        taxPct: fmt(newTaxPct),
        taxType: newTaxType,
      }
    })

    extraction.setLineItems(updatedItems)
  }

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
