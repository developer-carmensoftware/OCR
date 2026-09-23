import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listActivity,
  markChipSeen,
  type ActivityFilter,
  type ReviewDocument,
} from '../../lib/api/emailReview'
/** Where the page opens before the counts have said otherwise. */
const TODAY: ActivityFilter = 'today'

export interface ReviewQueueController {
  /** Never null: the page opens on `today` and falls through to the first chip that has
   *  anything (see the fetch effect). `loading` covers the fall-through, so the strip does
   *  not visibly hop. */
  filter: ActivityFilter
  setFilter: (f: ActivityFilter) => void
  rows: ReviewDocument[]
  total: number
  /** Keyed by filter name. Every chip is present even at zero — one that appears only
   *  when it has rows makes the strip jump around as documents resolve. */
  counts: Record<string, number>
  /** Same keys: of those rows, how many are wrong in some way. Sizes the pile; does not
   *  decide the dot. */
  attention: Record<string, number>
  /** Which chips are holding something nobody in this BU has looked at — the dot. The chip
   *  on screen is never in here: opening one is what marks it, for the whole BU. */
  unseen: Record<string, boolean>
  offset: number
  setOffset: (n: number) => void
  loading: boolean
  /** A failed fetch is not an empty queue. The page renders a retry for this, never the
   *  empty state — "nothing is waiting" and "we could not ask" must never look alike. */
  error: boolean
  reload: () => void
}

/**
 * The activity page's data, in one hook: `listActivity` returns the window AND the chip
 * counts, refetched whenever the filter, size or offset moves.
 *
 * There used to be a second call, `getReviewStatus`, whose only reader was the email
 * forwarding pitch. That screen is gone, and so is the call — whether a BU has scanned
 * anything at all is `counts.all`, which this one already answers.
 */
export function useReviewQueue(
  limit: number,
  /** Skips the fall-through below and opens straight on this chip — how the bell's
   *  blocked/failed rows land on `unposted` (`ReviewQueue.tsx`'s `filterFromHash`).
   *  Read once, on mount, same as every other opening-chip decision here. */
  initialFilter?: ActivityFilter | null
): ReviewQueueController {
  // The page opens on the day: "what has happened today" is the question somebody arrives
  // with. It no longer waits for `auto_post` to name a chip — the fall-through below covers
  // what that rule was for, and covers more besides.
  const [filter, setFilterState] = useState<ActivityFilter>(initialFilter || TODAY)
  // Whether the opening chip has been settled. The fall-through runs once, so a refresh
  // never throws the reader back to the top and neither does working a chip down to zero.
  // Already settled when the caller named a chip explicitly — the fall-through exists to
  // guess one, and there is nothing to guess.
  const landed = useRef(!!initialFilter)
  const [rows, setRows] = useState<ReviewDocument[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [attention, setAttention] = useState<Record<string, number>>({})
  const [unseen, setUnseen] = useState<Record<string, boolean>>({})
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce(n => n + 1), [])

  // Content, and — on the very first response — where the page should have opened.
  useEffect(() => {
    let alive = true
    let hopped = false
    setLoading(true)
    listActivity(filter, limit, offset)
      .then(page => {
        if (!alive) return

        // **The opening chip, settled from the counts rather than guessed at.**
        //
        // Today first, because that is the question somebody arrives with. But a quiet
        // morning must not be the whole answer, so an empty Today hands over to the work,
        // and an empty Review to what the robot posted without being asked.
        //
        // It costs one extra request and only on a quiet morning: every chip's count
        // arrives with this first response, so the fall-through knows exactly where to go
        // instead of trying each chip in turn. Nothing is painted on the way past —
        // `hopped` holds `loading` on, so the reader never sees an empty table flash before
        // the one with their work in it.
        //
        // This replaces the `auto_post ? success : review` rule. That existed because a BU
        // with review switched off has a permanently empty Review chip; falling through an
        // empty chip covers it without asking, and covers a BU that has simply caught up.
        if (!landed.current) {
          landed.current = true
          const next = !page.counts.today
            ? page.counts.review
              ? 'review'
              : page.counts.success
                ? 'success'
                : null
            : null
          if (next) {
            hopped = true
            setFilterState(next)
            return
          }
        }

        setRows(page.data)
        setTotal(page.total)
        setCounts(page.counts)
        setAttention(page.attention ?? {})

        // The chip on screen has now been looked at, so its dot goes out — for everyone in
        // the BU, which is the whole point of the mark living on the server.
        //
        // Cleared locally rather than by reloading: `markChipSeen` changes what the next
        // GET would answer, and re-fetching to learn that costs a round trip to be told
        // what we already know. It is also what stops a loop, since the value that gates
        // the POST is the value the POST clears. Not awaited and never surfaced — a dot
        // that stays on until next time is not worth an error message.
        const owed = !!page.unseen?.[filter]
        setUnseen(owed ? { ...page.unseen, [filter]: false } : (page.unseen ?? {}))
        if (owed) void markChipSeen(filter).catch(() => {})

        setError(false)
      })
      .catch(() => {
        if (alive) setError(true)
      })
      .finally(() => {
        // Not while hopping: the effect is about to run again for the chip we fell through
        // to, and clearing this in between is what would flash the empty state.
        if (alive && !hopped) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [filter, limit, offset, nonce])

  // Switching filter always starts at the top. Keeping the offset would land someone on
  // page 3 of a filter that has two rows, which reads as an empty list.
  const setFilter = useCallback((next: ActivityFilter) => {
    setFilterState(next)
    setOffset(0)
  }, [])

  // Coming back to the tab is the moment a stale list is most obvious — someone else in
  // the BU may have cleared it while this was open. Cheap: one small read.
  useEffect(() => {
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reload])

  return {
    filter,
    setFilter,
    rows,
    total,
    counts,
    attention,
    unseen,
    offset,
    setOffset,
    loading,
    error,
    reload,
  }
}
