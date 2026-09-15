// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LanguageProvider } from '../../i18n/LanguageContext'
import OrderStatusBadge from './OrderStatusBadge'

// `paid` and `complete` deliberately render identically: `complete` only means the
// order was posted to Carmen as an AR entry, an admin-side step with no customer
// consequence. If this test fails after someone "fixes" the badge to distinguish
// them again, see the comment on OrderStatusBadge's MAP before reintroducing a split.
describe('OrderStatusBadge paid/complete parity', () => {
  it('renders the same text for paid and complete', () => {
    const { unmount } = render(
      <LanguageProvider>
        <OrderStatusBadge status="paid" />
      </LanguageProvider>
    )
    const paidText = screen.getByText('Complete')
    expect(paidText).toBeInTheDocument()
    unmount()

    render(
      <LanguageProvider>
        <OrderStatusBadge status="complete" />
      </LanguageProvider>
    )
    expect(screen.getByText('Complete')).toBeInTheDocument()
  })
})
