import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import '../../styles/components/pager.css'

interface Props {
  offset: number
  limit: number
  total: number
  onChange: (offset: number) => void
}

/**
 * Prev / range / next for an offset-paged list. Renders nothing when everything
 * fits on one page — a pager under a three-row list is noise.
 *
 * ponytail: no page-number buttons. Two arrows and a range read the same and stay
 * one line at any total; numbered pages need ellipsis logic the moment there are
 * more than a handful.
 */
export default function Pager({ offset, limit, total, onChange }: Props) {
  const { t } = useT()
  if (total <= limit) return null

  const canPrev = offset > 0
  const canNext = offset + limit < total

  return (
    <nav className="pager" aria-label={t('common.pagination')}>
      <button
        type="button"
        className="pager__btn"
        onClick={() => onChange(Math.max(0, offset - limit))}
        disabled={!canPrev}
        aria-label={t('common.pagePrev')}
      >
        <ChevronLeft size={15} strokeWidth={2} />
      </button>
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
        onClick={() => onChange(offset + limit)}
        disabled={!canNext}
        aria-label={t('common.pageNext')}
      >
        <ChevronRight size={15} strokeWidth={2} />
      </button>
    </nav>
  )
}
