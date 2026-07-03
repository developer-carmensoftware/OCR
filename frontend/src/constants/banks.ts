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
  'Krungsri (BAY)': {
    name: 'Bank of Ayudhya Public Company Limited',
    taxId: '0107536001079',
    address: '1222 Rama III Road, Bang Phongphang, Yan Nawa, Bangkok 10120',
  },
  'Krungthai Card (KTC)': {
    name: 'Krungthai Card Public Company Limited',
    taxId: '0107545000110',
    address:
      '591 United Business Centre II, 14th Fl., Sukhumvit Rd, North Klongton, Wattana, Bangkok 10110',
  },
  'GHL (NTT DATA)': {
    name: 'NTT DATA Digital Payment (Thailand) Co., Ltd.',
    taxId: '0105556152330',
    address: '130/1 Sethiwan Tower, 5th Fl., North Sathorn Road, Silom, Bang Rak, Bangkok 10500',
  },
  'PayPal (PAYPAL)': {
    name: 'PayPal Thailand Limited',
    taxId: '0105559010269',
    address: '63 Athenee Tower, 23rd Fl., Wireless Road, Lumpini, Pathumwan, Bangkok 10330',
  },
  'SiamPay (SIAMPAY)': {
    name: 'Asia Pay (Thailand) Limited',
    taxId: '0105549071478',
    address:
      '141/63 Skulthai Surawong Tower, 38th Fl., Surawong Road, Suriyawong, Bang Rak, Bangkok 10500',
  },
}

/** Display name → GL source code mapping */
export const BANK_SOURCE_MAP: Record<BankDisplayName, string> = {
  'Bangkok Bank (BBL)': 'ACBB',
  'Kasikornbank (KBANK)': 'ACKB',
  'Siam Commercial Bank (SCB)': 'ACSC',
  'Krungsri (BAY)': 'ACBY',
  'Krungthai Card (KTC)': 'ACKC',
  'GHL (NTT DATA)': 'ACGH',
  'PayPal (PAYPAL)': 'ACPP',
  'SiamPay (SIAMPAY)': 'ACSP',
}

/** Display name → API bank code mapping */
export const BANK_CODE_MAP: Record<BankDisplayName, BankCode> = {
  'Bangkok Bank (BBL)': 'BBL',
  'Kasikornbank (KBANK)': 'KBANK',
  'Siam Commercial Bank (SCB)': 'SCB',
  'Krungsri (BAY)': 'BAY',
  'Krungthai Card (KTC)': 'KTC',
  'GHL (NTT DATA)': 'GHL',
  'PayPal (PAYPAL)': 'PAYPAL',
  'SiamPay (SIAMPAY)': 'SIAMPAY',
}

/** API bank code → display name mapping */
export const OCR_BANK_MAP: Record<BankCode, BankDisplayName> = {
  BBL: 'Bangkok Bank (BBL)',
  KBANK: 'Kasikornbank (KBANK)',
  SCB: 'Siam Commercial Bank (SCB)',
  BAY: 'Krungsri (BAY)',
  KTC: 'Krungthai Card (KTC)',
  GHL: 'GHL (NTT DATA)',
  PAYPAL: 'PayPal (PAYPAL)',
  SIAMPAY: 'SiamPay (SIAMPAY)',
}

/** Thai display names for each bank code. */
export const BANK_THAI_NAMES: Record<BankCode, string> = {
  BBL: 'Bangkok Bank',
  KBANK: 'Kasikornbank',
  SCB: 'Siam Commercial Bank',
  BAY: 'Krungsri',
  KTC: 'Krungthai Card',
  GHL: 'GHL',
  PAYPAL: 'PayPal',
  SIAMPAY: 'SiamPay',
}

