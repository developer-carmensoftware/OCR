import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  daysAgo,
  today,
  lastDays,
  rangeDays,
  endOfDay,
  periodHours,
  granularityFor,
  MAX_DAILY_RANGE_DAYS,
} from './PeriodPicker'

/**
 * The one time control every admin page now uses. Its helpers decide which data source
 * the API reads and what dates it is sent, so they are worth pinning harder than the
 * markup: a wrong `granularityFor` is a 400 in the user's face, and a wrong `endOfDay`
 * silently drops the day they asked for.
 */

vi.mock('../../i18n/LanguageContext', () => ({
  useT: () => ({ t: (k: string) => k }),
}))

const { default: PeriodPicker } = await import('./PeriodPicker')

describe('date helpers', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('reads the local date, not the UTC one', () => {
    // ICT is UTC+7, so for most of the working day `new Date().toISOString()` is still
    // yesterday. Slicing an ISO string here would ask the API for the wrong "today".
    vi.setSystemTime(new Date('2026-08-24T02:30:00+07:00')) // = 2026-08-23T19:30Z
    expect(today()).toBe('2026-08-24')
  })

  it('counts back in whole local days', () => {
    vi.setSystemTime(new Date('2026-08-24T10:00:00+07:00'))
    expect(daysAgo(0)).toBe('2026-08-24')
    expect(daysAgo(7)).toBe('2026-08-17')
    expect(daysAgo(30)).toBe('2026-07-25')
  })

  it('lastDays ends today', () => {
    vi.setSystemTime(new Date('2026-08-24T10:00:00+07:00'))
    expect(lastDays(30)).toEqual({ from: '2026-07-25', to: '2026-08-24' })
  })
})

describe('rangeDays', () => {
  it('measures the span between the two dates', () => {
    expect(rangeDays({ from: '2026-08-01', to: '2026-08-31' })).toBe(30)
    expect(rangeDays({ from: '2026-08-24', to: '2026-08-24' })).toBe(0)
  })

  it('is not thrown off by a month boundary or a leap day', () => {
    expect(rangeDays({ from: '2026-01-31', to: '2026-02-01' })).toBe(1)
    expect(rangeDays({ from: '2024-02-28', to: '2024-03-01' })).toBe(2)
  })

  it('answers 0 for an unparseable range rather than NaN', () => {
    // NaN would make granularityFor answer 'day' by accident and re-raise the 400.
    expect(rangeDays({ from: '', to: '' })).toBe(0)
  })
})

describe('endOfDay', () => {
  it('covers the whole of the last day', () => {
    // A bare date parses as midnight, so passing it as an upper bound to a datetime
    // endpoint silently excludes everything the reader did that day.
    expect(endOfDay('2026-08-24')).toBe('2026-08-24T23:59:59')
  })
})

describe('granularityFor', () => {
  it('stays daily up to and including the cap', () => {
    expect(granularityFor({ from: '2026-01-01', to: '2026-01-31' })).toBe('day')
    const atCap = { from: '2026-01-01', to: '2026-04-03' } // exactly 92 days
    expect(rangeDays(atCap)).toBe(MAX_DAILY_RANGE_DAYS)
    expect(granularityFor(atCap)).toBe('day')
  })

  it('switches to monthly one day past the cap, which is where the API would 400', () => {
    expect(granularityFor({ from: '2026-01-01', to: '2026-04-04' })).toBe('month')
    expect(granularityFor({ from: '2025-08-24', to: '2026-08-24' })).toBe('month')
  })
})

describe('periodHours', () => {
  it('covers the whole of the final day', () => {
    // The two endpoints that still window by hours look back from now, so a 7-day range
    // has to be 8 days of hours or the first day is half-missing.
    expect(periodHours({ from: '2026-08-17', to: '2026-08-24' })).toBe(8 * 24)
  })

  it('never returns zero for a single-day range', () => {
    expect(periodHours({ from: '2026-08-24', to: '2026-08-24' })).toBe(24)
  })

  it('the 12-month preset lands inside the endpoint ceiling', () => {
    // The wall this whole change removed was le=720. The preset must fit the *new*
    // ceiling too, or the page 422s on its own dropdown — which is what it did until
    // this test caught it: 365 whole days is 366 days of hours, and the API said 8760.
    // `_MAX_PERIOD_HOURS` in routers/admin/usage.py is 366 * 24 for exactly this reason.
    expect(periodHours(lastDays(365))).toBeLessThanOrEqual(366 * 24)
  })
})

describe('PeriodPicker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T10:00:00+07:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('shows the matching preset for the current range', () => {
    render(<PeriodPicker value={lastDays(30)} onChange={() => {}} />)
    expect(screen.getByLabelText('admin.common.period.label')).toHaveValue('30d')
  })

  it('falls back to Custom for a range no preset describes', () => {
    render(<PeriodPicker value={{ from: '2026-03-02', to: '2026-05-11' }} onChange={() => {}} />)
    expect(screen.getByLabelText('admin.common.period.label')).toHaveValue('')
  })

  it('reveals the date inputs only on Custom', () => {
    const { rerender } = render(<PeriodPicker value={lastDays(7)} onChange={() => {}} />)
    expect(screen.queryByLabelText('admin.common.dateRange.from')).toBeNull()

    rerender(<PeriodPicker value={{ from: '2026-03-02', to: '2026-05-11' }} onChange={() => {}} />)
    expect(screen.getByLabelText('admin.common.dateRange.from')).toBeTruthy()
  })

  it('emits a whole range when a preset is picked', () => {
    const onChange = vi.fn()
    render(<PeriodPicker value={lastDays(7)} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('admin.common.period.label'), {
      target: { value: '12mo' },
    })
    expect(onChange).toHaveBeenCalledWith({ from: '2025-08-24', to: '2026-08-24' })
  })

  it('offers a 12-month option at all — the wall this change removed', () => {
    render(<PeriodPicker value={lastDays(7)} onChange={() => {}} />)
    const opts = Array.from(
      screen.getByLabelText('admin.common.period.label').querySelectorAll('option')
    ).map(o => o.getAttribute('value'))
    expect(opts).toContain('12mo')
    expect(opts).toContain('90d')
  })

  it('warns that the numbers are monthly totals once past the daily cap', () => {
    const wide = { from: '2025-08-24', to: '2026-08-24' }
    const { rerender } = render(
      <PeriodPicker value={wide} onChange={() => {}} showGranularityNote />
    )
    expect(screen.getByRole('status').textContent).toBe('admin.common.period.monthlyNote')

    // ...and stays quiet when the rows really are daily.
    rerender(<PeriodPicker value={lastDays(30)} onChange={() => {}} showGranularityNote />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('stays quiet on pages that do not read the rollup', () => {
    // Only the Usage surfaces switch source; the note would be a lie anywhere else.
    render(<PeriodPicker value={{ from: '2025-08-24', to: '2026-08-24' }} onChange={() => {}} />)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
