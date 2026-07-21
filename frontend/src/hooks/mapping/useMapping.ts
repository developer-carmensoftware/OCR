import { useState, useEffect, useRef } from 'react'
import { saveAccountingConfig } from '../../lib/api/config'
import { appKey } from '../../lib/storage'
import { parseNum } from '../../lib/format'
import { BANK_INFO, BANK_CODE_MAP, BANK_SOURCE_MAP } from '../../constants/banks'
import { useBankConfig } from './useBankConfig'
import { useMappingData } from './useMappingData'
import { useMappingSuggestions } from './useMappingSuggestions'
import { usePaymentTypes } from './usePaymentTypes'
import type { FieldMapping, BankDisplayName } from '../../types/api'
import type { ModalConfig } from '../useModal'
import type { CompanyData } from '../../lib/bankTransforms'
import type { MainMappingKey } from './useMappingSuggestions'

export type MainMappings = Record<MainMappingKey, FieldMapping>

const COMPANY_REQUIRED_FIELDS: Array<{ key: keyof CompanyData; label: string }> = [
  { key: 'name', label: 'Company Name' },
  { key: 'taxId', label: 'Tax ID' },
  { key: 'branch', label: 'Branch No' },
  { key: 'address', label: 'Address' },
]

export interface ActiveScan {
  paymentTypes: Set<string>
  commission: boolean
  tax: boolean
  net: boolean
}

