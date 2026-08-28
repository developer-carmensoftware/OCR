export function normalizeYearToCE(year: string | number): number {
  const y = parseInt(String(year), 10)
  if (isNaN(y)) return Number(year)
  if (y > 2400) return y - 543
  return y
}

export function parseDateToISO(dateStr: string | null | undefined): string {
  if (!dateStr) return new Date().toISOString()
  const parts = dateStr.split('/')
  if (parts.length !== 3) return new Date().toISOString()
  const [dd, mm, yyyy] = parts.map(p => p.trim())
  const normalizedYear = normalizeYearToCE(yyyy)
  // Pad day/month so single-digit input (e.g. "1/2/2025") forms a valid ISO string
  // instead of "2025-2-1" which most engines parse as Invalid Date → silent today-fallback.
  const pad = (s: string) => s.padStart(2, '0')
  const d = new Date(`${normalizedYear}-${pad(mm)}-${pad(dd)}T00:00:00.000Z`)
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

/**
 * Parse a "DD/MM/YYYY" (or "DD/MM/BBBB" Buddhist Era) string into a local Date
 * at midnight, for use with date pickers. Returns null when the input is empty
 * or does not form a valid calendar date.
 */
export function parseDDMMYYYYToDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  const parts = dateStr.split('/')
  if (parts.length !== 3) return null
  const [dd, mm, yyyy] = parts.map(p => p.trim())
  const day = parseInt(dd, 10)
  const month = parseInt(mm, 10)
  const year = normalizeYearToCE(yyyy)
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null
  const d = new Date(year, month - 1, day)
  // Reject overflow (e.g. 31/02 rolling into March) and invalid dates.
  if (isNaN(d.getTime()) || d.getDate() !== day || d.getMonth() !== month - 1) return null
  return d
}

/** Format a Date as "DD/MM/YYYY" (CE, zero-padded). */
export function formatDateToDDMMYYYY(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** DD/MM/YYYY from an ISO date string (project-wide display format); "—" if empty/invalid. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return formatDateToDDMMYYYY(d)
}

/** Format a backend ISO timestamp (tz-aware, `+00:00`) in the viewer's local
 * timezone as `YYYY-MM-DD HH:mm:ss`. The old `slice(0, 19)` pattern chopped the
 * offset and displayed raw UTC. */
export const fmtDateTime = (s: string | null | undefined): string =>
  s ? new Date(s).toLocaleString('sv-SE') : '—'

/** Normalize a date string formatted as "DD/MM/YYYY" (possibly with B.E. year) to C.E. */
export function normalizeDateStringToCE(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const parts = dateStr.split('/')
  if (parts.length !== 3) return dateStr
  const [dd, mm, yyyy] = parts.map(p => p.trim())
  const normalizedYear = normalizeYearToCE(yyyy)
  return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${normalizedYear}`
}
