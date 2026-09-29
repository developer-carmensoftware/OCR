export const en = {
  // — Notification bell —
  'notif.bellAria': 'Notifications',
  'notif.title': 'Notifications',
  'notif.empty': 'No notifications yet',
  'notif.markAllRead': 'Mark all read',
  'notif.approved': 'Order approved — {credits} credits added',
  'notif.rejected': 'Order rejected: {reason}',
  'notif.onHold': 'Your order was placed on hold (payment window expired)',
  'notif.missingSlip': 'Reminder: payment slip not yet uploaded',
  'notif.docPosted': 'Posted to Carmen · {doc}',
  'notif.docFailed': 'Could not post · {doc}',
  'notif.docPendingReview': '{count} waiting for your review',
  // The merged form: the queue count already carries the blocked ones, so this is the
  // same row, not a second one (2026-09-23 — see NotificationBell.tsx).
  'notif.docPendingReviewBlocked': '{count} waiting for your review — {blocked} blocked',
  'notif.docBlocked': 'Could not read · {doc}',
  // Collapsed blocked/failed rows: "N files: <short reason>", one row per reason rather
  // than one per document. `reason` is one of `notif.reasonShort.*` below.
  'notif.docsBlockedCount': '{count} files: {reason}',
  // The one older `document_blocked` shape that names no document at all — a queue-level
  // count written before 2026-09-23's collapsing landed. Nothing left to name per file, so
  // this reads as a request rather than an outcome, same as docPendingReview.
  'notif.docsBlockedOrphan': '{blocked} documents need attention',
  'notif.reasonShort.wrongPdfPassword': 'wrong PDF password',
  'notif.reasonShort.unsupportedAttachment': 'unsupported file type',
  'notif.reasonShort.unreadableDocument': 'could not be read',
  'notif.reasonShort.unknown': 'a problem',

  // Detail dialog for the two email-automation rows. They open here rather than
  // navigating: there is no tenant-facing email document page to navigate to,
  // and the payload already carries everything worth showing.
  'notif.detail.postedTitle': 'Posted to Carmen',
  'notif.detail.failedTitle': 'Could not post',
  'notif.detail.blockedTitle': 'Could not read this document',
  'notif.detail.postedMsg': 'Journal voucher {jv} was created in Carmen.',
  'notif.detail.postedMsgNoJv': 'The document was posted to Carmen.',
  'notif.detail.document': 'Document',
  'notif.detail.bank': 'Bank',
  'notif.detail.docNo': 'Doc no.',
  'notif.detail.jvNo': 'JV no.',
  'notif.detail.time': 'Processed',
  'notif.detail.openJv': 'Open JV in Carmen',
  'notif.detail.close': 'Close',
  // reason_code taxonomy — docs/email-automation/04-data-model.md
  //
  // The long form of `review.rc*`, which is the same taxonomy in the width a queue cell has.
  // Two entries rather than one because the bell has room for the fix and the cell does not;
  // what must not differ is the vocabulary — one verb and one noun per event, or the same
  // document reads as two findings depending on where you met it.
  'notif.reason.taxIdMismatch': "The document's tax ID does not match this business unit.",
  'notif.reason.duplicateDocument': 'This document had already been posted.',
  'notif.reason.mappingIncomplete': 'GL mapping for this bank is still incomplete.',
  'notif.reason.unreadableDocument': 'The document could not be read.',
  'notif.reason.carmenRejected': 'Carmen refused the journal voucher.',
  'notif.reason.carmenUnauthorized':
    'Carmen would not accept this business unit’s posting credential. The document is fine — the token needs to be set again in AI JV Automation settings.',
  // The three a customer fixes themselves, in AI JV Automation settings.
  'notif.reason.wrongPdfPassword':
    'This PDF is password-protected and the password saved for this bank did not open it. Update it in AI JV Automation settings and forward the mail again.',
  'notif.reason.senderNotAllowed':
    'The mail did not come from any address registered for this business unit. Add the sender in AI JV Automation settings and forward it again.',
  'notif.reason.unsupportedAttachment':
    'This file type cannot be read. Forward the document as a PDF or an image.',
  'notif.reason.unknown': 'The document could not be processed.',
} as const

