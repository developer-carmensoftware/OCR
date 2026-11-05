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
    date: '2026-11-05',
    version: '0.1.0',
    en: {
      title: 'Carmen AI Automation is live: read, review and post',
      features: [
        'AI reads credit card statements and gateway fee invoices from eight issuers and payment gateways: Bangkok Bank, Kasikornbank, SCB, Krungsri, KTC, GHL, PayPal and SiamPay. It suggests the GL accounts and posts the journal voucher (JV) to Carmen.',
        'AP Invoice Processing reads vendor invoices, checks the VAT type, discounts and line amounts against the document totals, suggests the GL accounts, and posts the invoice to Carmen.',
        'Forward bank emails to the address shown in your AI JV Automation settings and the documents wait in the queue, already read. Check one, fix the account mapping, and press Approve and post. Switch on "Post without review" to let documents with nothing to check post on their own.',
        'KBANK settlement reports are read, checked against the CSV file that comes with them, and posted as one settlement JV that clears your card receivables.',
        'Input tax is filed together with each JV, and you can file it late, with corrections, from the same queue.',
        'Daily revenue from your PMS (property management system) arrives in the same queue. Map any new rows to accounts, approve the day, and Carmen posts it. It works with the PMSs connected to Carmen.',
        'Start free with your first 30 documents. Then choose a monthly plan (Lite is 100 documents a month for 290 baht) or top up credits (100 credits for 450 baht, never expiring) in Plans & Credits. AP invoices are charged 1 credit per page read.',
      ],
    },
    th: {
      title: 'Carmen AI Automation เปิดใช้งานแล้ว: อ่าน ตรวจ และโพสต์',
      features: [
        'AI อ่านใบแจ้งยอดบัตรเครดิตและใบแจ้งค่าธรรมเนียมจากผู้ออกบัตรและ payment gateway 8 ราย ได้แก่ ธนาคารกรุงเทพ กสิกรไทย ไทยพาณิชย์ กรุงศรี KTC GHL PayPal และ SiamPay แนะนำรหัสบัญชี และโพสต์ใบสำคัญรายวัน (JV) เข้า Carmen',
        'AP Invoice Processing อ่านใบแจ้งหนี้ผู้ขาย ตรวจประเภท VAT ส่วนลด และยอดรายบรรทัดเทียบกับยอดรวมในเอกสาร แนะนำรหัสบัญชี แล้วโพสต์ใบแจ้งหนี้เข้า Carmen',
        'ส่งต่ออีเมลจากธนาคารไปยังที่อยู่อีเมลที่แสดงในการตั้งค่า AI JV Automation เอกสารจะถูกอ่านแล้วรออยู่ในคิว ให้ตรวจ แก้การจับคู่บัญชี แล้วกด "อนุมัติและโพสต์" ถ้าเปิดสวิตช์ "Post without review" เอกสารที่ไม่มีอะไรต้องตรวจจะโพสต์เอง',
        'รายงาน settlement ของ KBANK ถูกอ่าน ตรวจเทียบกับไฟล์ CSV ที่มาด้วยกัน แล้วโพสต์เป็น JV เดียวที่ตัดบัญชีลูกหนี้บัตรเครดิต',
        'ภาษีซื้อถูกยื่นพร้อมกับ JV แต่ละใบ และยื่นย้อนหลังพร้อมแก้ไขได้จากคิวเดียวกัน',
        'รายได้รายวันจาก PMS แสดงในคิวเดียวกัน ให้จับคู่บัญชีกับแถวใหม่ อนุมัติทั้งวัน แล้ว Carmen จะโพสต์ให้ ใช้ได้กับ PMS ที่เชื่อมต่อกับ Carmen',
        'เริ่มใช้ฟรี 30 เอกสารแรก แล้วเลือกแพ็กเกจรายเดือน (Lite 100 เอกสารต่อเดือน 290 บาท) หรือเติมเครดิต (100 เครดิต 450 บาท ไม่มีวันหมดอายุ) ได้ที่หน้าแพ็กเกจและเครดิต ใบแจ้งหนี้ AP คิด 1 เครดิตต่อหน้าที่อ่าน',
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
