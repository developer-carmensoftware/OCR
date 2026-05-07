import { useState, useEffect } from 'react'
import { saveMappingHistory } from '../lib/api/mapping'
import { useMappingData } from './mapping/useMappingData'
import { useMappingSuggestions } from './mapping/useMappingSuggestions'
import { usePaymentTypes } from './mapping/usePaymentTypes'

const BANK_INFO = {
  'Bangkok Bank (BBL)': {
    name: 'ธนาคารกรุงเทพ จำกัด (มหาชน)',
    taxId: '0107536000374',
    address: '333 ถนนสีลม เขตบางรัก กรุงเทพฯ 10500',
  },
  'Kasikornbank (KBANK)': {
    name: 'บมจ. ธนาคารกสิกรไทย',
    taxId: '0107536000315',
    address: '400/22 ถนนพหลโยธิน แขวงสามเสนใน เขตพญาไท กรุงเทพมหานคร 10400',
  },
  'Siam Commercial Bank (SCB)': {
    name: 'ธนาคารไทยพาณิชย์ จํากัด (มหาชน)',
    taxId: '0107536000102',
    address: '9 ถนนรัชดาภิเษก เขตจตุจักร กรุงเทพฯ 10900',
  },
}

const BANK_SOURCE_MAP = {
  'Bangkok Bank (BBL)': 'ACBB',
  'Kasikornbank (KBANK)': 'ACKB',
  'Siam Commercial Bank (SCB)': 'ACSC',
}

const OCR_BANK_MAP = {
  BBL: 'Bangkok Bank (BBL)',
  KBANK: 'Kasikornbank (KBANK)',
  SCB: 'Siam Commercial Bank (SCB)',
}

