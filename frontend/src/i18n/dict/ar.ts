export const en = {
  // -- Settlement report (AR reconciliation) — the mapping page's Settlement card and
  // the review screen's read-only JV. KBANK KB1P554V2 today; decision #3 (2026-09-22).

  // — AR reconciliation settings (#/CreditCardOCR/ar-settings) —
  //
  // The review modal points people here by name (review.arSettings), so the heading they
  // land on is the same words. Columns are NOT re-declared: the preview table reuses
  // review.jvDept / jvAccount / jvDesc / jvDebit / jvCredit and the segmented control
  // reuses review.arPostTypeDetail / arPostTypeSummary, because ARReviewPane already names
  // the same things that way (same `desc` field too, since 2026-09-17) and two vocabularies
  // for one column is how a reader starts wondering whether they are the same column.
  'ar.title': 'AR Reconciliation',
  'ar.intro':
    'Splits the lump credit-card control account into per-scheme receivables when a settlement report arrives by email.',
  'ar.bank': 'Merchant bank',
  'ar.enabled': 'Reconcile this bank',
  'ar.enabledOffHint': 'Switched off — arriving reports are handed back unread and cost nothing.',

  // The three controls the review dialog's AR reconciliation settings link sends people here for.
  'ar.postingRules': 'Posting rules',
  'ar.postType': 'Credit breakdown',
  'ar.postTypeMapped': '{mapped}/{total} mapped',
  'ar.postTypeHintDetail': 'One credit line per printed payment type, e.g. VS INTER UP PREM.',
  'ar.postTypeHintSummary':
    'One credit line per scheme — VS, MC, JCB — folding the sub-types together.',
  'ar.postTypeHintShared':
    'Each keeps its own mappings, so switching does not carry the other set over.',
  'ar.templateEmpty': '(empty)',
  'ar.tagSettlementDate': 'Settlement date',
  'ar.tagTaxInvoiceNo': 'Tax invoice no.',
  'ar.tagBankName': 'Bank name',
  'ar.tagInsert': 'Insert {field}',
  'ar.tagAdded': '{field} already added',
  'ar.fixedDebit': 'Debit legs (commission / tax / net)',
  'ar.fixedDebitKey.commission': 'Commission',
  'ar.fixedDebitKey.tax': 'Input tax',
  'ar.fixedDebitKey.net': 'Bank account',
  'ar.fixedDebitHint': 'From your credit-card mapping — edit them on the',
  'ar.fixedDebitLink': 'Mapping page',
  'ar.fixedDebitRuleNote':
    'Point your KBANK filename rule at KB1P554V2_SUM so the settlement report — not the commission fee invoice — is the file that reaches this pipeline.',

  // Payment type → credit GL.
  'ar.mappingTitle': 'Payment type mapping',
  'ar.mappingEmpty': 'Add the payment types this bank prints, or wait for the first report',
  'ar.mappingMissing': '{missing} of {total} still to map',
  'ar.mappingBlocks': 'Blocks auto-posting',
  'ar.mappingAllMapped': 'All {total} payment types mapped',
  'ar.mappingReady': 'Ready for JV',
  'ar.colDeptCode': 'Department Code',
  'ar.colAccCode': 'Account Code',
  'ar.addPlaceholder': 'Add a payment type, e.g. AMEX PREM',
  'ar.addType': 'Add type',
  'ar.rowCount': '{count} in {postType}',
  'ar.removeType': 'Remove {type}',

  // Save bar + the guard on the way out. The state sentence exists so a disabled primary
  // is not read as a broken control.
  'ar.unsaved': 'Unsaved changes',
  'ar.allSaved': 'Everything here is saved',
  'ar.save': 'Save settings',
  'ar.savingLabel': 'Saving...',
  'ar.reset': 'Reset',
  'ar.leaveTitle': 'Leave without saving?',
  'ar.leaveMessage':
    'The mappings and settings changed here have not been saved. Leaving now discards them.',
  'ar.leaveConfirm': 'Discard and leave',
  'ar.leaveCancel': 'Stay on this page',

  'ar.toastLoadFailed': 'Could not load AR reconciliation settings',
  'ar.toastSaved': 'Settings saved',
  'ar.toastSaveFailed': 'Save failed',
  'ar.toastDuplicateType': '{code} is already in the table',
  'ar.toastAllMapped': 'Every payment type is already mapped',
  'ar.toastNoSuggestion': 'No suggestion could be made',
} as const

