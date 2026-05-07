import { useState } from 'react'
import { suggestMapping, suggestPaymentTypes } from '../../lib/api/mapping'

/**
 * Manages all AI suggestion state and handlers for both
 * main account mappings and payment type mappings.
 */
export function useMappingSuggestions({ masterAccounts, masterDepartments, mappings, paymentAmount, activeScan, customPaymentTypes, setModalConfig }) {
  const [suggestionMeta, setSuggestionMeta] = useState({ commission: null, tax: null, net: null })
  const [mainSuggestions, setMainSuggestions] = useState({ commission: null, tax: null, net: null })
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [paymentSuggestions, setPaymentSuggestions] = useState({})
  const [paymentSuggestLoading, setPaymentSuggestLoading] = useState(false)

  const autoSuggest = async () => {
    if (!masterAccounts.length) return

    const fieldsToFetch = ['commission', 'tax', 'net'].filter(f =>
      (!mappings[f] || !mappings[f].dept || !mappings[f].acc) &&
      !(mainSuggestions[f] && mainSuggestions[f].source === 'history')
    )

    if (fieldsToFetch.length === 0) {
      setModalConfig({
        show: true,
        title: '✓ All Mappings Completed',
        message: 'All values have been successfully mapped. You can proceed to the next step.',
        type: 'success',
      })
      return
    }

    setSuggestLoading(true)
    try {
      const aiResult = await suggestMapping({
        accounts: masterAccounts.map(a => ({ code: a.code, name: a.name, type: a.type })),
        departments: masterDepartments.map(d => ({ code: d.code, name: d.name })),
      })

      const suggestKeyMap = { commission: 'Credit card commission', tax: 'Input Tax', net: 'Bank Account' }
      const fromAI = {}
      fieldsToFetch.forEach(f => {
        const s = (aiResult.suggestions || {})[suggestKeyMap[f]] || {}
        if (s.dept || s.acc) fromAI[f] = { dept: s.dept || '', acc: s.acc || '' }
      })

      if (Object.keys(fromAI).length > 0) {
        setMainSuggestions(prev => {
          const next = { ...prev }
          Object.entries(fromAI).forEach(([k, v]) => {
            next[k] = { dept: v.dept || prev[k]?.dept || '', acc: v.acc || prev[k]?.acc || '', source: 'ai' }
          })
          return next
        })
        setSuggestionMeta(prev => {
          const next = { ...prev }
          Object.keys(fromAI).forEach(k => { next[k] = 'ai' })
          return next
        })
      }
    } catch (err) {
      console.error('[Mapping] AI suggest failed:', err)
    } finally {
      setSuggestLoading(false)
    }
  }

  const confirmMainSuggestion = (key) => {
    const suggestion = mainSuggestions[key]
    if (suggestion) {
      // Returned so orchestrator can merge into mappings state
      return suggestion
    }
    setMainSuggestions(prev => ({ ...prev, [key]: null }))
    setSuggestionMeta(prev => ({ ...prev, [key]: null }))
    return null
  }

  const applyMainSuggestion = (key, setMappings) => {
    const suggestion = mainSuggestions[key]
    if (suggestion) {
      setMappings(prev => {
        const cur = prev[key] || { dept: '', acc: '' }
        return { ...prev, [key]: { dept: cur.dept || suggestion.dept || '', acc: cur.acc || suggestion.acc || '' } }
      })
    }
    setMainSuggestions(prev => ({ ...prev, [key]: null }))
    setSuggestionMeta(prev => ({ ...prev, [key]: null }))
  }

  const rejectMainSuggestion = (key) => {
    setMainSuggestions(prev => ({ ...prev, [key]: null }))
    setSuggestionMeta(prev => ({ ...prev, [key]: null }))
  }

  const autoSuggestPaymentTypes = async (specificTypes = null) => {
    if (!masterAccounts.length) return
    setPaymentSuggestLoading(true)

    const allTypes = specificTypes || [...activeScan.paymentTypes, ...customPaymentTypes]
    const needsAI = allTypes.filter(t =>
      (!paymentAmount[t] || !paymentAmount[t].dept || !paymentAmount[t].acc) &&
      !(paymentSuggestions[t] && paymentSuggestions[t].source === 'history')
    )

    if (needsAI.length === 0) {
      setPaymentSuggestLoading(false)
      setModalConfig({
        show: true,
        title: '✓ All Mappings Completed',
        message: 'All Payment Types have been successfully mapped.',
        type: 'success',
      })
      return
    }

    try {
      const result = await suggestPaymentTypes({
        payment_types: needsAI,
        accounts: masterAccounts.map(a => ({ code: a.code, name: a.name, type: a.type })),
        departments: masterDepartments.map(d => ({ code: d.code, name: d.name })),
      })
      const newSuggestions = {}
      Object.entries(result.suggestions || {}).forEach(([t, val]) => {
        if (val.dept || val.acc) newSuggestions[t] = { dept: val.dept || null, acc: val.acc || null, source: 'ai' }
      })
      setPaymentSuggestions(prev => ({ ...prev, ...newSuggestions }))
    } catch (err) {
      console.error('AI payment type suggest failed:', err)
    } finally {
      setPaymentSuggestLoading(false)
    }
  }

  const confirmPaymentSuggestion = (type, setPaymentAmount) => {
    const suggestion = paymentSuggestions[type]
    if (suggestion) {
      setPaymentAmount(prev => {
        const cur = prev[type] || { dept: '', acc: '' }
        return { ...prev, [type]: { dept: cur.dept || suggestion.dept || '', acc: cur.acc || suggestion.acc || '' } }
      })
    }
    setPaymentSuggestions(prev => ({ ...prev, [type]: null }))
  }

  const rejectPaymentSuggestion = (type) => {
    setPaymentSuggestions(prev => ({ ...prev, [type]: null }))
  }

  const clearAllSuggestions = () => {
    setMainSuggestions({ commission: null, tax: null, net: null })
    setSuggestionMeta({ commission: null, tax: null, net: null })
    setPaymentSuggestions({})
  }

  return {
    suggestionMeta,
    mainSuggestions,
    suggestLoading,
    paymentSuggestions,
    setPaymentSuggestions,
    paymentSuggestLoading,
    autoSuggest,
    applyMainSuggestion,
    rejectMainSuggestion,
    autoSuggestPaymentTypes,
    confirmPaymentSuggestion,
    rejectPaymentSuggestion,
    clearAllSuggestions,
  }
}
