/**
 * User-facing release notes ("what's new"), rendered in the notification bell.
 *
 * Hand-authored, newest first, in the SAME PR as the change it describes — so the
 * note ships exactly when the code does and there is nothing to remember after a
 * deploy. This is not `changelog/`: that one is an engineering log (file paths,
 * function names, English only). This is 2-4 lines for a Thai accounting clerk
 * who just watched the system go offline and wants to know what changed.
 *
 * The ISO date IS the identity: lexicographic order equals chronological order,
 * so "which have I already seen" is one string comparison, not a version parser.
 * `version` rides alongside for display only — it is never compared.
 *
 * ponytail: one entry per DATE, not per deploy. Shipping twice in a day means
 * editing that day's entry — cheaper than inventing a release id, at the price
 * that the edit won't re-notify anyone who already read it. Same tradeoff
 * deploy.yml already makes when it skips an existing tag.
 *
 * Adding an entry:
 *   1. Only if a USER can see the difference. Refactors, CI, and dependency
 *      bumps get a changelog line and nothing here.
 *   2. Sort each bullet into `features` / `fixes` / `qol`. One line each,
 *      describing what they can now do or will see. Empty sections are omitted.
 *   3. Both languages. TS will not compile with one missing.
 *   4. Bump the repo-root `VERSION` file to match this entry's `version` — CI
 *      fails the PR if the newest entry and VERSION disagree, and deploy.yml
 *      cuts the GitHub Release tag from VERSION.
 */

/**
 * A fix has to say what it was like BEFORE. "Mapping now saves correctly" tells a
 * clerk nothing — they need to recognize the thing that was wasting their time to
 * know it stopped. `before` is required rather than conventional, so the compiler
 * asks the question instead of a reviewer having to.
 */
export interface ReleaseFix {
  before: string
  text: string
}

export interface ReleaseNoteCopy {
  title: string
  /** Something they could not do at all before. */
  features?: string[]
  /** Something that was broken. */
  fixes?: ReleaseFix[]
  /** Worked before, just worse — fewer clicks, clearer wording, less waiting. */
  qol?: string[]
}

