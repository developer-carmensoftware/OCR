export function parseNum(v: unknown): number {
  if (typeof v === 'number') return v
  const n = Number(String(v || '').replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}

/** Format a number with exactly 2 decimal places and thousands separators. */
export const fmt = (v: unknown): string =>
  parseNum(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const round2 = (v: unknown): number => Math.round(parseNum(v) * 100) / 100
