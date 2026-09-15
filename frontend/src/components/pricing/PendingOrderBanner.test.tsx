// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { LanguageProvider } from '../../i18n/LanguageContext'
import PendingOrderBanner from './PendingOrderBanner'
import type { CreditOrder } from '../../lib/api/credits'
import type { ActiveSubscription } from '../../lib/api/auth'

vi.mock('../../lib/api/credits', () => ({
  uploadSlip: vi.fn().mockResolvedValue(undefined),
  cancelOrder: vi.fn().mockResolvedValue(undefined),
  getOrderDocuments: vi.fn().mockResolvedValue([]),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { uploadSlip } from '../../lib/api/credits'

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
  }
})

beforeEach(() => vi.mocked(uploadSlip).mockClear())

const SLIP = new File(['x'], 'slip.png', { type: 'image/png' })

function order(
  pack_code: string,
  credits: number,
  billing_period: 'monthly' | 'annual'
): CreditOrder {
  return {
    id: 'o-1',
    pack_code,
    credits,
    amount_thb: 990,
    billing_period,
    status: 'in_progress',
    created_at: '2026-09-14T00:00:00Z',
    slip_uploaded_at: null,
    approved_at: null,
    expires_at: null,
    rejected_reason: null,
  }
}

function sub(doc_allowance: number, billing_period: string): ActiveSubscription {
  return {
    plan_code: 'sub_growth',
    doc_allowance,
    docs_used: 0,
    docs_remaining: doc_allowance,
    period_start: '2026-09-01',
    period_end: '2026-09-30',
    billing_period,
    status: 'active',
  }
}

function renderBanner(o: CreditOrder, s: ActiveSubscription | null) {
  render(
    <LanguageProvider>
      <PendingOrderBanner
        orders={[o]}
        onChanged={() => {}}
        paymentInfo={null}
        initialSlipFile={SLIP}
        sub={s}
      />
    </LanguageProvider>
  )
  return screen.getByRole('button', { name: 'Confirm payment' })
}

/**
 * This banner reaches the slip button WITHOUT going through CheckoutFlow — a buyer
 * who left checkout and came back uploads from here. A guard that only covered the
 * checkout path would miss every one of these.
 */
describe('PendingOrderBanner plan-change confirmation', () => {
  it('warns with the real numbers when the order shrinks the quota', async () => {
    fireEvent.click(renderBanner(order('sub_lite', 100, 'monthly'), sub(1000, 'monthly')))

    // The same text also stands as a banner before the dialog ever opens (see
    // SlipUpload), so this asserts the dialog specifically rather than the text.
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/quota drops from 1,000 to 100 docs/)).toBeTruthy()
    expect(uploadSlip).not.toHaveBeenCalled()
  })

  it('warns about forfeited months when annual becomes monthly at the same tier', async () => {
    // Quota is identical, so a credits-only check would wave this through.
    fireEvent.click(renderBanner(order('sub_growth', 1000, 'monthly'), sub(1000, 'annual')))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/annual plan becomes monthly/)).toBeTruthy()
    expect(uploadSlip).not.toHaveBeenCalled()
  })

  it('names both losses when an annual plan becomes a smaller monthly one', async () => {
    // The costly case: the buyer gives up quota AND the months they prepaid. Reporting
    // only the quota drop here understated the loss by the larger of the two amounts.
    fireEvent.click(renderBanner(order('sub_lite', 100, 'monthly'), sub(1000, 'annual')))

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText(/plan becomes monthly and quota drops from 1,000 to 100 docs/)
    ).toBeTruthy()
    expect(uploadSlip).not.toHaveBeenCalled()
  })

  it('does not interrupt an upgrade', async () => {
    fireEvent.click(renderBanner(order('sub_pro', 5000, 'monthly'), sub(1000, 'monthly')))

    await waitFor(() => expect(uploadSlip).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does not interrupt a top-up pack bought alongside a subscription', async () => {
    // A pack grants non-expiring credits and never touches the subscription row,
    // so its credit count must not be compared against the plan's allowance.
    fireEvent.click(renderBanner(order('pack_small', 50, 'monthly'), sub(1000, 'monthly')))

    await waitFor(() => expect(uploadSlip).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does not interrupt a buyer who has no subscription at all', async () => {
    fireEvent.click(renderBanner(order('sub_lite', 100, 'monthly'), null))

    await waitFor(() => expect(uploadSlip).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
