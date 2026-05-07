import { useState, useRef } from 'react'

/**
 * Manages payment type mapping state:
 * the paymentAmount map, custom types, and the modal snapshot
 * pattern used to support Cancel/Revert in PaymentTypeModal.
 */
export function usePaymentTypes() {
  const [paymentAmount, setPaymentAmount] = useState({})
  const [customPaymentTypes, setCustomPaymentTypes] = useState([])
  const [newCustomType, setNewCustomType] = useState('')
  const [isAmountModalOpen, setIsAmountModalOpen] = useState(false)
  const paymentAmountSnapshot = useRef(null)
  const customPaymentTypesSnapshot = useRef(null)

  const loadPaymentAmountFromStorage = () => {
    const amountState = localStorage.getItem('accountMappingAmount')
    if (!amountState) return
    try {
      const parsed = JSON.parse(amountState)
      const savedCustomTypes = parsed.__customTypes || []
      setCustomPaymentTypes(savedCustomTypes)
      setPaymentAmount(prev => {
        const next = { ...prev }
        Object.keys(parsed).forEach(k => {
          if (k !== '__customTypes') next[k] = parsed[k]
        })
        savedCustomTypes.forEach(type => {
          if (!next[type]) next[type] = { dept: '', acc: '' }
        })
        return next
      })
    } catch { /* ignore */ }
  }

  const handlePaymentMappingChange = (type, field, value) => {
    setPaymentAmount(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }))
  }

  const handleAddCustomType = (activeScanPaymentTypes, onSuggest) => {
    const trimmed = newCustomType.trim().toUpperCase()
    if (!trimmed || activeScanPaymentTypes.has(trimmed) || customPaymentTypes.includes(trimmed)) return
    setCustomPaymentTypes(prev => [...prev, trimmed])
    setPaymentAmount(prev => ({ ...prev, [trimmed]: { dept: '', acc: '' } }))
    setNewCustomType('')
    if (onSuggest) onSuggest([trimmed])
  }

  const handleRemoveCustomType = (type) => {
    setCustomPaymentTypes(prev => prev.filter(t => t !== type))
    setPaymentAmount(prev => {
      const next = { ...prev }
      delete next[type]
      return next
    })
  }

  const openAmountModal = () => {
    paymentAmountSnapshot.current = JSON.parse(JSON.stringify(paymentAmount))
    customPaymentTypesSnapshot.current = [...customPaymentTypes]
    setIsAmountModalOpen(true)
  }

  const cancelAmountSelection = (clearSuggestions) => {
    if (paymentAmountSnapshot.current !== null) setPaymentAmount(paymentAmountSnapshot.current)
    if (customPaymentTypesSnapshot.current !== null) setCustomPaymentTypes(customPaymentTypesSnapshot.current)
    paymentAmountSnapshot.current = null
    customPaymentTypesSnapshot.current = null
    if (clearSuggestions) clearSuggestions()
    setIsAmountModalOpen(false)
  }

  const saveAmountSelection = () => {
    paymentAmountSnapshot.current = null
    customPaymentTypesSnapshot.current = null
    localStorage.setItem('accountMappingAmount', JSON.stringify({ ...paymentAmount, __customTypes: customPaymentTypes }))
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
    loadPaymentAmountFromStorage,
    handlePaymentMappingChange,
    handleAddCustomType,
    handleRemoveCustomType,
    openAmountModal,
    cancelAmountSelection,
    saveAmountSelection,
  }
}
