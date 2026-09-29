export const en = {
  // What the normalizers found, written here rather than in Python — the backend emits a
  // code and its numbers (`ExtractionWarning`) because a cron-driven pipeline cannot know
  // which side of the language toggle the reviewer is on. Kept to one sentence each: the
  // heading above already says amounts need review, and five of these used to end by
  // saying it again.
  'warn.reconMismatch':
    'Lines add up to {lines}, the printed grand total is {printed} — off by {gap}.',
  'warn.totalMissing':
    "The statement's printed total was not read, so the lines could not be checked against it.",
  'warn.assumedVat': 'VAT computed at an assumed {rate} — the printed totals did not show it.',
  'warn.feeUnreadable': 'A fee amount could not be read — enter it by hand.',
  'warn.noFeeLines': 'No fee lines found — the item table may have been missed.',
  'warn.vatUnallocated': 'Some fee lines had no amount, so the VAT split may be off.',
  'warn.negativeAmounts': 'Refund amounts are shown as extracted; they were not reconciled.',
  'warn.bankMismatch': 'Matched your {rule} rule but issued by {detected} — filed as {detected}.',
  'warn.settlementTotalMissing':
    'The report’s own TOTAL line could not be read, so the card rows were not cross-checked.',
  'warn.merchantMismatch': 'Merchant {doc} was read, but the file is named for merchant {file}.',
  'warn.apTaxGuessed': 'Assumed unit prices are VAT {taxType} — the footer did not confirm it.',
  // Our own words for where VAT sits, not a Carmen field name, so they read translated
  // inside the sentence above.
  'warn.taxType.Include': 'inclusive',
  'warn.taxType.Exclude': 'exclusive',
  'warn.taxType.None': 'exempt',
} as const

export const th: Record<keyof typeof en, string> = {
  'warn.reconMismatch': 'ผลรวมบรรทัด {lines} แต่ยอดรวมที่พิมพ์ไว้ {printed} — ต่างกัน {gap}',
  'warn.totalMissing': 'อ่านยอดรวมที่พิมพ์บนเอกสารไม่ได้ จึงไม่ได้ตรวจว่ารายการครบหรือไม่',
  'warn.assumedVat': 'คำนวณ VAT ที่อัตรา {rate} โดยอนุมาน เพราะยอดรวมบนเอกสารไม่ได้ระบุไว้',
  'warn.feeUnreadable': 'อ่านยอดค่าธรรมเนียมไม่ได้ — กรุณากรอกเอง',
  'warn.noFeeLines': 'ไม่พบบรรทัดค่าธรรมเนียม — อาจอ่านตารางรายการไม่เจอ',
  'warn.vatUnallocated': 'บางบรรทัดไม่มียอดค่าธรรมเนียม การกระจาย VAT อาจคลาดเคลื่อน',
  'warn.negativeAmounts': 'มียอดติดลบ แสดงตามที่อ่านได้ ไม่ได้กระทบยอดอัตโนมัติ',
  'warn.bankMismatch': 'เข้ากฎ {rule} แต่เอกสารออกโดย {detected} — บันทึกเป็น {detected}',
  'warn.settlementTotalMissing':
    'อ่านบรรทัดยอดรวมของรายงานไม่ได้ จึงไม่ได้ตรวจทานยอดรายบัตรกับยอดรวม',
  'warn.merchantMismatch': 'อ่านได้ร้านค้า {doc} แต่ชื่อไฟล์เป็นของร้านค้า {file}',
  'warn.apTaxGuessed': 'อนุมานว่าราคาต่อหน่วยเป็นแบบ{taxType} เพราะยอดท้ายเอกสารไม่ยืนยัน',
  'warn.taxType.Include': 'รวม VAT',
  'warn.taxType.Exclude': 'ไม่รวม VAT',
  'warn.taxType.None': 'ยกเว้น VAT',
}
