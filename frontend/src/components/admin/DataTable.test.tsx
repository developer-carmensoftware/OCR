import { describe, it, expect, vi, beforeEach } from 'vitest'
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
    // Nothing sorted yet: every slot holds the idle ⇅ and is marked as such. The slot
    // used to be blank, which left hover as the only clue a column could sort at all.
    container.querySelectorAll('.sort-icon').forEach(el => {
      expect(el.textContent).toBe('⇅')
      expect(el.className).toContain('sort-icon--idle')
    })

    fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(container.querySelectorAll('.sort-icon')).toHaveLength(2)
    expect(container.querySelectorAll('.sort-icon')[0].textContent).toBe('↑')
    expect(container.querySelectorAll('.sort-icon')[0].className).not.toContain('idle')
    expect(container.querySelectorAll('.sort-icon')[1].textContent).toBe('⇅')
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
  beforeEach(() => localStorage.clear())

  it('pages by the stored rows-per-page when no pageSize is given', () => {
    localStorage.setItem('rowsPerPage', '25')
    const { container } = render(<DataTable columns={columns} rows={many(40)} />)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(25)
  })

  it('falls back to 15 when nothing is stored', () => {
    const { container } = render(<DataTable columns={columns} rows={many(40)} />)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(15)
  })

  it('an explicit pageSize still wins, and hides the size control with it', () => {
    const { container } = render(<DataTable columns={columns} rows={many(20)} pageSize={3} />)
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3)
    // A nested table's size is not the reader's to pick.
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('choosing a size repages, and remembers the choice', () => {
    const { container } = render(<DataTable columns={columns} rows={many(40)} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '25' } })
    expect(container.querySelectorAll('tbody tr')).toHaveLength(25)
    expect(localStorage.getItem('rowsPerPage')).toBe('25')
  })

  it('clamps a page index left past the end instead of rendering a blank table', () => {
    const { container, rerender } = render(
      <DataTable columns={columns} rows={many(20)} pageSize={2} />
    )
    // walk to the last page (10 pages of 2)
    for (let i = 0; i < 9; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'common.pageNext' }))
    }
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)

    // A bigger page size: page 9 no longer exists.
    rerender(<DataTable columns={columns} rows={many(20)} pageSize={10} />)
    const cells = container.querySelectorAll('tbody tr')
    expect(cells.length).toBeGreaterThan(0)
    expect(cells).toHaveLength(10)
  })

  it('hides the pager entirely below the smallest size — no option would change anything', () => {
    render(<DataTable columns={columns} rows={rows} />)
    expect(screen.queryByRole('button', { name: 'common.pageNext' })).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('keeps the rows it has while a later page loads, rather than flashing skeletons', () => {
    const { container } = render(<DataTable columns={columns} rows={rows} loading />)
    expect(container.querySelectorAll('.skeleton-row')).toHaveLength(0)
    expect(container.querySelector('table')).toHaveAttribute('aria-busy', 'true')

    // The very first load has nothing to keep, so it still gets skeletons.
    const first = render(<DataTable columns={columns} rows={[]} loading />)
    expect(first.container.querySelectorAll('.skeleton-row').length).toBeGreaterThan(0)
  })
})

describe('DataTable first-click sort direction', () => {
  // Ascending-first meant every "Time" column opened on the oldest row in the range and
  // every amount column on the smallest — two clicks to see what you came for.
  const withGrain = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'when', label: 'When', sortable: true, defaultDesc: true },
    { key: 'cost', label: 'Cost', sortable: true, align: 'right' as const },
  ]

  const firstClickDir = (name: RegExp) => {
    const onChange = vi.fn()
    render(
      <DataTable
        columns={withGrain}
        rows={[]}
        server={{ sort: null, dir: 'desc', offset: 0, limit: 7, total: 0, onChange }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name }))
    return onChange.mock.calls.find(c => c[0].dir)?.[0].dir
  }

  it('opens a text column ascending', () => {
    expect(firstClickDir(/Name/)).toBe('asc')
  })

  it('opens a date column newest-first', () => {
    expect(firstClickDir(/When/)).toBe('desc')
  })

  it('opens a right-aligned amount biggest-first without needing defaultDesc', () => {
    expect(firstClickDir(/Cost/)).toBe('desc')
  })
})

