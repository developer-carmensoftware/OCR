import type { TKey } from '../i18n/dict'

export interface APStep {
  n: number
  label: string
  sub: string
}

export type APFieldKey =
  | 'ignore'
  | 'category'
  | 'description'
  | 'qty'
  | 'unitPrice'
  | 'discountPct'
  | 'discountAmt'
  | 'lineSubTotal'
  | 'taxPct'
  | 'taxType'
  | 'taxAmt'
  | 'lineTotal'
  | 'taxProfileCode1'

export type APColumnKey = `col${number}`

export interface APInvoiceHeader {
  vendorName: string
  vendorTaxId: string
  vendorBranch: string
  documentName: string
  documentDate: string
  documentNumber: string
  taxType: string
  invhDesc: string
  subTotal: string
  taxAmount: string
  totalDiscount: string
  grandTotal: string
}

export const AP_STEPS: APStep[] = [
  { n: 1, label: 'Upload', sub: 'Document' },
  { n: 2, label: 'Field', sub: 'Mapping' },
  { n: 3, label: 'Review', sub: 'Data' },
  { n: 4, label: 'Account', sub: 'Mapping' },
  { n: 5, label: 'Success', sub: 'Result' },
]

export const EMPTY_HEADER: APInvoiceHeader = {
  vendorName: '',
  vendorTaxId: '',
  vendorBranch: '',
  documentName: '',
  documentDate: '',
  documentNumber: '',
  taxType: '',
  invhDesc: '',
  subTotal: '0.00',
  taxAmount: '0.00',
  totalDiscount: '0.00',
  grandTotal: '0.00',
}

export const DEFAULT_MAPPINGS: Record<APColumnKey, APFieldKey | 'ignore'> = {
  col1: 'category',
  col2: 'description',
  col3: 'qty',
  col4: 'unitPrice',
  col5: 'discountPct',
  col6: 'discountAmt',
  col7: 'lineSubTotal',
  col8: 'taxPct',
  col9: 'taxType',
  col10: 'taxAmt',
  col11: 'lineTotal',
}

export const NUMERIC_FIELDS: APFieldKey[] = [
  'qty',
  'unitPrice',
  'discountPct',
  'discountAmt',
  'lineSubTotal',
  'taxPct',
  'taxAmt',
  'lineTotal',
]

// Re-exported from lib/format for backward compatibility
export { parseNum, fmt, round2 } from '../lib/format'

export const isNumFld = (f: string): boolean => NUMERIC_FIELDS.includes(f as APFieldKey)

export interface FieldOption {
  value: APFieldKey | 'ignore'
  label: string
}

export const getAvailableFields = (t: (key: TKey) => string): FieldOption[] => [
  { value: 'ignore', label: t('ap.ignore') },
  { value: 'category', label: t('ap.category') },
  { value: 'description', label: t('ap.description') },
  { value: 'qty', label: t('ap.qty') },
  { value: 'unitPrice', label: t('ap.unitPrice') },
  { value: 'discountPct', label: t('ap.discountPct') },
  { value: 'discountAmt', label: t('ap.discountAmt') },
  { value: 'lineSubTotal', label: t('ap.lineSubTotal') },
  { value: 'taxPct', label: t('ap.taxPct') },
  { value: 'taxProfileCode1', label: t('ap.taxProfile') },
  { value: 'taxType', label: t('ap.taxType') },
  { value: 'taxAmt', label: t('ap.taxAmt') },
  { value: 'lineTotal', label: t('ap.lineTotal') },
]