export const th: Record<keyof typeof en, string> = {
  // — Notification bell —
  'notif.bellAria': 'การแจ้งเตือน',
  'notif.title': 'การแจ้งเตือน',
  'notif.empty': 'ยังไม่มีการแจ้งเตือน',
  'notif.markAllRead': 'ทำเครื่องหมายว่าอ่านทั้งหมด',
  'notif.approved': 'อนุมัติคำสั่งซื้อแล้ว — เพิ่ม {credits} เครดิต',
  'notif.rejected': 'คำสั่งซื้อถูกปฏิเสธ: {reason}',
  'notif.onHold': 'คำสั่งซื้อของคุณถูกระงับ (หมดเวลาชำระเงิน)',
  'notif.missingSlip': 'เตือนความจำ: ยังไม่ได้อัปโหลดหลักฐานการชำระเงิน',
  'notif.docPosted': 'ส่งเข้า Carmen แล้ว · {doc}',
  'notif.docFailed': 'ส่งเข้า Carmen ไม่สำเร็จ · {doc}',
  'notif.docPendingReview': 'มี {count} รายการรอคุณตรวจสอบ',
  'notif.docPendingReviewBlocked': 'มี {count} รายการรอคุณตรวจสอบ — {blocked} รายการติดปัญหา',
  'notif.docBlocked': 'อ่านเอกสารไม่ได้ · {doc}',
  'notif.docsBlockedCount': '{count} ไฟล์: {reason}',
  'notif.docsBlockedOrphan': 'มี {blocked} เอกสารที่ต้องดำเนินการ',
  'notif.reasonShort.wrongPdfPassword': 'รหัสผ่าน PDF ไม่ถูกต้อง',
  'notif.reasonShort.unsupportedAttachment': 'ไฟล์แนบไม่รองรับ',
  'notif.reasonShort.unreadableDocument': 'อ่านเอกสารไม่ได้',
  'notif.reasonShort.unknown': 'มีปัญหา',

  'notif.detail.postedTitle': 'ส่งเข้า Carmen แล้ว',
  'notif.detail.failedTitle': 'ส่งเข้า Carmen ไม่สำเร็จ',
  'notif.detail.blockedTitle': 'อ่านเอกสารนี้ไม่ได้',
  'notif.detail.postedMsg': 'สร้างใบสำคัญ {jv} ใน Carmen เรียบร้อยแล้ว',
  'notif.detail.postedMsgNoJv': 'ส่งเอกสารเข้า Carmen เรียบร้อยแล้ว',
  'notif.detail.document': 'เอกสาร',
  'notif.detail.bank': 'ธนาคาร',
  'notif.detail.docNo': 'เลขที่เอกสาร',
  'notif.detail.jvNo': 'เลขที่ JV',
  'notif.detail.time': 'เวลาที่ประมวลผล',
  'notif.detail.openJv': 'เปิด JV ใน Carmen',
  'notif.detail.close': 'ปิด',
  'notif.reason.taxIdMismatch': 'เลขประจำตัวผู้เสียภาษีในเอกสารไม่ตรงกับหน่วยธุรกิจนี้',
  'notif.reason.duplicateDocument': 'เอกสารนี้ถูกส่งเข้าระบบไปแล้ว',
  'notif.reason.mappingIncomplete': 'การผูกผังบัญชีของธนาคารนี้ยังไม่ครบ',
  'notif.reason.unreadableDocument': 'อ่านข้อมูลจากเอกสารนี้ไม่ได้',
  'notif.reason.carmenRejected': 'Carmen ปฏิเสธการบันทึกใบสำคัญ',
  'notif.reason.carmenUnauthorized':
    'Carmen ไม่ยอมรับ token สำหรับส่งเอกสารของหน่วยธุรกิจนี้ ตัวเอกสารไม่มีปัญหา — ต้องตั้ง token ใหม่ในหน้าตั้งค่า AI JV Automation',
  'notif.reason.wrongPdfPassword':
    'ไฟล์ PDF นี้ตั้งรหัสผ่านไว้ และรหัสที่บันทึกไว้สำหรับธนาคารนี้เปิดไม่ได้ แก้รหัสในหน้าตั้งค่า AI JV Automation แล้วส่งเมลเข้ามาใหม่',
  'notif.reason.senderNotAllowed':
    'เมลฉบับนี้ไม่ได้มาจากอีเมลที่ลงทะเบียนไว้กับหน่วยธุรกิจนี้ เพิ่มผู้ส่งในหน้าตั้งค่า AI JV Automation แล้วส่งเข้ามาใหม่',
  'notif.reason.unsupportedAttachment':
    'ไฟล์ชนิดนี้อ่านไม่ได้ กรุณาส่งเอกสารเป็น PDF หรือไฟล์รูปภาพ',
  'notif.reason.unknown': 'ประมวลผลเอกสารนี้ไม่สำเร็จ',
}
