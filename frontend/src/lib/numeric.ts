/**
 * Strip everything that is not part of a decimal number so users cannot type
 * letters/symbols into numeric fields. Commas are preserved on purpose — the
 * app shows thousands-separated values (e.g. "1,234.56") and re-formats on blur.
 *
 * Rules: keep 0-9, ".", ",", and a single leading "-" (when allowed); collapse
 * multiple decimal points down to the first one.
 */
export function sanitizeNumericInput(raw: string, allowNegative = true): string {
  let s = raw.replace(/[^0-9.,-]/g, '')
  const negative = allowNegative && s.startsWith('-')
  s = s.replace(/-/g, '')
  const firstDot = s.indexOf('.')
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '')
  }
  return (negative ? '-' : '') + s
}
