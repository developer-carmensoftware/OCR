// ──────────────────────────────────────────────────────────────────
// API Types — mirrored from backend Pydantic models
// backend/app/models/schemas.py + backend/app/routers/*.py
// ──────────────────────────────────────────────────────────────────

// ── Auth ──────────────────────────────────────────────────────────

export interface ExchangeRequest {
  token: string
  bu: string
  user?: string
  uri?: string
}

export interface ExchangeResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  user: {
    carmen_user_id: string
    username: string
    bu: string
    uri: string
    tenant_id: string
  }
}

// ── Credit Card OCR ───────────────────────────────────────────────

export interface ExtractedDetailRow {
  transaction: string | null
  pay_amt: string | null
  commis_amt: string | null
  tax_amt: string | null
  total: string | null
}

export interface ExtractedCreditCardData {
  bank_name: string | null
  doc_name: string | null
  company_name: string | null
  doc_date: string | null
  doc_no: string | null
  merchant_name: string | null
  merchant_id: string | null
  bank_company_name: string | null
  branch_no: string | null
  details: ExtractedDetailRow[]
  is_duplicate: boolean
  raw_text: string | null
}

// ── AP Invoice ────────────────────────────────────────────────────

export interface APInvoiceItem {
  category: string
  description: string
  qty: number
  unitPrice: number
  discountPct: number
  discountAmt: number
  lineSubTotal: number
  taxPct: number
  taxType: string
  taxAmt: number
  lineTotal: number
}

export interface ExtractedAPInvoiceData {
  vendorName: string
  vendorTaxId: string
  vendorBranch: string
  documentName: string
  documentDate: string
  documentNumber: string
  taxType: 'Include' | 'Exclude'
  depositPct: number
  depositAmt: number
  items: APInvoiceItem[]
  subTotal: number
  taxAmount: number
  totalDiscount: number
  grandTotal: number
  id: string | null
  is_duplicate: boolean
}

// ── GL Mapping ────────────────────────────────────────────────────

export interface FieldMapping {
  dept: string | null
  acc: string | null
}

export interface CodeOption {
  code: string
  name: string
  type?: string | null
}

export interface SuggestRequest {
  bank_code: string
  source?: string | null
  accounts: CodeOption[]
  departments: CodeOption[]
}

export interface SuggestPaymentTypesRequest {
  bank_code: string
  source?: string | null
  payment_types: string[]
  accounts: CodeOption[]
  departments: CodeOption[]
}

export interface SuggestGLItem {
  index: number
  category?: string
  description?: string
  unit_price?: number
}

export interface SuggestGLRequest {
  items: SuggestGLItem[]
  invoice_desc?: string
  vn_code?: string
}

// ── Accounting Config ─────────────────────────────────────────────

export interface AccountingConfigRequest {
  bank_code: string | null
  file_prefix: string | null
  file_source: string | null
  description: string | null
  branch: string | null
  mappings: Record<string, FieldMapping> | null
  custom_types: string[] | null
}

export interface AccountingConfigResponse {
  bank_code: string | null
  file_prefix: string | null
  file_source: string | null
  description: string | null
  branch: string | null
  mappings: Record<string, FieldMapping>
  custom_types: string[]
}

// ── Shared / Utility ──────────────────────────────────────────────

export type BankCode = 'BBL' | 'KBANK' | 'SCB'
export type BankDisplayName =
  | 'Bangkok Bank (BBL)'
  | 'Kasikornbank (KBANK)'
  | 'Siam Commercial Bank (SCB)'

export interface ApiError {
  detail: string
  status?: number
}