describe('DataTable client-side search', () => {
  // Only Credit Orders had a search box before, and it matched the company name alone.
  // Client mode filters what is already in hand; the paged tables send `q` to Postgres.
  const people = [
    { id: '1', name: 'Carmen Cloud', code: 'CC-1' },
    { id: '2', name: 'Pilot BU', code: 'PB-9' },
  ]

  const searched = (value: string) =>
    render(
      <DataTable columns={columns} rows={people} search={{ value, onChange: () => {} }} />
    ).container.querySelectorAll('tbody tr')

  it('matches across every visible column, not just the first', () => {
    expect(searched('PB-9')).toHaveLength(1)
    expect(searched('Carmen')).toHaveLength(1)
  })

  it('ignores case and surrounding space', () => {
    expect(searched('  carmen  ')).toHaveLength(1)
  })

  it('an empty box is not a filter', () => {
    expect(searched('')).toHaveLength(2)
  })

  it('says the search matched nothing rather than reusing the empty-table copy', () => {
    // "No LLM calls yet" would be a lie when the table has rows the search excluded.
    render(
      <DataTable
        columns={columns}
        rows={people}
        emptyText="nothing here at all"
        search={{ value: 'zzz', onChange: () => {} }}
      />
    )
    expect(screen.getByText('admin.common.table.noMatch')).toBeTruthy()
    expect(screen.queryByText('nothing here at all')).toBeNull()
  })

  it('leaves the rows alone in server mode — the API already answered', () => {
    const { container } = render(
      <DataTable
        columns={columns}
        rows={people}
        search={{ value: 'zzz', onChange: () => {} }}
        server={{ sort: null, dir: 'desc', offset: 0, limit: 7, total: 2, onChange: vi.fn() }}
      />
    )
    // Filtering here would hide rows Postgres deliberately matched.
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
  })
})

describe('DataTable server mode', () => {
  const serverRows = [
    { id: '1', name: 'b', code: 'x' },
    { id: '2', name: 'a', code: 'y' },
  ]

  it('renders the window as given — re-sorting it here would undo the server order', () => {
    const onChange = vi.fn()
    const { container } = render(
      <DataTable
        columns={columns}
        rows={serverRows}
        server={{ sort: 'name', dir: 'asc', offset: 0, limit: 7, total: 99, onChange }}
      />
    )
    // 'b' before 'a': the API said so. Client-side sort would have swapped them and
    // ordered one page against itself.
    const cells = container.querySelectorAll('tbody tr td:first-child')
    expect([cells[0].textContent, cells[1].textContent]).toEqual(['b', 'a'])
  })

  it('pages off the server total, not the row count', () => {
    const onChange = vi.fn()
    render(
      <DataTable
        columns={columns}
        rows={serverRows}
        server={{ sort: null, dir: 'desc', offset: 0, limit: 7, total: 99, onChange }}
      />
    )
    // Two rows on screen, 99 behind them — the pager has to exist.
    fireEvent.click(screen.getByRole('button', { name: 'common.pageNext' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ offset: 7 }))
  })

  it('takes its size from the server state — that is what the rows were fetched with', () => {
    const onChange = vi.fn()
    localStorage.setItem('rowsPerPage', '15')
    render(
      <DataTable
        columns={columns}
        rows={serverRows}
        server={{ sort: null, dir: 'desc', offset: 0, limit: 50, total: 99, onChange }}
      />
    )
    expect(screen.getByRole('combobox')).toHaveValue('50')
    // And it reports nothing on its own — the old measuring version pushed a limit up
    // on mount, which is what let the measurement and the fetch chase each other.
    expect(onChange).not.toHaveBeenCalled()
  })

  it('a new size goes up with offset 0 in ONE patch', () => {
    const onChange = vi.fn()
    render(
      <DataTable
        columns={columns}
        rows={serverRows}
        server={{ sort: null, dir: 'desc', offset: 80, limit: 15, total: 99, onChange }}
      />
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '50' } })
    // Both halves together: offset 80 at limit 50 points past the end, and two patches
    // would be two fetches to reach one page.
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ limit: 50, offset: 0 })
  })

  it('a sort click sends the reader back to page 1', () => {
    const onChange = vi.fn()
    render(
      <DataTable
        columns={columns}
        rows={serverRows}
        server={{ sort: 'name', dir: 'asc', offset: 70, limit: 7, total: 99, onChange }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Code/ }))
    expect(onChange).toHaveBeenCalledWith({ sort: 'code', dir: 'asc', offset: 0 })
  })
})
