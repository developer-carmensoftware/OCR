import { useState, useEffect } from 'react'
import { getAccountingConfig } from '../../lib/api/config'
import { detectBankFromCompanyName, BANK_INFO, BANK_SOURCE_MAP } from '../../constants/banks'
import { normalizeConfigShape, codeToDisplayName } from '../../lib/bankTransforms'
import { appKey } from '../../lib/storage'
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
  company: CompanyData
  setCompany: React.Dispatch<React.SetStateAction<CompanyData>>
  configLoading: boolean
  savedMappings: Record<string, FieldMapping>
  savedCustomTypes: string[]
}

import type React from 'react'

export function useBankConfig(): BankConfigHook {
  const [configLoading, setConfigLoading] = useState(true)
  const [bank, setBank] = useState<BankDisplayName | ''>('')
  const [filePrefix, setFilePrefix] = useState('IC')
  const [fileSource, setFileSource] = useState('')
  const [description, setDescription] = useState('')
  const [company, setCompany] = useState<CompanyData>({
    name: '',
    taxId: '',
    branch: '',
    address: '',
  })
  const [savedMappings, setSavedMappings] = useState<Record<string, FieldMapping>>({})
  const [savedCustomTypes, setSavedCustomTypes] = useState<string[]>([])

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
    try {
      // Branch comes off the document (useOcrExtraction writes it here); the saved
      // accounting config has no branch of its own, so it must not blank this out.
      const cfg = JSON.parse(localStorage.getItem(appKey('accountingConfig')) || '{}') as {
        company?: { branch?: string }
      }
      ocrBranch = cfg.company?.branch || ''
    } catch {
      /* ignore */
    }

    const applyConfig = (source: Record<string, unknown>) => {
      const normalized = normalizeConfigShape(source, ocrBank, detectBankFromCompanyName)
      setBank(normalized.finalBank)
      setFilePrefix(normalized.finalPrefix)
      setFileSource(normalized.finalSource)
      setDescription((source.description as string) || '')
      setCompany({
        ...normalized.companyData,
        branch: normalized.companyData.branch || ocrBranch,
      })
    }

    getAccountingConfig()
      .then(apiData => {
        const hasData =
          apiData &&
          (apiData.bank_code || apiData.file_prefix || Object.keys(apiData.mappings || {}).length)
        if (hasData) {
          applyConfig(apiData as unknown as Record<string, unknown>)
          setSavedMappings(apiData.mappings || {})
          setSavedCustomTypes(apiData.custom_types || [])
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
      })
      .finally(() => setConfigLoading(false))
  }, [])

  return {
    bank,
    setBank,
    filePrefix,
    setFilePrefix,
    fileSource,
    setFileSource,
    description,
    setDescription,
    company,
    setCompany,
    configLoading,
    savedMappings,
    savedCustomTypes,
  }
}
