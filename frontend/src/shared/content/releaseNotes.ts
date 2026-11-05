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
      title: 'Email review queue, settlement reports, PMS days and new plans',
      features: [
        'Credit card statements and fee invoices that arrive by email are read for you and wait in the AI JV Automation queue. Open one to check it, fix the account mapping, file input tax (including late filing with corrections), and approve it to post to Carmen. Documents with nothing to check can post on their own if you switch on "Post without review".',
        'KBANK settlement reports are read and posted as one settlement JV that clears your card receivables, checked against the CSV that comes with them.',
        'Daily PMS revenue sent from Carmen appears in the same queue once your PMS is connected: map any new rows to accounts, then approve the day.',
        'New Lite plan (100 documents a month, 290 baht) and a 100-credit top-up pack (450 baht). Change your plan from Plans & Credits. AP invoices are charged one credit per page read.',
      ],
    },
    th: {
      title: 'คิวตรวจอีเมล รายงาน settlement ยอดรายวันจาก PMS และแพ็กเกจใหม่',
      features: [
        'ใบแจ้งยอดบัตรเครดิตและใบแจ้งค่าธรรมเนียมที่ส่งมาทางอีเมลจะถูกอ่านให้ และรออยู่ในคิว AI JV Automation เปิดดูเพื่อตรวจ แก้การจับคู่บัญชี ยื่นภาษีซื้อ (รวมถึงยื่นย้อนหลังพร้อมแก้ไข) แล้วอนุมัติเพื่อส่งเข้า Carmen เอกสารที่ไม่มีอะไรต้องตรวจจะส่งเข้า Carmen เองได้ ถ้าเปิดสวิตช์ "Post without review"',
        'รายงาน settlement ของ KBANK ถูกอ่านและส่งเป็น JV เดียวที่ตัดบัญชีลูกหนี้บัตรเครดิต พร้อมตรวจเทียบกับไฟล์ CSV ที่มาด้วยกัน',
        'รายได้ PMS รายวันที่ Carmen ส่งมาจะแสดงในคิวเดียวกันเมื่อเชื่อมต่อ PMS แล้ว ให้จับคู่บัญชีกับแถวใหม่ แล้วอนุมัติทั้งวัน',
        'แพ็กเกจ Lite ใหม่ (100 เอกสารต่อเดือน 290 บาท) และเครดิตเติมเพิ่ม 100 เครดิต (450 บาท) เปลี่ยนแพ็กเกจได้ที่หน้าแพ็กเกจและเครดิต ส่วนใบแจ้งหนี้ AP คิด 1 เครดิตต่อหน้าที่อ่าน',
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
