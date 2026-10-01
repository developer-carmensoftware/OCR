import { useState, useEffect } from 'react'
import { getAccountingConfig } from '@/shared/api/config'
import {
  detectBankFromCompanyName,
  BANK_INFO,
  BANK_CODE_MAP,
  BANK_SOURCE_MAP,
} from '@/shared/constants/banks'
import { normalizeConfigShape, codeToDisplayName } from '@/features/credit-card/lib/bankTransforms'
import { appKey } from '@/shared/lib/storage'
import type { BankDisplayName, FieldMapping } from '@/shared/types/api'
import type { CompanyData } from '@/features/credit-card/lib/bankTransforms'

export interface BankConfigHook {
  bank: BankDisplayName | ''
  setBank: React.Dispatch<React.SetStateAction<BankDisplayName | ''>>
  filePrefix: string
  setFilePrefix: React.Dispatch<React.SetStateAction<string>>
  fileSource: string
  setFileSource: React.Dispatch<React.SetStateAction<string>>
  /** bank_code -> description, the only description there is: a bank with no entry
   *  posts none (the BU-wide fallback was retired 2026-09-30). */
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
  /** When those mappings last changed on the server — sent back with a save, which the
   *  server refuses if someone else saved since. Null for an offline copy. */
  version: string | null
  /** Bumped each time a bank's mappings land, so a reload of the *same* bank is seen. */
  loadId: number
  /** Re-reads the selected bank from the server — "discard my edits, show me what is
   *  there". */
  reloadBank: () => void
  /** After a save that kept the page open: the server's new version of what was saved. */
  setVersion: (v: string | null) => void
  /** The bank_code whose mappings failed to load on a switch — the page shows a retry in
   *  place of its mapping sections rather than the previous bank's rows. */
  bankError: string | null
  retryBank: () => void
}

import type React from 'react'

/** `?bank=` off the current hash — the contract `ReviewDocument`'s AR-settings link
 *  makes (`#/CreditCardOCR/mapping?bank=KBANK`), naming the document's own bank rather
 *  than leaving the page to open on whatever was last saved. */
function bankCodeFromHash(): string | null {
  const query = window.location.hash.split('?')[1]
  return query ? new URLSearchParams(query).get('bank') : null
}

