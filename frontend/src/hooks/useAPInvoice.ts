import { useState, useEffect } from 'react'
import { AP_I18N } from '../constants/apInvoice'
import type { APLocale } from '../constants/apInvoice'
import { showToast } from '../lib/toast'
import { parseNum, fmt, round2 } from '../lib/format'
import { saveAPVendorMapping } from '../lib/api/config'
import { useAPExtraction } from './ap/useAPExtraction'
import { useAPVendor } from './ap/useAPVendor'
import { useAPValidation } from './ap/useAPValidation'
import { useAPSubmission } from './ap/useAPSubmission'

export function useAPInvoice() {
  const [lang, setLang] = useState<APLocale>('en')
  const t = AP_I18N[lang]

  const [step, setStep] = useState(1)
  const [modal, setModal] = useState<Record<string, unknown>>({ show: false })

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
    if (tgt === 0) {
      extraction.setLineItems(prev =>
        prev.map(item => ({ ...item, taxAmt: '0.00', taxPct: '0.00' }))
      )
    } else {
      extraction.setLineItems(validation.adjustField(tgt, sum, 'taxAmt', extraction.lineItems))
    }
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
    const taxPct = taxType === 'None' ? 0 : parseNum(snap.taxPct) || 7

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

    // Sync header summary totals
    extraction.updateHeader(
      'taxAmount',
      fmt(updatedItems.reduce((s, it) => s + parseNum(it.taxAmt), 0))
    )
    extraction.updateHeader(
      'grandTotal',
      fmt(updatedItems.reduce((s, it) => s + parseNum(it.lineTotal), 0))
    )
    extraction.updateHeader(
      'subTotal',
      fmt(updatedItems.reduce((s, it) => s + parseNum(it.lineSubTotal), 0))
    )
  }

  // Recalculates only the changed row; leaves all other rows untouched.
  const changeLineTaxType = (rowIndex: number, newTaxType: 'Include' | 'Exclude' | 'None') => {
    const updatedItems = extraction.lineItems.map((item, i) => {
      if (i !== rowIndex) return item

      const qty = parseNum(item.qty) || 1
      const unitPrice = parseNum(item.unitPrice)
      const discountAmt = parseNum(item.discountAmt)
      const currentTaxType = (item.taxType || 'Exclude') as 'Include' | 'Exclude' | 'None'
      const taxPct = newTaxType === 'None' ? 0 : parseNum(item.taxPct) || 7

      const afterDisc =
        unitPrice > 0
          ? round2(qty * unitPrice - discountAmt)
          : currentTaxType === 'Include'
            ? parseNum(item.lineTotal)
            : parseNum(item.lineSubTotal)

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
    extraction.updateHeader(
      'taxAmount',
      fmt(updatedItems.reduce((s, i) => s + parseNum(i.taxAmt), 0))
    )
    extraction.updateHeader(
      'grandTotal',
      fmt(updatedItems.reduce((s, i) => s + parseNum(i.lineTotal), 0))
    )
    extraction.updateHeader(
      'subTotal',
      fmt(updatedItems.reduce((s, i) => s + parseNum(i.lineSubTotal), 0))
    )
  }

  const handleReset = () => {
    extraction.resetExtraction()
    vendor.resetVendor()
    submission.resetGLLoaded()
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
    confirmMapping,
    goToAccount,
    handleAISuggest: submission.handleAISuggest,
    handleAcceptAll: submission.handleAcceptAll,
    hasSuggestions: submission.hasSuggestions,
    allMapped: submission.allMapped,
    handleConfirmSuggest: submission.handleConfirmSuggest,
    handleRejectSuggest: submission.handleRejectSuggest,
    handleGenerate: submission.handleGenerate,
    handleReset,
    adjustField,
    blurLineItem,
    changeLineTaxType,
    invoiceSeq: submission.invoiceSeq,
    isDuplicate: extraction.isDuplicate,
  }
}
