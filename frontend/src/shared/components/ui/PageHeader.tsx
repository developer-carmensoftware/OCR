import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="ui-page-header">
      <div className="ui-page-header-row">
        <h1 className="ui-page-title">{title}</h1>
        {actions && <div className="ui-page-actions">{actions}</div>}
      </div>
      {description && <p className="ui-page-description">{description}</p>}
    </div>
  )
}
