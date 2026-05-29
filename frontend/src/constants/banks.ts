import type { BankCode, BankDisplayName } from '../types/api'

export interface BankInfo {
  name: string
  taxId: string
  address: string
}

export interface BankEntry {
  value: BankCode
  label: string
  full: BankDisplayName
}

/** Bank metadata: company info, GL mappings */
export const BANK_INFO: Record<BankDisplayName, BankInfo> = {
  'Bangkok Bank (BBL)': {
    name: 'Bangkok Bank Public Company Limited',
    taxId: '0107536000374',
    address: '333 Silom Road, Bang Rak, Bangkok 10500',
  },
  'Kasikornbank (KBANK)': {
    name: 'Kasikornbank Public Company Limited',
    taxId: '0107536000315',
    address: '400/22 Phahonyothin Road, Samsen Nai, Phaya Thai, Bangkok 10400',
  },
  'Siam Commercial Bank (SCB)': {
    name: 'Siam Commercial Bank Public Company Limited',
    taxId: '0107536000102',
    address: '9 Ratchadapisek Road, Chatuchak, Bangkok 10900',
  },
}

/** Display name → GL source code mapping */
export const BANK_SOURCE_MAP: Record<BankDisplayName, string> = {
  'Bangkok Bank (BBL)': 'ACBB',
  'Kasikornbank (KBANK)': 'ACKB',
  'Siam Commercial Bank (SCB)': 'ACSC',
}

/** Display name → API bank code mapping */
export const BANK_CODE_MAP: Record<BankDisplayName, BankCode> = {
  'Bangkok Bank (BBL)': 'BBL',
  'Kasikornbank (KBANK)': 'KBANK',
  'Siam Commercial Bank (SCB)': 'SCB',
}

/** API bank code → display name mapping */
export const OCR_BANK_MAP: Record<BankCode, BankDisplayName> = {
  BBL: 'Bangkok Bank (BBL)',
  KBANK: 'Kasikornbank (KBANK)',
  SCB: 'Siam Commercial Bank (SCB)',
}

/** Thai display names for each bank code. */
export const BANK_THAI_NAMES: Record<BankCode, string> = {
  BBL: 'Bangkok Bank',
  KBANK: 'Kasikornbank',
  SCB: 'Siam Commercial Bank',
}

/** Infer bank display name from the bank's company name extracted by the LLM. */
export function detectBankFromCompanyName(
  bankCompanyname: string | null | undefined
): BankDisplayName | null {
  if (!bankCompanyname) return null
  if (bankCompanyname.includes('กรุงเทพ')) return 'Bangkok Bank (BBL)'
  if (bankCompanyname.includes('กสิกร')) return 'Kasikornbank (KBANK)'
  if (bankCompanyname.includes('ไทยพาณิชย์')) return 'Siam Commercial Bank (SCB)'
  return null
}

/**
 * Detect actual bank from extracted data using bank/company name + document keywords.
 */
export function detectBankFromExtracted(
  ext: Record<string, string | null | undefined> | null
): BankCode | null {
  if (!ext) return null

  const nameSignals = [ext.bank_company_name, ext.bank_name, ext.company_name]
  for (const name of nameSignals) {
    const detected = detectBankFromCompanyName(name)
    if (detected) return BANK_CODE_MAP[detected]
  }

  const docName = (ext.doc_name || '').toUpperCase()
  const rawText = (ext.raw_text || '').toUpperCase()

  if (docName.includes('KASIKORN') || docName.includes('กสิกร')) return 'KBANK'
  if (docName.includes('BANGKOK BANK') || docName.includes('กรุงเทพ')) return 'BBL'
  if (docName.includes('SIAM COMMERCIAL') || docName.includes('ไทยพาณิชย์')) return 'SCB'

  if (docName.includes('ใบนำฝาก') || docName.includes('ใบสรุปยอดขายบัตรเครดิต')) return 'SCB'

  if (rawText.includes('กสิกร')) return 'KBANK'
  if (rawText.includes('กรุงเทพ')) return 'BBL'
  if (rawText.includes('ไทยพาณิชย์')) return 'SCB'

  return null
}

export const BANKS: BankEntry[] = [
  { value: 'BBL', label: 'Bangkok Bank', full: 'Bangkok Bank (BBL)' },
  { value: 'KBANK', label: 'Kasikornbank', full: 'Kasikornbank (KBANK)' },
  { value: 'SCB', label: 'Siam Commercial Bank', full: 'Siam Commercial Bank (SCB)' },
]
