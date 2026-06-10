import { useState, useRef } from 'react'
import type React from 'react'
import { fetchAccountCodes, fetchDepartments, submitAPInvoiceToCarmen } from '../../lib/api/carmen'
import type { TaxProfileItem } from '../../lib/api/carmen'
import { apiFetch } from '../../lib/api/client'
import { API } from '../../lib/api/endpoints'
import { showToast, toast } from '../../lib/toast'
import { parseNum } from '../../lib/format'
import type { ModalState } from '../../types/modal'
import type { APLineItem } from './useAPExtraction'
import type { APInvoiceHeader } from '../../constants/apInvoice'
import type { Vendor } from './useAPVendor'
import {
  buildInvoicePayload,
  formatCarmenError,
  parseCarmenDupError,
} from '../../lib/apInvoicePayload'

interface GLAccount {
  code: string
  name: string
  name2?: string
}

interface APSubmissionProps {
  setStep: (step: number) => void
  setModal: (state: ModalState) => void
  headerData: APInvoiceHeader
  lineItems: APLineItem[]
  setLineItems: React.Dispatch<React.SetStateAction<APLineItem[]>>
  systemVendor: Vendor
  taxProfiles: TaxProfileItem[]
  apInvoiceId: string | null
  updateHeader?: (key: string, val: string) => void
}

export function useAPSubmission({
  setStep,
  setModal,
  headerData,
  lineItems,
  setLineItems,
  systemVendor,
  taxProfiles,
  apInvoiceId,
  updateHeader,
}: APSubmissionProps) {
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [masterAccounts, setMasterAccounts] = useState<GLAccount[]>([])
  const [masterDepts, setMasterDepts] = useState<GLAccount[]>([])
  const [glLoaded, setGlLoaded] = useState(false)
  const [invoiceSeq, setInvoiceSeq] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
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
      const res = await apiFetch(API.apInvoice.suggest, {
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
        llm_partial?: boolean
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
      if (data.llm_partial) {
        showToast(
          suggestedCount > 0
            ? `AI partially suggested ${suggestedCount} item${suggestedCount > 1 ? 's' : ''} — some items need manual mapping.`
            : 'AI could not generate suggestions. Please fill in manually.',
          'warning'
        )
      } else if (suggestedCount > 0) {
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
    const toastId = toast.loading(`Re-sending as ${newInvNo.trim()}…`)
    try {
      const modifiedHeader = { ...headerData, documentNumber: newInvNo.trim() }
      const payload = buildInvoicePayload(modifiedHeader, lineItems, systemVendor, taxProfiles)
      const result = (await submitAPInvoiceToCarmen(payload, apInvoiceId)) as Record<
        string,
        unknown
      >
      if ((result?.Code as number) < 0) {
        const dup = parseCarmenDupError((result.UserMessage as string) || '')
        if (dup) {
          toast.warning(`Invoice ${dup.invNo} already exists`, { id: toastId })
          _showDupModal(dup)
          return
        }
        toast.warning('Carmen rejected the data — please verify', { id: toastId })
        setModal({
          show: true,
          type: 'warning',
          title: 'Failed to create AP Invoice',
          message: formatCarmenError((result.UserMessage as string) || 'Error from Carmen Cloud'),
          confirmText: 'OK',
          onConfirm: () => setModal({ show: false }),
        })
        return
      }
      updateHeader?.('documentNumber', newInvNo.trim())
      setInvoiceSeq((result?.InternalMessage as string) ?? null)
      toast.success(`AP Invoice ${newInvNo.trim()} created`, { id: toastId })
      setStep(5)
    } catch (err) {
      console.error('AP Invoice re-submit error:', err)
      toast.error(`Could not send to Carmen — ${(err as Error).message || 'unknown error'}`, {
        id: toastId,
      })
    }
  }

  const handleGenerate = async () => {
    if (isSubmitting) return
    const missing = lineItems.filter(i => !i.deptCode || !i.accountCode)
    if (missing.length > 0) {
      showToast('Department code and Account code is required', 'warning')
      return
    }
    setIsSubmitting(true)
    const toastId = toast.loading('Sending to Carmen Cloud…')
    try {
      const payload = buildInvoicePayload(headerData, lineItems, systemVendor, taxProfiles)
      const result = (await submitAPInvoiceToCarmen(payload, apInvoiceId)) as Record<
        string,
        unknown
      >
      if ((result?.Code as number) < 0) {
        const dup = parseCarmenDupError((result.UserMessage as string) || '')
        if (dup) {
          toast.warning(`Invoice ${dup.invNo} already exists in Carmen`, { id: toastId })
          _showDupModal(dup)
          return
        }
        toast.warning('Carmen rejected the data — please verify', { id: toastId })
        setModal({
          show: true,
          type: 'warning',
          title: 'Failed to create AP Invoice',
          message: formatCarmenError((result.UserMessage as string) || 'Error from Carmen Cloud'),
          confirmText: 'OK',
          onConfirm: () => setModal({ show: false }),
        })
        return
      }
      setInvoiceSeq((result?.InternalMessage as string) ?? null)
      toast.success(`AP Invoice ${headerData.documentNumber || ''} created`, { id: toastId })
      setStep(5)
    } catch (err) {
      console.error('AP Invoice submit error:', err)
      toast.error(`Could not send to Carmen — ${(err as Error).message || 'unknown error'}`, {
        id: toastId,
      })
      setModal({
        show: true,
        type: 'warning',
        title: 'Failed to send AP Invoice',
        message:
          (err as Error).message || 'An error occurred while sending data. Please try again.',
        confirmText: 'OK',
        onConfirm: () => setModal({ show: false }),
      })
    } finally {
      setIsSubmitting(false)
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
    isSubmitting,
  }
}
