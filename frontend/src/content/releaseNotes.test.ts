import { describe, it, expect } from 'vitest'
import { RELEASE_NOTES, LATEST_RELEASE } from './releaseNotes'

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

  it('dates are unique — the date is the identity', () => {
    const dates = RELEASE_NOTES.map(r => r.date)
    expect(new Set(dates).size).toBe(dates.length)
  })

  it('is sorted newest first', () => {
    const dates = RELEASE_NOTES.map(r => r.date)
    expect(dates).toEqual([...dates].sort().reverse())
  })

  it('has non-empty EN and TH copy for every entry', () => {
    for (const r of RELEASE_NOTES) {
      for (const copy of [r.en, r.th]) {
        expect(copy.title.trim()).not.toBe('')
        const bullets = [
          ...(copy.features ?? []),
          ...(copy.qol ?? []),
          ...(copy.fixes ?? []).map(f => f.text),
        ]
        expect(bullets.length).toBeGreaterThan(0)
        expect(bullets.every(b => b.trim() !== '')).toBe(true)
      }
    }
  })

  // The type makes `before` required, so an omission cannot compile. This catches
  // the version that does compile: an empty string to shut the compiler up.
  it('every fix says what it was like before', () => {
    for (const r of RELEASE_NOTES) {
      for (const copy of [r.en, r.th]) {
        for (const fix of copy.fixes ?? []) {
          expect(fix.before.trim()).not.toBe('')
        }
      }
    }
  })

  // A missing TH bullet is invisible to a Thai reader — no error, just a shorter
  // list than the English one. TS only enforces that both languages exist.
  it('EN and TH have the same number of bullets in each category', () => {
    for (const r of RELEASE_NOTES) {
      expect(r.th.features?.length ?? 0).toBe(r.en.features?.length ?? 0)
      expect(r.th.fixes?.length ?? 0).toBe(r.en.fixes?.length ?? 0)
      expect(r.th.qol?.length ?? 0).toBe(r.en.qol?.length ?? 0)
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
})
