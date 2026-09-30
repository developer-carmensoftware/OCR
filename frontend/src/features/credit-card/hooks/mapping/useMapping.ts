import { useState, useEffect, useRef } from 'react'
import { useT } from '@/i18n/LanguageContext'
import type { TKey } from '@/i18n/dict'
import { saveAccountingConfig } from '@/shared/api/config'
import { saveARSettings, type PostType } from '@/features/credit-card/api/arReconcile'
import { appKey, writeAccountingConfig } from '@/shared/lib/storage'
import { isAccountAllowed, mergeSuggestion } from '@/shared/lib/deptAccounts'
import { glFieldLabel } from '../../lib/glFieldLabels'
import { parseNum } from '@/shared/lib/format'
import { BANK_INFO, BANK_CODE_MAP, BANK_SOURCE_MAP } from '@/shared/constants/banks'
import { useBankConfig } from './useBankConfig'
import { useMappingData } from './useMappingData'
import { useMappingSuggestions } from './useMappingSuggestions'
import { usePaymentTypes } from './usePaymentTypes'
import { isSettlementSource } from './useSettlementMapping'
import type { AddError } from '@/features/credit-card/components/payment-mapping/types'
import type { FieldMapping, BankDisplayName } from '@/shared/types/api'
import type { ModalConfig } from '@/shared/hooks/useModal'
import type { CompanyData } from '@/features/credit-card/lib/bankTransforms'
import type { MainMappingKey } from './useMappingSuggestions'

export type MainMappings = Record<MainMappingKey, FieldMapping>

// `labelKey`, not `label`: the same list names the fields in the form and names them again
// in the "fill these in" modal, so one translated string has to reach both.
const COMPANY_REQUIRED_FIELDS: Array<{ key: keyof CompanyData; labelKey: TKey }> = [
  { key: 'name', labelKey: 'cc.companyName' },
  { key: 'taxId', labelKey: 'cc.companyTaxId' },
  { key: 'branch', labelKey: 'cc.companyBranch' },
  { key: 'address', labelKey: 'cc.companyAddress' },
]

export interface ActiveScan {
  paymentTypes: Set<string>
  commission: boolean
  tax: boolean
  net: boolean
}

