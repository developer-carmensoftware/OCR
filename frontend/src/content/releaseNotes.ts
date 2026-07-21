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
 *   2. 2-4 bullets, one line each, describing what they can now do or will see.
 *   3. Both languages. TS will not compile with one missing.
 *   4. Bump the repo-root `VERSION` file to match this entry's `version` — CI
 *      fails the PR if the newest entry and VERSION disagree, and deploy.yml
 *      cuts the GitHub Release tag from VERSION.
 */

export interface ReleaseNoteCopy {
  title: string
  items: string[]
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
    date: '2026-07-20',
    version: '1.0.0',
    en: {
      title: 'Maintenance notices you can actually read',
      items: [
        'System updates now appear in the notification bell. Open one to read the full history on this page.',
        'The scheduled-maintenance bar shows the exact window and a countdown to it.',
        'Order notifications open the matching order directly instead of the full list.',
      ],
    },
    th: {
      title: 'แจ้งเตือนการปิดปรับปรุงที่อ่านเข้าใจง่ายขึ้น',
      items: [
        'การอัปเดตระบบจะแสดงที่กระดิ่งแจ้งเตือน กดเพื่อเปิดหน้านี้และดูประวัติทั้งหมด',
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