export interface ReleaseNote {
  /** YYYY-MM-DD, ICT. Matches that day's changelog file. Identity + seen-key. */
  date: string
  /** SemVer of the release this entry describes. Display only — see VERSION. */
  version: string
  en: ReleaseNoteCopy
  th: ReleaseNoteCopy
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    date: '2026-07-27',
    version: '1.0.2',
    en: {
      title: 'Eight banks and payment gateways supported',
      features: [
        'Credit-card scanning supports eight issuers and payment gateways: Bangkok Bank, Kasikornbank, SCB, Krungsri, KTC, GHL (NTT DATA), PayPal and SiamPay. Gateway fee invoices are read one row per printed fee line, with the document VAT spread across those lines.',
        "Account code choices now follow each department's allowed-account list from Carmen — departments with a restricted list only offer those accounts, and illegal pairs are flagged red before they can be saved or posted.",
      ],
      fixes: [
        {
          before:
            'Invoices with a discount column could read the VAT type wrong and post per-line amounts that did not match the document.',
          text: "Discount invoices now read VAT correctly, and the unit price in Carmen multiplies out to the line's Net Amount.",
        },
        {
          before:
            'Some AP invoice scans failed with a system error no matter how many times you retried.',
          text: 'Those scans now read correctly on the first try.',
        },
        {
          before:
            'On the GHL fee invoice, Branch No. was left blank and the address showed in English against a Thai tax invoice.',
          text: 'Branch No. is filled from the document, and the address prints as issued.',
        },
        {
          before:
            'In dark mode, hovering "additional mappings" in the payment-type window turned the text unreadable (white on white).',
          text: 'Hover colors are fixed in dark mode.',
        },
      ],
      qol: [
        'AI Suggest now recognizes payment-gateway fee invoices (KTC, PayPal, and others) and proposes settlement-receivable accounts instead of bank accounts.',
        'The mapping page is wider, and the credit row "Account Receivable / Bank" shows a live count of mapped payment types.',
        'Upload limits are now 5 MB per file and up to 5 PDF pages per scan.',
      ],
    },
    th: {
      title: 'รองรับธนาคารและ payment gateway รวม 8 ราย',
      features: [
        'การสแกนบัตรเครดิตรองรับผู้ออกบัตรและ payment gateway รวม 8 ราย ได้แก่ ธนาคารกรุงเทพ กสิกรไทย ไทยพาณิชย์ กรุงศรี KTC GHL (NTT DATA) PayPal และ SiamPay ใบแจ้งค่าธรรมเนียมจาก gateway จะอ่านเป็นหนึ่งบรรทัดต่อหนึ่งรายการค่าธรรมเนียมที่พิมพ์ไว้ พร้อมกระจาย VAT ท้ายเอกสารลงในแต่ละบรรทัด',
        'ตัวเลือกรหัสบัญชีจะเป็นไปตามรายการบัญชีที่อนุญาตของแต่ละแผนกจาก Carmen — แผนกที่จำกัดรายการไว้จะแสดงเฉพาะบัญชีที่อนุญาต และคู่ที่ไม่ถูกต้องจะถูกไฮไลต์สีแดงก่อนบันทึกหรือส่งบัญชี',
      ],
      fixes: [
        {
          before:
            'ใบแจ้งหนี้ที่มีคอลัมน์ส่วนลด อาจอ่านประเภท VAT ผิด และยอดรายบรรทัดที่ส่งไปไม่ตรงกับเอกสาร',
          text: 'ใบแจ้งหนี้ที่มีส่วนลดอ่าน VAT ถูกต้องแล้ว และราคาต่อหน่วยใน Carmen คูณออกมาตรงกับยอดสุทธิของบรรทัด',
        },
        {
          before: 'สแกนใบแจ้งหนี้ AP บางไฟล์ขึ้น system error ไม่ว่าจะลองซ้ำกี่ครั้ง',
          text: 'ไฟล์เหล่านั้นอ่านได้ถูกต้องตั้งแต่ครั้งแรกแล้ว',
        },
        {
          before:
            'ใบแจ้งค่าธรรมเนียม GHL: เลขที่สาขาว่างเปล่า และที่อยู่แสดงเป็นภาษาอังกฤษ ทั้งที่ใบกำกับภาษีเป็นภาษาไทย',
          text: 'เลขที่สาขาดึงจากเอกสารให้อัตโนมัติ และที่อยู่แสดงตามที่พิมพ์บนใบกำกับภาษี',
        },
        {
          before:
            'โหมดมืด: เอาเมาส์ชี้ "additional mappings" ในหน้าต่าง payment type แล้วตัวหนังสืออ่านไม่ได้ (ขาวบนพื้นขาว)',
          text: 'สีตอน hover ในโหมดมืดแสดงถูกต้องแล้ว',
        },
      ],
      qol: [
        'AI Suggest รู้จักใบแจ้งค่าธรรมเนียม payment gateway (KTC, PayPal และอื่นๆ) และเสนอบัญชีลูกหนี้จากผู้ให้บริการแทนบัญชีธนาคาร',
        'หน้าจับคู่บัญชีกว้างขึ้น และแถว "Account Receivable / Bank" แสดงจำนวน payment type ที่จับคู่แล้วแบบสด',
        'ขนาดไฟล์อัปโหลดจำกัดที่ 5 MB ต่อไฟล์ และ PDF สแกนได้สูงสุด 5 หน้าต่อครั้ง',
      ],
    },
  },
  {
    date: '2026-07-21',
    version: '1.0.1',
    en: {
      title: 'Account mappings stay saved',
      fixes: [
        {
          before:
            'Re-opening Mapping Settings showed "1 pending mapping" and the payment type back at "Click to Map", even though you had just saved it — so every scan meant mapping the same rows again.',
          text: 'Payment-type accounts you have mapped now come back exactly as you left them.',
        },
        {
          before: 'Payment types you added yourself disappeared after a reload.',
          text: 'Your own payment types are remembered too.',
        },
      ],
    },
    th: {
      title: 'การจับคู่บัญชีถูกจดจำไว้แล้ว',
      fixes: [
        {
          before:
            'เปิดหน้าตั้งค่าการจับคู่บัญชีอีกครั้ง ระบบขึ้นว่า "1 pending mapping" และ payment type กลับไปเป็น "Click to Map" ทั้งที่เพิ่งบันทึกไป ทำให้ต้อง map ซ้ำทุกครั้งที่สแกน',
          text: 'บัญชีของ payment type ที่จับคู่ไว้ จะแสดงค่าเดิมตามที่บันทึกไว้',
        },
        {
          before: 'payment type ที่เพิ่มเอง หายไปหลังจากโหลดหน้าใหม่',
          text: 'payment type ที่เพิ่มเองถูกจดจำไว้เช่นกัน',
        },
      ],
    },
  },
  {
    date: '2026-07-20',
    version: '1.0.0',
    en: {
      title: 'Maintenance notices you can actually read',
      features: [
        'System updates now appear in the notification bell. Open one to read the full history on this page.',
      ],
      qol: [
        'The scheduled-maintenance bar shows the exact window and a countdown to it.',
        'Order notifications open the matching order directly instead of the full list.',
      ],
    },
    th: {
      title: 'แจ้งเตือนการปิดปรับปรุงที่อ่านเข้าใจง่ายขึ้น',
      features: ['การอัปเดตระบบจะแสดงที่กระดิ่งแจ้งเตือน กดเพื่อเปิดหน้านี้และดูประวัติทั้งหมด'],
      qol: [
        'แถบแจ้งปิดปรับปรุงแสดงช่วงเวลาที่ชัดเจน พร้อมนับถอยหลัง',
        'การแจ้งเตือนคำสั่งซื้อจะเปิดคำสั่งซื้อนั้นโดยตรง แทนที่จะเปิดรายการทั้งหมด',
      ],
    },
  },
]

/**
 * Date of the newest user-visible release — the high-water mark for "have I read
 * this yet" (see lib/releaseNotesSeen.ts). NOT a version string: the version shown
 * in the UI is `__APP_VERSION__`, from the repo-root VERSION file.
 */
export const LATEST_RELEASE = RELEASE_NOTES[0]?.date ?? ''
