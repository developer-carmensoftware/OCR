import { useState, useEffect } from 'react'
import { getAccountingConfig } from '../../lib/api/config'
import {
  OCR_BANK_MAP,
  detectBankFromCompanyName,
  BANK_INFO,
  BANK_SOURCE_MAP,
} from '../../constants/banks'
import { normalizeConfigShape, codeToDisplayName } from '../../lib/bankTransforms'

/**
 * Manages bank configuration state: loading from API, localStorage fallback,
 * OCR wizard state, and bank auto-detection.
 *
 * Returns: { bank, setBank, filePrefix, setFilePrefix, fileSource, setFileSource,
 *            description, setDescription, company, setCompany, configLoading }
 */
export function useBankConfig() {
  const [configLoading, setConfigLoading] = useState(true)
  const [bank, setBank] = useState('')
  const [filePrefix, setFilePrefix] = useState('IC')
  const [fileSource, setFileSource] = useState('')
  const [description, setDescription] = useState('')
  const [company, setCompany] = useState({ name: '', taxId: '', branch: '', address: '' })

  useEffect(() => {
    // Parse OCR wizard state (transient, always from localStorage)
    let ocrBank = ''
    try {
      const ocrState = JSON.parse(localStorage.getItem('ocr_wizard_state') || '{}')
      ocrBank = codeToDisplayName(ocrState.bank) || ''
    } catch {
      /* ignore */
    }

    const applyConfig = source => {
      // source: { bank_code?, file_prefix?, file_source?, description?, mappings?, custom_types? }
      // or the old localStorage shape: { bank?, filePrefix?, fileSource?, description?, mappings?, company? }

      const normalized = normalizeConfigShape(source, ocrBank, detectBankFromCompanyName)

      setBank(normalized.finalBank)
      setFilePrefix(normalized.finalPrefix)
      setFileSource(normalized.finalSource)
      setDescription(source.description || '')
      setCompany(normalized.companyData)
    }

    // Load order: API (DB) → localStorage fallback
    getAccountingConfig()
      .then(apiData => {
        const hasData =
          apiData &&
          (apiData.bank_code || apiData.file_prefix || Object.keys(apiData.mappings || {}).length)
        if (hasData) {
          applyConfig(apiData)
        } else {
          throw new Error('empty')
        }
      })
      .catch(() => {
        // Fallback: localStorage
        const raw = localStorage.getItem('accountingConfig')
        if (raw) {
          try {
            applyConfig(JSON.parse(raw))
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
            }))
          }
        } else {
          setFilePrefix('IC')
        }
      })
      .finally(() => setConfigLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }
}
