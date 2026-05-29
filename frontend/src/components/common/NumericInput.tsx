import type { InputHTMLAttributes } from 'react'

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

interface NumericInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'onBlur' | 'value' | 'type'
> {
  value: string
  onChange: (value: string) => void
  onBlur?: (value: string) => void
  allowNegative?: boolean
}

/**
 * Drop-in replacement for a text `<input>` on numeric fields. Renders
 * `type="text" inputMode="decimal"` (numeric keypad on mobile) and sanitizes
 * keystrokes so non-numeric characters never reach state. Formatting (commas,
 * 2 decimals) stays in the parent's blur handler — this component is purely an
 * input guard and does not transform the displayed value.
 */
export default function NumericInput({
  value,
  onChange,
  onBlur,
  allowNegative = true,
  ...rest
}: NumericInputProps) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={e => onChange(sanitizeNumericInput(e.target.value, allowNegative))}
      onBlur={onBlur ? e => onBlur(e.target.value) : undefined}
    />
  )
}
