import { useEffect, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { CalendarDays } from 'lucide-react'
import 'react-day-picker/style.css'
import { parseDDMMYYYYToDate, formatDateToDDMMYYYY } from '../../lib/date'

interface DateInputProps {
  /** Current value as a "DD/MM/YYYY" string (may carry a Buddhist-era year from OCR). */
  value: string
  /** Called with the picked date formatted as "DD/MM/YYYY" (CE). */
  onChange: (value: string) => void
  readOnly?: boolean
  id?: string
  className?: string
  'aria-label'?: string
  placeholder?: string
}

/**
 * Calendar-backed date field. The displayed text is read-only — the user must
 * pick from the popover calendar, so free-form / malformed dates can't be typed.
 * The stored value stays a "DD/MM/YYYY" string (CE) so downstream submission
 * parsing is unchanged. OCR Buddhist-era values are normalized to CE when the
 * calendar opens (via parseDDMMYYYYToDate).
 */
export default function DateInput({
  value,
  onChange,
  readOnly,
  id,
  className,
  placeholder = 'Select date',
  ...rest
}: DateInputProps) {
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const selected = parseDDMMYYYYToDate(value) ?? undefined

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // When the trigger sits near the right edge, anchor the popover to its right
  // side so the calendar grows leftward instead of overflowing the viewport/card.
  useEffect(() => {
    if (!open || !containerRef.current) return
    const POPOVER_WIDTH = 300
    const rect = containerRef.current.getBoundingClientRect()
    setAlignRight(rect.left + POPOVER_WIDTH > window.innerWidth - 12)
  }, [open])

  const handleSelect = (day: Date | undefined) => {
    if (day) onChange(formatDateToDDMMYYYY(day))
    setOpen(false)
  }

  return (
    <div className="date-input" ref={containerRef}>
      <button
        type="button"
        id={id}
        aria-label={rest['aria-label']}
        className={`date-input-trigger ${className || ''}`}
        disabled={readOnly}
        onClick={() => !readOnly && setOpen(o => !o)}
      >
        <span className={value ? '' : 'date-input-placeholder'}>{value || placeholder}</span>
        <CalendarDays size={14} />
      </button>
      {open && (
        <div className={`date-input-popover ${alignRight ? 'align-right' : ''}`}>
          <DayPicker
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={handleSelect}
            captionLayout="dropdown"
            startMonth={new Date(2015, 0)}
            endMonth={new Date(2035, 11)}
          />
        </div>
      )}
    </div>
  )
}
