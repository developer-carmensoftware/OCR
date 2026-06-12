import { Wallet } from 'lucide-react'

/**
 * Header affordance that takes the user to the pricing / top-up page.
 * The 402 "out of credits" flow navigates there directly (see main.tsx), so
 * this is the always-visible manual entry point.
 */
export default function PaymentButton() {
  return (
    <a href="#/pricing" className="btn-icon" title="Plans & credits" aria-label="Plans and credits">
      <Wallet size={15} strokeWidth={2} />
    </a>
  )
}
