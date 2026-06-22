/**
 * Bilingual (EN/TH) copy for the customer-facing purchase flow
 * (catalog → checkout → QR → slip → order history).
 *
 * One flat object keyed by short namespaced keys. `en` is the source of truth;
 * `th` is typed as `Record<TKey, string>` so TS errors if a Thai string is
 * missing. Tier brand names (Free/Starter/Standard/…) are NOT here — they read
 * as product names and stay in `constants/billing.ts`.
 *
 * `{var}` placeholders are filled by `t(key, vars)` in LanguageContext.
 */

export type Lang = 'en' | 'th'

const en = {
  // — Header / nav —
  'nav.plansCredits': 'Plans & Credits',
  'nav.plans': 'Plans',
  'nav.history': 'History',

  // — Pricing hero + top-up section —
  'pricing.title': 'Start free with 30 documents',
  'pricing.subtitle': 'Pick the plan that fits your business.',
  'pricing.topupTitle': 'Top-up credits',
  'pricing.topupSub': 'Works with any plan. Credits never expire.',
  'pricing.topupNote': '1 credit = 1 document',
  'pricing.loadError': 'Failed to load plans: {error}',

  // — Plan cards —
  'plan.docsPerMonthSuffix': 'documents / month',
  'plan.perMonth': '/ month',
  'plan.perDoc': '/ doc',
  'plan.choose': 'Choose {name}',
  'plan.oneTimeTrial': 'One-time trial',
  'plan.docsUnit': 'documents',
  'plan.startScanning': 'Start scanning',
  'plan.custom': 'Custom',
  'plan.contactSales': 'Contact sales',
  'plan.enterpriseTagline': 'For large firms & accounting offices',
  'plan.customPricing': 'Custom pricing',
  'plan.badgePopular': 'Popular',

  // — Top-up packs —
  'pack.creditsUnit': 'credits',
  'pack.perDoc': '/doc',
  'pack.badgeBestValue': 'Best value',

  // — Enterprise contact dialog —
  'contact.sub': "Talk to our team to tailor an Enterprise plan to your organization's volume.",
  'contact.close': 'Close',
  'contact.phone': 'Phone',
  'contact.email': 'Email',

  // — Checkout —
  'checkout.step1': 'Billing info',
  'checkout.step2': 'Payment',
  'checkout.step3': 'Done',
  'checkout.sourceCarmen': 'From Carmen',
  'checkout.sourceLastInvoice': 'From last invoice',
  'checkout.createError': 'Could not create the order',
  'checkout.slipSubmittedToast': 'Slip submitted — our team will review it shortly',
  'checkout.backToPlans': 'Back to plans',
  'checkout.billingTitle': 'Billing information (for the tax invoice)',
  'checkout.fieldName': 'Company / buyer name',
  'checkout.phName': 'e.g. Example Co., Ltd.',
  'checkout.fieldTaxId': 'Tax ID',
  'checkout.phTaxId': '0000000000000',
  'checkout.fieldAddress': 'Address',
  'checkout.phAddress': 'Billing address for the tax invoice',
  'checkout.fieldBranch': 'Branch',
  'checkout.phBranch': 'Head office',
  'checkout.fieldEmail': 'Email',
  'checkout.phEmail': 'billing@example.com',
  'checkout.fieldContactName': 'Purchaser name',
  'checkout.phContactName': 'Contact person name',
  'checkout.summaryTitle': 'Order summary',
  'checkout.kindMonthly': 'Monthly plan',
  'checkout.kindTopup': 'Top-up credits (never expire)',
  'checkout.totalDue': 'Total due',
  'checkout.vatNote': 'Prices exclude 7% VAT',
  'checkout.creatingOrder': 'Creating order…',
  'checkout.continueToPayment': 'Continue to payment',
  'checkout.fillAllFieldsHint': 'Please fill in all fields to continue',
  'checkout.verifyHint':
    'Please verify your billing details — they will appear on the proforma invoice.',
  'checkout.scanToPay': 'Scan to pay with PromptPay',
  'checkout.scanSub':
    'Open your banking app, scan the QR, transfer the exact amount, then upload the slip below.',
  'checkout.confirmPayment': 'Confirm payment',
  'checkout.confirmSub':
    "Upload your transfer slip. We'll verify it and add the credits within one business day.",
  'checkout.hideInvoice': 'Hide invoice',
  'checkout.viewInvoice': 'View invoice (Proforma)',
  'checkout.slipSubmittedTitle': 'Slip submitted',
  'checkout.slipSubmittedSub':
    'Your order is under review. Once payment is verified, credits are added automatically and your tax invoice appears in order history.',
  'checkout.viewOrderHistory': 'View order history',

  // — PromptPay QR —
  'qr.promptpay': 'PromptPay',
  'qr.saveQr': 'Save QR',

  // — Slip upload —
  'slip.errType': 'Only JPG, PNG, or PDF files are supported',
  'slip.errSize': 'File exceeds 20 MB',
  'slip.chooseDifferent': 'Choose a different file',
  'slip.submitting': 'Submitting…',
  'slip.uploadLabel': 'Upload payment slip',
  'slip.uploadHint': 'Click or drag a file here · JPG · PNG · PDF · up to 20 MB',

  // — Order history + status —
  'order.statusPending': 'Awaiting payment',
  'order.statusReviewing': 'Reviewing slip',
  'order.statusPaid': 'Credited',
  'order.statusRejected': 'Slip rejected',
  'order.statusCancelled': 'Cancelled',
  'order.title': 'Order history',
  'order.buyPlan': 'Buy a plan',
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
  'order.approvedToast': 'Order approved — credits added to your balance',
  'order.rejectedToast': 'Your order was rejected — check the details',
  'order.cancelReviewConfirm':
    "Your slip is under review. If you've already transferred money, please contact our team. Cancel this order?",
  'order.reviewingBanner.title': 'Your order is under review',
  'order.reviewingBanner.body':
    "We're verifying your payment slip. Credits will be added once approved.",
  'order.rejectedNote': "This slip didn't pass review. Please place a new order.",
  'order.orderAgain': 'Order again',
  'order.noDocs': 'No documents for this order yet',
  'order.requestedAt': 'Requested',
  'order.slipUploadedAt': 'Slip uploaded',
  'order.approvedAt': 'Approved',

  // — Proforma doc UI controls (the printed body stays bilingual as-is) —
  'proforma.docNo': 'Document no.',
  'proforma.print': 'Print / Save PDF',

  // — Usage strip —
  'usage.freeLeft': 'Free quota left',
  'usage.topupCredits': 'Top-up credits',
  'usage.runningLow': 'Running low — pick a plan below to keep going',
  'usage.planLeft': 'Plan docs left',
  'usage.activeUntil': 'Active until',
  'order.expires': 'Expires',

  // — Feature flows (marketing showcase) —
  'flows.heading': 'How AI helps with your accounting work',
  'flows.sub': 'Pick a feature to see how it works',
  'flows.cc.desc':
    'Turn a single document into finished work: the system creates the Journal Voucher to post the entry automatically and runs Input Tax Reconciliation to record purchase VAT for your tax filing — replacing the old manual steps, accurately.',
  'flows.ap.desc':
    'Say goodbye to manual data entry. For purchases with no PR/PO or for service charges, just scan the document — the system builds the record automatically, cutting work time by up to 60%.',
  'flows.gl.desc':
    'Work faster with automatic account-code suggestions. AI reviews and analyzes your past entries to recommend the right code, and keeps learning to get more accurate over time.',
  'flows.cc.sub':
    'From one document, the system produces the full accounting entry and purchase-VAT report.',
  'flows.cc.n1.label': 'Receive document',
  'flows.cc.n1.cap': 'Bank fee statement',
  'flows.cc.match.label': 'Match accounts & tax',
  'flows.cc.chk1': 'Read & extract data',
  'flows.cc.chk2': 'Match chart of accounts / tax',
  'flows.cc.chk3': 'Create the target document',
  'flows.cc.out1.h': 'Accounting entry (JV)',
  'flows.cc.out1.p': 'Posted automatically, no manual keying',
  'flows.cc.out2.h': 'Purchase VAT report',
  'flows.cc.out2.p': 'Ready to file with the Revenue Department',
  'flows.cc.result': 'One document, two outputs automatically — less rework and fewer errors.',
  'flows.ap.sub':
    'Scan a bill; the system reads it and creates the invoice record for you — 60% less manual keying.',
  'flows.ap.s1.label': 'Scan bill',
  'flows.ap.s1.cap': 'Invoice or tax invoice',
  'flows.ap.s2a.label': 'Extract data',
  'flows.ap.s2a.cap': 'No., amount, tax, vendor',
  'flows.ap.s2b.label': 'Validate',
  'flows.ap.s2b.cap': 'Format + match vendor master',
  'flows.ap.s2c.label': 'Create invoice',
  'flows.ap.s2c.cap': 'Save to system + account code',
  'flows.ap.out.h': 'Ready to continue in the system',
  'flows.ap.out1': 'AP Invoice saved',
  'flows.ap.out2': 'Ready for journal entry (JV) and payment',
  'flows.ap.out3': 'Payable / purchase-VAT reports',
  'flows.ap.b1.label': 'less manual keying',
  'flows.ap.b2.label': 'Fewer errors',
  'flows.ap.b2.sub': 'from manual entry',
  'flows.ap.b3.label': 'Complete data',
  'flows.ap.b3.sub': 'fully traceable',
  'flows.gl.sub':
    'The system looks at your posting history and suggests the code most likely to fit.',
  'flows.gl.pick': 'Pick a sample item',
  'flows.gl.compare.label': 'Compare history',
  'flows.gl.compare.capOn': 'Found similar entries (95%+)',
  'flows.gl.compare.capOff': 'Review past entries',
  'flows.gl.out.label': 'Suggested code',
  'flows.gl.analyzing': 'Analyzing…',
  'flows.gl.accuracy': 'Accuracy',
  'flows.gl.s.water': 'Water supply — main building (MWA)',
  'flows.gl.s.water.code': '5301-01 · Water & utilities',
  'flows.gl.s.laundry': 'Laundry — blankets & linens',
  'flows.gl.s.laundry.code': '5405-02 · Laundry & cleaning services',
  'flows.gl.s.salmon': 'Purchase — frozen salmon',
  'flows.gl.s.salmon.code': '1401-03 · F&B inventory',
  'modal.cancel': 'Cancel',
} as const

