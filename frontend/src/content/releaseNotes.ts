/**
 * User-facing release notes ("what's new"), rendered in the notification bell.
 *
 * Hand-authored, newest first, in the SAME PR as the change it describes — so the
 * note ships exactly when the code does and there is nothing to remember after a
 * deploy. This is not `changelog/`: that one is an engineering log (file paths,
 * function names, English only). This is 2-4 lines for a Thai accounting clerk
 * who just watched the system go offline and wants to know what changed.
 *
 * The ISO date IS the identity. It matches the release-tag scheme
 * (`v2026.07.20` ← `changelog/2026-07-20.md`, cut by deploy.yml), and
 * lexicographic order equals chronological order — so "which have I already
 * seen" is one string comparison, not a version parser.
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
 */

export interface ReleaseNoteCopy {
  title: string
  items: string[]
}

export interface ReleaseNote {
  /** YYYY-MM-DD, ICT. Matches that day's changelog file and the git tag. */
  date: string
  en: ReleaseNoteCopy
  th: ReleaseNoteCopy
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    date: '2026-07-20',
    en: {
      title: 'Maintenance notices you can actually read',
      items: [
        'Updates to the system now appear here in the bell. Tap one to see what changed.',
        'The scheduled-maintenance bar shows the exact window and a countdown to it.',
        'Order notifications open the matching order directly instead of the full list.',
      ],
    },
    th: {
      title: 'แจ้งเตือนการปิดปรับปรุงที่อ่านเข้าใจง่ายขึ้น',
      items: [
        'การอัปเดตระบบจะแสดงที่กระดิ่งนี้ แตะเพื่อดูว่ามีอะไรเปลี่ยนไปบ้าง',
        'แถบแจ้งปิดปรับปรุงแสดงช่วงเวลาที่ชัดเจน พร้อมนับถอยหลัง',
        'การแจ้งเตือนคำสั่งซื้อจะเปิดคำสั่งซื้อนั้นโดยตรง แทนที่จะเปิดรายการทั้งหมด',
      ],
    },
  },
]

/**
 * Date of the newest user-visible release. Shown on the Home landing page as the
 * version string — deliberately "when did this last change for you", not "which
 * build is running": there is no trustworthy build version to read (see
 * deploy.yml's note about /api/version).
 */
export const LATEST_RELEASE = RELEASE_NOTES[0]?.date ?? ''
