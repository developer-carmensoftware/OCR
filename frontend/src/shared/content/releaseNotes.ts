/**
 * User-facing release notes, shown in the Changelog dialog the notification bell opens.
 *
 * Monthly, the way Carmen's own changelog runs: one entry per release, at most one release
 * a month, and a month with nothing a user can see gets no entry at all. Cutting the release
 * = bump the repo-root `VERSION` and add that month's entry, in the same commit. PRs in
 * between bump nothing; they park their user-visible bullets in `changelog/` for whoever
 * cuts the month. This is not `changelog/`: that one is an engineering log (file paths,
 * function names, English only). This is for an accounting clerk.
 *
 * The ISO release date IS the identity: lexicographic order equals chronological order,
 * so "which have I already seen" is one string comparison, not a version parser.
 * `version` rides alongside for display only — it is never compared.
 *
 * Adding an entry:
 *   1. Only if a USER can see the difference. Refactors, CI, and dependency
 *      bumps get a changelog line and nothing here.
 *   2. `features` = something they could not do at all before; `enhancements` = everything
 *      else they will notice, fixes included. Empty sections are omitted. `keyFeatures` is
 *      for a baseline release that sums up what the product does (0.1.0): "new" would claim
 *      that capabilities users already had arrived that day.
 *   3. Every bullet reads `Name (Module): description`, Module as the screen names it
 *      (AI JV Automation, AP Invoice Processing, Plans & Credits).
 *   4. Both languages. TS will not compile with one missing.
 *   5. Bump `VERSION` to match this entry's `version` — CI fails the PR if the newest
 *      entry and VERSION disagree, and deploy.yml cuts the GitHub Release tag from VERSION.
 */

export interface ReleaseNoteCopy {
  /** What the product does, for a baseline release (rendered first, as "Key Features"). */
  keyFeatures?: string[]
  /** Something they could not do at all before. */
  features?: string[]
  /** Worked before, now better or fixed. */
  enhancements?: string[]
}

export interface ReleaseNote {
  /** YYYY-MM-DD, ICT: the release day. Identity + seen-key; one per calendar month. */
  date: string
  /** SemVer of the release this entry describes. Display only — see VERSION. */
  version: string
  en: ReleaseNoteCopy
  th: ReleaseNoteCopy
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    date: '2026-11-05',
    version: '0.1.0',
    en: {
      keyFeatures: [
        'Card Statements and Fee Invoices (AI JV Automation): AI reads credit card statements and gateway fee invoices from eight issuers and payment gateways: Bangkok Bank, Kasikornbank, SCB, Krungsri, KTC, GHL, PayPal and SiamPay. It suggests the GL accounts and posts the journal voucher (JV) to Carmen.',
        'Vendor Invoices (AP Invoice Processing): AP Invoice Processing reads vendor invoices, checks the VAT type, discounts and line amounts against the document totals, suggests the GL accounts, and posts the invoice to Carmen.',
        'Email Queue (AI JV Automation): Forward bank emails to the address shown in your AI JV Automation settings and the documents wait in the queue, already read. Check one, fix the account mapping, and press Approve and post. Switch on "Post without review" to let documents with nothing to check post on their own.',
        'KBANK Settlement Reports (AI JV Automation): KBANK settlement reports are read, checked against the CSV file that comes with them, and posted as one settlement JV that clears your card receivables.',
        'Input Tax Filing (AI JV Automation): Input tax is filed together with each JV, and you can file it late, with corrections, from the same queue.',
        'PMS Daily Revenue (AI JV Automation): Daily revenue from your PMS (property management system) arrives in the same queue. Map any new rows to accounts, approve the day, and Carmen posts it. It works with the PMSs connected to Carmen.',
        'Monthly Plans and Top-ups (Plans & Credits): Start free with your first 30 documents. Then choose a monthly plan, Lite, Starter, Growth or Professional (from 290 baht for 100 documents a month), or top up credits that never expire (from 450 baht for 100 credits). AP invoices are charged 1 credit per page read.',
      ],
    },
    th: {
      keyFeatures: [
        'ใบแจ้งยอดบัตรและค่าธรรมเนียม (AI JV Automation): AI อ่านใบแจ้งยอดบัตรเครดิตและใบแจ้งค่าธรรมเนียมจากผู้ออกบัตรและ payment gateway 8 ราย ได้แก่ ธนาคารกรุงเทพ กสิกรไทย ไทยพาณิชย์ กรุงศรี KTC GHL PayPal และ SiamPay แนะนำรหัสบัญชี และโพสต์ใบสำคัญรายวัน (JV) เข้า Carmen',
        'ใบแจ้งหนี้ผู้ขาย (AP Invoice Processing): AP Invoice Processing อ่านใบแจ้งหนี้ผู้ขาย ตรวจประเภท VAT ส่วนลด และยอดรายบรรทัดเทียบกับยอดรวมในเอกสาร แนะนำรหัสบัญชี แล้วโพสต์ใบแจ้งหนี้เข้า Carmen',
        'คิวอีเมล (AI JV Automation): ส่งต่ออีเมลจากธนาคารไปยังที่อยู่อีเมลที่แสดงในการตั้งค่า AI JV Automation เอกสารจะถูกอ่านแล้วรออยู่ในคิว ให้ตรวจ แก้การจับคู่บัญชี แล้วกด "อนุมัติและโพสต์" ถ้าเปิดสวิตช์ "Post without review" เอกสารที่ไม่มีอะไรต้องตรวจจะโพสต์เอง',
        'รายงาน settlement ของ KBANK (AI JV Automation): รายงาน settlement ของ KBANK ถูกอ่าน ตรวจเทียบกับไฟล์ CSV ที่มาด้วยกัน แล้วโพสต์เป็น JV เดียวที่ตัดบัญชีลูกหนี้บัตรเครดิต',
        'การยื่นภาษีซื้อ (AI JV Automation): ภาษีซื้อถูกยื่นพร้อมกับ JV แต่ละใบ และยื่นย้อนหลังพร้อมแก้ไขได้จากคิวเดียวกัน',
        'รายได้รายวันจาก PMS (AI JV Automation): รายได้รายวันจาก PMS แสดงในคิวเดียวกัน ให้จับคู่บัญชีกับแถวใหม่ อนุมัติทั้งวัน แล้ว Carmen จะโพสต์ให้ ใช้ได้กับ PMS ที่เชื่อมต่อกับ Carmen',
        'แพ็กเกจรายเดือนและการเติมเครดิต (Plans & Credits): เริ่มใช้ฟรี 30 เอกสารแรก แล้วเลือกแพ็กเกจรายเดือน Lite, Starter, Growth หรือ Professional (เริ่มต้น 290 บาท ได้ 100 เอกสารต่อเดือน) หรือเติมเครดิตที่ไม่มีวันหมดอายุ (เริ่มต้น 450 บาท ได้ 100 เครดิต) ใบแจ้งหนี้ AP คิด 1 เครดิตต่อหน้าที่อ่าน',
      ],
    },
  },
]

/**
 * Date of the newest user-visible release — the high-water mark for "have I read
 * this yet" (see shared/lib/releaseNotesSeen.ts). NOT a version string: the version shown
 * in the UI is `__APP_VERSION__`, from the repo-root VERSION file.
 */
export const LATEST_RELEASE = RELEASE_NOTES[0]?.date ?? ''