export function useMapping() {
  const bankConfig = useBankConfig()

  const [mappings, setMappings] = useState<MainMappings>({
    commission: { dept: '', acc: '' },
    tax: { dept: '', acc: '' },
    net: { dept: '', acc: '' },
  })
  const [activeScan, setActiveScan] = useState<ActiveScan>({
    paymentTypes: new Set(),
    commission: false,
    tax: false,
    net: false,
  })
  const [modalConfig, setModalConfig] = useState<ModalConfig>({
    show: false,
    title: '',
    message: '',
    type: 'info',
  })
  const [saving, setSaving] = useState(false)
  const [acceptAllModal, setAcceptAllModal] = useState(false)

  const masterData = useMappingData()
  const paymentTypes = usePaymentTypes()

  const suggestions = useMappingSuggestions({
    bankCode: BANK_CODE_MAP[bankConfig.bank as BankDisplayName] || bankConfig.bank || '',
    source: bankConfig.fileSource || '',
    masterAccounts: masterData.masterAccounts,
    masterDepartments: masterData.masterDepartments,
    mappings,
    paymentAmount: paymentTypes.paymentAmount,
    activeScan,
    customPaymentTypes: paymentTypes.customPaymentTypes,
    setModalConfig,
  })

  const configAppliedRef = useRef(false)
  const { initFromData } = paymentTypes

  useEffect(() => {
    if (bankConfig.configLoading || !bankConfig.bank) return
    if (configAppliedRef.current) return

    // Latch only once there is something to apply: `bank` and `savedMappings` land in the
    // same React batch today, but if that ever reorders, latching first would burn the
    // guard on an empty config and the mappings would never restore.
    if (
      Object.keys(bankConfig.savedMappings).length === 0 &&
      bankConfig.savedCustomTypes.length === 0
    )
      return

    configAppliedRef.current = true

    const MAIN_KEYS = new Set<MainMappingKey>(['commission', 'tax', 'net'])
    const mainMappings: Partial<MainMappings> = {}
    const paymentMappings: Record<string, FieldMapping> = {}

    Object.entries(bankConfig.savedMappings).forEach(([field, val]) => {
      const mapping: FieldMapping = { dept: val.dept || '', acc: val.acc || '' }
      if (MAIN_KEYS.has(field as MainMappingKey)) {
        mainMappings[field as MainMappingKey] = mapping
      } else {
        paymentMappings[field] = mapping
      }
    })

    if (Object.keys(mainMappings).length > 0) {
      setMappings(prev => ({ ...prev, ...mainMappings }))
    }
    if (Object.keys(paymentMappings).length > 0 || bankConfig.savedCustomTypes.length > 0) {
      initFromData(paymentMappings, bankConfig.savedCustomTypes)
    }
  }, [
    bankConfig.configLoading,
    bankConfig.bank,
    bankConfig.savedMappings,
    bankConfig.savedCustomTypes,
    initFromData,
  ])

  useEffect(() => {
    const rescan = () => {
      try {
        const ocrState = JSON.parse(localStorage.getItem(appKey('ocr_wizard_state')) || '{}') as {
          details?: Array<Record<string, string>>
        }
        if (ocrState.details && Array.isArray(ocrState.details)) {
          const types = new Set<string>()
          let comm = false,
            tx = false,
            n = false
          ocrState.details.forEach(d => {
            if (d.Transaction) types.add(d.Transaction)
            if (parseNum(d.CommisAmt) > 0) comm = true
            if (parseNum(d.TaxAmt) > 0) tx = true
            if (parseNum(d.Total) > 0) n = true
          })
          setActiveScan({ paymentTypes: types, commission: comm, tax: tx, net: n })
        }
      } catch {
        /* ignore */
      }
    }
    rescan()
    // The snapshot was mount-only, so it went stale when the wizard's line items
    // were edited after this tab opened. Re-scan on focus (user switches back to
    // this tab) and on cross-tab localStorage writes so the required-mapping
    // counts track the live details.
    window.addEventListener('focus', rescan)
    window.addEventListener('storage', rescan)
    return () => {
      window.removeEventListener('focus', rescan)
      window.removeEventListener('storage', rescan)
    }
  }, [])

  const handleBankChange = (selected: BankDisplayName | '') => {
    bankConfig.setBank(selected)
    if (selected && BANK_INFO[selected as BankDisplayName]) {
      const info = BANK_INFO[selected as BankDisplayName]
      bankConfig.setCompany(prev => ({
        ...prev,
        name: info.name,
        taxId: info.taxId,
        address: info.address,
      }))
    }
    // Always overwrite: banks without an assigned GL source code map to '' —
    // leaving the previous bank's source in place would submit a wrong JvhSource.
    if (selected) bankConfig.setFileSource(BANK_SOURCE_MAP[selected as BankDisplayName] ?? '')
  }

  const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    bankConfig.setCompany(prev => ({ ...prev, [field]: e.target.value }))
  }

  const handleMappingChange = (type: string, field: keyof FieldMapping, value: string) => {
    setMappings(prev => ({ ...prev, [type]: { ...prev[type as MainMappingKey], [field]: value } }))
    suggestions.rejectMainSuggestion(type)
  }

  const handlePaymentMappingChange = (type: string, field: keyof FieldMapping, value: string) => {
    paymentTypes.handlePaymentMappingChange(type, field, value)
    suggestions.rejectPaymentSuggestion(type)
  }

  const handleAcceptAll = () => {
    setMappings(prev => {
      const next = { ...prev }
      ;(['commission', 'tax', 'net'] as MainMappingKey[]).forEach(key => {
        const s = suggestions.mainSuggestions[key]
        if (s) {
          const cur = next[key] || { dept: '', acc: '' }
          next[key] = { dept: cur.dept || s.dept || '', acc: cur.acc || s.acc || '' }
        }
      })
      return next
    })
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

  const missingCompanyFields = COMPANY_REQUIRED_FIELDS.filter(
    f => !bankConfig.company[f.key as keyof typeof bankConfig.company]?.trim()
  )
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
      localStorage.setItem(appKey('accountingConfig'), JSON.stringify(config))

      const allMappings: Record<string, FieldMapping> = { ...mappings }
      Object.entries(paymentTypes.paymentAmount).forEach(([type, val]) => {
        if (val.dept || val.acc) allMappings[type] = val
      })

      try {
        await saveAccountingConfig({
          bank_code: bankConfig.bank
            ? BANK_CODE_MAP[bankConfig.bank as BankDisplayName] || null
            : null,
          file_prefix: bankConfig.filePrefix,
          file_source: bankConfig.fileSource,
          description: bankConfig.description,
          branch: bankConfig.company.branch || null,
          mappings: allMappings,
          custom_types: paymentTypes.customPaymentTypes,
        })
        localStorage.setItem(appKey('accounting_config_updated'), Date.now().toString())
      } catch {
        /* ignore — localStorage already saved */
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
    company: bankConfig.company,
    setCompany: bankConfig.setCompany,
    handleCompanyChange,
    companyRequiredFields: COMPANY_REQUIRED_FIELDS,
    missingCompanyFields,
    mappings,
    handleMappingChange,
    masterAccounts: masterData.masterAccounts,
    masterDepartments: masterData.masterDepartments,
    loadingOpts: masterData.loadingOpts,
    loadInitialData: masterData.loadInitialData,
    paymentAmount: paymentTypes.paymentAmount,
    customPaymentTypes: paymentTypes.customPaymentTypes,
    newCustomType: paymentTypes.newCustomType,
    setNewCustomType: paymentTypes.setNewCustomType,
    handlePaymentMappingChange,
    handleAddCustomType: (activeScanPT?: Set<string>) =>
      paymentTypes.handleAddCustomType(activeScanPT || activeScan.paymentTypes, types =>
        masterData.masterAccounts.length && masterData.masterDepartments.length
          ? suggestions.autoSuggestPaymentTypes(types)
          : null
      ),
    handleRemoveCustomType: paymentTypes.handleRemoveCustomType,
    isAmountModalOpen: paymentTypes.isAmountModalOpen,
    openAmountModal: paymentTypes.openAmountModal,
    cancelAmountSelection: () =>
      paymentTypes.cancelAmountSelection(suggestions.clearAllSuggestions),
    saveAmountSelection: paymentTypes.saveAmountSelection,
    activeScan,
    allPaymentTypes,
    suggestionMeta: suggestions.suggestionMeta,
    mainSuggestions: suggestions.mainSuggestions,
    suggestLoading: suggestions.suggestLoading,
    autoSuggest: suggestions.autoSuggest,
    confirmMainSuggestion: (key: MainMappingKey) =>
      suggestions.applyMainSuggestion(key, setMappings),
    rejectMainSuggestion: suggestions.rejectMainSuggestion,
    paymentSuggestions: suggestions.paymentSuggestions,
    paymentSuggestLoading: suggestions.paymentSuggestLoading,
    autoSuggestPaymentTypes: suggestions.autoSuggestPaymentTypes,
    confirmPaymentSuggestion: (type: string) =>
      suggestions.confirmPaymentSuggestion(type, paymentTypes.setPaymentAmount),
    rejectPaymentSuggestion: suggestions.rejectPaymentSuggestion,
    modalConfig,
    setModalConfig,
    acceptAllModal,
    setAcceptAllModal,
    handleAcceptAll,
    saving,
    saveAllSettings,
    missingTopFields,
  }
}

import type React from 'react'
