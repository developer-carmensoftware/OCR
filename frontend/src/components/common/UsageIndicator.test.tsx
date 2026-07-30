import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { formatDate } from '../../lib/date'
import type { UsageData } from '../../lib/api/auth'

// Noon UTC, so the calendar day is the same from UTC-11 to UTC+11: an earlier
// version used midnight ICT, which is 17:00 UTC the previous day, so it read as
// the 31st locally and the 30th on CI. The expectation goes through formatDate
// too, which makes the assertion timezone-agnostic by construction rather than
// by picking a lucky hour. (formatDate uses local-time getters — see the note in
// changelog/2026-07-30.md about that being latent app-wide behaviour.)
const PERIOD_END = '2026-08-31T12:00:00Z'

// The badge is the app's only route to #/pricing, so the disclosure path is
// load-bearing. Pool math lives in UsageIndicator.test.ts (pure); this covers
// the trigger → panel behaviour and which pool rows render.

let usage: UsageData['usage']
let authed = true

vi.mock('../../lib/api/auth', () => ({ getUsage: () => Promise.resolve({ bu: 'x', usage }) }))
vi.mock('../../lib/api/client', () => ({ getStoredToken: () => 'tok' }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: authed }) }))

const { default: UsageIndicator } = await import('./UsageIndicator')

async function openPanel() {
  render(<UsageIndicator />)
  const trigger = await screen.findByRole('button', { name: /documents remaining/i })
  fireEvent.click(trigger)
  return trigger
}

beforeEach(() => {
  authed = true
  usage = { monthly_calls: 3, max_monthly_calls: 30, remaining_calls: 27, credit_balance: 0 }
  window.location.hash = '#/glJv'
})

describe('UsageIndicator — loading', () => {
  it('renders nothing when unauthenticated instead of a skeleton that never clears', () => {
    // The fetch effect bails out before setLoading(false), so an early return is
    // the only thing keeping the skeleton from sitting in the header forever.
    authed = false
    const { container } = render(<UsageIndicator />)
    expect(container).toBeEmptyDOMElement()
  })

  it('keeps the skeleton on the same elements as the loaded badge', async () => {
    // jsdom does not apply the stylesheet, so this can only assert the structural
    // contract the CSS relies on: both states carry .ui-quota-value (min-width:
    // 4ch fixes the width) and .ui-quota-chevron, so nothing resizes on resolve.
    const { container } = render(<UsageIndicator />)
    const shape = () => ({
      value: !!container.querySelector('.ui-quota-value'),
      chevron: !!container.querySelector('.ui-quota-chevron'),
    })
    expect(shape()).toEqual({ value: true, chevron: true })
    expect(container.querySelector('.ui-quota-placeholder')).toBeInTheDocument()

    await screen.findByRole('button', { name: /documents remaining/i })
    expect(shape()).toEqual({ value: true, chevron: true })
    expect(container.querySelector('.ui-quota-placeholder')).not.toBeInTheDocument()
  })
})

describe('UsageIndicator', () => {
  it('opens the quota panel from the badge', async () => {
    const trigger = await openPanel()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes on Escape and hands focus back to the trigger', async () => {
    const trigger = await openPanel()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('moves focus into the panel on open', async () => {
    // The panel is portaled to the end of <body>, so without this Tab would walk
    // the rest of the header and never reach the CTA.
    await openPanel()
    expect(screen.getByRole('dialog')).toHaveFocus()
  })

  it('shows only the pools the tenant actually has', async () => {
    await openPanel()
    expect(screen.getByText('Free quota left')).toBeInTheDocument()
    // No subscription and zero credits — those rows must not appear.
    expect(screen.queryByText('Plan docs left')).not.toBeInTheDocument()
    expect(screen.queryByText('Top-up credits')).not.toBeInTheDocument()
  })

  it('breaks a summed REMAIN back into its three pools', async () => {
    usage = {
      monthly_calls: 3,
      max_monthly_calls: 30,
      remaining_calls: 27,
      credit_balance: 15,
      subscription: {
        plan_code: 'sub_pro',
        doc_allowance: 1500,
        docs_used: 0,
        docs_remaining: 1500,
        period_start: null,
        period_end: PERIOD_END,
        status: 'active',
      },
    }
    await openPanel()
    // Scope to the panel: the total also shows on the badge itself.
    const panel = within(screen.getByRole('dialog'))
    expect(panel.getByText('27 / 30')).toBeInTheDocument()
    expect(panel.getByText('1500 / 1500')).toBeInTheDocument()
    expect(panel.getByText('15')).toBeInTheDocument()
    expect(panel.getByText('1542')).toBeInTheDocument() // 1500 + 27 + 15
    expect(
      panel.getByText(`Professional · Active until ${formatDate(PERIOD_END)}`)
    ).toBeInTheDocument()
  })

  it('omits the expiry clause when the plan has no period_end', async () => {
    usage = {
      monthly_calls: 0,
      max_monthly_calls: 0,
      remaining_calls: 0,
      credit_balance: 0,
      subscription: {
        plan_code: 'sub_pro',
        doc_allowance: 1500,
        docs_used: 0,
        docs_remaining: 1500,
        period_start: null,
        period_end: null,
        status: 'active',
      },
    }
    await openPanel()
    expect(screen.getByText('Professional')).toBeInTheDocument()
    expect(screen.queryByText(/Active until/)).not.toBeInTheDocument()
  })

  it('surfaces the low-quota hint only when the pool is nearly spent', async () => {
    usage = { monthly_calls: 30, max_monthly_calls: 30, remaining_calls: 0, credit_balance: 2 }
    await openPanel()
    expect(screen.getByText(/Running low/i)).toBeInTheDocument()
  })

  it('routes to pricing and closes', async () => {
    await openPanel()
    fireEvent.click(screen.getByRole('link', { name: /top up credits/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
