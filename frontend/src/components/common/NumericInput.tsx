import type { InputHTMLAttributes } from 'react'
import { sanitizeNumericInput } from './numericHelpers'

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
