import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="ui-empty-state">
      {icon && <div className="ui-empty-icon">{icon}</div>}
      <div className="ui-empty-title">{title}</div>
      {description && <div className="ui-empty-description">{description}</div>}
      {action && <div className="ui-empty-action">{action}</div>}
    </div>
  )
}
