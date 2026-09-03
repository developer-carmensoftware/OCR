import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import InlineSelect from './InlineSelect'
import { ROWS_PER_PAGE } from '../../hooks/useRowsPerPage'
import '../../styles/components/pager.css'

/** A constant, so it is built once rather than on every render of every table's pager. */
const SIZE_OPTIONS = ROWS_PER_PAGE.map(n => ({ value: String(n), label: String(n) }))

interface Props {
  offset: number
  limit: number
  total: number
  onChange: (offset: number) => void
  /**
   * Present = render the "Rows per page" select. Omit for a list whose size is not the
   * reader's to choose — the notification bell's fixed-height panel, or a table nested
   * inside an expanded row.
   *
   * The handler is expected to reset the offset along with the limit: offset 380 at a
   * new limit of 100 points past the end of a 393-row list. Pager does not do it itself
   * because the two live in one piece of caller state and patching them separately would
   * fire two fetches.
   */
  onLimitChange?: (limit: number) => void
}

/**
 * Rows-per-page / range / prev / next for an offset-paged list. Sized by its container,
 * so the same component sits in the bell dropdown, under a full-width order list, and
 * under every admin table without a variant.
 *
 * ponytail: a native `<select>` and two arrows. No page-number buttons — numbered pages
 * need ellipsis logic the moment there are more than a handful, and a range says the
 * same thing in one line at any total.
 */
export default function Pager({ offset, limit, total, onChange, onLimitChange }: Props) {
  const { t } = useT()
  // Hidden below the smallest option rather than below `limit`: at 20 rows on a 25-row
  // page there are no arrows to press, but "show me 15" is still a choice worth offering.
  // Below 15 no option changes anything, so the whole bar would be furniture.
  if (total <= (onLimitChange ? ROWS_PER_PAGE[0] : limit)) return null

  const canPrev = offset > 0
  const canNext = offset + limit < total

  return (
    <nav className="pager" aria-label={t('common.pagination')}>
      {onLimitChange && (
        <span className="pager__size">
          {t('common.rowsPerPage')}
          {/* `InlineSelect`, not a native <select>: a browser draws the option list itself,
              outside the page, so the app's popover tokens, radius, shadow and hover never
              reached it — the one surface here that was still wearing the OS's design. */}
          <InlineSelect
            className="pager__size-select"
            value={String(limit)}
            onChange={v => onLimitChange(Number(v))}
            options={SIZE_OPTIONS}
            aria-label={t('common.rowsPerPage')}
          />
        </span>
      )}
      <span className="pager__range text-mono">
        {t('common.pageRange', {
          from: offset + 1,
          // Math.min: the last page is usually short, and "25–32 of 30" is nonsense.
          to: Math.min(offset + limit, total),
          total,
        })}
      </span>
      <button
        type="button"
        className="pager__btn"
        onClick={() => onChange(Math.max(0, offset - limit))}
        disabled={!canPrev}
        aria-label={t('common.pagePrev')}
      >
        <ChevronLeft size={15} strokeWidth={2} />
      </button>
      <button
        type="button"
        className="pager__btn"
        onClick={() => onChange(offset + limit)}
        disabled={!canNext}
        aria-label={t('common.pageNext')}
      >
        <ChevronRight size={15} strokeWidth={2} />
      </button>
    </nav>
  )
}
