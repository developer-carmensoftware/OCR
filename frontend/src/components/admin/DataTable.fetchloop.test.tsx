import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'

/**
 * Regression: server-mode admin pages fetched forever.
 *
 * `useFitRows` derives the page size from the space left below the table, and server
 * mode feeds that size back into the fetch — so 15 rows left room measuring 17, 17 rows
 * left room measuring 15, and every admin page using it alternated
 * `limit=15` / `limit=17` against the API until the tab was closed.
 *
 * jsdom lays nothing out, so the measurement is mocked to reproduce exactly that
 * oscillation. The test asserts the fetching stops.
 */

vi.mock('../../i18n/LanguageContext', () => ({
  useT: () => ({ t: (k: string) => k }),
}))

// The measurement flips with the row count, which is the whole bug.
let renderedRows = 0
vi.mock('../../hooks/useFitRows', () => ({
  useFitRows: () => [renderedRows === 15 ? 17 : 15, () => {}],
}))

const { default: DataTable } = await import('./DataTable')
const { useTableQuery } = await import('../../hooks/admin/useTableQuery')

const columns = [{ key: 'name', label: 'Name', sortable: true }]

function Page({ onFetch }: { onFetch: (limit: number) => void }) {
  const { params, server } = useTableQuery({ defaultSort: 'name', filters: {} })
  const [rows, setRows] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    onFetch(params.limit)
    renderedRows = params.limit
    setRows(Array.from({ length: params.limit }, (_, i) => ({ id: String(i), name: `n${i}` })))
  }, [params, onFetch])

  return <DataTable columns={columns} rows={rows} server={server(99)} />
}

beforeEach(() => {
  renderedRows = 0
  window.location.hash = '#/admin/loop-check'
})

describe('server-mode page size', () => {
  it('settles instead of fetching forever', async () => {
    const onFetch = vi.fn()
    render(<Page onFetch={onFetch} />)

    // Let every queued effect drain. Before the fix this never stopped growing.
    await waitFor(() => expect(onFetch).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 50))
    const settled = onFetch.mock.calls.length

    await new Promise(r => setTimeout(r, 50))
    expect(onFetch.mock.calls.length).toBe(settled)
    // Mount, then at most one correction once the real measurement lands.
    expect(settled).toBeLessThanOrEqual(3)
  })
})
