import type { ReactNode } from 'react'

type BadgeVariant = 'info' | 'success' | 'gray' | 'blue' | 'warning' | 'error'

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
