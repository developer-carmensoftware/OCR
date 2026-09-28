import { createContext, useContext, type ReactNode } from 'react'

/**
 * The spot the tour is currently pointing at. Context rather than a prop drilled
 * through every figure: a figure is often a dozen components deep, and passing
 * `spot` through all of them is the tax that stops people writing tutorials.
 */
const SpotContext = createContext('')

export const SpotProvider = SpotContext.Provider

/**
 * Marks the one element in a figure that a step highlights.
 *
 *     <Spot id="buy-btn">…</Spot>
 *
 * It draws nothing. The modal measures `[data-spot]` and animates a single
 * highlight rect between targets, so the ring can travel from one element to
 * the next instead of blinking out and in.
 *
 * `className` is passed through for the corner radius — `tut-spot--pill` on a
 * pill-shaped control, say — since the highlight copies the target's shape.
 */
export function Spot({
  id,
  className = '',
  children,
}: {
  id: string
  className?: string
  children: ReactNode
}) {
  const active = useContext(SpotContext)
  return (
    <div
      data-spot={id}
      data-lit={active === id ? '' : undefined}
      className={`tut-spot${className ? ` ${className}` : ''}`}
    >
      {children}
    </div>
  )
}
