import { useT } from '../../i18n/LanguageContext'
import DateRangePicker from './DateRangePicker'

/**
 * One time control for every admin page.
 *
 * It replaces four different bespoke `<select>`s (1h/24h/7d here, 7d/30d/90d there) and
 * four bare date-range inputs. More to the point, it makes the long ranges reachable at
 * all: the period dropdowns used to stop at 7 or 30 days while the data behind them is
 * retained for twelve months.
 *
 * Emits `{from, to}` as YYYY-MM-DD. Pages whose endpoint speaks `period_hours` convert
 * with `periodHours()`.
 */

const DAY_MS = 86_400_000

/** Past this, /usage-summary answers from the monthly rollup — see `granularityFor`. */
export const MAX_DAILY_RANGE_DAYS = 92

export interface Period {
  from: string
  to: string
}

type PresetId = '24h' | '7d' | '30d' | '90d' | '12mo'

const PRESET_DAYS: Record<PresetId, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '12mo': 365,
}

const ymd = (d: Date) => {
  // Local, not toISOString(): in ICT (+07) the UTC date is yesterday for most of the
  // working day, so an ISO slice would quietly ask for the wrong "today".
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function daysAgo(n: number): string {
  return ymd(new Date(Date.now() - n * DAY_MS))
}

export function today(): string {
  return ymd(new Date())
}

/** The default every page opens on, unless it says otherwise. */
export function lastDays(n: number): Period {
  return { from: daysAgo(n), to: today() }
}

export function rangeDays(p: Period): number {
  const from = new Date(`${p.from}T00:00:00`).getTime()
  const to = new Date(`${p.to}T00:00:00`).getTime()
  if (isNaN(from) || isNaN(to)) return 0
  return Math.round((to - from) / DAY_MS)
}

/** `/usage-summary` and `/usage-summary/totals` take this. */
export function granularityFor(p: Period): 'day' | 'month' {
  return rangeDays(p) > MAX_DAILY_RANGE_DAYS ? 'month' : 'day'
}

/**
 * `to` for an endpoint typed `datetime` rather than `date`.
 *
 * A bare `2026-08-21` parses as midnight, so passing it as an upper bound silently
 * excludes the whole of the day the reader just asked for.
 */
export function endOfDay(to: string): string {
  return `${to}T23:59:59`
}

/** For the two endpoints that still window by hours (`/error-breakdown`, `/tenant-ranking`). */
export function periodHours(p: Period): number {
  // +1 day: `to` is a date, and the reader means the whole of it.
  return Math.max(1, (rangeDays(p) + 1) * 24)
}

/** Which preset, if any, the current range corresponds to. Custom otherwise. */
function matchPreset(p: Period): PresetId | '' {
  if (p.to !== today()) return ''
  const span = rangeDays(p)
  const hit = (Object.entries(PRESET_DAYS) as [PresetId, number][]).find(([, d]) => d === span)
  return hit ? hit[0] : ''
}

interface Props {
  value: Period
  onChange: (next: Period) => void
  /** Show the "monthly totals" caveat past 92 days. Only the Usage surfaces need it. */
  showGranularityNote?: boolean
}

export default function PeriodPicker({ value, onChange, showGranularityNote }: Props) {
  const { t } = useT()
  const preset = matchPreset(value)

  return (
    <div className="admin-period">
      <select
        className="admin-select"
        aria-label={t('admin.common.period.label')}
        value={preset}
        onChange={e => {
          const id = e.target.value as PresetId | ''
          // Choosing "Custom" opens the inputs on the range already on screen rather
          // than blanking them — the reader is usually adjusting, not starting over.
          if (id) onChange(lastDays(PRESET_DAYS[id]))
        }}
      >
        <option value="24h">{t('admin.common.period.24h')}</option>
        <option value="7d">{t('admin.common.period.7d')}</option>
        <option value="30d">{t('admin.common.period.30d')}</option>
        <option value="90d">{t('admin.common.period.90d')}</option>
        <option value="12mo">{t('admin.common.period.12mo')}</option>
        <option value="">{t('admin.common.period.custom')}</option>
      </select>

      {preset === '' && (
        <DateRangePicker
          from={value.from}
          to={value.to}
          onChange={(from, to) => onChange({ from, to })}
        />
      )}

      {showGranularityNote && granularityFor(value) === 'month' && (
        <span className="admin-period-note" role="status">
          {t('admin.common.period.monthlyNote')}
        </span>
      )}
    </div>
  )
}
