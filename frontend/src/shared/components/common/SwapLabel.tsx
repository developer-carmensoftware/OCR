import type { ReactNode } from 'react'

/**
 * Two labels stacked in one grid cell: the box is always as wide as the wider of the two,
 * so a control does not resize when its label swaps ("Confirm" → "Submitting…").
 *
 * A `min-width` cannot do this job — no single px value holds for both EN and TH, and the
 * Thai label is often the longer one.
 */
export default function SwapLabel({
  active,
  idle,
  busy,
}: {
  /** true = show `busy` */
  active: boolean
  idle: ReactNode
  busy: ReactNode
}) {
  return (
    <span className="swap-label">
      <span aria-hidden={active}>{idle}</span>
      <span aria-hidden={!active}>{busy}</span>
    </span>
  )
}
