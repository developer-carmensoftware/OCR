/**
 * Normalizes a year from Buddhist Era (B.E.) to Christian Era (C.E.) if necessary.
 * Thai B.E. is C.E. + 543.
 * If the year is greater than 2400, we assume it's B.E. and subtract 543.
 *
 * @param {string|number} year The year to normalize
 * @returns {number} The normalized year in C.E.
 */
export function normalizeYearToCE(year) {
  const y = parseInt(year, 10)
  if (isNaN(y)) return year
  if (y > 2400) return y - 543
  return y
}

/**
 * Converts a date string in DD/MM/YYYY format to an ISO string,
 * ensuring the year is in C.E.
 *
 * @param {string} dateStr Date in DD/MM/YYYY format
 * @returns {string} ISO date string
 */
export function parseDateToISO(dateStr) {
  if (!dateStr) return new Date().toISOString()
  const parts = dateStr.split('/')
  if (parts.length !== 3) return new Date().toISOString()
  const [dd, mm, yyyy] = parts
  const normalizedYear = normalizeYearToCE(yyyy)
  const d = new Date(`${normalizedYear}-${mm}-${dd}T00:00:00.000Z`)
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}
