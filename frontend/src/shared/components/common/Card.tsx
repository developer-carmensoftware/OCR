import type { ReactNode } from 'react'

interface Props {
  icon?: ReactNode
  title?: ReactNode
  right?: ReactNode
  children?: ReactNode
  className?: string
}

export default function Card({ icon, title, right, children, className = '' }: Props) {
  return (
    <div className={`data-card ${className}`}>
      {(icon || title || right) && (
        <div className="card-title">
          <div className="card-title-left">
            {icon}
            {title}
          </div>
          {right && <div>{right}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
