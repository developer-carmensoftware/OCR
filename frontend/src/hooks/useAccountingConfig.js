import { useEffect, useState } from 'react'
import { useLocalStorage } from './useLocalStorage'

const EMPTY_CONFIG = {}
const EMPTY_AMOUNT = {}

/**
 * Specialized hook for the 'accountingConfig' localStorage key.
 * Also reads 'accountMappingAmount' and merges it into paymentAmount.
 *
 * Provides a typed, reactive view of the accounting configuration
 * used by AccountingReview, InputTaxReconciliation, useOcrWizard, and useMapping.
 */
export function useAccountingConfig() {
  const [config, setConfig] = useLocalStorage('accountingConfig', EMPTY_CONFIG)
  const [amountConfig] = useLocalStorage('accountMappingAmount', EMPTY_AMOUNT)

  // Merged view: config.paymentAmount overridden by separate accountMappingAmount
  const mergedConfig = config
    ? { ...config, paymentAmount: { ...config.paymentAmount, ...amountConfig } }
    : amountConfig && Object.keys(amountConfig).length
      ? { paymentAmount: amountConfig }
      : null

  // Re-read on window focus (for cross-tab sync via Mapping page)
  const [, forceRefresh] = useState(0)
  useEffect(() => {
    const onFocus = () => forceRefresh(n => n + 1)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return {
    /** Full merged config object, or null if nothing is stored */
    config: mergedConfig,
    /** Raw accounting config (without merged paymentAmount) */
    rawConfig: config,
    setConfig,
    // Convenient typed accessors
    filePrefix: config?.filePrefix || '',
    fileSource: config?.fileSource || '',
    description: config?.description || '',
    company: config?.company || {},
    mappings: config?.mappings || {},
    bank: config?.bank || '',
    paymentAmount: mergedConfig?.paymentAmount || {},
  }
}
