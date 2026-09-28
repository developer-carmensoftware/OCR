import type { ReactNode } from 'react'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  disabled?: boolean
}

export default function Switch({ checked, onChange, label, disabled = false }: SwitchProps) {
  return (
    <label className={`ui-switch-label${disabled ? ' disabled' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
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
