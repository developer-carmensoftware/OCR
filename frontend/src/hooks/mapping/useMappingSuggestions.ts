import { useState } from 'react'
import { suggestMapping, suggestPaymentTypes } from '../../lib/api/mapping'
import type { FieldMapping } from '../../types/api'
import type { MasterAccount, MasterDepartment } from './useMappingData'
import type { ModalConfig } from '../useModal'

export type SuggestionSource = 'ai' | 'history' | null | undefined

export interface Suggestion extends FieldMapping {
  source?: SuggestionSource
}

export type MainMappingKey = 'commission' | 'tax' | 'net'

export interface MappingSuggestionsProps {
  bankCode: string
  source?: string
  masterAccounts: MasterAccount[]
  masterDepartments: MasterDepartment[]
  mappings: Record<MainMappingKey, FieldMapping>
  paymentAmount: Record<string, FieldMapping>
  activeScan: { paymentTypes: Set<string> }
  customPaymentTypes: string[]
  setModalConfig: (config: ModalConfig) => void
}

export interface MappingSuggestionsHook {
  suggestionMeta: Record<MainMappingKey, SuggestionSource>
  mainSuggestions: Record<MainMappingKey, Suggestion | null>
  suggestLoading: boolean
  paymentSuggestions: Record<string, Suggestion | null>
  setPaymentSuggestions: React.Dispatch<React.SetStateAction<Record<string, Suggestion | null>>>
  paymentSuggestLoading: boolean
  autoSuggest: () => Promise<void>
  applyMainSuggestion: (
    key: MainMappingKey,
    setMappings: React.Dispatch<React.SetStateAction<Record<MainMappingKey, FieldMapping>>>
  ) => void
  rejectMainSuggestion: (key: string) => void
  autoSuggestPaymentTypes: (specificTypes?: string[] | null) => Promise<void>
  confirmPaymentSuggestion: (
    type: string,
    setPaymentAmount: React.Dispatch<React.SetStateAction<Record<string, FieldMapping>>>
  ) => void
  rejectPaymentSuggestion: (type: string) => void
  clearAllSuggestions: () => void
}

import type React from 'react'

