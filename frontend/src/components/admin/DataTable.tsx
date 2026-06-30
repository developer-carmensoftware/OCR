import { Fragment, useState } from 'react'

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
  label: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
}

export interface DataTableProps<T = Record<string, unknown>> {
  columns: Column<T>[]
  rows: T[]
  pageSize?: number
  emptyText?: string
  loading?: boolean
  expandedRowId?: string | null
  renderExpandedRow?: (row: T) => React.ReactNode
}

interface ExpandedRowWrapperProps<T> {
  row: T
  renderExpandedRow: (row: T) => React.ReactNode
}

function ExpandedRowWrapper<T>({ row, renderExpandedRow: renderer }: ExpandedRowWrapperProps<T>) {
  return <>{renderer(row)}</>
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
  pageSize = 50,
  emptyText = 'No data',
  loading = false,
  expandedRowId,
  renderExpandedRow,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
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
    : rows

  const total = sorted.length
  const start = page * pageSize
  const paginated = sorted.slice(start, start + pageSize)
  const pages = Math.ceil(total / pageSize)

  const handleSort = (key: string) => {
    if (sortKey === key) setSortAsc(v => !v)
    else {
      setSortKey(key)
      setSortAsc(true)
      setPage(0)
    }
  }

  if (loading) {
    return (
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  className={`admin-th${col.align === 'right' ? ' text-right' : ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
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
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={String(col.key)}
                className={`admin-th${col.sortable ? ' sortable' : ''}${col.align === 'right' ? ' text-right' : ''}`}
                onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
              >
                {col.label}
                {col.sortable && sortKey === String(col.key) && (
                  <span className="sort-icon">{sortAsc ? ' ↑' : ' ↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginated.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="admin-td-empty">
                {emptyText}
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
            {start + 1}–{Math.min(start + pageSize, total)} of {total}
          </span>
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            className="pagination-btn"
          >
            ‹ Prev
          </button>
          <button
            type="button"
            disabled={page >= pages - 1}
            onClick={() => setPage(p => p + 1)}
            className="pagination-btn"
          >
            Next ›
          </button>
        </div>
      )}
    </div>
  )
}
