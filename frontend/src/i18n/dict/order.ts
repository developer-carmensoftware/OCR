export const en = {
  // — Order history + status —
  'order.statusInProgress': 'In progress',
  'order.statusComplete': 'Complete',
  'order.statusVoid': 'Void',
  'order.statusOnHold': 'On hold',
  'order.title': 'Order history',
  'order.loadError': 'Failed to load history: {error}',
  'order.loadingDocs': 'Loading documents…',
  'order.empty': 'No orders yet',
  'order.emptySub': 'Pick a monthly plan or top up credits to keep working past your free quota.',
  'order.viewAllPlans': 'View all plans',
  'order.pendingNote':
    "No slip uploaded yet. If you've already paid, upload the slip for our team to review.",
  'order.pendingBanner.title': 'You have an unfinished order',
  'order.pendingBanner.body':
    "It won't appear in your history until you upload the payment slip. Finish it below, or cancel it.",
  'order.viewInvoice': 'View invoice',
  'order.cancel': 'Cancel order',
  'order.cancelConfirm': 'Cancel this order? You can place it again afterwards.',
  'order.cancelledToast': 'Order cancelled',
  'order.approvedToast': 'Order approved',
  'order.rejectedToast': 'Your order was rejected — check the details',
  'order.cancelReviewConfirm':
    "Your slip is under review. If you've already transferred money, please contact our team. Cancel this order?",
  'order.reviewingBanner.title': 'Your order is under review',
  'order.reviewingBanner.body':
    "We're verifying your payment slip. Credits will be added once approved.",
  'order.onHoldNote':
    "Your payment window has passed — we'll contact you to confirm before finalizing.",
  'order.onHoldBanner.title': 'Your order needs a quick check',
  'order.onHoldBanner.body':
    'The 14-day payment window passed. Our team will reach out to confirm before finalizing — no action needed from you right now.',
  'order.rejectedNote': "This slip didn't pass review. Please place a new order.",
  'order.rejectedReasonLabel': 'Reason from review:',
  'order.orderAgain': 'Order again',
  'order.noDocs': 'No documents for this order yet',
  'order.requestedAt': 'Requested',
  'order.slipUploadedAt': 'Slip uploaded',
  'order.approvedAt': 'Approved',
  'order.expires': 'Expires',
} as const

export const th: Record<keyof typeof en, string> = {
  // — Order history + status —
  'order.statusInProgress': 'กำลังดำเนินการ',
  'order.statusComplete': 'เสร็จสมบูรณ์',
  'order.statusVoid': 'ยกเลิก',
  'order.statusOnHold': 'รอติดต่อยืนยัน',
  'order.title': 'ประวัติคำสั่งซื้อ',
  'order.loadError': 'โหลดประวัติไม่สำเร็จ: {error}',
  'order.loadingDocs': 'กำลังโหลดเอกสาร…',
  'order.empty': 'ยังไม่มีคำสั่งซื้อ',
  'order.emptySub': 'เลือกแพ็กเกจรายเดือนหรือเติมเครดิตเพื่อใช้งานต่อหลังหมดโควตาฟรี',
  'order.viewAllPlans': 'ดูแพ็กเกจทั้งหมด',
  'order.pendingNote': 'ยังไม่ได้อัปโหลดสลิป หากชำระเงินแล้ว กรุณาอัปโหลดสลิปให้ทีมงานตรวจสอบ',
  'order.pendingBanner.title': 'คุณมีคำสั่งซื้อที่ยังไม่เสร็จ',
  'order.pendingBanner.body':
    'คำสั่งซื้อจะยังไม่แสดงในประวัติจนกว่าจะอัปโหลดสลิปการชำระเงิน กรุณาดำเนินการให้เสร็จด้านล่าง หรือยกเลิกคำสั่งซื้อ',
  'order.viewInvoice': 'ดูใบแจ้งหนี้',
  'order.cancel': 'ยกเลิกคำสั่งซื้อ',
  'order.cancelConfirm': 'ยกเลิกคำสั่งซื้อนี้ใช่ไหม? คุณสามารถสั่งซื้อใหม่ได้ภายหลัง',
  'order.cancelledToast': 'ยกเลิกคำสั่งซื้อแล้ว',
  'order.approvedToast': 'คำสั่งซื้อได้รับการอนุมัติแล้ว',
  'order.rejectedToast': 'คำสั่งซื้อถูกปฏิเสธ — โปรดตรวจสอบรายละเอียด',
  'order.cancelReviewConfirm':
    'สลิปของคุณอยู่ระหว่างตรวจสอบ หากโอนเงินแล้ว กรุณาติดต่อทีมงาน ต้องการยกเลิกคำสั่งซื้อนี้ไหม?',
  'order.reviewingBanner.title': 'คำสั่งซื้อของคุณอยู่ระหว่างตรวจสอบ',
  'order.reviewingBanner.body':
    'ทีมงานกำลังตรวจสอบสลิปการชำระเงิน เครดิตจะถูกเพิ่มเมื่อได้รับการอนุมัติ',
  'order.onHoldNote': 'ครบกำหนดชำระเงินแล้ว — ทีมงานจะติดต่อคุณเพื่อยืนยันก่อนดำเนินการต่อ',
  'order.onHoldBanner.title': 'คำสั่งซื้อของคุณต้องการการยืนยันเพิ่มเติม',
  'order.onHoldBanner.body':
    'ครบกำหนด 14 วันแล้ว ทีมงานจะติดต่อคุณเพื่อยืนยันก่อนดำเนินการต่อ ไม่ต้องดำเนินการใด ๆ ในตอนนี้',
  'order.rejectedNote': 'สลิปนี้ไม่ผ่านการตรวจสอบ กรุณาสั่งซื้อใหม่อีกครั้ง',
  'order.rejectedReasonLabel': 'เหตุผลจากการตรวจสอบ:',
  'order.orderAgain': 'สั่งซื้อใหม่',
  'order.noDocs': 'ยังไม่มีเอกสารสำหรับคำสั่งซื้อนี้',
  'order.requestedAt': 'วันที่สั่งซื้อ',
  'order.slipUploadedAt': 'วันที่อัปโหลดสลิป',
  'order.approvedAt': 'วันที่อนุมัติ',
  'order.expires': 'หมดอายุ',
}