export function useMapping() {
  const [bank, setBank] = useState('')
  const [filePrefix, setFilePrefix] = useState('IC')
  const [fileSource, setFileSource] = useState('')
  const [description, setDescription] = useState('')
  const [company, setCompany] = useState({ name: '', taxId: '', branch: '', address: '' })
  const [mappings, setMappings] = useState({ commission: { dept: '', acc: '' }, tax: { dept: '', acc: '' }, net: { dept: '', acc: '' } })
  const [activeScan, setActiveScan] = useState({ paymentTypes: new Set(), commission: false, tax: false, net: false })
  const [modalConfig, setModalConfig] = useState({ show: false, title: '', message: '', type: 'info' })
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

  // --- Init effect ---
  useEffect(() => {
    masterData.loadInitialData()

    const detectBankFromCompanyName = (name) => {
      if (!name) return ''
      if (name.includes('กรุงเทพ')) return 'Bangkok Bank (BBL)'
      if (name.includes('กสิกร')) return 'Kasikornbank (KBANK)'
      if (name.includes('ไทยพาณิชย์')) return 'Siam Commercial Bank (SCB)'
      return ''
    }

    let ocrBank = ''
    let ocrCompany = {}
    try {
      const ocrState = JSON.parse(localStorage.getItem('ocr_wizard_state') || '{}')
      ocrBank = OCR_BANK_MAP[ocrState.bank] || ''

      if (ocrState.details && Array.isArray(ocrState.details)) {
        const types = new Set()
        let comm = false, tx = false, n = false
        const toNum = (v) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0
        ocrState.details.forEach(d => {
          if (d.Transaction) types.add(d.Transaction)
          if (toNum(d.CommisAmt) > 0) comm = true
          if (toNum(d.TaxAmt) > 0) tx = true
          if (toNum(d.Total) > 0) n = true
        })
        setActiveScan({ paymentTypes: types, commission: comm, tax: tx, net: n })
      }

      const ocrConfig = JSON.parse(localStorage.getItem('accountingConfig') || '{}')
      ocrCompany = ocrConfig.company || {}
    } catch { /* ignore */ }

    const config = localStorage.getItem('accountingConfig')
    if (config) {
      try {
        const parsed = JSON.parse(config)
        const detectedBank = detectBankFromCompanyName(parsed.company?.name || ocrCompany?.name)
        const finalBank = parsed.bank || ocrBank || detectedBank
        setBank(finalBank)
        setFilePrefix(parsed.filePrefix || 'IC')
        setFileSource(parsed.fileSource || BANK_SOURCE_MAP[finalBank] || '')
        setDescription(parsed.description || '')

        let companyData = { name: '', taxId: '', branch: '', address: '' }
        if (parsed.company) {
          companyData = { ...companyData, ...parsed.company }
        } else if (Object.keys(ocrCompany).length) {
          companyData = { ...companyData, ...ocrCompany }
        }
        if (finalBank && BANK_INFO[finalBank]) {
          const info = BANK_INFO[finalBank]
          companyData.name = info.name
          companyData.taxId = info.taxId
          companyData.address = info.address
        }
        setCompany(companyData)
        if (parsed.mappings) setMappings(prev => ({ ...prev, ...parsed.mappings }))
      } catch { /* ignore */ }
    } else if (ocrBank) {
      setBank(ocrBank)
      setFilePrefix('IC')
      setFileSource(BANK_SOURCE_MAP[ocrBank] || '')
      let companyData = { name: '', taxId: '', branch: '', address: '' }
      if (Object.keys(ocrCompany).length) companyData = { ...companyData, ...ocrCompany }
      if (BANK_INFO[ocrBank]) {
        const info = BANK_INFO[ocrBank]
        companyData.name = info.name
        companyData.taxId = info.taxId
        companyData.address = info.address
      }
      setCompany(companyData)
    } else {
      setFilePrefix('IC')
    }

    paymentTypes.loadPaymentAmountFromStorage()
  }, [])

  // --- Handlers ---
  const handleBankChange = (selected) => {
    setBank(selected)
    if (BANK_INFO[selected]) {
      const info = BANK_INFO[selected]
      setCompany(prev => ({ ...prev, name: info.name, taxId: info.taxId, address: info.address }))
    }
    if (BANK_SOURCE_MAP[selected]) setFileSource(BANK_SOURCE_MAP[selected])
  }

  const handleCompanyChange = (e, field) => {
    setCompany(prev => ({ ...prev, [field]: e.target.value }))
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
  const missingCompanyFields = companyRequiredFields.filter(f => !company[f.key]?.trim())
  const topLevelRequired = [
    { key: 'bank', label: 'Bank', value: bank },
    { key: 'filePrefix', label: 'File Prefix', value: filePrefix },
    { key: 'fileSource', label: 'File Source', value: fileSource },
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
      const config = { bank, filePrefix, fileSource, description, company, mappings, paymentAmount: paymentTypes.paymentAmount }
      localStorage.setItem('accountingConfig', JSON.stringify(config))

      if (bank) {
        const allMappings = { ...mappings }
        Object.entries(paymentTypes.paymentAmount).forEach(([type, val]) => {
          if (val.dept || val.acc) allMappings[type] = val
        })
        try {
          await saveMappingHistory({ bank_name: bank, mappings: allMappings })
        } catch { /* ignore */ }
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

  return {
    // Master data
    masterAccounts: masterData.masterAccounts,
    masterDepartments: masterData.masterDepartments,
    masterGLPrefixes: masterData.masterGLPrefixes,
    loadingOpts: masterData.loadingOpts,
    loadInitialData: masterData.loadInitialData,
    // Top-level config
    bank, setBank, handleBankChange,
    filePrefix, setFilePrefix,
    fileSource, setFileSource,
    description, setDescription,
    // Company
    company, setCompany, handleCompanyChange,
    // Mappings
    mappings, setMappings, handleMappingChange,
    // Payment types (from usePaymentTypes)
    paymentAmount: paymentTypes.paymentAmount,
    handlePaymentMappingChange: paymentTypes.handlePaymentMappingChange,
    customPaymentTypes: paymentTypes.customPaymentTypes,
    newCustomType: paymentTypes.newCustomType,
    setNewCustomType: paymentTypes.setNewCustomType,
    handleAddCustomType: (activeScanPT) =>
      paymentTypes.handleAddCustomType(
        activeScanPT || activeScan.paymentTypes,
        (types) => masterData.masterAccounts.length && masterData.masterDepartments.length
          ? suggestions.autoSuggestPaymentTypes(types)
          : null
      ),
    handleRemoveCustomType: paymentTypes.handleRemoveCustomType,
    isAmountModalOpen: paymentTypes.isAmountModalOpen,
    setIsAmountModalOpen: paymentTypes.setIsAmountModalOpen,
    openAmountModal: paymentTypes.openAmountModal,
    cancelAmountSelection: () => paymentTypes.cancelAmountSelection(suggestions.clearAllSuggestions),
    saveAmountSelection: paymentTypes.saveAmountSelection,
    // Scan state
    activeScan,
    allPaymentTypes,
    // Modal
    modalConfig, setModalConfig,
    // Save
    saving, saveAllSettings,
    acceptAllModal, setAcceptAllModal, handleAcceptAll,
    // AI suggestions (from useMappingSuggestions)
    suggestionMeta: suggestions.suggestionMeta,
    mainSuggestions: suggestions.mainSuggestions,
    suggestLoading: suggestions.suggestLoading,
    autoSuggest: suggestions.autoSuggest,
    confirmMainSuggestion: (key) => suggestions.applyMainSuggestion(key, setMappings),
    rejectMainSuggestion: suggestions.rejectMainSuggestion,
    paymentSuggestions: suggestions.paymentSuggestions,
    setPaymentSuggestions: suggestions.setPaymentSuggestions,
    paymentSuggestLoading: suggestions.paymentSuggestLoading,
    autoSuggestPaymentTypes: suggestions.autoSuggestPaymentTypes,
    confirmPaymentSuggestion: (type) => suggestions.confirmPaymentSuggestion(type, paymentTypes.setPaymentAmount),
    rejectPaymentSuggestion: suggestions.rejectPaymentSuggestion,
    // Validation
    companyRequiredFields, missingCompanyFields, missingTopFields,
  }
}
