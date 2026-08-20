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

/** Bank metadata: company info, GL mappings.
 * `address` goes straight into the Carmen input-tax payload, so store it exactly as the
 * bank prints it on its tax invoice — Thai when the invoice is Thai, English when that is
 * all the bank publishes. One string, one language per bank; no TH/EN pair. */
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
    // ponytail: addresses here are static per bank, not OCR'd — GHL's invoice prints Thai,
    // so store it as printed. Extract from the document only if a bank ever moves.
    address:
      '130/1 อาคารเศรษฐีวรรณ สาทร ชั้น 5 ถนนสาทรเหนือ แขวงสีลม เขตบางรัก จังหวัดกรุงเทพมหานคร 10500',
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

// (code, thai keywords, english keywords) — ordered specific-before-generic:
// processors/issuers before the generic กรุง* substrings (which would otherwise
// shadow KTC/BAY), and before กรุงเทพ specifically (just "Bangkok" — appears in
// every Bangkok-address footer, including the processors' own). Single source
// of truth for the issuer-name tier and the raw-text tier below. Mirrors
// backend utils/bank_detect.py.
const BANK_KEYWORDS: Array<{ code: BankCode; thai: string[]; english: string[] }> = [
  { code: 'KTC', thai: ['บัตรกรุงไทย'], english: ['KRUNGTHAI CARD'] },
  { code: 'BAY', thai: ['กรุงศรี'], english: ['KRUNGSRI', 'BANK OF AYUDHYA'] },
  { code: 'GHL', thai: ['เอ็นทีที เดต้า'], english: ['NTT DATA'] },
  { code: 'PAYPAL', thai: ['เพย์พาล'], english: ['PAYPAL'] },
  { code: 'SIAMPAY', thai: ['สยามเพย์'], english: ['ASIA PAY', 'SIAMPAY'] },
  { code: 'KBANK', thai: ['กสิกร'], english: [] },
  { code: 'SCB', thai: ['ไทยพาณิชย์'], english: [] },
  { code: 'BBL', thai: ['กรุงเทพ'], english: [] },
]

function matchBankKeywords(text: string, upper: string): BankCode | null {
  for (const { code, thai, english } of BANK_KEYWORDS) {
    if (thai.some(k => text.includes(k)) || english.some(k => upper.includes(k))) return code
  }
  return null
}

/** Infer bank display name from the bank's company name extracted by the LLM. */
export function detectBankFromCompanyName(
  bankCompanyname: string | null | undefined
): BankDisplayName | null {
  if (!bankCompanyname) return null
  const upper = bankCompanyname.toUpperCase()
  // ghl.py fixes bank_name to the literal "GHL" (too short/common a substring
  // to safely match elsewhere, e.g. raw free text).
  if (upper === 'GHL') return OCR_BANK_MAP.GHL
  const code = matchBankKeywords(bankCompanyname, upper)
  return code ? OCR_BANK_MAP[code] : null
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

  // Same specific-first chain as the other tiers, then English legacy names
  // and SCB document-title keywords.
  if (docName) {
    const code = matchBankKeywords(docName, docName)
    if (code) return code
    if (docName.includes('KASIKORN')) return 'KBANK'
    if (docName.includes('BANGKOK BANK')) return 'BBL'
    if (docName.includes('SIAM COMMERCIAL')) return 'SCB'
    if (docName.includes('ใบนำฝาก') || docName.includes('ใบสรุปยอดขายบัตรเครดิต')) return 'SCB'
  }

  if (ext.raw_text) {
    const code = matchBankKeywords(rawText, rawText)
    if (code) return code
  }

  return null
}

/**
 * Step-3 JV debit side: consolidated (3 summed buckets — commission, tax, Bank
 * Account) for ALL banks by default, so every layout reviews the same way
 * (SIAMPAY-style). Flip to true to restore the per-transaction grouping (one
 * debit set per detail line), preserved in ccJv.ts for future use.
 */
export const GROUP_DEBIT_BY_TRANSACTION = false

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