export type TKey = keyof typeof en

const th: Record<TKey, string> = {
  // — Header / nav —
  'nav.plansCredits': 'แพ็กเกจและเครดิต',
  'nav.plans': 'แพ็กเกจ',
  'nav.history': 'ประวัติ',

  // — Pricing hero + top-up section —
  'pricing.title': 'เริ่มต้นใช้งานฟรี 30 เอกสาร',
  'pricing.subtitle': 'เลือกแพ็กเกจที่เหมาะกับธุรกิจของคุณ',
  'pricing.topupTitle': 'เติมเครดิต',
  'pricing.topupSub': 'ใช้ได้กับทุกแพ็กเกจ เครดิตไม่มีวันหมดอายุ',
  'pricing.topupNote': '1 เครดิต = 1 เอกสาร',
  'pricing.loadError': 'โหลดแพ็กเกจไม่สำเร็จ: {error}',

  // — Plan cards —
  'plan.docsPerMonthSuffix': 'เอกสาร / เดือน',
  'plan.perMonth': '/ เดือน',
  'plan.perDoc': '/ เอกสาร',
  'plan.choose': 'เลือก {name}',
  'plan.oneTimeTrial': 'ทดลองใช้ครั้งเดียว',
  'plan.docsUnit': 'เอกสาร',
  'plan.startScanning': 'เริ่มสแกนเอกสาร',
  'plan.custom': 'กำหนดเอง',
  'plan.contactSales': 'ติดต่อฝ่ายขาย',
  'plan.enterpriseTagline': 'สำหรับองค์กรขนาดใหญ่และสำนักงานบัญชี',
  'plan.customPricing': 'ราคาตามการใช้งาน',
  'plan.badgePopular': 'ยอดนิยม',

  // — Top-up packs —
  'pack.creditsUnit': 'เครดิต',
  'pack.perDoc': '/เอกสาร',
  'pack.badgeBestValue': 'คุ้มที่สุด',

  // — Enterprise contact dialog —
  'contact.sub': 'พูดคุยกับทีมงานเพื่อออกแบบแพ็กเกจ Enterprise ให้เหมาะกับปริมาณงานขององค์กรคุณ',
  'contact.close': 'ปิด',
  'contact.phone': 'โทรศัพท์',
  'contact.email': 'อีเมล',

  // — Checkout —
  'checkout.step1': 'ข้อมูลออกบิล',
  'checkout.step2': 'ชำระเงิน',
  'checkout.step3': 'เสร็จสิ้น',
  'checkout.sourceCarmen': 'จาก Carmen',
  'checkout.sourceLastInvoice': 'จากใบแจ้งหนี้ล่าสุด',
  'checkout.createError': 'สร้างคำสั่งซื้อไม่สำเร็จ',
  'checkout.slipSubmittedToast': 'ส่งสลิปแล้ว — ทีมงานจะตรวจสอบให้เร็ว ๆ นี้',
  'checkout.backToPlans': 'กลับไปหน้าแพ็กเกจ',
  'checkout.billingTitle': 'ข้อมูลสำหรับออกใบกำกับภาษี',
  'checkout.fieldName': 'ชื่อบริษัท / ผู้ซื้อ',
  'checkout.phName': 'เช่น บริษัท ตัวอย่าง จำกัด',
  'checkout.fieldTaxId': 'เลขประจำตัวผู้เสียภาษี',
  'checkout.phTaxId': '0000000000000',
  'checkout.fieldAddress': 'ที่อยู่',
  'checkout.phAddress': 'ที่อยู่สำหรับออกใบกำกับภาษี',
  'checkout.fieldBranch': 'สาขา',
  'checkout.phBranch': 'สำนักงานใหญ่',
  'checkout.fieldEmail': 'อีเมล',
  'checkout.phEmail': 'billing@example.com',
  'checkout.fieldContactName': 'ชื่อผู้สั่งซื้อ',
  'checkout.phContactName': 'ชื่อผู้ติดต่อ',
  'checkout.summaryTitle': 'สรุปคำสั่งซื้อ',
  'checkout.kindMonthly': 'แพ็กเกจรายเดือน',
  'checkout.kindTopup': 'เครดิตเติม (ไม่มีวันหมดอายุ)',
  'checkout.totalDue': 'ยอดชำระทั้งหมด',
  'checkout.vatNote': 'ราคายังไม่รวมภาษีมูลค่าเพิ่ม 7%',
  'checkout.creatingOrder': 'กำลังสร้างคำสั่งซื้อ…',
  'checkout.continueToPayment': 'ดำเนินการชำระเงิน',
  'checkout.fillAllFieldsHint': 'กรุณากรอกข้อมูลให้ครบทุกช่อง',
  'checkout.verifyHint':
    'กรุณาตรวจสอบข้อมูลสำหรับออกบิลให้ถูกต้องก่อนดำเนินการ — ข้อมูลนี้จะปรากฏบนใบแจ้งหนี้',
  'checkout.scanToPay': 'สแกนเพื่อจ่ายด้วยพร้อมเพย์',
  'checkout.scanSub': 'เปิดแอปธนาคาร สแกน QR โอนยอดให้ตรงจำนวน แล้วอัปโหลดสลิปด้านล่าง',
  'checkout.confirmPayment': 'ยืนยันการชำระเงิน',
  'checkout.confirmSub': 'อัปโหลดสลิปการโอน เราจะตรวจสอบและเพิ่มเครดิตให้ภายใน 1 วันทำการ',
  'checkout.hideInvoice': 'ซ่อนใบแจ้งหนี้',
  'checkout.viewInvoice': 'ดูใบแจ้งหนี้ (Proforma)',
  'checkout.slipSubmittedTitle': 'ส่งสลิปแล้ว',
  'checkout.slipSubmittedSub':
    'คำสั่งซื้อของคุณอยู่ระหว่างตรวจสอบ เมื่อยืนยันการชำระเงินแล้ว ระบบจะเพิ่มเครดิตอัตโนมัติ และใบกำกับภาษีจะปรากฏในประวัติคำสั่งซื้อ',
  'checkout.viewOrderHistory': 'ดูประวัติคำสั่งซื้อ',

  // — PromptPay QR —
  'qr.promptpay': 'พร้อมเพย์',
  'qr.saveQr': 'บันทึก QR',

  // — Slip upload —
  'slip.errType': 'รองรับเฉพาะไฟล์ JPG, PNG หรือ PDF เท่านั้น',
  'slip.errSize': 'ไฟล์มีขนาดเกิน 20 MB',
  'slip.chooseDifferent': 'เลือกไฟล์อื่น',
  'slip.submitting': 'กำลังส่ง…',
  'slip.uploadLabel': 'อัปโหลดสลิปการชำระเงิน',
  'slip.uploadHint': 'คลิกหรือลากไฟล์มาวางที่นี่ · JPG · PNG · PDF · ไม่เกิน 20 MB',

  // — Order history + status —
  'order.statusPending': 'รอชำระเงิน',
  'order.statusReviewing': 'กำลังตรวจสลิป',
  'order.statusPaid': 'เติมเครดิตแล้ว',
  'order.statusRejected': 'สลิปไม่ผ่าน',
  'order.statusCancelled': 'ยกเลิกแล้ว',
  'order.title': 'ประวัติคำสั่งซื้อ',
  'order.buyPlan': 'ซื้อแพ็กเกจ',
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
  'order.approvedToast': 'คำสั่งซื้อได้รับการอนุมัติ — เพิ่มเครดิตเข้ายอดแล้ว',
  'order.rejectedToast': 'คำสั่งซื้อถูกปฏิเสธ — โปรดตรวจสอบรายละเอียด',
  'order.cancelReviewConfirm':
    'สลิปของคุณอยู่ระหว่างตรวจสอบ หากโอนเงินแล้ว กรุณาติดต่อทีมงาน ต้องการยกเลิกคำสั่งซื้อนี้ไหม?',
  'order.reviewingBanner.title': 'คำสั่งซื้อของคุณอยู่ระหว่างตรวจสอบ',
  'order.reviewingBanner.body':
    'ทีมงานกำลังตรวจสอบสลิปการชำระเงิน เครดิตจะถูกเพิ่มเมื่อได้รับการอนุมัติ',
  'order.rejectedNote': 'สลิปนี้ไม่ผ่านการตรวจสอบ กรุณาสั่งซื้อใหม่อีกครั้ง',
  'order.orderAgain': 'สั่งซื้อใหม่',
  'order.noDocs': 'ยังไม่มีเอกสารสำหรับคำสั่งซื้อนี้',
  'order.requestedAt': 'วันที่สั่งซื้อ',
  'order.slipUploadedAt': 'วันที่อัปโหลดสลิป',
  'order.approvedAt': 'วันที่อนุมัติ',

  // — Proforma doc UI controls —
  'proforma.docNo': 'เลขที่เอกสาร',
  'proforma.print': 'พิมพ์ / บันทึก PDF',

  // — Usage strip —
  'usage.freeLeft': 'โควตาฟรีคงเหลือ',
  'usage.topupCredits': 'เครดิตเติม',
  'usage.runningLow': 'เครดิตใกล้หมด — เลือกแพ็กเกจด้านล่างเพื่อใช้งานต่อ',
  'usage.planLeft': 'เอกสารในแพ็กเกจคงเหลือ',
  'usage.activeUntil': 'ใช้งานถึง',
  'order.expires': 'หมดอายุ',

  // — Feature flows (marketing showcase) —
  'flows.heading': 'ระบบ AI ช่วยงานบัญชีของคุณยังไง',
  'flows.sub': 'เลือกฟีเจอร์เพื่อดูขั้นตอนการทำงาน',
  'flows.cc.desc':
    'ระบบช่วยเปลี่ยนเอกสาร 1 ใบ ให้เป็นเรื่องง่าย โดยสร้าง Journal Voucher เพื่อบันทึกบัญชีอัตโนมัติ และทำ Input Tax Reconciliation บันทึกภาษีซื้อเพื่อออกรายงานนำส่งสรรพากร ลดขั้นตอนการทำงานแบบเดิม ๆ ได้อย่างแม่นยำ',
  'flows.ap.desc':
    'บอกลาการคีย์ข้อมูลด้วยตนเอง สำหรับรายการสั่งซื้อที่ไม่มี PR/PO หรือรายการค่าบริการต่าง ๆ เพียงแค่สแกนเอกสารเข้าสู่ระบบ ระบบจะจัดการสร้างเอกสารให้อัตโนมัติ ช่วยประหยัดเวลาการทำงานลงได้มากถึง 60%',
  'flows.gl.desc':
    'เพิ่มความรวดเร็วในการทำงานด้วยระบบแนะนำการลงบัญชีอัตโนมัติ โดย AI จะช่วยตรวจสอบและวิเคราะห์ข้อมูลการบันทึกบัญชีในอดีต เพื่อให้คำแนะนำที่ถูกต้อง และระบบจะเรียนรู้เพื่อเพิ่มความแม่นยำขึ้นเรื่อย ๆ อย่างต่อเนื่อง',
  'flows.cc.sub': 'จากเอกสารใบเดียว ระบบสร้างบันทึกบัญชีและรายงานภาษีซื้อให้ครบ',
  'flows.cc.n1.label': 'รับเอกสาร',
  'flows.cc.n1.cap': 'ใบแจ้งค่าธรรมเนียมจากธนาคาร',
  'flows.cc.match.label': 'ระบบจับคู่บัญชีและภาษี',
  'flows.cc.chk1': 'อ่านและดึงข้อมูล',
  'flows.cc.chk2': 'จับคู่ผังบัญชี / ภาษี',
  'flows.cc.chk3': 'สร้างเอกสารปลายทาง',
  'flows.cc.out1.h': 'บันทึกบัญชี (JV)',
  'flows.cc.out1.p': 'ลงบัญชีอัตโนมัติ ไม่ต้องคีย์มือ',
  'flows.cc.out2.h': 'รายงานภาษีซื้อ',
  'flows.cc.out2.p': 'พร้อมนำส่งสรรพากร',
  'flows.cc.result': 'จากเอกสาร 1 ใบ ได้งาน 2 อย่างอัตโนมัติ ลดงานซ้ำซ้อนและข้อผิดพลาด',
  'flows.ap.sub': 'สแกนบิล ระบบอ่านและสร้างใบแจ้งหนี้ในระบบให้ ลดงานคีย์มือ 60%',
  'flows.ap.s1.label': 'สแกนบิล',
  'flows.ap.s1.cap': 'ใบแจ้งหนี้ หรือใบกำกับภาษี',
  'flows.ap.s2a.label': 'ดึงข้อมูล',
  'flows.ap.s2a.cap': 'เลขที่ ยอดเงิน ภาษี ผู้ขาย',
  'flows.ap.s2b.label': 'ตรวจความถูกต้อง',
  'flows.ap.s2b.cap': 'รูปแบบ + เทียบฐานผู้ขาย',
  'flows.ap.s2c.label': 'สร้างใบแจ้งหนี้',
  'flows.ap.s2c.cap': 'บันทึกเข้าระบบ + รหัสบัญชี',
  'flows.ap.out.h': 'พร้อมใช้งานต่อในระบบ',
  'flows.ap.out1': 'บันทึก AP Invoice สำเร็จ',
  'flows.ap.out2': 'พร้อมบันทึกบัญชี (JV) และทำจ่าย',
  'flows.ap.out3': 'รายงานเจ้าหนี้ / ภาษีซื้อ',
  'flows.ap.b1.label': 'ลดเวลาคีย์มือ',
  'flows.ap.b2.label': 'ลดข้อผิดพลาด',
  'flows.ap.b2.sub': 'จากการบันทึกด้วยมือ',
  'flows.ap.b3.label': 'ข้อมูลครบถ้วน',
  'flows.ap.b3.sub': 'ตรวจสอบย้อนได้',
  'flows.gl.sub': 'ระบบดูจากประวัติการลงบัญชี แล้วแนะนำรหัสที่น่าจะใช่ให้เลือก',
  'flows.gl.pick': 'เลือกตัวอย่างรายการ',
  'flows.gl.compare.label': 'เทียบประวัติ',
  'flows.gl.compare.capOn': 'พบรายการคล้ายกัน (95%+)',
  'flows.gl.compare.capOff': 'ดูการลงบัญชีย้อนหลัง',
  'flows.gl.out.label': 'รหัสที่แนะนำ',
  'flows.gl.analyzing': 'กำลังวิเคราะห์…',
  'flows.gl.accuracy': 'ความแม่นยำ',
  'flows.gl.s.water': 'ค่าน้ำประปาอาคารหลัก MWA',
  'flows.gl.s.water.code': '5301-01 · ค่าน้ำประปาและสาธารณูปโภค',
  'flows.gl.s.laundry': 'ค่าซักรีดผ้าห่มและเครื่องนอน',
  'flows.gl.s.laundry.code': '5405-02 · ค่าจ้างซักรีดและทำความสะอาด',
  'flows.gl.s.salmon': 'จัดซื้อปลาแซลมอนสดแช่แข็ง',
  'flows.gl.s.salmon.code': '1401-03 · สินค้าคลังเครื่องดื่มและอาหาร',
  'modal.cancel': 'ยกเลิก',
}

export const DICT: Record<Lang, Record<TKey, string>> = { en, th }

/** Pure lookup: current lang → en fallback → key; fills `{var}` placeholders. */
export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  const s = DICT[lang][key] ?? DICT.en[key] ?? key
  if (!vars) return s
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`))
}
