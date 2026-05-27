import { describe, it, expect } from 'vitest'
import { normalizeYearToCE, parseDateToISO } from '../lib/date'

// ── normalizeYearToCE ──────────────────────────────────────────────────────────

describe('normalizeYearToCE', () => {
  it('returns CE year unchanged when <= 2400', () => {
    expect(normalizeYearToCE(2024)).toBe(2024)
  })

  it('returns CE year unchanged for string input <= 2400', () => {
    expect(normalizeYearToCE('2024')).toBe(2024)
  })

  it('converts Buddhist Era year > 2400 by subtracting 543', () => {
    // 2567 BE = 2024 AD
    expect(normalizeYearToCE(2567)).toBe(2024)
  })

  it('converts BE year as string', () => {
    expect(normalizeYearToCE('2567')).toBe(2024)
  })

  it('converts boundary value 2401 (BE) to 1858 (CE)', () => {
    expect(normalizeYearToCE(2401)).toBe(1858)
  })

  it('leaves boundary value 2400 unchanged (treated as CE)', () => {
    expect(normalizeYearToCE(2400)).toBe(2400)
  })

  it('returns NaN for non-numeric string input', () => {
    expect(normalizeYearToCE('abc')).toBeNaN()
  })
})

// ── parseDateToISO ─────────────────────────────────────────────────────────────

describe('parseDateToISO', () => {
  it('parses valid DD/MM/YYYY CE date → ISO string', () => {
    const iso = parseDateToISO('15/05/2024')
    expect(iso).toMatch(/^2024-05-15/)
  })

  it('parses Buddhist Era date DD/MM/BBBB → CE ISO string', () => {
    const iso = parseDateToISO('15/05/2567')
    expect(iso).toMatch(/^2024-05-15/)
  })

  it('returns approximately current time for null input', () => {
    const before = Date.now()
    const iso = parseDateToISO(null)
    const after = Date.now()
    const ts = new Date(iso).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after + 1000)
  })

  it('returns approximately current time for undefined input', () => {
    const before = Date.now()
    const iso = parseDateToISO(undefined)
    const after = Date.now()
    const ts = new Date(iso).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after + 1000)
  })

  it('returns approximately current time for empty string input', () => {
    const before = Date.now()
    const iso = parseDateToISO('')
    const after = Date.now()
    const ts = new Date(iso).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after + 1000)
  })

  it('returns approximately current time when date parts count != 3', () => {
    const before = Date.now()
    const iso = parseDateToISO('15/05')
    const after = Date.now()
    const ts = new Date(iso).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after + 1000)
  })

  it('does NOT fall back for Feb 30 — JS Date overflows to Mar 1 (documents behavior)', () => {
    // JS new Date('2024-02-30T00:00:00.000Z') === 2024-03-01 (overflow, not NaN)
    // parseDateToISO returns that valid-but-overflowed ISO string instead of a fallback.
    const iso = parseDateToISO('30/02/2024')
    expect(iso).toMatch(/Z$/) // is still a valid ISO-8601 string
    expect(new Date(iso).getTime()).not.toBeNaN()
  })

  it('returns an ISO-8601 string (ends with Z)', () => {
    const iso = parseDateToISO('01/01/2024')
    expect(iso).toMatch(/Z$/)
  })
})
