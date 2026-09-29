import type { ReactNode } from 'react'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  disabled?: boolean
  /** For a switch whose caption is laid out elsewhere (a title on the far side of a
   *  card), so it still has an accessible name. Ignored when `label` is given. */
  ariaLabel?: string
}

export default function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  ariaLabel,
}: SwitchProps) {
  return (
    <label className={`ui-switch-label${disabled ? ' disabled' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label ? undefined : ariaLabel}
        className={`ui-switch${checked ? ' checked' : ''}`}
        onClick={() => onChange(!checked)}
        disabled={disabled}
      >
        <span className="ui-switch-thumb" />
      </button>
      {label && <span className="ui-switch-text">{label}</span>}
    </label>
  )
}
