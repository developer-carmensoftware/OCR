import { BANK_SOURCE_MAP, OCR_BANK_MAP, BANK_INFO } from '../constants/banks'
import type { BankCode, BankDisplayName } from '../types/api'
import type { BankInfo } from '../constants/banks'

export interface NormalizedConfig {
  isApi: boolean
  rawBank: BankDisplayName | ''
  finalBank: BankDisplayName | ''
  finalPrefix: string
  finalSource: string
  companyData: CompanyData
}

export interface CompanyData {
  name: string
  taxId: string
  branch: string
  address: string
}

function isApiShape(source: Record<string, unknown>): boolean {
  return 'bank_code' in source || 'file_prefix' in source
}

export function codeToDisplayName(bankCode: string | null | undefined): BankDisplayName | '' {
  if (!bankCode) return ''
  return OCR_BANK_MAP[bankCode as BankCode] || ''
}

function getGLSourceCode(displayName: string): string {
  return BANK_SOURCE_MAP[displayName as BankDisplayName] || ''
}

/** Bank code → Carmen GL source code (e.g. 'KBANK' → 'ACKB'). The single
 * authority for source: 1:1 with the bank, add/remove a code in BANK_SOURCE_MAP. */
export function codeToSource(bankCode: string | null | undefined): string {
  const name = codeToDisplayName(bankCode)
  return name ? BANK_SOURCE_MAP[name] : ''
}

function getBankInfo(displayName: string): BankInfo | null {
  return BANK_INFO[displayName as BankDisplayName] || null
}

export function normalizeConfigShape(
  source: Record<string, unknown>,
  ocrBankOverride: BankDisplayName | '',
  detectBankFn: (name: string) => BankDisplayName | null
): NormalizedConfig {
  const isApi = isApiShape(source)

  const rawBank = isApi
    ? codeToDisplayName(source.bank_code as string)
    : (source.bank as BankDisplayName) || ''
  const companyName = (source.company as Record<string, string> | undefined)?.name || ''
  const finalBank = ocrBankOverride || rawBank || detectBankFn(companyName) || ''

  const finalPrefix = ((isApi ? source.file_prefix : source.filePrefix) as string) || 'IC'

  // Source is always bank-derived (single authority: BANK_SOURCE_MAP) — never
  // read back a stored value, which could be stale from a previous bank.
  const finalSource = getGLSourceCode(finalBank) || ''

  let companyData: CompanyData = { name: '', taxId: '', branch: '', address: '' }
  if (isApi) {
    companyData.branch = (source.branch as string) || ''
  } else if (source.company) {
    companyData = { ...companyData, ...(source.company as Partial<CompanyData>) }
  }

  if (finalBank) {
    const info = getBankInfo(finalBank)
    if (info) {
      companyData.name = info.name
      companyData.taxId = info.taxId
      companyData.address = info.address
    }
  }

  return { isApi, rawBank, finalBank, finalPrefix, finalSource, companyData }
}

/** The description this bank's documents carry, with the BU-wide one as fallback.
 *
 * Twin of `description_for` in backend/app/services/accounting_config_service.py —
 * the email-ingest job resolves it there, the wizard here, and the two must agree
 * or the same statement posts under two different descriptions depending on which
 * route it took. A blank per-bank entry is not an override. */
export function descriptionForBank(
  description: string | null | undefined,
  bankDescriptions: Record<string, string> | null | undefined,
  bankCode: string | null | undefined
): string {
  const own = (bankDescriptions ?? {})[bankCode || '']
  return (own || '').trim() || description || ''
}
