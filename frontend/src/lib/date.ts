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
  const [dd, mm, yyyy] = parts
  const normalizedYear = normalizeYearToCE(yyyy)
  const d = new Date(`${normalizedYear}-${mm}-${dd}T00:00:00.000Z`)
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}
