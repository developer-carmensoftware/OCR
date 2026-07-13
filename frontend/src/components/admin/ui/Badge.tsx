import type { ReactNode } from 'react'

type Status = 'ok' | 'warn' | 'error' | 'neutral'

interface BadgeProps {
  status?: Status
  children: ReactNode
}

export default function Badge({ status = 'neutral', children }: BadgeProps) {
  return <span className={`status-badge ${status}`}>{children}</span>
}
