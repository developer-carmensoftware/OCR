import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ServerTable, SortDir } from '../../components/admin/DataTable'

/**
 * Filters, sort, and page for one admin table — held in the URL rather than in
 * component state.
 *
 * Every admin page used to keep its filters in `useState`, so leaving the page and
 * coming back reset them, and there was no way to hand a colleague the view you were
 * looking at. `AdminLayout` already routes on `hash.split('?')[0]`, so a query string
 * after the hash was free.
 *
 * Values equal to their default are omitted from the URL — an untouched page keeps a
 * clean `#/admin/llm-logs`.
 */

export interface TableQueryState {
  q: string
  sort: string
  dir: SortDir
  offset: number
  limit: number
}

type Extra = Record<string, string>

const BASE_DEFAULTS = { q: '', dir: 'desc' as SortDir, offset: 0, limit: 25 }

function readHashParams(): URLSearchParams {
  const [, qs = ''] = window.location.hash.split('?')
  return new URLSearchParams(qs)
}

function writeHashParams(params: URLSearchParams) {
  const [path = ''] = window.location.hash.split('?')
  const qs = params.toString()
  const next = qs ? `${path}?${qs}` : path
  if (next === window.location.hash) return
  // replaceState, not assignment: adjusting a filter is not a navigation, and pushing
  // each keystroke would make Back walk letter by letter out of a search box.
  window.history.replaceState(null, '', `${window.location.pathname}${next}`)
}

export interface UseTableQuery<E extends Extra> {
  /** Everything the fetch needs, filters included. */
  params: TableQueryState & E
  /** Patch any subset. Anything other than paging resets to page 1. */
  set: (next: Partial<TableQueryState & E>) => void
  /** Hand straight to `<DataTable server={…} />`. */
  server: (total: number) => ServerTable
  /** True when anything differs from the defaults — drives a "Clear" affordance. */
  dirty: boolean
  reset: () => void
}

export function useTableQuery<E extends Extra>(opts: {
  /** The column the API sorts by when the reader has not chosen one. */
  defaultSort: string
  defaultDir?: SortDir
  /** Page-specific filters (tenant, status, dates…) with their default values. */
  filters?: E
}): UseTableQuery<E> {
  const { defaultSort, defaultDir = 'desc', filters } = opts

  // Frozen on first render: these are literals at every call site, and re-deriving from
  // a fresh object each render would make every dependency below unstable.
  const defaultsRef = useRef({ ...BASE_DEFAULTS, sort: defaultSort, dir: defaultDir, ...filters })
  const defaults = defaultsRef.current

  const [state, setState] = useState(() => {
    const url = readHashParams()
    const restored = { ...defaults } as TableQueryState & E
    for (const key of Object.keys(defaults)) {
      const raw = url.get(key)
      if (raw === null) continue
      const fallback = (defaults as Record<string, unknown>)[key]
      // Numbers stay numbers: `offset` arriving as "25" would make `offset + limit`
      // concatenate into "2525" and page into nowhere.
      ;(restored as Record<string, unknown>)[key] =
        typeof fallback === 'number' ? Number(raw) || 0 : raw
    }
    return restored
  })

  useEffect(() => {
    const params = readHashParams()
    for (const [key, value] of Object.entries(state)) {
      const isDefault = value === (defaults as Record<string, unknown>)[key]
      if (isDefault || value === '' || value == null) params.delete(key)
      else params.set(key, String(value))
    }
    writeHashParams(params)
  }, [state, defaults])

  const set = useCallback((next: Partial<TableQueryState & E>) => {
    setState(prev => {
      // Any change other than moving through pages invalidates the page index: page 4
      // of the old filter has nothing to do with page 4 of the new one.
      const pagingOnly = Object.keys(next).every(k => k === 'offset' || k === 'limit')
      return { ...prev, ...(pagingOnly ? {} : { offset: 0 }), ...next }
    })
  }, [])

  const reset = useCallback(() => setState({ ...defaults } as TableQueryState & E), [defaults])

  const dirty = useMemo(
    () =>
      Object.entries(state).some(
        ([k, v]) =>
          k !== 'offset' && k !== 'limit' && v !== (defaults as Record<string, unknown>)[k]
      ),
    [state, defaults]
  )

  // Hoisted and stable. Inlined into the object below it would be a new function every
  // render, and DataTable's "report my measured page size" effect depends on its
  // identity — it would re-run on every render instead of when the measurement moves.
  const onServerChange = useCallback<ServerTable['onChange']>(
    // The table only ever patches sort/dir/offset/limit — a strict subset of the state
    // — but TS can't see that through the generic filter type.
    next => set(next as Partial<TableQueryState & E>),
    [set]
  )

  const server = useCallback(
    (total: number): ServerTable => ({
      sort: state.sort,
      dir: state.dir,
      offset: state.offset,
      limit: state.limit,
      total,
      onChange: onServerChange,
    }),
    [state.sort, state.dir, state.offset, state.limit, onServerChange]
  )

  return { params: state, set, server, dirty, reset }
}
