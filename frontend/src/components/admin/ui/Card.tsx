import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export default function Card({ title, icon, actions, children, className }: CardProps) {
  const hasHeader = Boolean(title || icon || actions)
  return (
    <div className={`ui-card${className ? ` ${className}` : ''}`}>
      {hasHeader && (
        <div className="ui-card-header">
          <div className="ui-card-heading">
            {icon && <span className="ui-card-icon">{icon}</span>}
            {title && <h3 className="ui-card-title">{title}</h3>}
          </div>
          {actions && <div className="ui-card-actions">{actions}</div>}
        </div>
      )}
      <div className="ui-card-body">{children}</div>
    </div>
  )
}
