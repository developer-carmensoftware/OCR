import { useEffect, useState } from 'react'
import { useLocalStorage } from './useLocalStorage'
import type { FieldMapping } from '../types/api'

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
  rawConfig: AccountingConfig | null
  setConfig: (valOrFn: AccountingConfig | ((prev: AccountingConfig) => AccountingConfig)) => void
  refresh: () => void
  filePrefix: string
  fileSource: string
  description: string
  company: AccountingConfig['company']
  mappings: Record<string, FieldMapping>
  bank: string
  paymentAmount: Record<string, FieldMapping>
}

const EMPTY_CONFIG: AccountingConfig = {}
const EMPTY_AMOUNT: Record<string, FieldMapping> = {}

export function useAccountingConfig(): AccountingConfigHook {
  const [config, setConfig] = useLocalStorage<AccountingConfig>('accountingConfig', EMPTY_CONFIG)
  const [amountConfig] = useLocalStorage<Record<string, FieldMapping>>('accountMappingAmount', EMPTY_AMOUNT)

  const mergedConfig: AccountingConfig | null = config
    ? { ...config, paymentAmount: { ...config.paymentAmount, ...amountConfig } }
    : Object.keys(amountConfig).length
      ? { paymentAmount: amountConfig }
      : null

  const [, forceRefresh] = useState(0)
  useEffect(() => {
    const onFocus = () => forceRefresh(n => n + 1)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return {
    config: mergedConfig,
    rawConfig: config,
    setConfig,
    refresh: () => forceRefresh(n => n + 1),
    filePrefix: config?.filePrefix || '',
    fileSource: config?.fileSource || '',
    description: config?.description || '',
    company: config?.company || {},
    mappings: config?.mappings || {},
    bank: config?.bank || '',
    paymentAmount: mergedConfig?.paymentAmount || {},
  }
}
