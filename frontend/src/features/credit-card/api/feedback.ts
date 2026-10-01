import { apiFetch } from '@/shared/api/client'
import { API } from '@/shared/api/endpoints'

const FIELD_NAME_MAP: Record<string, string> = {
  DateProcessed: 'date_processed',
  BankName: 'bank_name',
  DocName: 'doc_name',
  CompanyName: 'company_name',
  DocDate: 'doc_date',
  DocNo: 'doc_no',
  MerchantName: 'merchant_name',
  MerchantId: 'merchant_id',
  BankCompanyName: 'bank_company_name',
  BranchNo: 'branch_no',
  Transaction: 'transaction',
  PayAmt: 'pay_amt',
  CommisAmt: 'commis_amt',
  TaxAmt: 'tax_amt',
  Total: 'total',
}

export interface Correction {
  fieldName: string
  originalValue: unknown
  correctedValue: unknown
}

export async function logCorrections(
  cardId: string,
  bankCode: string,
  corrections: Correction[]
): Promise<void> {
  // Only fields the server's `FieldName` enum knows. It validates the batch as a whole, so
  // one unmapped key (BranchNo, until 2026-09-30) 422'd every correction sent beside it.
  const known = corrections.filter(c =>
    Object.prototype.hasOwnProperty.call(FIELD_NAME_MAP, c.fieldName)
  )
  if (!cardId || !bankCode || !known.length) return

  const res = await apiFetch(API.feedback.corrections, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      corrections: known.map(({ fieldName, originalValue, correctedValue }) => ({
        doc_no: cardId,
        bank_code: bankCode,
        field_name: FIELD_NAME_MAP[fieldName],
        original_value: String(originalValue ?? ''),
        corrected_value: String(correctedValue ?? ''),
      })),
    }),
  })
  if (!res.ok) {
    console.error(`[feedback] Corrections rejected (${res.status})`)
    return
  }

  const data = (await res.json().catch(() => ({}))) as { saved?: number }
  console.warn(`[feedback] ✓ Logged ${data.saved ?? '?'}/${known.length} corrections`)
}

export function diffCorrections(
  headerData: Record<string, unknown>,
  originalHeader: Record<string, unknown>,
  details: Array<Record<string, unknown>>,
  originalDetails: Array<Record<string, unknown>>
): Correction[] {
  const corrections: Correction[] = []

  for (const [key, value] of Object.entries(headerData)) {
    const orig = originalHeader[key]
    if (orig !== undefined && String(orig ?? '') !== String(value ?? '')) {
      corrections.push({ fieldName: key, originalValue: orig, correctedValue: value })
    }
  }

  const origByUid = new Map(originalDetails.map(r => [r._uid, r]))
  for (const row of details) {
    const origRow = origByUid.get(row._uid)
    if (!origRow) continue
    for (const [col, value] of Object.entries(row)) {
      if (col === '_uid') continue
      const orig = origRow[col]
      if (orig !== undefined && String(orig ?? '') !== String(value ?? '')) {
        corrections.push({ fieldName: col, originalValue: orig, correctedValue: value })
      }
    }
  }

  return corrections
}
