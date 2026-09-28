import { useEffect } from 'react'

/**
 * Locks background scrolling while `active`, counted across every caller.
 *
 * Four dialogs each used to save `document.body.style.overflow`, set it to `hidden`,
 * and put the saved value back on cleanup. That pattern is not composable: whenever
 * two of them overlapped, the inner one saved `'hidden'` and restored `'hidden'` —
 * and if it unmounted *after* the outer one (which React does for a whole deleted
 * subtree: parent cleanup first, then child), the page was left unscrollable with
 * nothing on screen to explain it. Only a reload cleared it.
 *
 * A counter cannot get that wrong. The first lock remembers the page's own overflow,
 * the last one out restores it, and the order they arrive and leave in stops mattering.
 *
 * Global, not per-hook, on purpose — the thing being locked is global.
 */
let locks = 0
let priorOverflow = ''

export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return
    if (locks++ === 0) {
      priorOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    return () => {
      if (--locks === 0) document.body.style.overflow = priorOverflow
    }
  }, [active])
}

/** Test-only: the module-level counter outlives a single render tree. */
export function __resetScrollLock() {
  locks = 0
  priorOverflow = ''
  document.body.style.overflow = ''
}
