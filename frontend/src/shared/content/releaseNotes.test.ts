import { describe, it, expect } from 'vitest'
import { RELEASE_NOTES, LATEST_RELEASE, type ReleaseNoteCopy } from './releaseNotes'

const bulletsOf = (c: ReleaseNoteCopy) => [
  ...(c.keyFeatures ?? []),
  ...(c.features ?? []),
  ...(c.enhancements ?? []),
]
const allText = (r: (typeof RELEASE_NOTES)[number]) => [...bulletsOf(r.en), ...bulletsOf(r.th)]
/** The `Name (Module): ` lead-in every bullet opens with. */
const LABEL = /^[^():]+ \([^()]+\): (?=\S)/

// The bell's unread tracking is a lexicographic date compare against one stored
// string, so a malformed, duplicated, or out-of-order date breaks it SILENTLY
// rather than throwing. This is the cheap CI gate on hand-edited content.
describe('release notes', () => {
  it('every date is a real ISO calendar date', () => {
    for (const r of RELEASE_NOTES) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      // Round-trips only if the date actually exists (rejects 2026-02-31).
      expect(new Date(`${r.date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(r.date)
    }
  })

  // Monthly cadence: a second release in a month waits for the next month's entry. The
  // date stays the identity (and unique by implication), so the seen-mark logic never
  // has to know.
  it('has at most one entry per calendar month', () => {
    const months = RELEASE_NOTES.map(r => r.date.slice(0, 7))
    expect(new Set(months).size).toBe(months.length)
  })

  it('is sorted newest first', () => {
    const dates = RELEASE_NOTES.map(r => r.date)
    expect(dates).toEqual([...dates].sort().reverse())
  })

  it('has non-empty EN and TH copy for every entry', () => {
    for (const r of RELEASE_NOTES) {
      for (const copy of [r.en, r.th]) {
        const bullets = bulletsOf(copy)
        expect(bullets.length).toBeGreaterThan(0)
        expect(bullets.every(b => b.trim() !== '')).toBe(true)
      }
    }
  })

  // Carmen's changelog shape: the reader scans the names, then reads the line they want.
  it('every bullet reads "Name (Module): description"', () => {
    for (const r of RELEASE_NOTES) {
      for (const b of allText(r)) expect(b).toMatch(LABEL)
    }
  })

  // A missing TH bullet is invisible to a Thai reader — no error, just a shorter
  // list than the English one. TS only enforces that both languages exist.
  it('EN and TH have the same number of bullets in each category', () => {
    for (const r of RELEASE_NOTES) {
      expect(r.th.keyFeatures?.length ?? 0).toBe(r.en.keyFeatures?.length ?? 0)
      expect(r.th.features?.length ?? 0).toBe(r.en.features?.length ?? 0)
      expect(r.th.enhancements?.length ?? 0).toBe(r.en.enhancements?.length ?? 0)
    }
  })

  it('LATEST_RELEASE is the newest date', () => {
    expect(LATEST_RELEASE).toBe(RELEASE_NOTES[0]?.date ?? '')
  })

  it('every version is SemVer', () => {
    for (const r of RELEASE_NOTES) expect(r.version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  // The drift guard. VERSION is the source of truth — backend config.py reads it,
  // vite bakes it in as __APP_VERSION__, deploy.yml tags the release from it. This
  // catches the "bumped VERSION, forgot the release note" half of the same edit.
  it('newest entry matches the repo-root VERSION file', () => {
    expect(RELEASE_NOTES[0]?.version).toBe(__APP_VERSION__)
  })

  // ---- Language guards ---------------------------------------------------------
  // The note is read by a Thai accounting clerk and an English reader, so a number
  // or a product name that exists in only one language is a wrong fact, not a
  // style issue. These are cheap, mechanical checks; they do not replace reading it.

  it('no copy has stray spaces, empty strings or unbalanced brackets and quotes', () => {
    for (const r of RELEASE_NOTES) {
      for (const t of allText(r)) {
        expect(t).toBe(t.trim())
        expect(t).not.toMatch(/ {2}/)
        expect((t.match(/\(/g) ?? []).length).toBe((t.match(/\)/g) ?? []).length)
        expect((t.match(/"/g) ?? []).length % 2).toBe(0)
      }
    }
  })

  // The bug class that shipped once: 490 in the copy, 450 on the screen. If a number is
  // in one language it must be in the other, bullet for bullet.
  it('each bullet carries the same numbers in EN and TH', () => {
    const nums = (t: string) =>
      (t.replace(/\beight\b/gi, '8').match(/\d[\d,]*/g) ?? []).sort().join(',')
    for (const r of RELEASE_NOTES) {
      const en = bulletsOf(r.en)
      const th = bulletsOf(r.th)
      en.forEach((b, i) => expect(nums(th[i]), `bullet ${i + 1}`).toBe(nums(b)))
    }
  })

  // A product name, bank or file type named in one language must be named in the other.
  it('each bullet names the same products and banks in EN and TH', () => {
    const NAMED = [
      'KBANK',
      'KTC',
      'GHL',
      'PayPal',
      'SiamPay',
      'PMS',
      'CSV',
      'JV',
      'VAT',
      'AP',
      'Lite',
      'Starter',
      'Growth',
      'Professional',
      'AI JV Automation',
      'Post without review',
    ]
    for (const r of RELEASE_NOTES) {
      const en = bulletsOf(r.en)
      const th = bulletsOf(r.th)
      en.forEach((b, i) => {
        for (const n of NAMED) {
          expect(th[i].includes(n), `bullet ${i + 1} "${n}"`).toBe(b.includes(n))
        }
      })
    }
  })

  it('Thai bullets do not open with lowercase English', () => {
    for (const r of RELEASE_NOTES) {
      for (const b of bulletsOf(r.th)) expect(b).not.toMatch(/^[a-z]/)
    }
  })

  // One idea per bullet. The caps are loose on purpose; they stop a bullet from quietly
  // growing into a paragraph, not from being a full sentence. Measured after the label.
  it('bullets stay readable in length', () => {
    const desc = (b: string) => b.replace(LABEL, '')
    for (const r of RELEASE_NOTES) {
      for (const b of bulletsOf(r.en)) expect(desc(b).split(/\s+/).length).toBeLessThanOrEqual(55)
      for (const b of bulletsOf(r.th)) expect(desc(b).length).toBeLessThanOrEqual(260)
    }
  })

  // Wrong facts we have already shipped once, and words the product does not use.
  it('contains none of the strings known to be wrong or off-label', () => {
    const BANNED =
      /Pricing page|490|Bank statements|1\.0\.2|หน้า Pricing|เครดิตเติมเพิ่ม|Carmen AI address/
    for (const r of RELEASE_NOTES) {
      for (const t of allText(r)) expect(t).not.toMatch(BANNED)
    }
  })

  // Thai keeps English only where the screen does (JV, AP, PMS, KBANK, CSV, VAT,
  // settlement, gateway, module names, the quoted switch label). Everything else has a
  // Thai word.
  it('Thai does not fall back to translatable English words', () => {
    for (const r of RELEASE_NOTES) {
      for (const t of bulletsOf(r.th)) {
        const stripped = t.replace(/AP Invoice Processing|Post without review/g, '')
        expect(stripped).not.toMatch(
          /\b(journal|voucher|invoice|statement|input tax|credit|plan)\b/i
        )
      }
    }
  })
})