/** Infer bank display name from the bank's company name extracted by the LLM. */
export function detectBankFromCompanyName(
  bankCompanyname: string | null | undefined
): BankDisplayName | null {
  if (!bankCompanyname) return null
  const upper = bankCompanyname.toUpperCase()
  // Specific issuers before the generic กรุง* substrings (KTC/BAY/processors
  // would otherwise be shadowed by กรุงเทพ). Mirrors backend utils/bank_detect.py.
  if (
    bankCompanyname.includes('บัตรกรุงไทย') ||
    upper.includes('KRUNGTHAI CARD') ||
    upper === 'KTC'
  )
    return 'Krungthai Card (KTC)'
  if (
    bankCompanyname.includes('กรุงศรี') ||
    upper.includes('KRUNGSRI') ||
    upper.includes('BANK OF AYUDHYA')
  )
    return 'Krungsri (BAY)'
  if (bankCompanyname.includes('เอ็นทีที เดต้า') || upper.includes('NTT DATA') || upper === 'GHL')
    return 'GHL (NTT DATA)'
  if (upper.includes('PAYPAL') || bankCompanyname.includes('เพย์พาล')) return 'PayPal (PAYPAL)'
  if (
    upper.includes('ASIA PAY') ||
    upper.includes('SIAMPAY') ||
    bankCompanyname.includes('สยามเพย์')
  )
    return 'SiamPay (SIAMPAY)'
  if (bankCompanyname.includes('กสิกร')) return 'Kasikornbank (KBANK)'
  if (bankCompanyname.includes('ไทยพาณิชย์')) return 'Siam Commercial Bank (SCB)'
  if (bankCompanyname.includes('กรุงเทพ')) return 'Bangkok Bank (BBL)'
  return null
}

/**
 * Detect actual bank from extracted data using bank/company name + document keywords.
 */
export function detectBankFromExtracted(
  ext: Record<string, string | null | undefined> | null
): BankCode | null {
  if (!ext) return null

  // Issuer fields get the full keyword chain; the merchant's own company_name
  // only legacy bank keywords — merchant names like "บริษัท กรุงศรี ฟู้ดส์"
  // must not flip detection to a new issuer. Mirrors backend utils/bank_detect.py.
  for (const name of [ext.bank_company_name, ext.bank_name]) {
    const detected = detectBankFromCompanyName(name)
    if (detected) return BANK_CODE_MAP[detected]
  }
  const merchant = ext.company_name || ''
  if (merchant.includes('กรุงเทพ')) return 'BBL'
  if (merchant.includes('กสิกร')) return 'KBANK'
  if (merchant.includes('ไทยพาณิชย์')) return 'SCB'

  const docName = (ext.doc_name || '').toUpperCase()
  const rawText = (ext.raw_text || '').toUpperCase()

  if (docName.includes('KASIKORN') || docName.includes('กสิกร')) return 'KBANK'
  if (docName.includes('BANGKOK BANK') || docName.includes('กรุงเทพ')) return 'BBL'
  if (docName.includes('SIAM COMMERCIAL') || docName.includes('ไทยพาณิชย์')) return 'SCB'

  if (docName.includes('ใบนำฝาก') || docName.includes('ใบสรุปยอดขายบัตรเครดิต')) return 'SCB'

  // Most-specific first. กรุงเทพ is checked LAST: it is just "Bangkok" and
  // appears in every Bangkok-address footer (all four processors are Bangkok-based).
  if (rawText.includes('บัตรกรุงไทย') || rawText.includes('KRUNGTHAI CARD')) return 'KTC'
  if (
    rawText.includes('กรุงศรี') ||
    rawText.includes('KRUNGSRI') ||
    rawText.includes('BANK OF AYUDHYA')
  )
    return 'BAY'
  if (rawText.includes('เอ็นทีที เดต้า') || rawText.includes('NTT DATA')) return 'GHL'
  if (rawText.includes('PAYPAL')) return 'PAYPAL'
  if (rawText.includes('ASIA PAY') || rawText.includes('SIAMPAY')) return 'SIAMPAY'
  if (rawText.includes('กสิกร')) return 'KBANK'
  if (rawText.includes('ไทยพาณิชย์')) return 'SCB'
  if (rawText.includes('กรุงเทพ')) return 'BBL'

  return null
}

export const BANKS: BankEntry[] = [
  { value: 'BBL', label: 'Bangkok Bank', full: 'Bangkok Bank (BBL)' },
  { value: 'KBANK', label: 'Kasikornbank', full: 'Kasikornbank (KBANK)' },
  { value: 'SCB', label: 'Siam Commercial Bank', full: 'Siam Commercial Bank (SCB)' },
  { value: 'BAY', label: 'Krungsri', full: 'Krungsri (BAY)' },
  { value: 'KTC', label: 'Krungthai Card', full: 'Krungthai Card (KTC)' },
  { value: 'GHL', label: 'GHL (NTT DATA)', full: 'GHL (NTT DATA)' },
  { value: 'PAYPAL', label: 'PayPal', full: 'PayPal (PAYPAL)' },
  { value: 'SIAMPAY', label: 'SiamPay', full: 'SiamPay (SIAMPAY)' },
]
