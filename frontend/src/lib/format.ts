export function parseNum(v: unknown): number {
  if (typeof v === 'number') return v
  const n = Number(String(v || '').replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}

/** Alias for parseNum — used by components that call it toNum() */
export const toNum = parseNum

export const fmt = (v: unknown): string =>
  parseNum(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const round2 = (v: unknown): number => Math.round(parseNum(v) * 100) / 100

/** Format quantity: always 2 decimal places. */
export const fmtQty = (v: unknown): string =>
  parseNum(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
