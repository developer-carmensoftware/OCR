import type { ReactNode } from 'react'

/* Two vocabularies, deliberately kept side by side rather than collapsed:
   `ok/warn/error/neutral` reads as operational status (a job ran, a token is
   missing), `info/success/gray/blue/warning` reads as classification (a tax
   type, an order state). Forcing one onto the other made call sites read worse.
   Every tone resolves to a `.status-badge.<tone>` rule in components.css. */
type BadgeVariant =
  'info' | 'success' | 'gray' | 'blue' | 'warning' | 'error' | 'ok' | 'warn' | 'neutral'

interface Props {
  children: ReactNode
  variant?: BadgeVariant
  pill?: boolean
  className?: string
}

export default function Badge({ children, variant = 'info', pill = true, className = '' }: Props) {
  return (
    <span className={`status-badge ${variant}${!pill ? ' tag' : ''} ${className}`.trim()}>
      {children}
    </span>
  )
}