export const th: Record<keyof typeof en, string> = {
  // — AR reconciliation settings —
  //
  // Dept / Account / Description / Debit / Credit and Detail / Summary stay in English
  // here as they do in the review pane: they are the column names Carmen prints and the
  // words an accountant says out loud.
  'ar.title': 'กระทบยอดลูกหนี้บัตรเครดิต',
  'ar.intro':
    'แยกยอดบัญชีคุมยอดบัตรเครดิตก้อนเดียวออกเป็นลูกหนี้รายค่ายบัตร เมื่อรายงาน settlement ส่งเข้ามาทางอีเมล',
  'ar.bank': 'ธนาคารผู้รับบัตร',
  'ar.enabled': 'กระทบยอดธนาคารนี้',
  'ar.enabledOffHint': 'ปิดอยู่ — รายงานที่ส่งเข้ามาจะถูกส่งคืนโดยไม่อ่านและไม่มีค่าใช้จ่าย',

  'ar.postingRules': 'กติกาการลงบัญชี',
  'ar.postType': 'รูปแบบการแบ่งยอดเครดิต',
  'ar.postTypeMapped': 'ผูกแล้ว {mapped}/{total}',
  'ar.postTypeHintDetail': 'ลงเครดิตหนึ่งบรรทัดต่อประเภทบัตรตามที่พิมพ์ เช่น VS INTER UP PREM',
  'ar.postTypeHintSummary':
    'ลงเครดิตหนึ่งบรรทัดต่อค่ายบัตร — VS, MC, JCB — โดยรวมประเภทย่อยเข้าด้วยกัน',
  'ar.postTypeHintShared': 'แต่ละรูปแบบเก็บผังบัญชีของตัวเอง การสลับจึงไม่ดึงผังของอีกชุดมาใช้',
  'ar.templateEmpty': '(ว่าง)',
  'ar.tagSettlementDate': 'วันที่ปิดยอด',
  'ar.tagTaxInvoiceNo': 'เลขที่ใบกำกับภาษี',
  'ar.tagBankName': 'ชื่อธนาคาร',
  'ar.tagInsert': 'แทรก{field}',
  'ar.tagAdded': 'แทรก{field}แล้ว',
  'ar.fixedDebit': 'ฝั่งเดบิต (ค่าธรรมเนียม / ภาษีซื้อ / ยอดสุทธิ)',
  'ar.fixedDebitKey.commission': 'ค่าคอมมิชชั่น',
  'ar.fixedDebitKey.tax': 'ภาษีซื้อ',
  'ar.fixedDebitKey.net': 'บัญชีธนาคาร',
  'ar.fixedDebitHint': 'ดึงมาจากผังบัญชีบัตรเครดิตของคุณ — แก้ไขได้ที่',
  'ar.fixedDebitLink': 'หน้าผังบัญชี',
  'ar.fixedDebitRuleNote':
    'ตั้งกฎชื่อไฟล์ KBANK ให้จับ KB1P554V2_SUM เพื่อให้รายงาน settlement — ไม่ใช่ใบแจ้งค่าธรรมเนียม — เป็นไฟล์ที่เข้าสู่กระบวนการนี้',

  'ar.mappingTitle': 'ผูกผังบัญชีตามประเภทบัตร',
  'ar.mappingEmpty': 'เพิ่มประเภทบัตรที่ธนาคารนี้พิมพ์ หรือรอรายงานใบแรก',
  'ar.mappingMissing': 'ยังต้องผูกอีก {missing} จาก {total}',
  'ar.mappingBlocks': 'ทำให้โพสต์อัตโนมัติไม่ได้',
  'ar.mappingAllMapped': 'ผูกครบแล้วทั้ง {total} ประเภทบัตร',
  'ar.mappingReady': 'พร้อมสร้าง JV',
  'ar.colDeptCode': 'รหัสฝ่าย',
  'ar.colAccCode': 'รหัสบัญชี',
  'ar.addPlaceholder': 'เพิ่มประเภทบัตร เช่น AMEX PREM',
  'ar.addType': 'เพิ่มประเภทบัตร',
  'ar.rowCount': '{count} รายการใน {postType}',
  'ar.removeType': 'ลบ {type}',

  'ar.unsaved': 'มีการแก้ไขที่ยังไม่บันทึก',
  'ar.allSaved': 'บันทึกทุกอย่างในหน้านี้แล้ว',
  'ar.save': 'บันทึกการตั้งค่า',
  'ar.savingLabel': 'กำลังบันทึก...',
  'ar.reset': 'คืนค่า',
  'ar.leaveTitle': 'ออกโดยไม่บันทึก?',
  'ar.leaveMessage': 'ผังบัญชีและการตั้งค่าที่แก้ไว้ยังไม่ได้บันทึก ถ้าออกตอนนี้จะหายทั้งหมด',
  'ar.leaveConfirm': 'ทิ้งการแก้ไขแล้วออก',
  'ar.leaveCancel': 'อยู่หน้านี้ต่อ',

  'ar.toastLoadFailed': 'โหลดการตั้งค่ากระทบยอดไม่สำเร็จ',
  'ar.toastSaved': 'บันทึกการตั้งค่าแล้ว',
  'ar.toastSaveFailed': 'บันทึกไม่สำเร็จ',
  'ar.toastDuplicateType': 'มี {code} อยู่ในตารางแล้ว',
  'ar.toastAllMapped': 'ผูกบัญชีครบทุกประเภทบัตรแล้ว',
  'ar.toastNoSuggestion': 'ไม่สามารถแนะนำบัญชีได้',
}
