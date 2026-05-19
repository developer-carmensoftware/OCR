import { BANK_CODE_MAP, BANK_SOURCE_MAP, OCR_BANK_MAP, BANK_INFO } from '../constants/banks'

/**
 * Checks if an object is in API shape (with bank_code, file_prefix, etc.)
 * vs legacy localStorage shape (with bank, filePrefix, etc.)
 */
export function isApiShape(source) {
  return 'bank_code' in source || 'file_prefix' in source
}

/**
 * Convert API bank_code (e.g., 'BBL') to display name (e.g., 'Bangkok Bank (BBL)')
 */
export function codeToDisplayName(bankCode) {
  return OCR_BANK_MAP[bankCode] || ''
}

/**
 * Convert display name (e.g., 'Bangkok Bank (BBL)') to API bank code (e.g., 'BBL')
 */
export function displayNameToCode(displayName) {
  return BANK_CODE_MAP[displayName] || null
}

/**
 * Get GL source code (e.g., 'ACBB') for a display name
 */
export function getGLSourceCode(displayName) {
  return BANK_SOURCE_MAP[displayName] || ''
}

/**
 * Get bank info (name, taxId, address) for a display name
 */
export function getBankInfo(displayName) {
  return BANK_INFO[displayName] || null
}

/**
 * Normalize config from either API or localStorage shape
 * Returns: { rawBank, finalBank, finalPrefix, finalSource, companyData }
 */
export function normalizeConfigShape(source, ocrBankOverride, detectBankFn) {
  const isApi = isApiShape(source)

  // Extract bank
  const rawBank = isApi ? codeToDisplayName(source.bank_code) : source.bank || ''
  const finalBank = ocrBankOverride || rawBank || detectBankFn(source.company?.name || '')

  // Extract prefix
  const finalPrefix = (isApi ? source.file_prefix : source.filePrefix) || 'IC'

  // Extract GL source (recalculate if bank changed)
  const rawSource = isApi ? source.file_source : source.fileSource
  const bankChanged = finalBank !== rawBank
  const finalSource = bankChanged
    ? getGLSourceCode(finalBank) || ''
    : rawSource || getGLSourceCode(finalBank) || ''

  // Normalize company data
  let companyData = { name: '', taxId: '', branch: '', address: '' }
  if (isApi) {
    companyData.branch = source.branch || ''
  } else if (source.company) {
    companyData = { ...companyData, ...source.company }
  }

  // Merge with bank info
  if (finalBank) {
    const info = getBankInfo(finalBank)
    if (info) {
      companyData.name = info.name
      companyData.taxId = info.taxId
      companyData.address = info.address
    }
  }

  return {
    isApi,
    rawBank,
    finalBank,
    finalPrefix,
    finalSource,
    companyData,
  }
}