export function useMapping() {
  const { t } = useT()
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

  // Which bank's data was last applied to `mappings`/`paymentAmount` — not a one-shot
  // latch, because switching the bank dropdown fetches and must apply a *different*
  // bank's mappings. Keyed off `mappingsBankCode` rather than `bank`: that field only
  // ever changes in the same batch as `savedMappings`/`savedCustomTypes` (see
  // useBankConfig), so there is no window where this fires on a bank whose mappings
  // have not actually landed yet.
  const appliedBankCodeRef = useRef<string | null | undefined>(undefined)
  // This bank's settlement-report entries exactly as loaded. `useSettlementMapping` owns
  // and saves them; this copy is only what a save sends when that hook has nothing to
  // give (still loading) — the PUT replaces every entry of the bank, so leaving them out
  // would delete them.
  const settlementEntriesRef = useRef<Record<string, FieldMapping>>({})
  const { initFromData, resetPaymentTypes } = paymentTypes

  useEffect(() => {
    if (bankConfig.configLoading) return
    if (appliedBankCodeRef.current === bankConfig.mappingsBankCode) return
    appliedBankCodeRef.current = bankConfig.mappingsBankCode

    const MAIN_KEYS = new Set<MainMappingKey>(['commission', 'tax', 'net'])
    const mainMappings: MainMappings = {
      commission: { dept: '', acc: '' },
      tax: { dept: '', acc: '' },
      net: { dept: '', acc: '' },
    }
    const paymentMappings: Record<string, FieldMapping> = {}
    const settlementEntries: Record<string, FieldMapping> = {}

    Object.entries(bankConfig.savedMappings).forEach(([field, val]) => {
      const mapping: FieldMapping = { dept: val.dept || '', acc: val.acc || '' }
      if (MAIN_KEYS.has(field as MainMappingKey)) {
        mainMappings[field as MainMappingKey] = mapping
      } else if (isSettlementSource(val.source)) {
        // Not a fee-invoice payment type: listing it here too put every settlement key in
        // the payment-type dialog twice, and a settlement type removed there came back
        // on save, untagged, from this list.
        settlementEntries[field] = val
      } else {
        paymentMappings[field] = mapping
      }
    })
    settlementEntriesRef.current = settlementEntries

    // Full replace, not merge: a bank switch must not carry the previous bank's fixed
    // fields or payment types forward. `initFromData` merges on purpose — it preserves
    // edits nobody has saved yet (usePaymentTypes.test.ts pins that) — so the
    // payment-type side is cleared first and initFromData then seeds it from a blank
    // slate. The bootstrap case (nothing to clear yet) behaves exactly as before.
    setMappings(mainMappings)
    resetPaymentTypes()
    initFromData(
      paymentMappings,
      bankConfig.savedCustomTypes.filter(code => !(code in settlementEntries))
    )
  }, [
    bankConfig.configLoading,
    bankConfig.mappingsBankCode,
    bankConfig.savedMappings,
    bankConfig.savedCustomTypes,
    initFromData,
    resetPaymentTypes,
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
    setMappings(prev => {
      const cur = prev[type as MainMappingKey]
      const next = { ...cur, [field]: value }
      // Dept change that forbids the current account (Carmen DefaultAccount) clears it.
      if (field === 'dept' && !isAccountAllowed(value, next.acc, masterData.masterDepartments)) {
        next.acc = ''
      }
      return { ...prev, [type]: next }
    })
    suggestions.rejectMainSuggestion(type)
  }

  const handlePaymentMappingChange = (type: string, field: keyof FieldMapping, value: string) => {
    paymentTypes.handlePaymentMappingChange(type, field, value)
    if (
      field === 'dept' &&
      !isAccountAllowed(value, paymentTypes.paymentAmount[type]?.acc, masterData.masterDepartments)
    ) {
      paymentTypes.handlePaymentMappingChange(type, 'acc', '')
    }
    suggestions.rejectPaymentSuggestion(type)
  }

  const handleAcceptAll = () => {
    setMappings(prev => {
      const next = { ...prev }
      ;(['commission', 'tax', 'net'] as MainMappingKey[]).forEach(key => {
        const s = suggestions.mainSuggestions[key]
        if (s) {
          const cur = next[key] || { dept: '', acc: '' }
          next[key] = mergeSuggestion(cur, s, masterData.masterDepartments)
        }
      })
      return next
    })
    paymentTypes.setPaymentAmount(prev => {
      const next = { ...prev }
      Object.entries(suggestions.paymentSuggestions).forEach(([type, s]) => {
        if (s) {
          const cur = next[type] || { dept: '', acc: '' }
          next[type] = mergeSuggestion(cur, s, masterData.masterDepartments)
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
  const topLevelRequired: Array<{ key: string; labelKey: TKey; value: string }> = [
    { key: 'bank', labelKey: 'cc.cfgBank', value: bankConfig.bank },
    { key: 'filePrefix', labelKey: 'cc.cfgFilePrefix', value: bankConfig.filePrefix },
    { key: 'fileSource', labelKey: 'cc.cfgFileSource', value: bankConfig.fileSource },
  ]
  const missingTopFields = topLevelRequired.filter(f => !f.value?.trim())

  /** What the merged page's Settlement card contributes to a save — omitted entirely
   *  for a bank with no settlement layout, since there is then nothing to add. No
   *  `template` any more (Ticket D, 2026-09-22) — a settlement JV's wording is
   *  `bankConfig.description`/`bankDescriptions`, already part of the one
   *  `saveAccountingConfig` call below. */
  interface SettlementSave {
    hasSettlementLayout: boolean
    mappingsToSave: Record<string, FieldMapping>
    postType: PostType
    bankCode: string
  }

  const saveAllSettings = async (shouldClose = false, settlement?: SettlementSave) => {
    if (saving) return
    const allMissing = [...missingTopFields, ...missingCompanyFields]
    if (allMissing.length > 0) {
      setModalConfig({
        show: true,
        title: t('cc.valRequiredTitle'),
        message: t('cc.valRequiredMsg', {
          fields: allMissing.map(f => t(f.labelKey)).join(', '),
        }),
        type: 'error',
      })
      return
    }

    // Block saving pairs the dept's DefaultAccount forbids — they'd fail at Carmen.
    // Only types visible in the UI (main fields + scan/custom payment types) are
    // gated: a stale hidden entry would otherwise dead-end the Save with no row to fix.
    const visibleTypes = new Set([...activeScan.paymentTypes, ...paymentTypes.customPaymentTypes])
    const illegalPairs = [
      ...Object.entries(mappings).map(([k, m]) => ({ label: k, ...m })),
      ...Object.entries(paymentTypes.paymentAmount)
        .filter(([k]) => visibleTypes.has(k))
        .map(([k, m]) => ({ label: k, ...m })),
    ].filter(m => m.dept && m.acc && !isAccountAllowed(m.dept, m.acc, masterData.masterDepartments))
    if (illegalPairs.length > 0) {
      setModalConfig({
        show: true,
        title: t('cc.valIllegalTitle'),
        // `label` is the config key, so the three fixed ones read as storage names
        // ('commission') unless they go through the shared display map first.
        message: t('cc.valIllegalMsg', {
          pairs: illegalPairs
            .map(m =>
              t('cc.valIllegalPair', {
                label: glFieldLabel(m.label, t),
                acc: m.acc ?? '',
                dept: m.dept ?? '',
              })
            )
            .join('\n'),
        }),
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
        bankDescriptions: bankConfig.bankDescriptions,
        company: bankConfig.company,
        mappings,
        paymentAmount: paymentTypes.paymentAmount,
      }
      writeAccountingConfig(config)

      const allMappings: Record<string, FieldMapping> = { ...mappings }
      Object.entries(paymentTypes.paymentAmount).forEach(([type, val]) => {
        if (val.dept || val.acc) allMappings[type] = val
      })
      // The Settlement card's own rows (both Detail and Summary, source-tagged) — the
      // same table now (decision #3), so they travel in the one PUT rather than a
      // mapping payload of their own. Without that hook's rows, what was loaded goes back
      // unchanged: the PUT replaces the bank's entries, so absent means deleted.
      Object.assign(
        allMappings,
        settlement ? settlement.mappingsToSave : settlementEntriesRef.current
      )

      try {
        await saveAccountingConfig({
          bank_code: bankConfig.bank
            ? BANK_CODE_MAP[bankConfig.bank as BankDisplayName] || null
            : null,
          file_prefix: bankConfig.filePrefix,
          file_source: bankConfig.fileSource,
          description: bankConfig.description,
          bank_descriptions: bankConfig.bankDescriptions,
          branch: bankConfig.company.branch || null,
          mappings: allMappings,
          custom_types: paymentTypes.customPaymentTypes,
        })
        localStorage.setItem(appKey('accounting_config_updated'), Date.now().toString())
      } catch {
        /* ignore — localStorage already saved */
      }

      // Rules first, JV posting profile second — same order and the same reasoning
      // ReviewDocument.approve() uses for rules-then-JV: a correction is right on its
      // own regardless of what happens next, so it is not worth losing behind a
      // partial-save rollback. A bank with no settlement layout has nothing here to
      // send at all.
      if (settlement?.hasSettlementLayout) {
        try {
          await saveARSettings({
            bank_code: settlement.bankCode,
            post_type: settlement.postType,
          })
        } catch (err) {
          setSaving(false)
          setModalConfig({
            show: true,
            title: t('cc.saveSettlementFailedTitle'),
            message: t('cc.saveSettlementFailedMsg', {
              detail: err instanceof Error ? err.message : '',
            }),
            type: 'error',
          })
          return
        }
      }

      if (shouldClose && window.opener) {
        window.close()
      } else {
        window.location.hash = '/CreditCardOCR'
        if (!shouldClose) {
          setModalConfig({
            show: true,
            title: t('cc.saveSuccessTitle'),
            message: t('cc.saveSuccessMsg'),
            type: 'success',
          })
        }
      }
    } finally {
      setSaving(false)
    }
  }

  /** Bulk apply for fee-invoice payment types — one write, the same dept→account rule as a
   *  single edit, and each row's open suggestion answered by the edit. */
  const applyPaymentMappings = (codes: string[], patch: { dept?: string; acc?: string }) => {
    paymentTypes.setPaymentAmount(prev => {
      const next = { ...prev }
      for (const code of codes) {
        const m: FieldMapping = {
          ...next[code],
          dept: patch.dept ?? next[code]?.dept ?? '',
          acc: patch.acc ?? next[code]?.acc ?? '',
        }
        if (patch.dept !== undefined && patch.acc === undefined) {
          if (!isAccountAllowed(m.dept, m.acc, masterData.masterDepartments)) m.acc = ''
        }
        next[code] = m
      }
      return next
    })
    codes.forEach(code => suggestions.rejectPaymentSuggestion(code))
  }

  /** Adds a fee-invoice payment type and asks the AI for it straight away, like a scanned
   *  one. `taken` holds other sets' codes, so a key is never listed in two places. */
  const addPaymentType = (raw: string, taken: Set<string>): AddError => {
    const all = new Set([...taken, ...activeScan.paymentTypes])
    const err = paymentTypes.addCustomType(raw, all)
    if (!err && masterData.masterAccounts.length && masterData.masterDepartments.length) {
      void suggestions.autoSuggestPaymentTypes([raw.trim().toUpperCase()])
    }
    return err
  }

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
    bankDescriptions: bankConfig.bankDescriptions,
    setBankDescriptions: bankConfig.setBankDescriptions,
    configLoading: bankConfig.configLoading,
    // The full merged dict as last loaded from the server (source-tagged), for the
    // Settlement card to seed its own Detail/Summary rows from without a second fetch.
    savedMappings: bankConfig.savedMappings,
    mappingsBankCode: bankConfig.mappingsBankCode,
    company: bankConfig.company,
    setCompany: bankConfig.setCompany,
    handleCompanyChange,
    companyRequiredFields: COMPANY_REQUIRED_FIELDS,
    missingCompanyFields,
    mappings,
    handleMappingChange,
    masterAccounts: masterData.masterAccounts,
    masterDepartments: masterData.masterDepartments,
    masterGLPrefixes: masterData.masterGLPrefixes,
    loadingOpts: masterData.loadingOpts,
    loadInitialData: masterData.loadInitialData,
    paymentAmount: paymentTypes.paymentAmount,
    customPaymentTypes: paymentTypes.customPaymentTypes,
    handlePaymentMappingChange,
    applyPaymentMappings,
    addPaymentType,
    handleRemoveCustomType: paymentTypes.handleRemoveCustomType,
    isAmountModalOpen: paymentTypes.isAmountModalOpen,
    openAmountModal: paymentTypes.openAmountModal,
    cancelAmountSelection: () =>
      paymentTypes.cancelAmountSelection(suggestions.clearAllSuggestions),
    // Legality gate lives in PaymentMappingDialog's Done handler (it switches to the
    // failing row) — an error modal naming a row the reader cannot see confused users.
    saveAmountSelection: paymentTypes.saveAmountSelection,
    activeScan,
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
