import { IdCard } from 'lucide-react'
import { HEADER_LABELS } from '../../constants'
import DateInput from '../common/DateInput'
import { useT } from '../../i18n/LanguageContext'

interface Props {
  headerData: Record<string, string>
  onUpdate?: (key: string, value: string) => void
  readOnly?: boolean
}

const DATE_KEYS = new Set(['DocDate', 'DateProcessed'])

function RenderLabel({ label }: { label: string }) {
  if (label.includes('<br>')) {
    const parts = label.split('<br>')
    const primary = parts[0]
    const secondaryRaw = parts[1] || ''
    const match = secondaryRaw.match(/<span[^>]*>(.*?)<\/span>/)
    const secondary = match ? match[1] : secondaryRaw
    return (
      <>
        {primary}
        <br />
        <span style={{ fontSize: '0.8em', color: '#666' }}>{secondary}</span>
      </>
    )
  }
  return <>{label}</>
}

export default function HeaderCard({ headerData, onUpdate, readOnly }: Props) {
  const { t } = useT()
  return (
    <div className="data-card overflow-visible">
      <div className="card-title">
        <div className="card-title-left">
          <IdCard size={16} /> {t('cc.headerInfo')}
        </div>
      </div>
      <div className="card-body">
        <div className="header-form">
          {Object.entries(headerData).map(([key, value]) => {
            const labelHtml = HEADER_LABELS[key] || key
            return (
              <div key={key} className="form-field">
                <label htmlFor={key}>
                  <RenderLabel label={labelHtml} />
                </label>
                {DATE_KEYS.has(key) ? (
                  <DateInput
                    id={key}
                    aria-label={key}
                    value={value}
                    readOnly={readOnly}
                    onChange={v => !readOnly && onUpdate?.(key, v)}
                  />
                ) : (
                  <input
                    id={key}
                    type="text"
                    aria-label={key}
                    value={value}
                    readOnly={readOnly}
                    onChange={e => !readOnly && onUpdate?.(key, e.target.value)}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
