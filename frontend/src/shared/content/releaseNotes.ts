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
      title: 'Carmen AI Automation is live: scan, review and post to Carmen',
      features: [
        'Credit card statements and gateway fee invoices from eight issuers and gateways (Bangkok Bank, Kasikornbank, SCB, Krungsri, KTC, GHL, PayPal, SiamPay) are read by AI. It suggests the GL accounts and posts the journal voucher to Carmen.',
        'AP Invoice Processing reads vendor invoices, checks the VAT type, discounts and line amounts against the document totals, suggests the GL accounts, and posts the invoice to Carmen.',
        'Forward your bank emails to your Carmen AI address and the documents are read for you and wait in the AI JV Automation queue. Open one to check it, fix the account mapping, and approve it to post. Documents with nothing to check can post on their own if you switch on "Post without review".',
        'KBANK settlement reports are read and posted as one settlement JV that clears your card receivables, checked against the CSV that comes with them.',
        'Input tax is filed with each journal voucher, and late filing with corrections is handled from the same queue.',
        'Daily revenue from your PMS arrives in the same queue: map any new rows to accounts, approve the day, and Carmen posts it. It works with the PMSs connected to Carmen.',
        'Start free with your first 30 documents, then choose a monthly plan (Lite starts at 100 documents for 290 baht) or buy top-up credits (100 credits for 450 baht, never expiring) from Plans & Credits. AP invoices are charged one credit per page read.',
      ],
    },
    th: {
      title: 'Carmen AI Automation เปิดใช้งานแล้ว: สแกน ตรวจ และส่งเข้า Carmen',
      features: [
        'AI อ่านใบแจ้งยอดบัตรเครดิตและใบแจ้งค่าธรรมเนียมจาก gateway ของ 8 ราย (ธนาคารกรุงเทพ กสิกรไทย ไทยพาณิชย์ กรุงศรี KTC GHL PayPal SiamPay) แนะนำรหัสบัญชี และส่งใบสำคัญรายวัน (JV) เข้า Carmen',
        'AP Invoice Processing อ่านใบแจ้งหนี้ผู้ขาย ตรวจประเภท VAT ส่วนลด และยอดรายบรรทัดกับยอดรวมในเอกสาร แนะนำรหัสบัญชี แล้วส่งใบแจ้งหนี้เข้า Carmen',
        'ส่งต่ออีเมลจากธนาคารมายังที่อยู่อีเมล Carmen AI ของคุณ เอกสารจะถูกอ่านให้และรออยู่ในคิว AI JV Automation เปิดดูเพื่อตรวจ แก้การจับคู่บัญชี แล้วอนุมัติเพื่อส่งเข้า Carmen เอกสารที่ไม่มีอะไรต้องตรวจจะส่งเองได้ ถ้าเปิดสวิตช์ "Post without review"',
        'รายงาน settlement ของ KBANK ถูกอ่านและส่งเป็น JV เดียวที่ตัดบัญชีลูกหนี้บัตรเครดิต พร้อมตรวจเทียบกับไฟล์ CSV ที่มาด้วยกัน',
        'ภาษีซื้อถูกยื่นพร้อมกับ JV แต่ละใบ และการยื่นย้อนหลังพร้อมแก้ไขทำได้จากคิวเดียวกัน',
        'รายได้รายวันจาก PMS แสดงในคิวเดียวกัน ให้จับคู่บัญชีกับแถวใหม่ อนุมัติทั้งวัน แล้ว Carmen จะลงบัญชีให้ ใช้ได้กับ PMS ที่เชื่อมต่อกับ Carmen',
        'เริ่มใช้ฟรี 30 เอกสารแรก แล้วเลือกแพ็กเกจรายเดือน (Lite เริ่มที่ 100 เอกสาร 290 บาท) หรือซื้อเครดิตเติมเพิ่ม (100 เครดิต 450 บาท ไม่มีวันหมดอายุ) ได้ที่หน้าแพ็กเกจและเครดิต ใบแจ้งหนี้ AP คิด 1 เครดิตต่อหน้าที่อ่าน',
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
