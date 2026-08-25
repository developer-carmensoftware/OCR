import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/dict'

/**
 * Fetch one admin table's rows. The companion to `useTableQuery`, which owns the
 * filters this reads.
 *
 * Eight pages carried the identical block — three `useState`s, an effect that flips
 * `loading`, maps `data`/`total` off the envelope, toasts the failure, and an
 * `eslint-disable exhaustive-deps` to silence the fetch closure. Copying it once more
 * per new page is how the stale-response bug below stayed unfixed in eight places at
 * once.
 *
 * Every list endpoint answers the same `Page<T>` envelope (`{total, limit, offset,
 * data}` — see `lib/api/page.ts`), which is what makes one hook enough.
 *
 * @param fetcher  Thunk returning the envelope. Closes over the current filters, so it
 *                 is re-created each render — hence the explicit `deps`.
 * @param deps     What a refetch depends on; normally `[params]` from `useTableQuery`.
 * @param errorKey i18n key for the failure toast, called with `{ error }`.
 */
export function useTableData<T>(
  fetcher: () => Promise<{ data?: T[]; total?: number }>,
  deps: unknown[],
  errorKey: TKey
): { rows: T[]; total: number; loading: boolean; reload: () => void } {
  const { t } = useT()
  const [rows, setRows] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  // Monotonic request id. Typing in the search box fires a request per keystroke and
  // nothing guarantees they resolve in order, so a slow early response could land last
  // and repaint the table with rows that no longer match the filters. Only the newest
  // request is allowed to write. Every page had this race; fixing it here fixes it once.
  const latest = useRef(0)

  // The fetcher and `t` are new identities every render; the caller's `deps` are the
  // real trigger. Listing them here instead would refetch on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fetcher, deps)

  useEffect(() => {
    const seq = ++latest.current
    setLoading(true)
    run()
      .then(r => {
        if (seq !== latest.current) return
        setRows(r.data ?? [])
        setTotal(r.total ?? 0)
      })
      .catch(e => {
        if (seq !== latest.current) return
        toast.error(t(errorKey, { error: e?.message ?? 'failed to load' }))
      })
      .finally(() => {
        if (seq === latest.current) setLoading(false)
      })
    // `t` is excluded on purpose: switching language must not refire every table's
    // request, and the toast reads the current `t` when it actually fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, nonce])

  // For pages that mutate a row and need the list back (resolve an alert, revoke a
  // session). Stable, so it is safe in a dependency list.
  const reload = useCallback(() => setNonce(n => n + 1), [])

  return { rows, total, loading, reload }
}
