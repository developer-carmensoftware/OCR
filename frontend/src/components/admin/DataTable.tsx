import { Fragment, useState } from 'react'
import { useT } from '../../i18n/LanguageContext'

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
  emptyText,
  loading = false,
  expandedRowId,
  renderExpandedRow,
}: DataTableProps<T>) {
  // The pagination controls and the empty fallback used to be hardcoded English,
  // so every admin page rendered "‹ Prev / Next › / of" untranslated no matter what
  // the language toggle said. Fixing it here fixes all 11 callers at once.
  const { t } = useT()
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

  // One header for both the loading and the loaded table. Rendering a plainer <th> while
  // loading gave the skeleton different column widths than the data that replaced it.
  const head = (
    <thead>
      <tr>
        {columns.map(col => {
          const isSorted = sortKey === String(col.key)
          return (
            <th
              key={String(col.key)}
              className={`admin-th${col.sortable ? ' sortable' : ''}${col.align === 'right' ? ' text-right' : ''}`}
              aria-sort={
                col.sortable
                  ? isSorted
                    ? sortAsc
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
                      and in an auto-layout table that re-flowed every column per sort click */}
                  <span className="sort-icon" aria-hidden="true">
                    {isSorted ? (sortAsc ? '↑' : '↓') : ''}
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

  if (loading) {
    return (
      <div className="admin-table-wrap">
        <table className="admin-table">
          {head}
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
        {head}
        <tbody>
          {paginated.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="admin-td-empty">
                {emptyText ?? t('admin.common.table.noData')}
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
              to: Math.min(start + pageSize, total),
              total,
            })}
          </span>
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            className="pagination-btn"
          >
            {t('admin.common.table.prev')}
          </button>
          <button
            type="button"
            disabled={page >= pages - 1}
            onClick={() => setPage(p => p + 1)}
            className="pagination-btn"
          >
            {t('admin.common.table.next')}
          </button>
        </div>
      )}
    </div>
  )
}
