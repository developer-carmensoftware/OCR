import { useState, useEffect, useRef, useMemo } from 'react'
import {
  EMPTY_HEADER, DEFAULT_MAPPINGS,
  fmt, round2, isNumFld, getAvailableFields, AP_I18N, parseNum,
} from '../constants/apInvoice'
import { fetchAccountCodes, fetchDepartments, submitAPInvoiceToCarmen } from '../lib/api/carmen'
import { apiFetch } from '../lib/api/client'
import { toast } from 'sonner'

function parseDateToISO(dateStr) {
  if (!dateStr) return new Date().toISOString()
  const parts = dateStr.split('/')
  if (parts.length !== 3) return new Date().toISOString()
  const [dd, mm, yyyy] = parts
  const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`)
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

function addDays(isoDate, days) {
  const d = new Date(isoDate)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

function buildInvoicePayload(headerData, lineItems, systemVendor) {
  const now = new Date().toISOString()
  const invDate = parseDateToISO(headerData.documentDate)
  const creditTerm = systemVendor.term ?? 0
  const dueDate = creditTerm > 0 ? addDays(invDate, creditTerm) : invDate
  const parts = (headerData.documentDate || '').split('/')
  const taxPeriod = parts.length === 3 ? `${parts[1]}/${parts[2]}` : ''

  const detail = lineItems.map(item => {
    const netAmt = parseNum(item.lineSubTotal)
    const taxAmt = parseNum(item.taxAmt)
    const total = parseNum(item.lineTotal)
    const taxRate = parseNum(item.taxPct) || 7
    const qty = parseNum(item.qty) || 1

    // Send net unit price (after discount) to Carmen — no separate discount field needed
    const grossPrice = parseNum(item.unitPrice)
    const discAmt = parseNum(item.discountAmt)
    const grossLine = grossPrice * qty
    const netPrice = grossLine > 0
      ? parseFloat(((grossLine - discAmt) / qty).toFixed(2))
      : grossPrice

    return {
      InvhSeq: -1,
      InvdSeq: -1,
      InvdDesc: item.description || '',
      InvdQty: qty,
      UnitCode: 'UNIT',
      InvdPrice: netPrice.toFixed(2),
      InvdTaxA1: taxAmt.toFixed(2),
      InvdTaxC1: taxAmt.toFixed(2),
      InvdTaxA2: '0.00',
      InvdTaxC2: '0.00',
      NetAmt: netAmt.toFixed(2),
      NetBaseAmt: netAmt.toFixed(2),
      UnPaid: total.toFixed(2),
      TotalPrice: total.toFixed(2),
      DeptCode: item.deptCode || '',
      InvdBTaxCr1: systemVendor.vatCrAccCode || '',
      InvdBTaxDr: systemVendor.vat1DrAccCode || '',
      InvdT1Dr: item.accountCode || '',
      InvdT2Dr: '',
      InvdTaxT1: headerData.taxType === 'Include' ? 'Include' : 'Add',
      InvdTaxR1: taxRate.toFixed(2),
      InvdTaxT2: 'None',
      InvdTaxR2: '0.00',
      DimList: {},
      LastModified: now,
      InvdBTaxCr1DeptCode: systemVendor.crDeptCode || '',
      InvdT1DrDeptCode: item.deptCode || '',
      InvdT2DrDeptCode: item.deptCode || '',
      TaxProfileCode1: systemVendor.taxProfileCode1 || null,
      TaxProfileCode2: null,
      Tax1Overwrite: false,
      Tax2Overwrite: false,
    }
  })

  return {
    VnCode: systemVendor.code || '',
    InvhDate: now,
    InvhDesc: headerData.invhDesc || '',
    InvhSource: 'OAPI',
    InvhInvNo: headerData.documentNumber || '',
    InvhInvDate: invDate,
    InvhDueDate: dueDate,
    InvhCredit: creditTerm,
    CurCode: 'THB',
    CurRate: 1,
    InvhTInvNo: headerData.documentNumber || '',
    InvhTInvDt: invDate,
    TaxPeriod: taxPeriod,
    TaxStatus: 'Pending',
    InvhTotalAmt: parseNum(headerData.grandTotal),
    InvWht: {},
    DimHList: {},
    Detail: detail,
    InvhStatus: '',
    VoidRemark: '',
  }
}

export function useAPInvoice() {
  const [lang, setLang] = useState('en')
  const t = AP_I18N[lang]
  const showToast = (msg, type = 'info') => {
    if (type === 'success') toast.success(msg)
    else if (type === 'error') toast.error(msg)
    else if (type === 'warning') toast.warning(msg)
    else toast.info(msg)
  }

  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewType, setPreviewType] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState(null)

  const [headerData, setHeaderData] = useState(EMPTY_HEADER)
  const [lineItems, setLineItems] = useState([])
  const [fieldMappings, setFieldMappings] = useState(DEFAULT_MAPPINGS)

  const [systemVendor, setSystemVendor] = useState({ code: '', name: '' })
  const [vendorSearch, setVendorSearch] = useState('')
  const [showVendorDrop, setShowVendorDrop] = useState(false)
  const [vendors, setVendors] = useState([])
  const [vendorDbByTax, setVendorDbByTax] = useState({})

  const [suggestLoading, setSuggestLoading] = useState(false)
  const [vendorRefreshing, setVendorRefreshing] = useState(false)
  const [invoiceSeq, setInvoiceSeq] = useState(null)
  const [masterAccounts, setMasterAccounts] = useState([])
  const [masterDepts, setMasterDepts] = useState([])
  const [glLoaded, setGlLoaded] = useState(false)
  const [modal, setModal] = useState({ show: false })
  const [isDuplicate, setIsDuplicate] = useState(false)
  const [apInvoiceId, setApInvoiceId] = useState(null)

  const fileInputRef = useRef(null)
  const previewUrlRef = useRef(null)

  const loadVendors = async (setRefreshing = false) => {
    if (setRefreshing) setVendorRefreshing(true)
    try {
      const r = await apiFetch('/api/v1/ocr/carmen/vendors')
      const data = await r.json()
      const list = (data.Data || []).map(v => ({
        code: v.VnCode || '',
        name: v.VnName || '',
        taxId: String(v.VnTaxNo || '').replace(/\D/g, ''),
        active: v.Active,
        catCode: v.VnCateCode,
        catDesc: v.VnCateDesc,
        vat1DrAccCode: v.VnVat1DrAccCode,
        vat1DrAccDesc: v.VnVat1DrAccDesc,
        vat1DrDeptCode: v.VnVat1DrDeptCode,
        vat1DrDeptDesc: v.VnVat1DrDeptDesc,
        vatCrAccCode: v.VnVatCrAccCode,
        vatCrAccDesc: v.VnVatCrAccDesc,
        crDeptCode: v.VnCrDeptCode,
        crDeptDesc: v.VnCrDeptDesc,
        taxProfileCode1: v.TaxProfileCode1,
        taxProfileDesc1: v.TaxProfileDesc1,
        branchNo: v.BranchNo,
        term: v.VnTerm ?? 0,
      }))
      setVendors(list)
      const db = {}
      list.forEach(v => { if (v.taxId) db[v.taxId] = v })
      setVendorDbByTax(db)
      if (setRefreshing) showToast('Vendor list updated', 'success')
    } catch {
      if (setRefreshing) showToast('Failed to load vendor list', 'error')
    } finally {
      if (setRefreshing) setVendorRefreshing(false)
    }
  }

  const refreshVendors = () => loadVendors(true)

  useEffect(() => {
    if (step !== 4 || glLoaded) return
    setGlLoaded(true)
    Promise.all([fetchAccountCodes(), fetchDepartments()])
      .then(([accs, depts]) => {
        setMasterAccounts(
          accs.filter(a => a.AccCode && a.AccCode !== 'AccCode')
            .map(a => ({ code: a.AccCode, name: a.Description || '', name2: a.Description2 || '' }))
        )
        setMasterDepts(
          depts.filter(d => d.DeptCode && d.DeptCode !== 'CodeDep')
            .map(d => ({ code: d.DeptCode, name: d.Description || '', name2: d.Description2 || '' }))
        )
      })
      .catch(() => { })
  }, [step])

  useEffect(() => {
    if (showVendorDrop) return
    const raw = String(headerData.vendorTaxId).replace(/\D/g, '')
    const found = vendorDbByTax[raw]
    if (found && found.active !== false) {
      setSystemVendor(found)
      setVendorSearch(`${found.code} — ${found.name} | TaxID : ${found.taxId || '—'} | Branch No. : ${String(found.branchNo ?? '—').padStart(5, '0')}`)
    } else if (raw.length >= 10) {
      setSystemVendor({ code: '', name: t.vendorNotFound })
      setVendorSearch('')
    } else {
      setSystemVendor({ code: '', name: '' })
      setVendorSearch('')
    }
  }, [headerData.vendorTaxId, lang, vendorDbByTax])

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.toLowerCase()
    return vendors.filter(v =>
      v.name.toLowerCase().includes(q) ||
      v.code.toLowerCase().includes(q) ||
      v.taxId.includes(vendorSearch) ||
      String(v.branchNo || '').includes(vendorSearch)
    )
  }, [vendors, vendorSearch])

  // Computed totals
  const sumLineSubTotal = lineItems.reduce((s, i) => s + Math.round(parseNum(i.lineSubTotal) * 100), 0) / 100
  const sumLineTotal = lineItems.reduce((s, i) => s + Math.round(parseNum(i.lineTotal) * 100), 0) / 100
  const sumDiscount = lineItems.reduce((s, i) => s + Math.round(parseNum(i.discountAmt) * 100), 0) / 100
  const sumTax = lineItems.reduce((s, i) => s + Math.round(parseNum(i.taxAmt) * 100), 0) / 100

  const tgtSubTotal = round2(headerData.subTotal)
  const tgtDiscount = round2(headerData.totalDiscount)
  const tgtTax = round2(headerData.taxAmount)
  const tgtGrand = round2(headerData.grandTotal)

  const isInclude = headerData.taxType === 'Include'

  const isSubDiff = sumLineSubTotal !== tgtSubTotal
  const isDiscDiff = sumDiscount !== tgtDiscount
  const isTaxDiff = sumTax !== tgtTax
  const calcGrandFromLines = sumLineTotal
  const isGrandDiff = calcGrandFromLines !== tgtGrand

  const validationErrors = [
    isSubDiff && t.subTotal,
    isDiscDiff && t.discount,
    isTaxDiff && t.tax,
    isGrandDiff && t.grandTotal,
  ].filter(Boolean)
  const isValid = validationErrors.length === 0

  const availableFields = getAvailableFields(t)
  const activeCols = Object.keys(fieldMappings)
    .map(k => parseInt(k.replace('col', ''), 10))
    .filter(c => fieldMappings[`col${c}`] !== 'ignore' && fieldMappings[`col${c}`] !== 'category')

  const adjustField = (tgt, sumCur, itemKey, adjustTotal = false, isDiscount = false) => {
    if (!lineItems.length) return
    const diff = (Math.round(tgt * 100) - Math.round(sumCur * 100)) / 100
    if (diff === 0) return
    const items = [...lineItems]
    const last = items.length - 1
    items[last][itemKey] = fmt((Math.round(round2(items[last][itemKey]) * 100) + Math.round(diff * 100)) / 100)
    if (adjustTotal) {
      const ltDiff = isDiscount ? -diff : diff
      items[last].lineTotal = fmt((Math.round(round2(items[last].lineTotal) * 100) + Math.round(ltDiff * 100)) / 100)
    }
    setLineItems(items)
  }

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const url = URL.createObjectURL(f)
    previewUrlRef.current = url
    setFile(f)
    setPreviewUrl(url)
    setPreviewType(f.type === 'application/pdf' ? 'pdf' : 'image')
    runOCR(f)
  }

  const runOCR = async (fileObj) => {
    setLoading(true)
    setStatus('AI is extracting data from document...')
    setError(null)
    try {
      let retries = 3, delay = 800
      while (retries > 0) {
        try {
          const formData = new FormData()
          formData.append('file', fileObj)
          const res = await apiFetch('/api/v1/ap-invoice/extract', { method: 'POST', body: formData })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()

          if (data.is_duplicate) {
            setStatus('Duplicate document found')
            setModal({
              show: true,
              type: 'warning',
              title: 'Duplicate document found',
              message: `Document No. ${data.documentNumber || '—'} for this vendor is already in the system and cannot be imported again.`,
              confirmText: 'OK',
              onConfirm: () => { setModal({ show: false }); setStep(1); setFile(null); setPreviewUrl(null) }
            })
            return
          }

          setApInvoiceId(data.id)

          setHeaderData({
            vendorName: data.vendorName || '',
            vendorTaxId: data.vendorTaxId || '',
            vendorBranch: data.vendorBranch || '',
            documentName: data.documentName || '',
            documentDate: data.documentDate || '',
            documentNumber: data.documentNumber || '',
            taxType: data.taxType || '',
            subTotal: fmt(data.subTotal),
            taxAmount: fmt(data.taxAmount),
            totalDiscount: fmt(data.totalDiscount),
            grandTotal: fmt(data.grandTotal),
          })

          const formattedItems = (data.items || []).map(item => {
            const ni = { ...item, deptCode: '', accountCode: '' }
            Object.keys(ni).forEach(k => {
              if (isNumFld(k) && ni[k] !== undefined && ni[k] !== '') ni[k] = fmt(ni[k])
            })
            return ni
          })
          setLineItems(formattedItems)

          if (data.vendorTaxId) {
            try {
              const saved = localStorage.getItem(`ap_mapping_${data.vendorTaxId}`)
              if (saved) setFieldMappings(JSON.parse(saved))
            } catch { /* ignore corrupt localStorage data */ }
          }
          setStatus('Data extracted successfully ✓')
          showToast('Data extracted successfully — please review and adjust', 'success')
          setStep(2)
          loadVendors() // Load vendors after successful OCR extraction
          return
        } catch (err) {
          retries--
          if (retries === 0) throw err
          setStatus('Retrying...')
          showToast('Retrying...', 'info')
          await new Promise(r => setTimeout(r, delay))
          delay *= 2
        }
      }
    } catch (err) {
      console.error(err)
      setStatus(err.message)
      setError(t.errProcess)
      showToast('Failed to extract data. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const updateHeader = (key, val) => setHeaderData(p => ({ ...p, [key]: val }))
  const blurHeader = (key, val) => { if (val) setHeaderData(p => ({ ...p, [key]: fmt(val) })) }
  const updateItem = (idx, key, val) => setLineItems(items => items.map((r, i) => {
    if (i !== idx) return r
    const clearSuggest = key === 'deptCode' ? { _suggestDept: undefined } : key === 'accountCode' ? { _suggestAcc: undefined } : {}
    return { ...r, [key]: val, ...clearSuggest }
  }))
  const blurItem = (idx, key, val) => { if (val) setLineItems(items => items.map((r, i) => i === idx ? { ...r, [key]: fmt(val) } : r)) }

  const confirmMapping = () => {
    if (headerData.vendorTaxId) {
      localStorage.setItem(`ap_mapping_${headerData.vendorTaxId}`, JSON.stringify(fieldMappings))
    }
    showToast('Column settings saved', 'success')
    setStep(3)
  }

  const goToAccount = () => {
    if (!systemVendor.code) {
      showToast(t.warnSelectVendor, 'warning')
      return
    }
    if (!isValid) {
      setModal({
        show: true, type: 'warning',
        title: t.mismatchTitle,
        message: t.warnMismatch,
        confirmText: t.proceed,
        cancelText: t.backEdit,
        onConfirm: () => { setModal({ show: false }); setStep(4) },
        onCancel: () => setModal({ show: false }),
      })
    } else {
      setStep(4)
    }
  }

  const runSuggest = async (itemsToSuggest) => {
    setSuggestLoading(true)
    showToast('AI is suggesting account codes...', 'info')
    try {
      const res = await apiFetch('/api/v1/ap-invoice/suggest-gl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToSuggest,
          invoice_desc: headerData.invhDesc || '',
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const suggestions = data.suggestions || {}
      let suggestedCount = 0
      setLineItems(prev => prev.map((item, idx) => {
        const s = suggestions[idx]
        if (!s) return item
        const newDept = (!item.deptCode || item._suggestDept) && s.deptCode ? s.deptCode : null
        const newAcc = (!item.accountCode || item._suggestAcc) && s.accountCode ? s.accountCode : null
        if (newDept || newAcc) suggestedCount++
        return {
          ...item,
          deptCode: newDept ?? item.deptCode,
          accountCode: newAcc ?? item.accountCode,
          _suggestDept: newDept || undefined,
          _suggestAcc: newAcc || undefined,
        }
      }))
      if (suggestedCount > 0) {
        setModal({
          show: true,
          title: '✓ AI Suggestion',
          message: `AI suggested account codes for ${suggestedCount} items. Please review.`,
          type: 'success',
          confirmText: 'OK',
          onConfirm: () => setModal({ show: false }),
        })
      }
    } catch (err) {
      console.error('AI suggest error:', err)
      showToast('Failed to suggest account codes. Please try again.', 'error')
    } finally {
      setSuggestLoading(false)
    }
  }

  const handleAISuggest = () => {
    const itemsToSuggest = lineItems
      .map((item, idx) => ({
        index: idx,
        category: item.category || '',
        description: item.description || '',
        unit_price: parseNum(item.unitPrice ?? item.lineTotal ?? 0),
      }))
      .filter((_, idx) => {
        const item = lineItems[idx]
        return !item.deptCode || !item.accountCode || item._suggestDept || item._suggestAcc
      })

    if (!itemsToSuggest.length) {
      setModal({
        show: true,
        title: '✓ Mapping Complete',
        message: 'All items have been mapped. No further suggestions needed.',
        type: 'success',
        confirmText: 'OK',
        onConfirm: () => setModal({ show: false }),
      })
      return
    }

    if (!headerData.invhDesc) {
      setModal({
        show: true,
        type: 'info',
        title: t.invDescTitle,
        message: t.invDescMsg,
        confirmText: t.proceedAnyway,
        cancelText: t.backFillDesc,
        onConfirm: () => { setModal({ show: false }); runSuggest(itemsToSuggest) },
        onCancel: () => setModal({ show: false }),
      })
    } else {
      runSuggest(itemsToSuggest)
    }
  }

  const hasSuggestions = lineItems.some(i => i._suggestDept || i._suggestAcc)
  const allMapped = lineItems.length > 0 && lineItems.every(i => i.deptCode && i.accountCode && !i._suggestDept && !i._suggestAcc)

  const handleAcceptAll = () => {
    setLineItems(prev => prev.map(item => ({
      ...item,
      _suggestDept: undefined,
      _suggestAcc: undefined,
    })))
    showToast('All account codes confirmed', 'success')
  }

  const handleConfirmSuggest = (idx) => {
    setLineItems(prev => prev.map((item, i) =>
      i !== idx ? item : { ...item, _suggestDept: undefined, _suggestAcc: undefined }
    ))
  }

  const handleRejectSuggest = (idx) => {
    setLineItems(prev => prev.map((item, i) =>
      i !== idx ? item : {
        ...item,
        deptCode: item._suggestDept ? '' : item.deptCode,
        accountCode: item._suggestAcc ? '' : item.accountCode,
        _suggestDept: undefined,
        _suggestAcc: undefined,
      }
    ))
  }

  const handleGenerate = async () => {
    const missing = lineItems.filter(i => !i.deptCode || !i.accountCode)
    if (missing.length > 0) {
      showToast(`Department code and Account code is required`, 'warning')
      return
    }
    setLoading(true)
    setStatus('Sending AP Invoice to Carmen Cloud...')
    setError(null)
    showToast('Sending AP Invoice to Carmen Cloud...', 'info')
    try {
      const payload = buildInvoicePayload(headerData, lineItems, systemVendor)
      const result = await submitAPInvoiceToCarmen(payload, apInvoiceId)
      if (result?.Code < 0) {
        showToast('Carmen Cloud rejected the data, please verify', 'warning')
        setModal({
          show: true, type: 'warning',
          title: 'Failed to create AP Invoice',
          message: result.UserMessage || 'Error from Carmen Cloud',
          confirmText: 'OK',
          onConfirm: () => { setModal({ show: false }); handleReset() },
        })
        return
      }
      setInvoiceSeq(result?.InternalMessage ?? null)
      showToast('AP Invoice created successfully', 'success')
      setStep(5)
    } catch (err) {
      console.error('AP Invoice submit error:', err)
      showToast(`Failed to send AP Invoice: ${err.message || 'An error occurred'}`, 'error')
      setModal({
        show: true, type: 'warning',
        title: 'Failed to send AP Invoice',
        message: err.message || 'An error occurred while sending data. Please try again.',
        confirmText: 'OK',
        onConfirm: () => setModal({ show: false }),
      })
    } finally {
      setLoading(false)
      setStatus('')
    }
  }

  const handleReset = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setFile(null); setPreviewUrl(null); setPreviewType(null)
    setHeaderData(EMPTY_HEADER); setSystemVendor({ code: '', name: '' }); setVendorSearch('')
    setLineItems([]); setFieldMappings(DEFAULT_MAPPINGS); setStep(1)
    setGlLoaded(false)
    setIsDuplicate(false)
    setApInvoiceId(null)
    setStatus(''); setError(null)
  }

  return {
    // i18n
    lang, setLang, t,
    // Wizard
    step, setStep,
    // File & preview
    file, previewUrl, previewType, fileInputRef,
    loading, status, error, setError, suggestLoading,
    // Data
    headerData, lineItems, fieldMappings, setFieldMappings,
    masterAccounts, masterDepts,
    // Vendor search
    systemVendor, setSystemVendor, vendorSearch, setVendorSearch,
    showVendorDrop, setShowVendorDrop, filteredVendors,
    // Modal
    modal, setModal,
    // Computed totals & diffs
    sumLineSubTotal, sumLineTotal, sumDiscount, sumTax,
    tgtSubTotal, tgtDiscount, tgtTax, tgtGrand,
    isSubDiff, isDiscDiff, isTaxDiff, isGrandDiff,
    isInclude, calcGrandFromLines,
    validationErrors, isValid,
    availableFields, activeCols,
    // Handlers
    handleFileChange,
    updateHeader, blurHeader,
    updateItem, blurItem,
    confirmMapping, goToAccount,
    handleAISuggest, handleAcceptAll, hasSuggestions, allMapped,
    handleConfirmSuggest, handleRejectSuggest, handleReset,
    handleGenerate,
    refreshVendors, vendorRefreshing,
    invoiceSeq,
    adjustField,
    isDuplicate,
  }
}
