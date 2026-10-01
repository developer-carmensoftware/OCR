import { useEffect, useState, useCallback } from 'react'
import { getAccountingConfig } from '@/shared/api/config'
import { appKey, readAccountingConfig, type AccountingConfig } from '@/shared/lib/storage'
import type { FieldMapping } from '@/shared/types/api'

// Shape and storage key live together in shared/lib/storage; re-exported because several
// credit-card modules already import the type from here.
export type { AccountingConfig }

export interface AccountingConfigHook {
  config: AccountingConfig | null
  loading: boolean
  refresh: () => void
  filePrefix: string
  fileSource: string
  bankDescriptions: Record<string, string>
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

/**
 * @param bankCode The bank whose GL rules to read — the document's own. GL rules are per
 * bank since 20260924000000, and an unscoped read answers with whichever bank the mapping
 * page saved last, so a JV built for one bank's statement took another bank's accounts.
 * Omit only where no mapping is read (header fields and per-bank descriptions).
 * @param options.wait The bank is not known yet (a document still loading): read nothing and
 * stay `loading`, rather than send the unscoped read that answers for the wrong bank.
 */
export function useAccountingConfig(
  bankCode?: string,
  options: { wait?: boolean } = {}
): AccountingConfigHook {
  const wait = options.wait === true
  const [config, setConfigState] = useState<AccountingConfig | null>(null)
  const [loading, setLoading] = useState(true)
  // Which bank `config` was read for. `loading` alone lags a bank change by one render, and
  // in that render the JV would be built from the previous bank's accounts.
  const [loadedFor, setLoadedFor] = useState<string | undefined | null>(null)
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
    if (wait) return
    let cancelled = false
    setLoading(true)

    getAccountingConfig(bankCode)
      .then(apiData => {
        if (cancelled) return
        const hasData =
          apiData.bank_code || apiData.file_prefix || Object.keys(apiData.mappings || {}).length > 0
        if (!hasData) throw new Error('empty')

        const { mappings, paymentAmount } = splitMappings(apiData.mappings || {})
        const lsCompany = readAccountingConfig().company ?? {}
        setConfigState({
          bank: apiData.bank_code || '',
          filePrefix: apiData.file_prefix || '',
          fileSource: apiData.file_source || '',
          bankDescriptions: apiData.bank_descriptions || {},
          company: { ...lsCompany, ...(apiData.branch ? { branch: apiData.branch } : {}) },
          mappings,
          paymentAmount,
        })
      })
      .catch(() => {
        if (cancelled) return
        // The offline copy holds whichever bank the mapping page saved last, and a scan
        // rewrites its `bank` on every run — it cannot answer for a bank asked for by name.
        setConfigState(bankCode ? null : readFromLocalStorage())
      })
      .finally(() => {
        if (cancelled) return
        setLoadedFor(bankCode)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [refreshKey, bankCode, wait])

  return {
    config,
    loading: loading || wait || loadedFor !== bankCode,
    refresh,
    filePrefix: config?.filePrefix || '',
    fileSource: config?.fileSource || '',
    bankDescriptions: config?.bankDescriptions || {},
    company: config?.company || {},
    mappings: config?.mappings || {},
    bank: config?.bank || '',
    paymentAmount: config?.paymentAmount || {},
  }
}
