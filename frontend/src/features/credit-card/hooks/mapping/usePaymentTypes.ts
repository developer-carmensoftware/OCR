import { useState, useRef } from 'react'
import { appKey } from '@/shared/lib/storage'
import type { FieldMapping } from '@/shared/types/api'
import type { AddError, Undo } from '@/features/credit-card/components/payment-mapping/types'

export interface PaymentTypesHook {
  paymentAmount: Record<string, FieldMapping>
  setPaymentAmount: React.Dispatch<React.SetStateAction<Record<string, FieldMapping>>>
  customPaymentTypes: string[]
  isAmountModalOpen: boolean
  setIsAmountModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  initFromData: (mappings?: Record<string, FieldMapping>, customTypes?: string[]) => void
  /** Clears payment-type state outright — the bank switched, so the previous bank's
   *  mappings and custom types must not bleed into the new one. `initFromData` merges
   *  on purpose (it preserves unsaved edits), so a caller that needs a clean slate first
   *  calls this, then `initFromData` with the new bank's saved data. */
  resetPaymentTypes: () => void
  handlePaymentMappingChange: (type: string, field: keyof FieldMapping, value: string) => void
  /** Upper-cased and trimmed; refused when blank or already a code in `taken` (this
   *  set's own rows plus any other set's, so one key is never edited from two places). */
  addCustomType: (raw: string, taken: Set<string>) => AddError
  /** Removes a typed-in type and its mapping; the returned undo puts both back. */
  handleRemoveCustomType: (type: string) => Undo
  openAmountModal: () => void
  cancelAmountSelection: (clearSuggestions?: (() => void) | null) => void
  saveAmountSelection: () => void
}

import type React from 'react'

export function usePaymentTypes(): PaymentTypesHook {
  const [paymentAmount, setPaymentAmount] = useState<Record<string, FieldMapping>>({})
  const [customPaymentTypes, setCustomPaymentTypes] = useState<string[]>([])
  const [isAmountModalOpen, setIsAmountModalOpen] = useState(false)
  const paymentAmountSnapshot = useRef<Record<string, FieldMapping> | null>(null)
  const customPaymentTypesSnapshot = useRef<string[] | null>(null)

  const initFromData = (
    mappings: Record<string, FieldMapping> = {},
    customTypes: string[] = []
  ) => {
    setCustomPaymentTypes(customTypes)
    setPaymentAmount(prev => {
      const next = { ...prev }
      Object.keys(mappings).forEach(k => {
        next[k] = mappings[k]
      })
      customTypes.forEach(type => {
        if (!next[type]) next[type] = { dept: '', acc: '' }
      })
      return next
    })
  }

  const handlePaymentMappingChange = (type: string, field: keyof FieldMapping, value: string) => {
    setPaymentAmount(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }))
  }

  const addCustomType = (raw: string, taken: Set<string>): AddError => {
    // ponytail: custom types are upper-cased here but activeScan keys are raw document
    // strings (useMapping rescan), so a mixed-case doc value renders a duplicate row.
    // Fixing means normalizing both sides + migrating already-saved keys — own change.
    const code = raw.trim().toUpperCase()
    if (!code) return 'blank'
    if (taken.has(code) || customPaymentTypes.includes(code)) return 'duplicate'
    setCustomPaymentTypes(prev => [...prev, code])
    setPaymentAmount(prev => ({ ...prev, [code]: { dept: '', acc: '' } }))
    return null
  }

  const resetPaymentTypes = () => {
    setPaymentAmount({})
    setCustomPaymentTypes([])
  }

  const handleRemoveCustomType = (type: string): Undo => {
    const index = customPaymentTypes.indexOf(type)
    const mapping = paymentAmount[type]
    setCustomPaymentTypes(prev => prev.filter(t => t !== type))
    setPaymentAmount(prev => {
      const next = { ...prev }
      delete next[type]
      return next
    })
    return () => {
      setCustomPaymentTypes(prev => {
        if (prev.includes(type)) return prev
        const next = [...prev]
        next.splice(index < 0 ? next.length : Math.min(index, next.length), 0, type)
        return next
      })
      setPaymentAmount(prev =>
        type in prev ? prev : { ...prev, [type]: mapping ?? { dept: '', acc: '' } }
      )
    }
  }

  const openAmountModal = () => {
    paymentAmountSnapshot.current = structuredClone(paymentAmount)
    customPaymentTypesSnapshot.current = [...customPaymentTypes]
    setIsAmountModalOpen(true)
  }

  const cancelAmountSelection = (clearSuggestions?: (() => void) | null) => {
    if (paymentAmountSnapshot.current !== null) setPaymentAmount(paymentAmountSnapshot.current)
    if (customPaymentTypesSnapshot.current !== null)
      setCustomPaymentTypes(customPaymentTypesSnapshot.current)
    paymentAmountSnapshot.current = null
    customPaymentTypesSnapshot.current = null
    if (clearSuggestions) clearSuggestions()
    setIsAmountModalOpen(false)
  }

  const saveAmountSelection = () => {
    paymentAmountSnapshot.current = null
    customPaymentTypesSnapshot.current = null
    // ponytail: accountMappingAmount is an offline-only duplicate of
    // accountingConfig.paymentAmount, and __customTypes has no reader at all
    // (useAccountingConfig strips it). Fold both into accountingConfig next time this
    // persistence is touched — needs a one-shot migration read for existing browsers.
    localStorage.setItem(
      appKey('accountMappingAmount'),
      JSON.stringify({ ...paymentAmount, __customTypes: customPaymentTypes })
    )
    setIsAmountModalOpen(false)
  }

  return {
    paymentAmount,
    setPaymentAmount,
    customPaymentTypes,
    isAmountModalOpen,
    setIsAmountModalOpen,
    initFromData,
    resetPaymentTypes,
    handlePaymentMappingChange,
    addCustomType,
    handleRemoveCustomType,
    openAmountModal,
    cancelAmountSelection,
    saveAmountSelection,
  }
}
