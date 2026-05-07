/**
 * Shared number formatting utilities.
 * All components that need numeric parsing/formatting should import from here
 * instead of declaring their own local versions.
 */

/**
 * Parse any value (string with commas, number, null, etc.) to a float.
 * Returns 0 for non-numeric values.
 */
export function parseNum(v) {
  if (typeof v === 'number') return v
  const n = Number(String(v || '').replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}

/** Alias for parseNum — used by components that call it toNum() */
export const toNum = parseNum

/**
 * Format a number to a localized string with 2 decimal places.
 * e.g. 1234.5 → "1,234.50"
 */
export const fmt = (v) =>
  parseNum(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Round a value to 2 decimal places using proper floating-point arithmetic. */
export const round2 = (v) => Math.round(parseNum(v) * 100) / 100
