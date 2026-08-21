import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// The sort arrow used to render only on the sorted column. `.admin-table` is
// auto-layout, so that glyph appearing widened the cell and re-flowed every column
// in the table on each sort click. The slot is now always present and sized in CSS;
// what a refactor would quietly break is the empty span, so it gets pinned here.

vi.mock('../../i18n/LanguageContext', () => ({
  useT: () => ({ t: (k: string) => k }),
}))

const { default: DataTable } = await import('./DataTable')

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'code', label: 'Code', sortable: true },
]
const rows = [
  { id: '1', name: 'b', code: 'x' },
  { id: '2', name: 'a', code: 'y' },
]

const many = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: String(i), name: `n${i}`, code: `c${i}` }))

describe('DataTable sort-icon slot', () => {
  it('renders one slot per sortable column, sorted or not', () => {
    const { container } = render(<DataTable columns={columns} rows={rows} />)
    expect(container.querySelectorAll('.sort-icon')).toHaveLength(2)
    // nothing sorted yet, so every slot is empty but present
    container.querySelectorAll('.sort-icon').forEach(el => expect(el.textContent).toBe(''))

    fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(container.querySelectorAll('.sort-icon')).toHaveLength(2)
    expect(container.querySelectorAll('.sort-icon')[0].textContent).toBe('↑')
    expect(container.querySelectorAll('.sort-icon')[1].textContent).toBe('')
  })

  it('keeps the same header markup while loading, so the skeleton measures the same', () => {
    const { container: busy } = render(<DataTable columns={columns} rows={[]} loading />)
    const { container: done } = render(<DataTable columns={columns} rows={rows} />)
    // `disabled` is the one intended difference — it changes behaviour, not geometry.
    const head = (c: HTMLElement) =>
      c.querySelector('thead')!.innerHTML.replace(/ disabled=""/g, '')
    expect(head(busy)).toBe(head(done))
  })
})

describe('DataTable paging', () => {
  // jsdom lays nothing out, so useFitRows never measures and falls back to 7 rows.
  // That fallback is what these assert against; the measurement itself is covered in
  // useFitRows.test.ts.
  it('pages by the measured row count when no pageSize is given', () => {
    const { container } = render(<DataTable columns={columns} rows={many(20)} />)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(7)
  })

  it('an explicit pageSize still wins — nested tables are not viewport-bound', () => {
    const { container } = render(<DataTable columns={columns} rows={many(20)} pageSize={3} />)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3)
  })

  it('clamps a page index left past the end instead of rendering a blank table', () => {
    const { container, rerender } = render(
      <DataTable columns={columns} rows={many(20)} pageSize={2} />
    )
    // walk to the last page (10 pages of 2)
    for (let i = 0; i < 9; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'admin.common.table.next' }))
    }
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)

    // A resize grows the page size: page 9 no longer exists.
    rerender(<DataTable columns={columns} rows={many(20)} pageSize={10} />)
    const cells = container.querySelectorAll('tbody tr')
    expect(cells.length).toBeGreaterThan(0)
    expect(cells).toHaveLength(10)
  })

  it('hides the pager when everything fits on one page', () => {
    render(<DataTable columns={columns} rows={rows} />)
    expect(screen.queryByRole('button', { name: 'admin.common.table.next' })).toBeNull()
  })
})
