/** Bank metadata: company info, GL mappings */
export const BANK_INFO = {
  'Bangkok Bank (BBL)': {
    name: 'ธนาคารกรุงเทพ จำกัด (มหาชน)',
    taxId: '0107536000374',
    address: '333 ถนนสีลม เขตบางรัก กรุงเทพฯ 10500',
  },
  'Kasikornbank (KBANK)': {
    name: 'บมจ. ธนาคารกสิกรไทย',
    taxId: '0107536000315',
    address: '400/22 ถนนพหลโยธิน แขวงสามเสนใน เขตพญาไท กรุงเทพมหานคร 10400',
  },
  'Siam Commercial Bank (SCB)': {
    name: 'ธนาคารไทยพาณิชย์ จํากัด (มหาชน)',
    taxId: '0107536000102',
    address: '9 ถนนรัชดาภิเษก เขตจตุจักร กรุงฯ 10900',
  },
}

/** Display name → GL source code mapping */
export const BANK_SOURCE_MAP = {
  'Bangkok Bank (BBL)': 'ACBB',
  'Kasikornbank (KBANK)': 'ACKB',
  'Siam Commercial Bank (SCB)': 'ACSC',
}

/** Display name → API bank code mapping */
export const BANK_CODE_MAP = {
  'Bangkok Bank (BBL)': 'BBL',
  'Kasikornbank (KBANK)': 'KBANK',
  'Siam Commercial Bank (SCB)': 'SCB',
}

/** API bank code → display name mapping */
export const OCR_BANK_MAP = {
  BBL: 'Bangkok Bank (BBL)',
  KBANK: 'Kasikornbank (KBANK)',
  SCB: 'Siam Commercial Bank (SCB)',
}

/** Thai display names for each bank code. */
export const BANK_THAI_NAMES = {
  BBL: 'ธนาคารกรุงเทพ',
  KBANK: 'ธนาคารกสิกรไทย',
  SCB: 'ธนาคารไทยพาณิชย์',
}

/** Infer bank code from the bank's company name extracted by the LLM. */
export function detectBankFromCompanyName(bankCompanyname) {
  if (!bankCompanyname) return null
  if (bankCompanyname.includes('กรุงเทพ')) return 'BBL'
  if (bankCompanyname.includes('กสิกร')) return 'KBANK'
  if (bankCompanyname.includes('ไทยพาณิชย์')) return 'SCB'
  return null
}

/**
 * Detect actual bank from extracted data using bank/company name + document keywords.
 */
export function detectBankFromExtracted(ext) {
  if (!ext) return null

  // 1. Bank Name / Company Name check
  const nameSignals = [ext.bank_companyname, ext.bank_name, ext.company_name]
  for (const name of nameSignals) {
    const detected = detectBankFromCompanyName(name)
    if (detected) return detected
  }

  // 2. Document Name / Keywords (Fallback)
  const docName = (ext.doc_name || '').toUpperCase()
  const rawText = (ext.raw_text || '').toUpperCase()

  if (docName.includes('KASIKORN') || docName.includes('กสิกร')) return 'KBANK'
  if (docName.includes('BANGKOK BANK') || docName.includes('กรุงเทพ')) return 'BBL'
  if (docName.includes('SIAM COMMERCIAL') || docName.includes('ไทยพาณิชย์')) return 'SCB'

  // Specific SCB documents
  if (docName.includes('ใบนำฝาก') || docName.includes('ใบสรุปยอดขายบัตรเครดิต')) return 'SCB'

  // If still not found, try raw text search for keywords
  if (rawText.includes('กสิกร')) return 'KBANK'
  if (rawText.includes('กรุงเทพ')) return 'BBL'
  if (rawText.includes('ไทยพาณิชย์')) return 'SCB'

  return null
}

export const BANKS = [
  { value: 'BBL', label: 'Bangkok Bank', full: 'Bangkok Bank (BBL)' },
  { value: 'KBANK', label: 'Kasikornbank', full: 'Kasikornbank (KBANK)' },
  { value: 'SCB', label: 'Siam Commercial Bank', full: 'Siam Commercial Bank (SCB)' },
]
