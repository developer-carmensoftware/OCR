import { useState, useEffect } from 'react'
import { getAccountingConfig } from '../../lib/api/config'
import {
  detectBankFromCompanyName,
  BANK_INFO,
  BANK_CODE_MAP,
  BANK_SOURCE_MAP,
} from '../../constants/banks'
import { normalizeConfigShape, codeToDisplayName } from '../../lib/bankTransforms'
import { appKey, readAccountingConfig } from '../../lib/storage'
import type { BankDisplayName, FieldMapping } from '../../types/api'
import type { CompanyData } from '../../lib/bankTransforms'

export interface BankConfigHook {
  bank: BankDisplayName | ''
  setBank: React.Dispatch<React.SetStateAction<BankDisplayName | ''>>
  filePrefix: string
  setFilePrefix: React.Dispatch<React.SetStateAction<string>>
  fileSource: string
  setFileSource: React.Dispatch<React.SetStateAction<string>>
  description: string
  setDescription: React.Dispatch<React.SetStateAction<string>>
  /** bank_code -> description, for a BU whose banks should not all read alike. */
  bankDescriptions: Record<string, string>
  setBankDescriptions: React.Dispatch<React.SetStateAction<Record<string, string>>>
  company: CompanyData
  setCompany: React.Dispatch<React.SetStateAction<CompanyData>>
  configLoading: boolean
  savedMappings: Record<string, FieldMapping>
  savedCustomTypes: string[]
  /** Which bank_code `savedMappings`/`savedCustomTypes` belong to — always updated in the
   *  same batch as those two, so a consumer can key a "new bank's data just landed" effect
   *  off this instead of off `bank` (which changes one render before the fetch for it
   *  resolves). Null before anything has loaded or when no bank is selected. */
  mappingsBankCode: string | null
}

import type React from 'react'

