import { useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Persists for the life of the module (i.e. until a full page reload), so a
// landing surface animates once on first view and renders instantly on every
// in-app navigation back to it. Daily users shouldn't re-watch a load sequence.
const seen = new Set<string>()

/**
 * True only the first time `key` is shown this session, and never when the user
 * prefers reduced motion. Use it to gate framer-motion entrance animations:
 *
 *   const enter = useEntrance('home')
 *   <motion.div initial={enter ? { opacity: 0, y: 12 } : false} animate={{ opacity: 1, y: 0 }} />
 *
 * `initial={false}` makes framer-motion mount at the `animate` target with no transition.
 */
export function useEntrance(key: string): boolean {
  const reduce = useReducedMotion()
  const first = useRef(!seen.has(key))
  if (first.current) seen.add(key)
  return first.current && !reduce
}
