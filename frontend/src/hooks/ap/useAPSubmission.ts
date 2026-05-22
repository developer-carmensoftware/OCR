import { useState, useRef } from 'react'
import { fetchAccountCodes, fetchDepartments, submitAPInvoiceToCarmen } from '../../lib/api/carmen'
import { apiFetch } from '../../lib/api/client'
import { showToast } from '../../lib/toast'
import { parseNum } from '../../lib/format'
import { parseDateToISO } from '../../lib/date'
import type { APLineItem } from './useAPExtraction'
import type { APInvoiceHeader } from '../../constants/apInvoice'
import type { Vendor } from './useAPVendor'

interface GLAccount {
  code: string
  name: string
  name2?: string
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

function buildInvoicePayload(
  headerData: APInvoiceHeader,
  lineItems: APLineItem[],
  systemVendor: Vendor
): Record<string, unknown> {
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
    // When the line has no VAT (taxAmt === 0), keep rate at 0 so Carmen does not
    // recompute tax from the rate. The || 7 default only applies to non-zero-tax lines.
    const taxRate = taxAmt === 0 ? 0 : parseNum(item.taxPct) || 7
    const qty = parseNum(item.qty) || 1
    const grossPrice = parseNum(item.unitPrice)
    const discAmt = parseNum(item.discountAmt)
    const grossLine = grossPrice * qty
    const netPrice =
      grossLine > 0 ? parseFloat(((grossLine - discAmt) / qty).toFixed(2)) : grossPrice

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
      InvdBTaxDr: item.accountCode || '',
      InvdT1Dr: systemVendor.vat1DrAccCode || '',
      InvdT2Dr: '',
      InvdTaxT1: taxAmt === 0 ? 'None' : headerData.taxType === 'Include' ? 'Include' : 'Add',
      InvdTaxR1: taxRate.toFixed(2),
      InvdTaxT2: 'None',
      InvdTaxR2: '0.00',
      DimList: {},
      LastModified: now,
      InvdBTaxCr1DeptCode: systemVendor.crDeptCode || '',
      InvdT1DrDeptCode: systemVendor.vat1DrDeptCode || '',
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
    InvhSource: 'AAPI',
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

const _CARMEN_FIELD_LABELS: Record<string, string> = {
  InvhInvNo: 'Invoice Number',
  VnCode: 'Vendor Code',
  InvhDate: 'Invoice Date',
  InvdSeq: 'Invoice Line',
}

function _formatCarmenError(msg: string): string {
  return (msg || '').replace(
    /\b(InvhInvNo|VnCode|InvhDate|InvdSeq)\b/g,
    m => _CARMEN_FIELD_LABELS[m] || m
  )
}

function _parseCarmenDupError(msg: string): { invNo: string; vnCode: string } | null {
  const m = (msg || '').match(/InvhInvNo.*?\[([^\],]+),([^\]]+)\]/)
  if (!m) return null
  return { invNo: m[1].trim(), vnCode: m[2].trim() }
}

interface APSubmissionProps {
  setStep: (step: number) => void
  setModal: (config: Record<string, unknown>) => void
  headerData: APInvoiceHeader
  lineItems: APLineItem[]
  setLineItems: React.Dispatch<React.SetStateAction<APLineItem[]>>
  systemVendor: Vendor
  apInvoiceId: string | null
  updateHeader?: (key: string, val: string) => void
}

import type React from 'react'