export function useMappingSuggestions({
  bankCode,
  source,
  masterAccounts,
  masterDepartments,
  mappings,
  paymentAmount,
  activeScan,
  customPaymentTypes,
  setModalConfig,
}: MappingSuggestionsProps): MappingSuggestionsHook {
  const [suggestionMeta, setSuggestionMeta] = useState<Record<MainMappingKey, SuggestionSource>>({
    commission: null,
    tax: null,
    net: null,
  })
  const [mainSuggestions, setMainSuggestions] = useState<Record<MainMappingKey, Suggestion | null>>(
    {
      commission: null,
      tax: null,
      net: null,
    }
  )
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [paymentSuggestions, setPaymentSuggestions] = useState<Record<string, Suggestion | null>>(
    {}
  )
  const [paymentSuggestLoading, setPaymentSuggestLoading] = useState(false)

  const autoSuggest = async () => {
    if (!masterAccounts.length) return

    const fieldsToFetch = (['commission', 'tax', 'net'] as MainMappingKey[]).filter(
      f =>
        (!mappings[f] || !mappings[f].dept || !mappings[f].acc) &&
        !(mainSuggestions[f] && mainSuggestions[f]?.source === 'history')
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
        bank_code: bankCode,
        source: source || null,
        accounts: masterAccounts.map(a => ({ code: a.code, name: a.name, type: a.type })),
        departments: masterDepartments.map(d => ({ code: d.code, name: d.name })),
      })

      const suggestKeyMap: Record<MainMappingKey, string> = {
        commission: 'Credit card commission',
        tax: 'Input Tax',
        net: 'Bank Account',
      }
      const fromAI: Partial<Record<MainMappingKey, Suggestion>> = {}
      fieldsToFetch.forEach(f => {
        const s =
          ((aiResult.suggestions || {}) as Record<string, FieldMapping | null>)[suggestKeyMap[f]] ||
          {}
        const sm = s as FieldMapping
        if (sm.dept || sm.acc) fromAI[f] = { dept: sm.dept || '', acc: sm.acc || '' }
      })

      if (Object.keys(fromAI).length > 0) {
        setMainSuggestions(prev => {
          const next = { ...prev }
          ;(Object.entries(fromAI) as [MainMappingKey, Suggestion][]).forEach(([k, v]) => {
            next[k] = {
              dept: v.dept || prev[k]?.dept || '',
              acc: v.acc || prev[k]?.acc || '',
              source: 'ai',
            }
          })
          return next
        })
        setSuggestionMeta(prev => {
          const next = { ...prev }
          Object.keys(fromAI).forEach(k => {
            next[k as MainMappingKey] = 'ai'
          })
          return next
        })
      }
    } catch (err) {
      console.error('[Mapping] AI suggest failed:', err)
    } finally {
      setSuggestLoading(false)
    }
  }

  const applyMainSuggestion = (
    key: MainMappingKey,
    setMappings: React.Dispatch<React.SetStateAction<Record<MainMappingKey, FieldMapping>>>
  ) => {
    const suggestion = mainSuggestions[key]
    if (suggestion) {
      setMappings(prev => {
        const cur = prev[key] || { dept: '', acc: '' }
        return {
          ...prev,
          [key]: { dept: cur.dept || suggestion.dept || '', acc: cur.acc || suggestion.acc || '' },
        }
      })
    }
    setMainSuggestions(prev => ({ ...prev, [key]: null }))
    setSuggestionMeta(prev => ({ ...prev, [key]: null }))
  }

  const rejectMainSuggestion = (key: string) => {
    setMainSuggestions(prev => ({ ...prev, [key]: null }))
    setSuggestionMeta(prev => ({ ...prev, [key as MainMappingKey]: null }))
  }

  const autoSuggestPaymentTypes = async (specificTypes: string[] | null = null) => {
    if (!masterAccounts.length) return
    setPaymentSuggestLoading(true)

    const allTypes = specificTypes || [...activeScan.paymentTypes, ...customPaymentTypes]
    const needsAI = allTypes.filter(
      t =>
        (!paymentAmount[t] || !paymentAmount[t].dept || !paymentAmount[t].acc) &&
        !(paymentSuggestions[t] && paymentSuggestions[t]?.source === 'history')
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
        bank_code: bankCode,
        source: source || null,
        payment_types: needsAI,
        accounts: masterAccounts.map(a => ({ code: a.code, name: a.name, type: a.type })),
        departments: masterDepartments.map(d => ({ code: d.code, name: d.name })),
      })
      const newSuggestions: Record<string, Suggestion> = {}
      Object.entries(result.suggestions || {}).forEach(([t, val]) => {
        if (val && (val.dept || val.acc))
          newSuggestions[t] = { dept: val.dept || null, acc: val.acc || null, source: 'ai' }
      })
      setPaymentSuggestions(prev => ({ ...prev, ...newSuggestions }))
    } catch (err) {
      console.error('AI payment type suggest failed:', err)
    } finally {
      setPaymentSuggestLoading(false)
    }
  }

  const confirmPaymentSuggestion = (
    type: string,
    setPaymentAmount: React.Dispatch<React.SetStateAction<Record<string, FieldMapping>>>
  ) => {
    const suggestion = paymentSuggestions[type]
    if (suggestion) {
      setPaymentAmount(prev => {
        const cur = prev[type] || { dept: '', acc: '' }
        return {
          ...prev,
          [type]: { dept: cur.dept || suggestion.dept || '', acc: cur.acc || suggestion.acc || '' },
        }
      })
    }
    setPaymentSuggestions(prev => ({ ...prev, [type]: null }))
  }

  const rejectPaymentSuggestion = (type: string) => {
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
