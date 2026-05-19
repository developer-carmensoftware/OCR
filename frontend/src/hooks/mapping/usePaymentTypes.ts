import { useState, useRef } from 'react'
import type { FieldMapping } from '../../types/api'

export interface PaymentTypesHook {
  paymentAmount: Record<string, FieldMapping>
  setPaymentAmount: React.Dispatch<React.SetStateAction<Record<string, FieldMapping>>>
  customPaymentTypes: string[]
  newCustomType: string
  setNewCustomType: React.Dispatch<React.SetStateAction<string>>
  isAmountModalOpen: boolean
  setIsAmountModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  initFromData: (mappings?: Record<string, FieldMapping>, customTypes?: string[]) => void
  loadPaymentAmountFromStorage: () => void
  handlePaymentMappingChange: (type: string, field: keyof FieldMapping, value: string) => void
  handleAddCustomType: (
    activeScanPaymentTypes: Set<string>,
    onSuggest?: ((types: string[]) => void) | null
  ) => void
  handleRemoveCustomType: (type: string) => void
  openAmountModal: () => void
  cancelAmountSelection: (clearSuggestions?: (() => void) | null) => void
  saveAmountSelection: () => void
}

import type React from 'react'

export function usePaymentTypes(): PaymentTypesHook {
  const [paymentAmount, setPaymentAmount] = useState<Record<string, FieldMapping>>({})
  const [customPaymentTypes, setCustomPaymentTypes] = useState<string[]>([])
  const [newCustomType, setNewCustomType] = useState('')
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

  const loadPaymentAmountFromStorage = () => {
    const amountState = localStorage.getItem('accountMappingAmount')
    if (!amountState) return
    try {
      const parsed = JSON.parse(amountState) as Record<string, unknown>
      initFromData(
        Object.fromEntries(Object.entries(parsed).filter(([k]) => k !== '__customTypes')) as Record<
          string,
          FieldMapping
        >,
        (parsed.__customTypes as string[]) || []
      )
    } catch {
      /* ignore */
    }
  }

  const handlePaymentMappingChange = (type: string, field: keyof FieldMapping, value: string) => {
    setPaymentAmount(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }))
  }

  const handleAddCustomType = (
    activeScanPaymentTypes: Set<string>,
    onSuggest?: ((types: string[]) => void) | null
  ) => {
    const trimmed = newCustomType.trim().toUpperCase()
    if (!trimmed || activeScanPaymentTypes.has(trimmed) || customPaymentTypes.includes(trimmed))
      return
    setCustomPaymentTypes(prev => [...prev, trimmed])
    setPaymentAmount(prev => ({ ...prev, [trimmed]: { dept: '', acc: '' } }))
    setNewCustomType('')
    if (onSuggest) onSuggest([trimmed])
  }

  const handleRemoveCustomType = (type: string) => {
    setCustomPaymentTypes(prev => prev.filter(t => t !== type))
    setPaymentAmount(prev => {
      const next = { ...prev }
      delete next[type]
      return next
    })
  }

  const openAmountModal = () => {
    paymentAmountSnapshot.current = JSON.parse(JSON.stringify(paymentAmount)) as Record<
      string,
      FieldMapping
    >
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
    localStorage.setItem(
      'accountMappingAmount',
      JSON.stringify({ ...paymentAmount, __customTypes: customPaymentTypes })
    )
    setIsAmountModalOpen(false)
  }

  return {
    paymentAmount,
    setPaymentAmount,
    customPaymentTypes,
    newCustomType,
    setNewCustomType,
    isAmountModalOpen,
    setIsAmountModalOpen,
    initFromData,
    loadPaymentAmountFromStorage,
    handlePaymentMappingChange,
    handleAddCustomType,
    handleRemoveCustomType,
    openAmountModal,
    cancelAmountSelection,
    saveAmountSelection,
  }
}
