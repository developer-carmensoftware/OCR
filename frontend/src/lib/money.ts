/** Format a baht amount with thousands separators. `withDecimals` shows .00. */
export function formatThb(value: number | string, withDecimals = false): string {
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('en-US', {
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })
}

/** Format a per-document/credit rate, always two decimals, e.g. 1.98. */
export function formatRate(value: number): string {
  if (!Number.isFinite(value)) return '0.00'
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** DD/MM/YYYY from an ISO date string (project-wide display format). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}
