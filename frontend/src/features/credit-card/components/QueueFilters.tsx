import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react'
import { useT } from '@/i18n/LanguageContext'
import type { TKey } from '@/i18n/dict'
import { BANKS } from '@/shared/constants/banks'
import {
  NO_NARROW,
  type ActivityFilter,
  type QueueNarrow,
  type QueueRange,
  type QueueSource,
} from '@/features/credit-card/api/emailReview'

/**
 * The queue's narrowing, one toolbar row beside the two-chip strip: the search box, a single
 * `+ Filter` button, and — only for what is applied — a chip per attribute (`Bank: KBANK ✕`).
 *
 * The chip is the control and its result at once (Stripe's filter chips, Linear and Polaris's
 * index filters): click its label to change the value, ✕ to drop it. A first cut had a popover
 * of seventeen pills *and* a chip row repeating the choice *and* a badge number — three
 * surfaces for one fact, and three rows above the table. Attributes are listed first and
 * values only after one is picked, so nothing is laid out that was not asked for.
 *
 * Posted / Not posted are the Status attribute, not chips of the strip (§24): they light the
 * All chip, which is where the log lives.
 */

type AttrId = 'status' | 'source' | 'bank' | 'date'

interface Option {
  id: string
  label: string
  /** A second, quieter line of text on the same row — a bank's name beside its code. */
  hint?: string
  /** Why this cannot be picked right now. Set = the row is shown but dead (`aria-disabled`). */
  locked?: string
}

interface Attr {
  id: AttrId
  label: TKey
  /** `multi` keeps the list open and checks; `single` is a radio and closes on pick. */
  kind: 'single' | 'multi'
}

const ATTRS: Attr[] = [
  { id: 'status', label: 'review.filterStatus', kind: 'single' },
  { id: 'source', label: 'review.filterSource', kind: 'multi' },
  { id: 'bank', label: 'review.filterBank', kind: 'single' },
  { id: 'date', label: 'review.filterDate', kind: 'single' },
]

const STATUS_IDS: ActivityFilter[] = ['success', 'unposted']
const isLogStatus = (f: ActivityFilter) => STATUS_IDS.includes(f)

const SEARCH_DEBOUNCE_MS = 300

/** Typing fires one request per keystroke otherwise — `useReviewQueue` refetches on every
 *  change of `narrow`. The box keeps its own text and commits it after a pause. */