export function useAPSubmission({
  setStep,
  setModal,
  headerData,
  lineItems,
  setLineItems,
  systemVendor,
  apInvoiceId,
  updateHeader,
}: APSubmissionProps) {
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [masterAccounts, setMasterAccounts] = useState<GLAccount[]>([])
  const [masterDepts, setMasterDepts] = useState<GLAccount[]>([])
  const [glLoaded, setGlLoaded] = useState(false)
  const [invoiceSeq, setInvoiceSeq] = useState<string | null>(null)
  const dupInvNoRef = useRef('')
  const pendingSuggestRef = useRef<unknown[]>([])

  const loadGLData = async () => {
    if (glLoaded) return
    setGlLoaded(true)
    try {
      const [accs, depts] = await Promise.all([fetchAccountCodes(), fetchDepartments()])
      setMasterAccounts(
        accs
          .filter(a => a.AccCode && a.AccCode !== 'AccCode')
          .map(a => ({
            code: a.AccCode as string,
            name: (a.Description as string) || '',
            name2: (a.Description2 as string) || '',
          }))
      )
      setMasterDepts(
        depts
          .filter(d => d.DeptCode && d.DeptCode !== 'CodeDep')
          .map(d => ({
            code: d.DeptCode as string,
            name: (d.Description as string) || '',
            name2: (d.Description2 as string) || '',
          }))
      )
    } catch {
      /* ignore */
    }
  }

  const resetGLLoaded = () => setGlLoaded(false)

  const runSuggest = async (itemsToSuggest: unknown[]) => {
    setSuggestLoading(true)
    showToast('AI is suggesting account codes...', 'info')
    try {
      const res = await apiFetch('/api/v1/ap-invoice/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToSuggest,
          invoice_desc: headerData.invhDesc || '',
          vn_code: systemVendor?.code || '',
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as {
        suggestions?: Record<number, { deptCode?: string; accountCode?: string }>
      }
      const suggestions = data.suggestions || {}
      let suggestedCount = 0
      setLineItems(prev =>
        prev.map((item, idx) => {
          const s = suggestions[idx]
          if (!s) return item
          const newDept = (!item.deptCode || item._suggestDept) && s.deptCode ? s.deptCode : null
          const newAcc =
            (!item.accountCode || item._suggestAcc) && s.accountCode ? s.accountCode : null
          if (newDept || newAcc) suggestedCount++
          return {
            ...item,
            deptCode: newDept ?? item.deptCode,
            accountCode: newAcc ?? item.accountCode,
            _suggestDept: newDept || undefined,
            _suggestAcc: newAcc || undefined,
          }
        })
      )
      if (suggestedCount > 0) {
        showToast(
          `AI suggested ${suggestedCount} account code${suggestedCount > 1 ? 's' : ''} — please review.`,
          'success'
        )
      } else {
        showToast('AI could not generate new suggestions. Please fill in manually.', 'info')
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
      showToast('All items already have account codes.', 'info')
      return
    }

    if (!headerData.invhDesc) {
      pendingSuggestRef.current = itemsToSuggest
      setModal({
        show: true,
        type: 'warning',
        title: 'No Invoice Description',
        message: 'Adding an Invoice Description helps AI suggest more accurate GL accounts.',
        confirmText: 'Suggest Anyway',
        cancelText: 'Go Back',
        onConfirm: () => {
          setModal({ show: false })
          runSuggest(pendingSuggestRef.current)
        },
        onCancel: () => setModal({ show: false }),
      })
      return
    }
    runSuggest(itemsToSuggest)
  }

  const handleAcceptAll = () => {
    setLineItems(prev =>
      prev.map(item => ({ ...item, _suggestDept: undefined, _suggestAcc: undefined }))
    )
    showToast('All account codes confirmed', 'success')
  }

  const handleConfirmSuggest = (idx: number) => {
    setLineItems(prev =>
      prev.map((item, i) =>
        i !== idx ? item : { ...item, _suggestDept: undefined, _suggestAcc: undefined }
      )
    )
  }

  const handleRejectSuggest = (idx: number) => {
    setLineItems(prev =>
      prev.map((item, i) =>
        i !== idx
          ? item
          : {
              ...item,
              deptCode: item._suggestDept ? '' : item.deptCode,
              accountCode: item._suggestAcc ? '' : item.accountCode,
              _suggestDept: undefined,
              _suggestAcc: undefined,
            }
      )
    )
  }

  const _showDupModal = (dup: { invNo: string; vnCode: string }) => {
    setModal({
      show: true,
      type: 'warning',
      title: 'Invoice Already Exists in Carmen',
      message: `Invoice Number "${dup.invNo}" for Vendor Code "${dup.vnCode}" already exists in Carmen.`,
      confirmText: 'Change Invoice Number',
      cancelText: 'Cancel',
      onConfirm: () => _showChangeInvNoModal(dup),
      onCancel: () => {
        setModal({ show: false })
        setStep(1)
      },
    })
  }

  const _showChangeInvNoModal = (dup: { invNo: string; vnCode: string }) => {
    dupInvNoRef.current = ''
    setModal({
      show: true,
      type: 'warning',
      title: 'Change Invoice Number',
      message: 'Enter a new Invoice Number to re-submit to Carmen.',
      inputLabel: 'New Invoice Number',
      inputValue: '',
      onInputChange: (v: string) => {
        dupInvNoRef.current = v
      },
      inputPlaceholder: `e.g. ${dup.invNo}-A`,
      confirmText: 'Re-submit',
      cancelText: 'Back',
      onConfirm: () => {
        setModal({ show: false })
        _resubmitWithNewInvNo(dupInvNoRef.current)
      },
      onCancel: () => _showDupModal(dup),
    })
  }

  const _resubmitWithNewInvNo = async (newInvNo: string) => {
    if (!newInvNo?.trim()) {
      showToast('Please enter a new Invoice Number.', 'warning')
      return
    }
    showToast('Re-sending AP Invoice to Carmen Cloud...', 'info')
    try {
      const modifiedHeader = { ...headerData, documentNumber: newInvNo.trim() }
      const payload = buildInvoicePayload(modifiedHeader, lineItems, systemVendor)
      const result = (await submitAPInvoiceToCarmen(payload, apInvoiceId)) as Record<
        string,
        unknown
      >
      if ((result?.Code as number) < 0) {
        const dup = _parseCarmenDupError((result.UserMessage as string) || '')
        if (dup) {
          _showDupModal(dup)
          return
        }
        showToast('Carmen Cloud rejected the data, please verify', 'warning')
        setModal({
          show: true,
          type: 'warning',
          title: 'Failed to create AP Invoice',
          message: _formatCarmenError((result.UserMessage as string) || 'Error from Carmen Cloud'),
          confirmText: 'OK',
          onConfirm: () => setModal({ show: false }),
        })
        return
      }
      updateHeader?.('documentNumber', newInvNo.trim())
      setInvoiceSeq((result?.InternalMessage as string) ?? null)
      showToast('AP Invoice created successfully', 'success')
      setStep(5)
    } catch (err) {
      console.error('AP Invoice re-submit error:', err)
      showToast(
        `Failed to send AP Invoice: ${(err as Error).message || 'An error occurred'}`,
        'error'
      )
    }
  }

  const handleGenerate = async () => {
    const missing = lineItems.filter(i => !i.deptCode || !i.accountCode)
    if (missing.length > 0) {
      showToast('Department code and Account code is required', 'warning')
      return
    }
    showToast('Sending AP Invoice to Carmen Cloud...', 'info')
    try {
      const payload = buildInvoicePayload(headerData, lineItems, systemVendor)
      const result = (await submitAPInvoiceToCarmen(payload, apInvoiceId)) as Record<
        string,
        unknown
      >
      if ((result?.Code as number) < 0) {
        const dup = _parseCarmenDupError((result.UserMessage as string) || '')
        if (dup) {
          _showDupModal(dup)
          return
        }
        showToast('Carmen Cloud rejected the data, please verify', 'warning')
        setModal({
          show: true,
          type: 'warning',
          title: 'Failed to create AP Invoice',
          message: _formatCarmenError((result.UserMessage as string) || 'Error from Carmen Cloud'),
          confirmText: 'OK',
          onConfirm: () => setModal({ show: false }),
        })
        return
      }
      setInvoiceSeq((result?.InternalMessage as string) ?? null)
      showToast('AP Invoice created successfully', 'success')
      setStep(5)
    } catch (err) {
      console.error('AP Invoice submit error:', err)
      showToast(
        `Failed to send AP Invoice: ${(err as Error).message || 'An error occurred'}`,
        'error'
      )
      setModal({
        show: true,
        type: 'warning',
        title: 'Failed to send AP Invoice',
        message:
          (err as Error).message || 'An error occurred while sending data. Please try again.',
        confirmText: 'OK',
        onConfirm: () => setModal({ show: false }),
      })
    }
  }

  const hasSuggestions = lineItems.some(i => i._suggestDept || i._suggestAcc)
  const allMapped =
    lineItems.length > 0 &&
    lineItems.every(i => i.deptCode && i.accountCode && !i._suggestDept && !i._suggestAcc)

  return {
    suggestLoading,
    masterAccounts,
    masterDepts,
    invoiceSeq,
    loadGLData,
    resetGLLoaded,
    handleAISuggest,
    handleAcceptAll,
    handleConfirmSuggest,
    handleRejectSuggest,
    handleGenerate,
    hasSuggestions,
    allMapped,
  }
}
