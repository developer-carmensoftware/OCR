import { Fragment, useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import { useFitRows } from '../../hooks/useFitRows'

const SKELETON_WIDTHS = [
  'sk-w-72',
  'sk-w-55',
  'sk-w-85',
  'sk-w-60',
  'sk-w-78',
  'sk-w-50',
  'sk-w-68',
  'sk-w-80',
]

export interface Column<T> {
  key: keyof T | string
  label: React.ReactNode
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  /** First click sorts descending. Implied by `align: 'right'` (nobody opens an amount
   *  column smallest-first); set it explicitly on date columns, which are left-aligned
   *  but still want newest first. */
  defaultDesc?: boolean
}

export type SortDir = 'asc' | 'desc'

/**
 * Sorting and paging handled by the API rather than in the browser.
 *
 * Client-side sorting can only order the rows that were fetched, so on a capped
 * endpoint "highest cost" silently means "highest cost among the last 200 by time".
 * When this prop is present the local sort/slice is skipped entirely: `rows` is the
 * window, `total` is the truth, and header clicks go back to the server.
 */
export interface ServerTable {
  sort: string | null
  dir: SortDir
  offset: number
  /** Rows per page. Measured here and reported back through `onChange`. */
  limit: number
  total: number
  onChange: (next: Partial<{ sort: string; dir: SortDir; offset: number; limit: number }>) => void
}

export interface DataTableProps<T = Record<string, unknown>> {
  columns: Column<T>[]
  rows: T[]
  /** Fixed rows per page. Omit to fit the viewport — only pass it for a table that is
   *  not viewport-bound, such as one nested inside an expanded row. */
  pageSize?: number
  emptyText?: string
  loading?: boolean
  expandedRowId?: string | null
  renderExpandedRow?: (row: T) => React.ReactNode
  /** Present = the API sorts and pages. Absent = today's in-browser behaviour. */
  server?: ServerTable
  /** Renders a search box above the table. Server-side when `server` is set. */
  search?: { value: string; onChange: (q: string) => void; placeholder?: string }
}

interface ExpandedRowWrapperProps<T> {
  row: T
  renderExpandedRow: (row: T) => React.ReactNode
}

function ExpandedRowWrapper<T>({ row, renderExpandedRow: renderer }: ExpandedRowWrapperProps<T>) {
  return <>{renderer(row)}</>
}

const SEARCH_DEBOUNCE_MS = 300

/**
 * Local state for instant typing, debounced upward — in server mode every commit is a
 * request, and firing one per keystroke turns "carmen" into six round trips.
 */
function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (q: string) => void
  placeholder: string
}) {
  const [local, setLocal] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The parent can reset the query (a "clear filters" button, a restored URL). Follow it,
  // but never mid-typing: that would fight the reader for the caret.
  useEffect(() => {
    if (timer.current === null) setLocal(value)
  }, [value])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  return (
    <div className="admin-table-search">
      <Search size={14} aria-hidden="true" />
      <input
        type="search"
        value={local}
        onChange={e => {
          const next = e.target.value
          setLocal(next)
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => {
            timer.current = null
            onChange(next)
          }, SEARCH_DEBOUNCE_MS)
        }}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  )
}

function getCell(row: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((obj, k) => {
    if (obj && typeof obj === 'object') return (obj as Record<string, unknown>)[k]
    return undefined
  }, row)
}

