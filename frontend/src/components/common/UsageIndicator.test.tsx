import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import type { UsageData } from '../../lib/api/auth'

// The badge is the app's only route to #/pricing, so the disclosure path is
// load-bearing. Pool math lives in UsageIndicator.test.ts (pure); this covers
// the trigger → panel behaviour and which pool rows render.

let usage: UsageData['usage']

vi.mock('../../lib/api/auth', () => ({ getUsage: () => Promise.resolve({ bu: 'x', usage }) }))
vi.mock('../../lib/api/client', () => ({ getStoredToken: () => 'tok' }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true }) }))

const { default: UsageIndicator } = await import('./UsageIndicator')

async function openPanel() {
  render(<UsageIndicator />)
  const trigger = await screen.findByRole('button', { name: /documents remaining/i })
  fireEvent.click(trigger)
  return trigger
}

beforeEach(() => {
  usage = { monthly_calls: 3, max_monthly_calls: 30, remaining_calls: 27, credit_balance: 0 }
  window.location.hash = '#/glJv'
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
        period_end: '2026-08-31T00:00:00+07:00',
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
    expect(panel.getByText(/Professional · Active until 31\/08\/2026/)).toBeInTheDocument()
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
