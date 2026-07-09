interface DateRangePickerProps {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}

export default function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  return (
    <div className="admin-date-range">
      <label className="admin-date-label" htmlFor="date-from">
        From
      </label>
      <input
        id="date-from"
        type="date"
        className="admin-date-input"
        aria-label="From date"
        value={from}
        onChange={e => onChange(e.target.value, to)}
        max={to || undefined}
      />
      <span className="admin-date-sep">–</span>
      <label className="admin-date-label" htmlFor="date-to">
        To
      </label>
      <input
        id="date-to"
        type="date"
        className="admin-date-input"
        aria-label="To date"
        value={to}
        onChange={e => onChange(from, e.target.value)}
        min={from || undefined}
      />
    </div>
  )
}
