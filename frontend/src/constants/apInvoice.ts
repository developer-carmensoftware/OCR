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

export const getAvailableFields = (t: Record<string, string>): FieldOption[] => [
  { value: 'ignore', label: t.ignore },
  { value: 'category', label: t.category },
  { value: 'description', label: t.description },
  { value: 'qty', label: t.qty },
  { value: 'unitPrice', label: t.unitPrice },
  { value: 'discountPct', label: t.discountPct },
  { value: 'discountAmt', label: t.discountAmt },
  { value: 'lineSubTotal', label: t.lineSubTotal },
  { value: 'taxPct', label: t.taxPct },
  { value: 'taxProfileCode1', label: t.taxProfile },
  { value: 'taxType', label: t.taxType },
  { value: 'taxAmt', label: t.taxAmt },
  { value: 'lineTotal', label: t.lineTotal },
]

export type APLocale = 'th' | 'en'
export type APTranslations = Record<string, string>

export const AP_I18N: Record<APLocale, APTranslations> = {
  th: {
    appTitle: 'Carmen Cloud',
    appSub: 'AP Invoice OCR',
    uploadTitle: 'Upload Invoice Document',
    uploadDesc: 'Supports JPG, PNG, and PDF files (max 20 MB)',
    uploadBtn: 'Select Document',
    mapTitle: 'Review and Field Mapping',
    confirmMap: 'Confirm Field Mapping',
    reviewTitle: 'Item detail',
    headerTitle: 'Header Info',
    systemVendor: 'Vendor / Supplier',
    vendorNotFound: 'Not found in system (check Tax ID)',
    vendorName: 'Vendor Name',
    vendorTaxId: 'Tax ID',
    vendorBranch: 'Branch',
    docName: 'Document Type',
    docNo: 'Document No.',
    docDate: 'Document Date',
    subTotal: 'Sub Total',
    discount: 'Total Discount',
    tax: 'VAT Amount',
    grandTotal: 'Grand Total',
    summaryAccount: 'Account Summary',
    sumFromTable: 'From Table',
    sumFromDoc: 'From Document',
    adjust: 'Adjust',
    validOk: 'Totals matched',
    validOkDesc: 'Table and document totals are 100% synchronized.',
    validErr: 'Number mismatch',
    validErrPrefix: 'Difference:',
    acctTitle: 'Account Mapping',
    aiSuggest: 'AI Suggest',
    debitTax: 'Debit — Input Tax (Tax 1)',
    creditAp: 'Credit — Account Payable (A/P)',
    debitExpense: 'Debit — Expense',
    taxProfile: 'Tax Profile',
    deptCode: 'Dept. Code',
    accountCode: 'Account Code',
    vendorGroup: 'Vendor Group',
    expenseDesc: 'Map expense accounts based on extracted items',
    generateInv: 'Generate AP Invoice',
    successTitle: 'Saved Successfully!',
    successDesc: 'AP Invoice No.',
    successDesc2: 'has been created and mapped to Carmen Cloud.',
    uploadNew: 'Upload New Document',
    ignore: 'Ignore',
    category: 'Category (Account)',
    description: 'Description',
    qty: 'Qty',
    unitPrice: 'Unit Price',
    discountPct: 'Discount%',
    discountAmt: 'Discount Amt',
    lineSubTotal: 'Line Sub Total',
    taxPct: 'Tax%',
    taxType: 'Tax Type',
    taxRateUnmatched: 'This rate has no matching Tax Profile — the document rate is kept as-is.',
    taxAmt: 'Tax Amount',
    lineTotal: 'Line Total',
    backUpload: 'Back',
    backMap: 'Back to Mapping',
    backReview: 'Back to Review',
    processing: 'AI is processing...',
    retry: 'Retry',
    searchVendor: 'Please select a vendor',
    searchDept: 'Dept code/name',
    searchAcc: 'Account code/name',
    warnMismatch: 'Totals do not match. Are you sure you want to proceed?',
    errProcess: 'OCR processing error. Please try again.',
    itemCount: 'Total Items',
    items: 'items',
    tableTotal: 'Table Total',
    duplicateDoc:
      'Duplicate Document! This document number and vendor already exist in the system.',
    proceed: 'Proceed',
    proceedAnyway: 'Proceed (Skip Warning)',
    warnSelectVendor: 'Please select a vendor from the system before proceeding',
    mismatchTitle: 'Amount Mismatch',
    backEdit: 'Back to Review',
    invDescTitle: 'Add Invoice Description for Better Results',
    invDescMsg:
      'Adding an Invoice Description helps AI suggest more accurate GL accounts.\nYou can add it in the Invoice Description field above.',
    backFillDesc: 'Back to fill description',
    mappingWarning:
      'Please provide both Department and Account codes for all line items before proceeding.',
    sending: 'Sending...',
    invDescLabel: 'Invoice Description',
    invDescPlaceholder: 'Invoice description...',
  },
  en: {
    appTitle: 'Carmen Cloud',
    appSub: 'AP Invoice OCR',
    uploadTitle: 'Upload Invoice Document',
    uploadDesc: 'Supports JPG, PNG, and PDF files (max 20 MB)',
    uploadBtn: 'Select Document',
    mapTitle: 'Review and Field Mapping',
    confirmMap: 'Confirm Field Mapping',
    reviewTitle: 'Item detail',
    headerTitle: 'Header Info',
    systemVendor: 'Vendor / Supplier',
    vendorNotFound: 'Not found in system (check Tax ID)',
    vendorName: 'Vendor Name',
    vendorTaxId: 'Tax ID',
    vendorBranch: 'Branch',
    docName: 'Document Type',
    docNo: 'Document No.',
    docDate: 'Document Date',
    subTotal: 'Sub Total',
    discount: 'Total Discount',
    tax: 'VAT Amount',
    grandTotal: 'Grand Total',
    summaryAccount: 'Account Summary',
    sumFromTable: 'From Table',
    sumFromDoc: 'From Document',
    adjust: 'Adjust',
    validOk: 'Totals matched',
    validOkDesc: 'Table and document totals are 100% synchronized.',
    validErr: 'Number mismatch',
    validErrPrefix: 'Difference:',
    acctTitle: 'Account Mapping',
    aiSuggest: 'AI Suggest',
    debitTax: 'Debit — Input Tax (Tax 1)',
    creditAp: 'Credit — Account Payable (A/P)',
    debitExpense: 'Debit — Expense',
    taxProfile: 'Tax Profile',
    deptCode: 'Dept. Code',
    accountCode: 'Account Code',
    vendorGroup: 'Vendor Group',
    expenseDesc: 'Map expense accounts based on extracted items',
    generateInv: 'Generate AP Invoice',
    successTitle: 'Saved Successfully!',
    successDesc: 'AP Invoice No.',
    successDesc2: 'has been created and mapped to Carmen Cloud.',
    uploadNew: 'Upload New Document',
    ignore: 'Ignore',
    category: 'Category (Account)',
    description: 'Description',
    qty: 'Qty',
    unitPrice: 'Unit Price',
    discountPct: 'Discount%',
    discountAmt: 'Discount Amt',
    lineSubTotal: 'Line Sub Total',
    taxPct: 'Tax%',
    taxType: 'Tax Type',
    taxRateUnmatched: 'This rate has no matching Tax Profile — the document rate is kept as-is.',
    taxAmt: 'Tax Amount',
    lineTotal: 'Line Total',
    backUpload: 'Back',
    backMap: 'Back to Mapping',
    backReview: 'Back to Review',
    processing: 'AI is processing...',
    retry: 'Retry',
    searchVendor: 'Please select a vendor',
    searchDept: 'Dept code/name',
    searchAcc: 'Account code/name',
    warnMismatch: 'Totals do not match. Are you sure you want to proceed?',
    errProcess: 'OCR processing error. Please try again.',
    itemCount: 'Total Items',
    items: 'items',
    tableTotal: 'Table Total',
    duplicateDoc:
      'Duplicate Document! This document number and vendor already exist in the system.',
    proceed: 'Proceed',
    proceedAnyway: 'Proceed (Skip Warning)',
    warnSelectVendor: 'Please select a vendor from the system before proceeding',
    mismatchTitle: 'Amount Mismatch',
    backEdit: 'Back to Review',
    invDescTitle: 'Add Invoice Description for Better Results',
    invDescMsg:
      'Adding an Invoice Description helps AI suggest more accurate GL accounts.\nYou can add it in the Invoice Description field above.',
    backFillDesc: 'Back to fill description',
    mappingWarning:
      'Please provide both Department and Account codes for all line items before proceeding.',
    sending: 'Sending...',
    invDescLabel: 'Invoice Description',
    invDescPlaceholder: 'Invoice description...',
  },
}
