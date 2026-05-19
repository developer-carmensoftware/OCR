import { useState, useEffect } from 'react'
import { AP_I18N } from '../constants/apInvoice'
import type { APLocale } from '../constants/apInvoice'
import { showToast } from '../lib/toast'
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
    blurHeader: extraction.blurHeader,
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
    invoiceSeq: submission.invoiceSeq,
    isDuplicate: extraction.isDuplicate,
  }
}