export function useBankConfig(): BankConfigHook {
  const [configLoading, setConfigLoading] = useState(true)
  const [bank, setBank] = useState<BankDisplayName | ''>('')
  const [filePrefix, setFilePrefix] = useState('IC')
  const [fileSource, setFileSource] = useState('')
  const [bankDescriptions, setBankDescriptions] = useState<Record<string, string>>({})
  // Branch defaults to head office: a tax invoice that states no branch was issued by the
  // head office, Revenue Department code "00000" — `_HEAD_OFFICE` in
  // backend/app/services/credit_card/input_tax.py, whose frontend twin is
  // InputTaxReconciliation.tsx. Without it every new BU opened with this required field
  // blank and could not save its GL mapping until someone typed the default by hand.
  const [company, setCompany] = useState<CompanyData>({
    name: '',
    taxId: '',
    branch: '00000',
    address: '',
  })
  const [savedMappings, setSavedMappings] = useState<Record<string, FieldMapping>>({})
  const [savedCustomTypes, setSavedCustomTypes] = useState<string[]>([])
  const [mappingsBankCode, setMappingsBankCode] = useState<string | null>(null)
  const [version, setVersion] = useState<string | null>(null)
  const [loadId, setLoadId] = useState(0)
  const [bankError, setBankError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let ocrBank: BankDisplayName | '' = ''
    try {
      const ocrState = JSON.parse(
        localStorage.getItem(appKey('ocr_wizard_state')) || '{}'
      ) as Record<string, unknown>
      ocrBank = codeToDisplayName(ocrState.bank as string) || ''
    } catch {
      /* ignore */
    }
    // An explicit `?bank=` names the bank a specific document belongs to, which is more
    // specific than either an in-progress wizard scan or the tenant's last-saved default,
    // so it wins over both.
    const bankOverride = codeToDisplayName(bankCodeFromHash()) || ocrBank
    // That bank wins over the config's stored default (normalizeConfigShape below does the
    // same), so the mappings this fetches must be scoped to it — otherwise the dropdown
    // would show one bank while displaying a different bank's GL mappings.
    const scopeBankCode = bankOverride ? BANK_CODE_MAP[bankOverride] : undefined

    const applyConfig = (source: Record<string, unknown>) => {
      const normalized = normalizeConfigShape(source, bankOverride, detectBankFromCompanyName)
      setBank(normalized.finalBank)
      setFilePrefix(normalized.finalPrefix)
      setFileSource(normalized.finalSource)
      setBankDescriptions(
        (source.bank_descriptions as Record<string, string>) ??
          (source.bankDescriptions as Record<string, string>) ??
          {}
      )
      // The BU's saved branch, else head office. Not the last scanned document's branch:
      // that is one document's fact (KTC's is even the merchant's own), and a document's
      // branch reaches the input-tax record from the document itself anyway.
      setCompany({
        ...normalized.companyData,
        branch: normalized.companyData.branch || '00000',
      })
    }

    getAccountingConfig(scopeBankCode)
      .then(apiData => {
        const hasData =
          apiData &&
          (apiData.bank_code || apiData.file_prefix || Object.keys(apiData.mappings || {}).length)
        if (hasData) {
          applyConfig(apiData as unknown as Record<string, unknown>)
          setSavedMappings(apiData.mappings || {})
          setSavedCustomTypes(apiData.custom_types || [])
          setMappingsBankCode(scopeBankCode ?? apiData.bank_code ?? null)
          setVersion(apiData.version ?? null)
          setLoadId(n => n + 1)
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
        } else if (bankOverride) {
          setBank(bankOverride)
          setFilePrefix('IC')
          setFileSource(BANK_SOURCE_MAP[bankOverride] || '')
          if (BANK_INFO[bankOverride]) {
            const info = BANK_INFO[bankOverride]
            setCompany(prev => ({
              ...prev,
              name: info.name,
              taxId: info.taxId,
              address: info.address,
            }))
          }
        } else {
          setFilePrefix('IC')
        }
        // The server fetch failed outright (no authoritative bank-scoped answer either
        // way), but a later bank switch must still be able to trigger a real fetch rather
        // than staying stuck thinking nothing has loaded yet.
        setMappingsBankCode(scopeBankCode ?? null)
      })
      .finally(() => setConfigLoading(false))
  }, [])

  // Re-fetch this bank's own GL mappings when the dropdown changes to one the initial
  // load didn't already cover. Header fields (file_prefix, company) stay BU-wide and are
  // deliberately left alone here; descriptions are already keyed per bank.
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
    setBankError(null)
    getAccountingConfig(bankCode)
      .then(apiData => {
        if (cancelled) return
        setSavedMappings(apiData.mappings || {})
        setSavedCustomTypes(apiData.custom_types || [])
        setMappingsBankCode(bankCode)
        setVersion(apiData.version ?? null)
        setLoadId(n => n + 1)
      })
      .catch(() => {
        // Said, not swallowed: leaving the previous bank's rows up under this bank's name
        // is what a Save then wrote into this bank. The page offers `retryBank` instead.
        if (!cancelled) setBankError(bankCode)
      })
    return () => {
      cancelled = true
    }
  }, [bank, configLoading, mappingsBankCode, retryKey])

  return {
    bank,
    setBank,
    filePrefix,
    setFilePrefix,
    fileSource,
    setFileSource,
    bankDescriptions,
    setBankDescriptions,
    company,
    setCompany,
    configLoading,
    bankError,
    retryBank: () => setRetryKey(k => k + 1),
    // Clearing `mappingsBankCode` is what makes the effect above fetch again; the page
    // shows its loading state meanwhile, as for a switch.
    reloadBank: () => setMappingsBankCode(null),
    version,
    setVersion,
    loadId,
    savedMappings,
    savedCustomTypes,
    mappingsBankCode,
  }
}