export default function DataTable<T = Record<string, unknown>>({
  columns,
  rows,
  pageSize,
  emptyText,
  loading = false,
  expandedRowId,
  renderExpandedRow,
  server,
  search,
}: DataTableProps<T>) {
  // The pagination controls and the empty fallback used to be hardcoded English,
  // so every admin page rendered "‹ Prev / Next › / of" untranslated no matter what
  // the language toggle said. Fixing it here fixes all 11 callers at once.
  const { t } = useT()
  // Rows per page is measured off the rendered table, not decided here: a laptop and a
  // 4K panel should not both get 50. An explicit `pageSize` still wins — see the prop.
  const [fits, bodyRef] = useFitRows('tr', 7)
  const perPage = pageSize ?? fits
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  // In server mode the fetch needs the page size, and only this component can measure
  // it. Report it up; the parent refetches when it changes.
  //
  // Only ever report a LARGER measurement than the last one for this viewport, because
  // the measurement and the row count feed each other: useFitRows derives the count
  // from the space left below the table, so fetching 15 rows leaves room that measures
  // as 17, and fetching 17 leaves room that measures as 15. Reporting both directions
  // made every server-mode page fetch forever, alternating limit=15 and limit=17.
  //
  // Page size follows the *viewport*, so a real resize resets the high-water mark and
  // the table re-measures from scratch. A shrink caused by our own rows is ignored,
  // which is what makes the sequence monotonic and therefore terminating.
  const onServerChange = server?.onChange
  const serverLimit = server?.limit
  const fitted = useRef({ viewport: '', limit: 0 })
  useEffect(() => {
    if (!onServerChange) return
    const viewport = `${window.innerWidth}x${window.innerHeight}`
    if (fitted.current.viewport !== viewport) fitted.current = { viewport, limit: 0 }
    if (perPage <= fitted.current.limit) return
    fitted.current.limit = perPage
    if (serverLimit !== perPage) onServerChange({ limit: perPage })
  }, [onServerChange, serverLimit, perPage])

  const activeSort = server ? server.sort : sortKey
  const activeAsc = server ? server.dir === 'asc' : sortAsc

  // Client mode only — in server mode `q` went out with the fetch and `rows` is already
  // the answer. Matches the raw cell values, so it finds what a `render` may have
  // reformatted (a date shows as DD/MM/YYYY but is stored ISO).
  // ponytail: substring over the visible columns, no fuzzy matching and no index. These
  // tables hold at most a few hundred complete rows; the ones that truncate are on the
  // server path, where Postgres does the matching.
  const needle = !server && search?.value ? search.value.trim().toLowerCase() : ''
  const matched = needle
    ? rows.filter(row =>
        columns.some(col => {
          const v = getCell(row, String(col.key))
          return v != null && String(v).toLowerCase().includes(needle)
        })
      )
    : rows

  // Server mode: `rows` IS the window, already ordered. Touching it here would re-sort
  // one page against itself and undo the whole point.
  const sorted =
    server || !sortKey
      ? matched
      : [...matched].sort((a, b) => {
          const av = getCell(a, sortKey)
          const bv = getCell(b, sortKey)
          if (av === bv) return 0
          const cmp =
            av === null || av === undefined
              ? -1
              : bv === null || bv === undefined
                ? 1
                : av < bv
                  ? -1
                  : 1
          return sortAsc ? cmp : -cmp
        })

  const total = server ? server.total : sorted.length
  const pages = Math.ceil(total / perPage)
  // A resize can make the current page index point past the end (fewer, taller pages);
  // clamp rather than render a blank table the reader has to click their way out of.
  const safePage = server
    ? Math.floor(server.offset / Math.max(1, perPage))
    : Math.min(page, Math.max(0, pages - 1))
  const start = safePage * perPage
  const paginated = server ? sorted : sorted.slice(start, start + perPage)

  const goToPage = (next: number) => {
    if (server) server.onChange({ offset: next * perPage })
    else setPage(next)
  }

  const handleSort = (key: string) => {
    // First click follows the column's own grain: amounts and dates open at the top.
    // Ascending-first meant every "Time" column opened on the oldest row in the range.
    const col = columns.find(c => String(c.key) === key)
    const firstAsc = !(col?.defaultDesc || col?.align === 'right')
    const nextAsc = activeSort === key ? !activeAsc : firstAsc
    if (server) {
      server.onChange({ sort: key, dir: nextAsc ? 'asc' : 'desc', offset: 0 })
      return
    }
    setSortKey(key)
    setSortAsc(nextAsc)
    setPage(0)
  }

  // One header for both the loading and the loaded table. Rendering a plainer <th> while
  // loading gave the skeleton different column widths than the data that replaced it.
  const head = (
    <thead>
      <tr>
        {columns.map(col => {
          const isSorted = activeSort === String(col.key)
          return (
            <th
              key={String(col.key)}
              className={`admin-th${col.sortable ? ' sortable' : ''}${col.align === 'right' ? ' text-right' : ''}`}
              aria-sort={
                col.sortable
                  ? isSorted
                    ? activeAsc
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                  : undefined
              }
            >
              {col.sortable ? (
                <button
                  type="button"
                  className="admin-th-sort"
                  onClick={() => handleSort(String(col.key))}
                  disabled={loading}
                >
                  {col.label}
                  {/* always rendered: the arrow used to appear only on the sorted column,
                      and in an auto-layout table that re-flowed every column per sort click.
                      Unsorted columns show a dimmed ⇅ — the slot used to be blank, so the
                      only clue a column could sort at all was a hover state, which a
                      tablet never produces. */}
                  <span
                    className={`sort-icon${isSorted ? '' : ' sort-icon--idle'}`}
                    aria-hidden="true"
                  >
                    {isSorted ? (activeAsc ? '↑' : '↓') : '⇅'}
                  </span>
                </button>
              ) : (
                col.label
              )}
            </th>
          )
        })}
      </tr>
    </thead>
  )

  // Rendered in both branches, never inside the loading early-return: with server-side
  // search every keystroke refetches, and an input that unmounts mid-fetch loses focus
  // after the first character.
  const toolbar = search ? (
    <div className="admin-table-toolbar">
      <SearchBox
        value={search.value}
        onChange={search.onChange}
        placeholder={search.placeholder ?? t('admin.common.table.searchPlaceholder')}
      />
    </div>
  ) : null

  if (loading) {
    return (
      <div className="admin-table-wrap">
        {toolbar}
        <table className="admin-table">
          {head}
          <tbody ref={bodyRef}>
            {Array.from({ length: 7 }).map((_, i) => (
              <tr key={i} className="admin-tr skeleton-row" role="presentation">
                {columns.map((col, j) => (
                  <td
                    key={String(col.key)}
                    className={`admin-td${col.align === 'right' ? ' text-right' : ''}`}
                    role="presentation"
                  >
                    <span
                      className={`skeleton skeleton-cell ${SKELETON_WIDTHS[(i + j) % SKELETON_WIDTHS.length]}`}
                    />
                    {null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="admin-table-wrap">
      {toolbar}
      <table className="admin-table">
        {head}
        <tbody ref={bodyRef}>
          {paginated.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="admin-td-empty">
                {/* A search that matched nothing is not the same news as an empty table,
                    and the caller's `emptyText` ("No LLM calls yet") would be a lie. */}
                {search?.value
                  ? t('admin.common.table.noMatch', { q: search.value })
                  : (emptyText ?? t('admin.common.table.noData'))}
              </td>
            </tr>
          ) : (
            paginated.map((row, i) => {
              const rowId = (row as { id?: string }).id
              const isExpanded = expandedRowId != null && rowId === expandedRowId
              return (
                <Fragment key={rowId ?? i}>
                  <tr className={`admin-tr${isExpanded ? ' admin-tr--expanded' : ''}`}>
                    {columns.map(col => (
                      <td
                        key={String(col.key)}
                        className={`admin-td${col.align === 'right' ? ' text-right' : ''}`}
                      >
                        {col.render
                          ? col.render(row)
                          : String(getCell(row, String(col.key)) ?? '—')}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && renderExpandedRow && (
                    <tr className="admin-tr-expanded">
                      <td colSpan={columns.length} className="admin-td-expanded">
                        <ExpandedRowWrapper row={row} renderExpandedRow={renderExpandedRow} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })
          )}
        </tbody>
      </table>

      {pages > 1 && (
        <div className="admin-table-pagination">
          <span className="pagination-info">
            {t('admin.common.table.range', {
              from: start + 1,
              to: Math.min(start + perPage, total),
              total,
            })}
          </span>
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => goToPage(safePage - 1)}
            className="pagination-btn"
          >
            {t('admin.common.table.prev')}
          </button>
          <button
            type="button"
            disabled={safePage >= pages - 1}
            onClick={() => goToPage(safePage + 1)}
            className="pagination-btn"
          >
            {t('admin.common.table.next')}
          </button>
        </div>
      )}
    </div>
  )
}
