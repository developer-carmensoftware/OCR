import { useEffect, useState, useCallback } from 'react'
import { getAccountingConfig } from '../../lib/api/config'
import { appKey } from '../../lib/storage'
import type { FieldMapping } from '../../types/api'

export interface AccountingConfig {
  bank?: string
  filePrefix?: string
  fileSource?: string
  description?: string
  company?: {
    name?: string
    taxId?: string
    branch?: string
    address?: string
  }
  mappings?: Record<string, FieldMapping>
  paymentAmount?: Record<string, FieldMapping>
}

export interface AccountingConfigHook {
  config: AccountingConfig | null
  loading: boolean
  refresh: () => void
  filePrefix: string
  fileSource: string
  description: string
  company: AccountingConfig['company']
  mappings: Record<string, FieldMapping>
  bank: string
  paymentAmount: Record<string, FieldMapping>
}

const MAIN_KEYS = new Set(['commission', 'tax', 'net'])

function splitMappings(raw: Record<string, FieldMapping>): {
  mappings: Record<string, FieldMapping>
  paymentAmount: Record<string, FieldMapping>
} {
  const mappings: Record<string, FieldMapping> = {}
  const paymentAmount: Record<string, FieldMapping> = {}
  Object.entries(raw).forEach(([k, v]) => {
    if (MAIN_KEYS.has(k)) mappings[k] = v
    else paymentAmount[k] = v
  })
  return { mappings, paymentAmount }
}

function readFromLocalStorage(): AccountingConfig | null {
  try {
    const raw = localStorage.getItem(appKey('accountingConfig'))
    if (!raw) return null
    const parsed = JSON.parse(raw) as AccountingConfig
    const amountRaw = localStorage.getItem(appKey('accountMappingAmount'))
    if (amountRaw) {
      const { __customTypes: _ignored, ...paymentAmount } = JSON.parse(amountRaw) as Record<
        string,
        FieldMapping | string[]
      >
      parsed.paymentAmount = {
        ...(parsed.paymentAmount || {}),
        ...(paymentAmount as Record<string, FieldMapping>),
      }
    }
    return parsed
  } catch {
    return null
  }
}

export function useAccountingConfig(): AccountingConfigHook {
  const [config, setConfigState] = useState<AccountingConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    // ponytail: storage-only listener. Safe today because Mapping Settings opens in a
    // separate tab (CreditCardOCR.tsx window.open) and 'storage' never fires in the
    // writing tab. Add a 'focus' listener too if it ever becomes an in-app route.
    const onStorage = (e: StorageEvent) => {
      if (e.key === appKey('accounting_config_updated')) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    getAccountingConfig()
      .then(apiData => {
        if (cancelled) return
        const hasData =
          apiData.bank_code || apiData.file_prefix || Object.keys(apiData.mappings || {}).length > 0
        if (!hasData) throw new Error('empty')

        const { mappings, paymentAmount } = splitMappings(apiData.mappings || {})
        const lsCompany = (() => {
          try {
            const raw = localStorage.getItem(appKey('accountingConfig'))
            return raw ? ((JSON.parse(raw) as AccountingConfig).company ?? {}) : {}
          } catch {
            return {}
          }
        })()
        setConfigState({
          bank: apiData.bank_code || '',
          filePrefix: apiData.file_prefix || '',
          fileSource: apiData.file_source || '',
          description: apiData.description || '',
          company: { ...lsCompany, ...(apiData.branch ? { branch: apiData.branch } : {}) },
          mappings,
          paymentAmount,
        })
      })
      .catch(() => {
        if (cancelled) return
        setConfigState(readFromLocalStorage())
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return {
    config,
    loading,
    refresh,
    filePrefix: config?.filePrefix || '',
    fileSource: config?.fileSource || '',
    description: config?.description || '',
    company: config?.company || {},
    mappings: config?.mappings || {},
    bank: config?.bank || '',
    paymentAmount: config?.paymentAmount || {},
  }
}
