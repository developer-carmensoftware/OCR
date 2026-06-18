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

const _ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]
const _TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function _hundreds(n: number): string {
  let s = ''
  if (n >= 100) {
    s += `${_ONES[Math.floor(n / 100)]} Hundred `
    n %= 100
  }
  if (n >= 20) {
    s += `${_TENS[Math.floor(n / 10)]} `
    n %= 10
  }
  if (n > 0) s += `${_ONES[n]} `
  return s.trim()
}

/** Spell a baht amount in English words, e.g. 490 → "Four Hundred Ninety Baht Only". */
export function bahtToEnglishWords(amount: number | string): string {
  const value = typeof amount === 'string' ? Number(amount) : amount
  if (!Number.isFinite(value) || value === 0) return 'Zero Baht Only'

  const [intStr, decStr] = value.toFixed(2).split('.')
  let intPart = parseInt(intStr, 10)
  const satang = parseInt(decStr, 10)

  let result = ''
  const scales: [number, string][] = [
    [1_000_000_000, 'Billion'],
    [1_000_000, 'Million'],
    [1_000, 'Thousand'],
    [1, ''],
  ]
  for (const [size, label] of scales) {
    const chunk = Math.floor(intPart / size)
    intPart %= size
    if (chunk > 0) result += `${_hundreds(chunk)}${label ? ` ${label}` : ''} `
  }
  result = `${result.trim()} Baht`
  result += satang > 0 ? ` and ${_hundreds(satang)} Satang` : ' Only'
  return result.replace(/\s+/g, ' ').trim()
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
