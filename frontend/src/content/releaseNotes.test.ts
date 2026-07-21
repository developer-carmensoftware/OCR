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
        expect(copy.items.length).toBeGreaterThan(0)
        expect(copy.items.every(i => i.trim() !== '')).toBe(true)
      }
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
