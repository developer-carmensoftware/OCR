import { useState, useEffect } from 'react'
import { saveMappingHistory } from '../lib/api/mapping'
import { saveAccountingConfig } from '../lib/api/config'
import { BANK_INFO, BANK_CODE_MAP, BANK_SOURCE_MAP } from '../constants/banks'
import { useBankConfig } from './mapping/useBankConfig'
import { useMappingData } from './mapping/useMappingData'
import { useMappingSuggestions } from './mapping/useMappingSuggestions'
import { usePaymentTypes } from './mapping/usePaymentTypes'

export function useMapping() {
  // Bank config (handles API/localStorage loading, OCR wizard state, bank detection)
  const bankConfig = useBankConfig()

  // Local state for mappings and UI
  const [mappings, setMappings] = useState({
    commission: { dept: '', acc: '' },
    tax: { dept: '', acc: '' },
    net: { dept: '', acc: '' },
  })
  const [activeScan, setActiveScan] = useState({
    paymentTypes: new Set(),
    commission: false,
    tax: false,
    net: false,
  })
  const [modalConfig, setModalConfig] = useState({
    show: false,
    title: '',
    message: '',
    type: 'info',
  })
  const [saving, setSaving] = useState(false)
  const [acceptAllModal, setAcceptAllModal] = useState(false)

  // --- Sub-hooks ---
  const masterData = useMappingData()
  const paymentTypes = usePaymentTypes()

  const suggestions = useMappingSuggestions({
    masterAccounts: masterData.masterAccounts,
    masterDepartments: masterData.masterDepartments,
    mappings,
    paymentAmount: paymentTypes.paymentAmount,
    activeScan,
    customPaymentTypes: paymentTypes.customPaymentTypes,
    setModalConfig,
  })

  // Parse OCR wizard state on mount (for activeScan)
  useEffect(() => {
    try {
      const ocrState = JSON.parse(localStorage.getItem('ocr_wizard_state') || '{}')
      if (ocrState.details && Array.isArray(ocrState.details)) {
        const types = new Set()
        let comm = false,
          tx = false,
          n = false
        const toNum = v => parseFloat(String(v ?? '').replace(/,/g, '')) || 0
        ocrState.details.forEach(d => {
          if (d.Transaction) types.add(d.Transaction)
          if (toNum(d.CommisAmt) > 0) comm = true
          if (toNum(d.TaxAmt) > 0) tx = true
          if (toNum(d.Total) > 0) n = true
        })
        setActiveScan({ paymentTypes: types, commission: comm, tax: tx, net: n })
      }
    } catch {
      /* ignore */
    }
  }, [])

  // --- Handlers ---
  const handleBankChange = selected => {
    bankConfig.setBank(selected)
    if (BANK_INFO[selected]) {
      const info = BANK_INFO[selected]
      bankConfig.setCompany(prev => ({
        ...prev,
        name: info.name,
        taxId: info.taxId,
        address: info.address,
      }))
    }
    if (BANK_SOURCE_MAP[selected]) bankConfig.setFileSource(BANK_SOURCE_MAP[selected])
  }

  const handleCompanyChange = (e, field) => {
    bankConfig.setCompany(prev => ({ ...prev, [field]: e.target.value }))
  }

  const handleMappingChange = (type, field, value) => {
    setMappings(prev => ({ ...prev, [type]: { ...prev[type], [field]: value } }))
    suggestions.rejectMainSuggestion(type)
  }

  const handleAcceptAll = () => {
    // Accept all main suggestions
    setMappings(prev => {
      const next = { ...prev }
      ;['commission', 'tax', 'net'].forEach(key => {
        const s = suggestions.mainSuggestions[key]
        if (s) {
          const cur = next[key] || { dept: '', acc: '' }
          next[key] = { dept: cur.dept || s.dept || '', acc: cur.acc || s.acc || '' }
        }
      })
      return next
    })
    // Accept all payment suggestions
    paymentTypes.setPaymentAmount(prev => {
      const next = { ...prev }
      Object.entries(suggestions.paymentSuggestions).forEach(([type, s]) => {
        if (s) {
          const cur = next[type] || { dept: '', acc: '' }
          next[type] = { dept: cur.dept || s.dept || '', acc: cur.acc || s.acc || '' }
        }
      })
      return next
    })
    suggestions.clearAllSuggestions()
    setAcceptAllModal(false)
  }

  // Validation
  const companyRequiredFields = [
    { key: 'name', label: 'Company Name' },
    { key: 'taxId', label: 'Tax ID' },
    { key: 'branch', label: 'Branch No' },
    { key: 'address', label: 'Address' },
  ]
  const missingCompanyFields = companyRequiredFields.filter(f => !bankConfig.company[f.key]?.trim())
  const topLevelRequired = [
    { key: 'bank', label: 'Bank', value: bankConfig.bank },
    { key: 'filePrefix', label: 'File Prefix', value: bankConfig.filePrefix },
    { key: 'fileSource', label: 'File Source', value: bankConfig.fileSource },
  ]
  const missingTopFields = topLevelRequired.filter(f => !f.value?.trim())

  const saveAllSettings = async (shouldClose = false) => {
    if (saving) return
    const allMissing = [...missingTopFields, ...missingCompanyFields]
    if (allMissing.length > 0) {
      setModalConfig({
        show: true,
        title: 'Please fill in all required fields',
        message: `Please fill in ${allMissing.map(f => f.label).join(', ')} before saving`,
        type: 'error',
      })
      return
    }

    setSaving(true)
    try {
      const config = {
        bank: bankConfig.bank,
        filePrefix: bankConfig.filePrefix,
        fileSource: bankConfig.fileSource,
        description: bankConfig.description,
        company: bankConfig.company,
        mappings,
        paymentAmount: paymentTypes.paymentAmount,
      }
      localStorage.setItem('accountingConfig', JSON.stringify(config))

      const allMappings = { ...mappings }
      Object.entries(paymentTypes.paymentAmount).forEach(([type, val]) => {
        if (val.dept || val.acc) allMappings[type] = val
      })

      // Persist to DB (dual-write — DB is primary, localStorage is cache)
      try {
        await saveAccountingConfig({
          bank_code: BANK_CODE_MAP[bankConfig.bank] || null,
          file_prefix: bankConfig.filePrefix,
          file_source: bankConfig.fileSource,
          description: bankConfig.description,
          branch: bankConfig.company.branch || null,
          mappings: allMappings,
          custom_types: paymentTypes.customPaymentTypes,
        })
      } catch {
        /* ignore — localStorage already saved above */
      }

      if (bankConfig.bank) {
        try {
          await saveMappingHistory({
            bank_code: BANK_CODE_MAP[bankConfig.bank] || bankConfig.bank,
            mappings: allMappings,
          })
        } catch {
          /* ignore */
        }
      }

      if (shouldClose && window.opener) {
        window.close()
      } else {
        window.location.hash = '/CreditCardOCR'
        if (!shouldClose) {
          setModalConfig({
            show: true,
            title: 'Save Successful',
            message: 'Account Mapping settings have been saved successfully.',
            type: 'success',
          })
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const allPaymentTypes = [
    ...activeScan.paymentTypes,
    ...paymentTypes.customPaymentTypes.filter(t => !activeScan.paymentTypes.has(t)),
  ]

  // --- Backward-compatible flat return for existing components ---
  return {
    // Bank config (flat for backward compat)
    bank: bankConfig.bank,
    setBank: bankConfig.setBank,
    handleBankChange,
    filePrefix: bankConfig.filePrefix,
    setFilePrefix: bankConfig.setFilePrefix,
    fileSource: bankConfig.fileSource,
    setFileSource: bankConfig.setFileSource,
    description: bankConfig.description,
    setDescription: bankConfig.setDescription,
    configLoading: bankConfig.configLoading,

    // Company
    company: bankConfig.company,
    setCompany: bankConfig.setCompany,
    handleCompanyChange,
    companyRequiredFields,
    missingCompanyFields,

    // Mappings
    mappings,
    setMappings,
    handleMappingChange,

    // Master data
    masterAccounts: masterData.masterAccounts,
    masterDepartments: masterData.masterDepartments,
    masterGLPrefixes: masterData.masterGLPrefixes,
    loadingOpts: masterData.loadingOpts,
    loadInitialData: masterData.loadInitialData,

    // Payment types
    paymentAmount: paymentTypes.paymentAmount,
    customPaymentTypes: paymentTypes.customPaymentTypes,
    newCustomType: paymentTypes.newCustomType,
    setNewCustomType: paymentTypes.setNewCustomType,
    handlePaymentMappingChange: paymentTypes.handlePaymentMappingChange,
    handleAddCustomType: activeScanPT =>
      paymentTypes.handleAddCustomType(activeScanPT || activeScan.paymentTypes, types =>
        masterData.masterAccounts.length && masterData.masterDepartments.length
          ? suggestions.autoSuggestPaymentTypes(types)
          : null
      ),
    handleRemoveCustomType: paymentTypes.handleRemoveCustomType,
    isAmountModalOpen: paymentTypes.isAmountModalOpen,
    setIsAmountModalOpen: paymentTypes.setIsAmountModalOpen,
    openAmountModal: paymentTypes.openAmountModal,
    cancelAmountSelection: () =>
      paymentTypes.cancelAmountSelection(suggestions.clearAllSuggestions),
    saveAmountSelection: paymentTypes.saveAmountSelection,

    // Scan state
    activeScan,
    allPaymentTypes,

    // AI suggestions
    suggestionMeta: suggestions.suggestionMeta,
    mainSuggestions: suggestions.mainSuggestions,
    suggestLoading: suggestions.suggestLoading,
    autoSuggest: suggestions.autoSuggest,
    confirmMainSuggestion: key => suggestions.applyMainSuggestion(key, setMappings),
    rejectMainSuggestion: suggestions.rejectMainSuggestion,
    paymentSuggestions: suggestions.paymentSuggestions,
    setPaymentSuggestions: suggestions.setPaymentSuggestions,
    paymentSuggestLoading: suggestions.paymentSuggestLoading,
    autoSuggestPaymentTypes: suggestions.autoSuggestPaymentTypes,
    confirmPaymentSuggestion: type =>
      suggestions.confirmPaymentSuggestion(type, paymentTypes.setPaymentAmount),
    rejectPaymentSuggestion: suggestions.rejectPaymentSuggestion,

    // Modal
    modalConfig,
    setModalConfig,

    // Acceptance flow
    acceptAllModal,
    setAcceptAllModal,
    handleAcceptAll,

    // Save
    saving,
    saveAllSettings,

    // Validation
    missingTopFields,

    // --- NEW: Grouped structure for future refactoring (optional) ---
    __grouped: {
      bank: {
        value: bankConfig.bank,
        set: bankConfig.setBank,
        handler: handleBankChange,
      },
      filePrefix: {
        value: bankConfig.filePrefix,
        set: bankConfig.setFilePrefix,
      },
      fileSource: {
        value: bankConfig.fileSource,
        set: bankConfig.setFileSource,
      },
      description: {
        value: bankConfig.description,
        set: bankConfig.setDescription,
      },
      company: {
        value: bankConfig.company,
        set: bankConfig.setCompany,
        handler: handleCompanyChange,
        requiredFields: companyRequiredFields,
        missingFields: missingCompanyFields,
      },
      mappings: {
        value: mappings,
        set: setMappings,
        handler: handleMappingChange,
      },
      masterData: {
        accounts: masterData.masterAccounts,
        departments: masterData.masterDepartments,
        glPrefixes: masterData.masterGLPrefixes,
        loading: masterData.loadingOpts,
        loadInitial: masterData.loadInitialData,
      },
      paymentTypes: {
        amount: paymentTypes.paymentAmount,
        custom: paymentTypes.customPaymentTypes,
        newCustom: paymentTypes.newCustomType,
        setNewCustom: paymentTypes.setNewCustomType,
        handler: paymentTypes.handlePaymentMappingChange,
      },
      scan: {
        state: activeScan,
        allTypes: allPaymentTypes,
      },
      suggestions: {
        meta: suggestions.suggestionMeta,
        main: suggestions.mainSuggestions,
        mainLoading: suggestions.suggestLoading,
        autoSuggest: suggestions.autoSuggest,
      },
      modal: {
        config: modalConfig,
        setConfig: setModalConfig,
      },
    },
  }
}
