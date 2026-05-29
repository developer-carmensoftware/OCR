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
    uploadTitle: 'อัปโหลดเอกสารใบแจ้งหนี้',
    uploadDesc: 'รองรับไฟล์รูปภาพ JPG, PNG และ PDF (สูงสุด 20 MB)',
    uploadBtn: 'เลือกไฟล์เอกสาร',
    mapTitle: 'ตรวจสอบและจับคู่ Field (Field Mapping)',
    confirmMap: 'ยืนยัน Field Mapping',
    reviewTitle: 'Item detail',
    headerTitle: 'ข้อมูลทั่วไป (Header Info)',
    systemVendor: 'Vendor / Supplier',
    vendorNotFound: 'ไม่พบในระบบ (ตรวจสอบ Tax ID)',
    vendorName: 'ชื่อผู้ขาย',
    vendorTaxId: 'เลขผู้เสียภาษี',
    vendorBranch: 'สาขา',
    docName: 'ประเภทเอกสาร',
    docNo: 'เลขที่เอกสาร',
    docDate: 'วันที่เอกสาร',
    subTotal: 'มูลค่าก่อนภาษี',
    discount: 'ส่วนลดรวม',
    tax: 'ภาษีมูลค่าเพิ่ม',
    grandTotal: 'ยอดรวมทั้งสิ้น',
    summaryAccount: 'รายการสรุปบัญชี',
    sumFromTable: 'ยอดจากตาราง',
    sumFromDoc: 'ยอดตามเอกสาร',
    adjust: 'Adjust',
    validOk: 'ยอดรวมบัญชีตรงกัน',
    validOkDesc: 'ข้อมูลยอดรวมตรงกัน 100%',
    validErr: 'พบข้อผิดพลาดด้านตัวเลข',
    validErrPrefix: 'ส่วนต่าง:',
    acctTitle: 'ผังบัญชี (Account Mapping)',
    aiSuggest: 'AI แนะนำบัญชี',
    debitTax: 'Debit — ภาษีซื้อ (Tax 1)',
    creditAp: 'Credit — เจ้าหนี้ (A/P)',
    debitExpense: 'Debit — ค่าใช้จ่าย (Expense)',
    taxProfile: 'Tax Profile',
    deptCode: 'Dept. Code',
    accountCode: 'Account Code',
    vendorGroup: 'Vendor Group',
    expenseDesc: 'จับคู่ผังบัญชีค่าใช้จ่ายตามรายการสินค้า',
    generateInv: 'Generate AP Invoice',
    successTitle: 'บันทึกข้อมูลสำเร็จ!',
    successDesc: 'AP Invoice เลขที่',
    successDesc2: 'ถูกสร้างและผูกผังบัญชีเรียบร้อยแล้ว',
    uploadNew: 'อัปโหลดเอกสารใหม่',
    ignore: 'ไม่นำเข้า (Ignore)',
    category: 'ประเภท (Account)',
    description: 'รายละเอียดสินค้า',
    qty: 'จำนวน',
    unitPrice: 'ราคา/หน่วย',
    discountPct: 'ส่วนลด%',
    discountAmt: 'มูลค่าส่วนลด',
    lineSubTotal: 'มูลค่าก่อนภาษี',
    taxPct: 'อัตราภาษี%',
    taxType: 'ประเภทภาษี',
    taxAmt: 'มูลค่าภาษี',
    lineTotal: 'รวม',
    backUpload: 'กลับ',
    backMap: 'กลับแก้ Mapping',
    backReview: 'กลับแก้ไข',
    processing: 'AI กำลังประมวลผล...',
    retry: 'ลองใหม่',
    searchVendor: 'Please select a vendor',
    searchDept: 'รหัส/ชื่อแผนก',
    searchAcc: 'รหัส/ชื่อบัญชี',
    warnMismatch: 'ยอดเงินไม่สัมพันธ์กัน — ดำเนินการต่อข้ามคำเตือนนี้?',
    errProcess: 'เกิดข้อผิดพลาดในการประมวลผล OCR กรุณาลองใหม่อีกครั้ง',
    itemCount: 'จำนวนรายการ',
    items: 'items',
    tableTotal: 'ยอดรวมตาราง',
    duplicateDoc: 'เอกสารซ้ำ! เลขที่เอกสารนี้และผู้ขายรายนี้มีอยู่ในระบบแล้ว',
    proceed: 'ดำเนินการต่อ',
    proceedAnyway: 'ดำเนินการต่อ (ข้ามคำเตือน)',
    warnSelectVendor: 'กรุณาเลือกผู้ขายจากระบบก่อนดำเนินการต่อ',
    mismatchTitle: 'ยอดเงินไม่ตรงกัน',
    backEdit: 'กลับแก้ไข',
    invDescTitle: 'เพิ่มคำอธิบายใบแจ้งหนี้เพื่อผลลัพธ์ที่ดีขึ้น',
    invDescMsg:
      'การเพิ่มคำอธิบายใบแจ้งหนี้ช่วยให้ AI แนะนำรหัสบัญชีได้แม่นยำขึ้น\nสามารถเพิ่มได้ที่ช่อง Invoice Description ด้านบน',
    backFillDesc: 'กลับเพื่อกรอกคำอธิบาย',
    mappingWarning: 'กรุณาระบุรหัสแผนกและรหัสบัญชีให้ครบทุกรายการก่อนดำเนินการต่อ',
    sending: 'กำลังส่ง...',
    invDescLabel: 'คำอธิบายใบแจ้งหนี้',
    invDescPlaceholder: 'ใส่คำอธิบาย...',
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