export function QueueSearch({ value, onCommit }: { value: string; onCommit: (q: string) => void }) {
  const { t } = useT()
  const [text, setText] = useState(value)

  // The committed value moved without us typing (Clear, the no-match card): follow it.
  useEffect(() => setText(value), [value])

  useEffect(() => {
    if (text.trim() === value) return
    const id = window.setTimeout(() => onCommit(text.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [text, value, onCommit])

  return (
    <label className="rq-search">
      <Search size={14} aria-hidden="true" />
      <input
        type="search"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={t('review.searchPlaceholder')}
        aria-label={t('review.searchLabel')}
        maxLength={100}
      />
    </label>
  )
}

interface BarProps {
  narrow: QueueNarrow
  onChange: (n: QueueNarrow) => void
  /** The page's current filter; only `success` / `unposted` count as the Status attribute. */
  status: ActivityFilter
  onStatus: (f: ActivityFilter) => void
}

/** Where the open menu hangs, and what to give focus back to when it closes. */
interface MenuState {
  /** `null` = the attribute list. */
  attr: AttrId | null
  /** Opened from `+ Filter` (so a value list can go back) rather than from a chip. */
  viaList: boolean
  left: number
  top: number
}

export function FilterBar({ narrow, onChange, status, onStatus }: BarProps) {
  const { t } = useT()
  const root = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)

  const optionsOf = (id: AttrId): Option[] => {
    switch (id) {
      case 'status':
        return [
          { id: 'success', label: t('review.filterSuccess') },
          { id: 'unposted', label: t('review.filterUnposted') },
        ]
      case 'source':
        return [
          { id: 'email', label: t('review.srcEmail') },
          { id: 'manual', label: t('review.srcManual') },
          // A PMS day has no bank: while a bank is set, PMS cannot be added.
          {
            id: 'pms',
            label: t('review.srcPms'),
            locked: narrow.bank ? t('review.pmsLockedByBank') : undefined,
          },
        ]
      case 'bank':
        return BANKS.map(b => ({ id: b.value, label: b.value, hint: b.label }))
      case 'date':
        return [
          { id: '', label: t('review.rangeAny') },
          { id: 'today', label: t('review.rangeToday') },
          { id: '7d', label: t('review.range7d') },
          { id: '30d', label: t('review.range30d') },
        ]
    }
  }

  /** The ids chosen for an attribute — what is checked in its list. */
  const chosen = (id: AttrId): string[] => {
    switch (id) {
      case 'status':
        return isLogStatus(status) ? [status] : []
      case 'source':
        return narrow.sources
      case 'bank':
        return narrow.bank ? [narrow.bank] : []
      case 'date':
        return [narrow.range]
    }
  }

  /** Whether an attribute is applied — `Any time` is the date's "nothing", not a value. */
  const isApplied = (id: AttrId) => (id === 'date' ? narrow.range !== '' : chosen(id).length > 0)
  const applied = ATTRS.filter(a => isApplied(a.id))

  /** `Email, Manual +1`: a chip stays one short line however many are checked. */
  const valueText = (id: AttrId): string => {
    const opts = optionsOf(id)
    const names = chosen(id).map(v => opts.find(o => o.id === v)?.label ?? v)
    return names.length > 2
      ? `${names.slice(0, 2).join(', ')} +${names.length - 2}`
      : names.join(', ')
  }

  const clearAttr = (id: AttrId) => {
    if (id === 'status') onStatus('all')
    else if (id === 'source') onChange({ ...narrow, sources: [] })
    else if (id === 'bank') onChange({ ...narrow, bank: '' })
    else onChange({ ...narrow, range: '' })
  }

  /** The Bank attribute is dead while PMS is a source — the other end of the same lock. */
  const attrLock = (id: AttrId): string | undefined =>
    id === 'bank' && narrow.sources.includes('pms') ? t('review.bankLockedByPms') : undefined

  const pick = (id: AttrId, value: string) => {
    // Belt and braces: the rows are dead while locked, but a lock that lives only in the markup
    // is one refactor from leaking, and the API would answer 400 to what got through.
    if (id === 'source' && value === 'pms' && narrow.bank) return
    if (id === 'bank' && narrow.sources.includes('pms')) return
    if (id === 'status') {
      onStatus(status === value ? 'all' : (value as ActivityFilter))
    } else if (id === 'source') {
      const v = value as QueueSource
      onChange({
        ...narrow,
        sources: narrow.sources.includes(v)
          ? narrow.sources.filter(s => s !== v)
          : [...narrow.sources, v],
      })
    } else if (id === 'bank') {
      onChange({ ...narrow, bank: narrow.bank === value ? '' : value })
    } else {
      onChange({ ...narrow, range: value as QueueRange })
    }
  }

  const close = (restoreFocus: boolean) => {
    setMenu(null)
    if (restoreFocus) opener.current?.focus()
  }

  const openAt = (el: HTMLElement, attr: AttrId | null, viaList: boolean) => {
    const box = root.current!.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    opener.current = el
    setMenu({ attr, viaList, left: r.left - box.left, top: r.bottom - box.top + 6 })
  }

  // Outside click closes; Escape closes and hands focus back to where it came from.
  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(null)
        opener.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  // A menu that opens must take focus, or the keyboard has nowhere to start: the checked
  // item of a value list, else the first.
  const level = menu ? (menu.attr ?? 'list') : null
  useLayoutEffect(() => {
    if (!level || !menuRef.current) return
    const items = [
      ...menuRef.current.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled])'),
    ]
    ;(items.find(i => i.getAttribute('aria-checked') === 'true') ?? items[0])?.focus()
  }, [level])

  const onMenuKey = (e: React.KeyboardEvent) => {
    // A dead row is not a stop: Arrow keys step over it, so focus never lands on a dead end.
    const items = [
      ...menuRef.current!.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled])'),
    ]
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') items[(i + 1) % items.length]?.focus()
    else if (e.key === 'ArrowUp') items[(i - 1 + items.length) % items.length]?.focus()
    else if ((e.key === 'ArrowLeft' || e.key === 'Backspace') && menu?.attr && menu.viaList)
      setMenu({ ...menu, attr: null })
    else return
    e.preventDefault()
  }

  const clearAll = () => {
    onChange({ ...NO_NARROW, q: narrow.q })
    if (isLogStatus(status)) onStatus('all')
  }

  const attrOf = menu?.attr ? ATTRS.find(a => a.id === menu.attr)! : null

  return (
    <div className="rq-find" ref={root}>
      <QueueSearch value={narrow.q} onCommit={q => onChange({ ...narrow, q })} />

      <button
        type="button"
        className="btn btn-outline rq-addfilter"
        aria-haspopup="menu"
        aria-expanded={menu?.viaList === true}
        onClick={e => (menu?.viaList ? close(false) : openAt(e.currentTarget, null, true))}
      >
        <Plus size={14} aria-hidden="true" />
        {t('review.filtersButton')}
      </button>

      {applied.length > 0 && (
        <div className="rq-chips" role="group" aria-label={t('review.activeFilters')}>
          {applied.map(a => {
            const name = `${t(a.label)}: ${valueText(a.id)}`
            return (
              <span key={a.id} className="rq-chip">
                <button
                  type="button"
                  className="rq-chip-main"
                  aria-haspopup="menu"
                  onClick={e => openAt(e.currentTarget, a.id, false)}
                  onKeyDown={e => {
                    if (e.key === 'Backspace' || e.key === 'Delete') clearAttr(a.id)
                  }}
                >
                  <span className="rq-chip-k">{t(a.label)}:</span> {valueText(a.id)}
                </button>
                <button
                  type="button"
                  className="rq-chip-x"
                  onClick={() => clearAttr(a.id)}
                  aria-label={t('review.removeFilter', { name })}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            )
          })}
          <button type="button" className="rq-clear" onClick={clearAll}>
            {t('review.clearAll')}
          </button>
        </div>
      )}

      {menu && (
        <div
          ref={menuRef}
          className="rq-menu"
          style={{ left: menu.left, top: menu.top }}
          onKeyDown={onMenuKey}
        >
          {/* The way back sits OUTSIDE the `role="menu"` below, as does the note at the bottom:
              a menu may only contain menu items (axe: aria-required-children, critical), and a
              back button that is not an item nor a paragraph of help text is neither. Its name
              starts with the visible title, so the spoken name contains what is on screen
              (label-content-name-mismatch). */}
          {attrOf && menu.viaList && (
            <button
              type="button"
              className="rq-menu-head"
              onClick={() => setMenu({ ...menu, attr: null })}
              aria-label={`${t(attrOf.label)} – ${t('review.back')}`}
            >
              <ChevronLeft size={14} aria-hidden="true" />
              {t(attrOf.label)}
            </button>
          )}
          <div role="menu" aria-label={attrOf ? t(attrOf.label) : t('review.filtersTitle')}>
            {!attrOf &&
              ATTRS.map(a => {
                const lock = attrLock(a.id)
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="menuitem"
                    className="rq-menuitem"
                    aria-disabled={lock ? true : undefined}
                    title={lock}
                    onClick={() => {
                      if (!lock) setMenu({ ...menu, attr: a.id, viaList: true })
                    }}
                  >
                    <span>{t(a.label)}</span>
                    <span className="rq-menu-r">
                      {lock ? (
                        <span className="rq-menu-lock">{lock}</span>
                      ) : (
                        <>
                          {isApplied(a.id) && <span className="rq-menu-v">{valueText(a.id)}</span>}
                          <ChevronRight size={14} aria-hidden="true" />
                        </>
                      )}
                    </span>
                  </button>
                )
              })}

            {attrOf && (
              <>
                {optionsOf(attrOf.id).map(o => {
                  const on = chosen(attrOf.id).includes(o.id)
                  return (
                    <button
                      key={o.id || 'any'}
                      type="button"
                      role={attrOf.kind === 'multi' ? 'menuitemcheckbox' : 'menuitemradio'}
                      aria-checked={on}
                      aria-disabled={o.locked ? true : undefined}
                      title={o.locked}
                      className="rq-menuitem"
                      onClick={() => {
                        if (o.locked) return
                        pick(attrOf.id, o.id)
                        if (attrOf.kind === 'single') close(true)
                      }}
                    >
                      <span>
                        {o.label}
                        {o.hint && <span className="rq-menu-hint"> {o.hint}</span>}
                      </span>
                      {o.locked && (
                        <>
                          {' '}
                          <span className="rq-menu-lock">{o.locked}</span>
                        </>
                      )}
                      {on && <Check size={14} aria-hidden="true" />}
                    </button>
                  )
                })}
              </>
            )}
          </div>
          {/* Said where the choice is made, not after: a PMS day vanishing from the list when a
              bank is picked reads as a bug. */}
          {attrOf?.id === 'bank' && <p className="rq-menu-note">{t('review.bankNoPms')}</p>}
        </div>
      )}
    </div>
  )
}
