import { useEffect, useRef, useState } from 'react'
import { useT } from '../../i18n/LanguageContext'

interface DateRangePickerProps {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}

const DEBOUNCE_MS = 300

export default function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const { t } = useT()
  // Local state gives instant input feedback; the parent's onChange (which drives a
  // network fetch in every consumer) is debounced so rapidly adjusting the range
  // doesn't fire one full request per change.
  const [localFrom, setLocalFrom] = useState(from)
  const [localTo, setLocalTo] = useState(to)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setLocalFrom(from), [from])
  useEffect(() => setLocalTo(to), [to])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  const commit = (nextFrom: string, nextTo: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onChange(nextFrom, nextTo), DEBOUNCE_MS)
  }

  return (
    <div className="admin-date-range">
      <label className="admin-date-label" htmlFor="date-from">
        {t('admin.common.dateRange.from')}
      </label>
      <input
        id="date-from"
        type="date"
        className="admin-date-input"
        aria-label={t('admin.common.dateRange.from')}
        value={localFrom}
        onChange={e => {
          setLocalFrom(e.target.value)
          commit(e.target.value, localTo)
        }}
        max={localTo || undefined}
      />
      <span className="admin-date-sep">–</span>
      <label className="admin-date-label" htmlFor="date-to">
        {t('admin.common.dateRange.to')}
      </label>
      <input
        id="date-to"
        type="date"
        className="admin-date-input"
        aria-label={t('admin.common.dateRange.to')}
        value={localTo}
        onChange={e => {
          setLocalTo(e.target.value)
          commit(localFrom, e.target.value)
        }}
        min={localFrom || undefined}
      />
    </div>
  )
}