export function useBankConfig(): BankConfigHook {
  const [configLoading, setConfigLoading] = useState(true)
  const [bank, setBank] = useState<BankDisplayName | ''>('')
  const [filePrefix, setFilePrefix] = useState('IC')
  const [fileSource, setFileSource] = useState('')
  const [description, setDescription] = useState('')
  const [bankDescriptions, setBankDescriptions] = useState<Record<string, string>>({})
  const [company, setCompany] = useState<CompanyData>({
    name: '',
    taxId: '',
    branch: '',
    address: '',
  })
  const [savedMappings, setSavedMappings] = useState<Record<string, FieldMapping>>({})
  const [savedCustomTypes, setSavedCustomTypes] = useState<string[]>([])
  const [mappingsBankCode, setMappingsBankCode] = useState<string | null>(null)

  useEffect(() => {
    let ocrBank: BankDisplayName | '' = ''
    let ocrBranch = ''
    try {
      const ocrState = JSON.parse(
        localStorage.getItem(appKey('ocr_wizard_state')) || '{}'
      ) as Record<string, unknown>
      ocrBank = codeToDisplayName(ocrState.bank as string) || ''
    } catch {
      /* ignore */
    }
    // Branch comes off the document (useOcrExtraction writes it here); the saved
    // accounting config has no branch of its own, so it must not blank this out.
    ocrBranch = readAccountingConfig().company?.branch || ''
    // The wizard's own bank wins over the config's stored default (normalizeConfigShape
    // below does the same), so the mappings this fetches must be scoped to it — otherwise
    // the dropdown would show `ocrBank` while displaying a different bank's GL mappings.
    const ocrBankCode = ocrBank ? BANK_CODE_MAP[ocrBank] : undefined

    const applyConfig = (source: Record<string, unknown>) => {
      const normalized = normalizeConfigShape(source, ocrBank, detectBankFromCompanyName)
      setBank(normalized.finalBank)
      setFilePrefix(normalized.finalPrefix)
      setFileSource(normalized.finalSource)
      setDescription((source.description as string) || '')
      setBankDescriptions(
        (source.bank_descriptions as Record<string, string>) ??
          (source.bankDescriptions as Record<string, string>) ??
          {}
      )
      setCompany({
        ...normalized.companyData,
        branch: normalized.companyData.branch || ocrBranch,
      })
    }

    getAccountingConfig(ocrBankCode)
      .then(apiData => {
        const hasData =
          apiData &&
          (apiData.bank_code || apiData.file_prefix || Object.keys(apiData.mappings || {}).length)
        if (hasData) {
          applyConfig(apiData as unknown as Record<string, unknown>)
          setSavedMappings(apiData.mappings || {})
          setSavedCustomTypes(apiData.custom_types || [])
          setMappingsBankCode(ocrBankCode ?? apiData.bank_code ?? null)
        } else {
          throw new Error('empty')
        }
      })
      .catch(() => {
        const raw = localStorage.getItem(appKey('accountingConfig'))
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as {
              mappings?: Record<string, FieldMapping>
              paymentAmount?: Record<string, FieldMapping>
            }
            applyConfig(parsed as Record<string, unknown>)
            // localStorage keeps main mappings and payment types in two fields; the API
            // returns them merged. Flatten here so consumers see one shape either way.
            setSavedMappings({ ...(parsed.mappings ?? {}), ...(parsed.paymentAmount ?? {}) })
          } catch {
            /* ignore */
          }
        } else if (ocrBank) {
          setBank(ocrBank)
          setFilePrefix('IC')
          setFileSource(BANK_SOURCE_MAP[ocrBank] || '')
          if (BANK_INFO[ocrBank]) {
            const info = BANK_INFO[ocrBank]
            setCompany(prev => ({
              ...prev,
              name: info.name,
              taxId: info.taxId,
              address: info.address,
              branch: prev.branch || ocrBranch,
            }))
          }
        } else {
          setFilePrefix('IC')
        }
        // The server fetch failed outright (no authoritative bank-scoped answer either
        // way), but a later bank switch must still be able to trigger a real fetch rather
        // than staying stuck thinking nothing has loaded yet.
        setMappingsBankCode(ocrBankCode ?? null)
      })
      .finally(() => setConfigLoading(false))
  }, [])

  // Re-fetch this bank's own GL mappings when the dropdown changes to one the initial
  // load didn't already cover. Header fields (file_prefix, description, company) stay
  // BU-wide and are deliberately left alone here.
  //
  // Keyed off `mappingsBankCode`, not `bank`: `bank` commits a render before the fetch
  // for it resolves, so latching an "applied" ref off `bank` in a consumer (useMapping)
  // would mark the switch handled before `savedMappings` actually caught up, and the
  // real update would then be silently skipped. `mappingsBankCode` only ever changes in
  // the same batch as `savedMappings`/`savedCustomTypes`, so it's safe to key off.
  useEffect(() => {
    if (configLoading) return
    const bankCode = bank ? (BANK_CODE_MAP[bank] ?? null) : null
    if (bankCode === mappingsBankCode) return
    if (!bankCode) {
      // Cleared the bank field — nothing to map to yet.
      setMappingsBankCode(null)
      setSavedMappings({})
      setSavedCustomTypes([])
      return
    }
    let cancelled = false
    getAccountingConfig(bankCode)
      .then(apiData => {
        if (cancelled) return
        setSavedMappings(apiData.mappings || {})
        setSavedCustomTypes(apiData.custom_types || [])
        setMappingsBankCode(bankCode)
      })
      .catch(() => {
        /* Keep whatever mappings are already on screen rather than blanking a bank
           switch out from under an in-progress edit over a transient network error. */
      })
    return () => {
      cancelled = true
    }
  }, [bank, configLoading, mappingsBankCode])

  return {
    bank,
    setBank,
    filePrefix,
    setFilePrefix,
    fileSource,
    setFileSource,
    description,
    setDescription,
    bankDescriptions,
    setBankDescriptions,
    company,
    setCompany,
    configLoading,
    savedMappings,
    savedCustomTypes,
    mappingsBankCode,
  }
}
