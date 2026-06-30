import { BANK_CODE_MAP, BANK_SOURCE_MAP, OCR_BANK_MAP, BANK_INFO } from '../constants/banks'
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

export function displayNameToCode(displayName: string): BankCode | null {
  return BANK_CODE_MAP[displayName as BankDisplayName] || null
}

function getGLSourceCode(displayName: string): string {
  return BANK_SOURCE_MAP[displayName as BankDisplayName] || ''
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

  const rawSource = (isApi ? source.file_source : source.fileSource) as string | undefined
  const bankChanged = finalBank !== rawBank
  const finalSource = bankChanged
    ? getGLSourceCode(finalBank) || ''
    : rawSource || getGLSourceCode(finalBank) || ''

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
