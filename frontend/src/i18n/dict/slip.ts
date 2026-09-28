export const en = {
  // — Slip upload —
  'slip.errType': 'Only JPG, PNG, or PDF files are supported',
  'slip.errSize': 'File exceeds 5 MB',
  'slip.chooseDifferent': 'Choose a different file',
  'slip.submitting': 'Submitting…',
  'slip.uploadLabel': 'Upload payment slip',
  'slip.uploadHint': 'Click or drag a file here · JPG · PNG · PDF · up to 5 MB',
  'slip.changeTitle': 'Confirm plan change',
  // All three share one shape — condition, loss, carry-over rule — so a buyer who reads
  // one recognises the others. "When approved" is load-bearing: the plan changes when an
  // admin approves the slip, not at upload, and a buyer told "immediately" reloads, sees
  // the old plan, and reports a bug.
  'slip.changeWarnQuota':
    "When approved, quota drops from {prev} to {next} docs. Unused docs and days aren't carried over.",
  'slip.changeWarnPeriod':
    "When approved, your annual plan becomes monthly. Prepaid months aren't carried over.",
  'slip.changeWarnBoth':
    'When approved, plan becomes monthly and quota drops from {prev} to {next} docs. Nothing is carried over.',
} as const

export const th: Record<keyof typeof en, string> = {
  // — Slip upload —
  'slip.errType': 'รองรับเฉพาะไฟล์ JPG, PNG หรือ PDF เท่านั้น',
  'slip.errSize': 'ไฟล์มีขนาดเกิน 5 MB',
  'slip.chooseDifferent': 'เลือกไฟล์อื่น',
  'slip.submitting': 'กำลังส่ง…',
  'slip.uploadLabel': 'อัปโหลดสลิปการชำระเงิน',
  'slip.uploadHint': 'คลิกหรือลากไฟล์มาวางที่นี่ · JPG · PNG · PDF · ไม่เกิน 5 MB',
  'slip.changeTitle': 'ยืนยันการเปลี่ยนแพ็กเกจ',
  'slip.changeWarnQuota':
    'เมื่ออนุมัติ: โควตาลดจาก {prev} เป็น {next} เอกสาร ส่วนที่เหลือไม่ถูกยกยอด',
  'slip.changeWarnPeriod': 'เมื่ออนุมัติ: แพ็กเกจรายปีเป็นรายเดือน เดือนที่จ่ายล่วงหน้าไม่ถูกยกยอด',
  'slip.changeWarnBoth':
    'เมื่ออนุมัติ: แพ็กเกจรายปีเป็นรายเดือน และโควตาลดจาก {prev} เป็น {next} เอกสาร ทั้งหมดไม่ถูกยกยอด',
}
