import { IdCard } from 'lucide-react'
import { HEADER_LABELS } from '../../constants'

interface Props {
  headerData: Record<string, string>
  onUpdate?: (key: string, value: string) => void
  readOnly?: boolean
}

export default function HeaderCard({ headerData, onUpdate, readOnly }: Props) {
  return (
    <div className="data-card">
      <div className="card-title">
        <div className="card-title-left">
          <IdCard size={16} /> Header Information
        </div>
      </div>
      <div className="card-body">
        <div className="header-form">
          {Object.entries(headerData).map(([key, value]) => {
            const labelHtml = HEADER_LABELS[key] || key
            return (
              <div key={key} className="form-field">
                <label dangerouslySetInnerHTML={{ __html: labelHtml }} />
                <input
                  type="text"
                  value={value}
                  readOnly={readOnly}
                  onChange={e => !readOnly && onUpdate?.(key, e.target.value)}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
