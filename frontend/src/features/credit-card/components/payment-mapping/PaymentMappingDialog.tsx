import { useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Info, Search, X } from 'lucide-react'
import AISuggestBar from '@/shared/components/common/AISuggestBar'
import { useT } from '@/i18n/LanguageContext'
import type {
  MasterAccount,
  MasterDepartment,
} from '@/features/credit-card/hooks/mapping/useMappingData'
import BulkApplyBar from './BulkApplyBar'
import MappingTable from './MappingTable'
import { STATUS_RANK, statsOf, statusOf, type MappingItem, type MappingSet } from './types'
import '@/styles/components/payment-modal.css'

/**
 * "Which account does each payment type post to" — one dialog for every bank and every
 * document type.
 *
 * It renders the `MappingSet`s it is given (`hooks/mapping/mappingSets.ts` builds them)
 * and holds only view state: which set, what filter, what search, what is selected. The
 * edits themselves go straight to the set's callbacks, and the draft semantics — Cancel
 * puts every set back as it was when the dialog opened — are the caller's `onCancel`.
 *
 * Patterns taken from SaaS mapping screens (A2X, Brex, Ramp, Polaris IndexTable):
 *  - one list, one progress count, one AI button and one message per set;
 *  - rows needing a person first, and they stay where they are while being edited — the
 *    order is fixed when the dialog opens, and the "Needs mapping" filter keeps the rows
 *    it matched until the filter changes, so mapping a row does not make it vanish from
 *    under the cursor;
 *  - bulk apply for the rows that share an account;
 *  - colour means state (amber = needs mapping, red = only a pair Carmen will refuse), and
 *    the state is always words as well;
 *  - Remove is undone from a toast rather than confirmed up front (the Gmail/Linear
 *    pattern, and AP invoice's `removeItemWithUndo`): a confirm on every remove trains
 *    people to click through it, and Cancel is no undo — it throws away every other edit.
 */

type Filter = 'all' | 'attention' | 'suggested'

interface Props {
  open: boolean
  sets: MappingSet[]
  /** Who this is for, e.g. the bank code. Shown before the set's label. */
  context: string
  masterAccounts: MasterAccount[]
  masterDepartments: MasterDepartment[]
  loadingOpts: boolean
  onCancel: () => void
  onDone: () => void
}

/** Codes in the order a person should see them: worst state, then what is on the scan
 *  in front of them, then the order the set had. */
function orderOf(items: MappingItem[], departments: MasterDepartment[]): string[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        STATUS_RANK[statusOf(a.item, departments)] - STATUS_RANK[statusOf(b.item, departments)] ||
        Number(!a.item.onDocument) - Number(!b.item.onDocument) ||
        a.index - b.index
    )
    .map(({ item }) => item.code)
}

export default function PaymentMappingDialog({
  open,
  sets,
  context,
  masterAccounts,
  masterDepartments,
  loadingOpts,
  onCancel,
  onDone,
}: Props) {
  const { t } = useT()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [order, setOrder] = useState<Record<string, string[]>>({})
  const [filter, setFilter] = useState<Filter>('all')
  // The codes the current filter matched when it was chosen — see the header comment.
  const [filterCodes, setFilterCodes] = useState<Set<string> | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [attemptedDone, setAttemptedDone] = useState(false)
  // Undo toasts this dialog raised. They go when it closes: an Undo pressed after Cancel
  // or Done would change rows nobody can see any more.
  const undoToasts = useRef<Array<string | number>>([])

  const active = sets.find(s => s.id === activeId) ?? sets[0]

  // Fresh view state every time the dialog opens; the order is taken now and kept.
  useEffect(() => {
    if (!open) return
    setActiveId(sets[0]?.id ?? null)
    setOrder(Object.fromEntries(sets.map(s => [s.id, orderOf(s.items, masterDepartments)])))
    setFilter('all')
    setFilterCodes(null)
    setSearch('')
    setSelected(new Set())
    setAttemptedDone(false)
    dialogRef.current?.focus()
    // Only on the open edge — re-ordering on every edit is exactly what this avoids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (open) return
    undoToasts.current.forEach(id => toast.dismiss(id))
    undoToasts.current = []
  }, [open])

  const stats = useMemo(
    () => (active ? statsOf(active, masterDepartments) : null),
    [active, masterDepartments]
  )

  const visible = useMemo(() => {
    if (!active) return []
    const byCode = new Map(active.items.map(i => [i.code, i]))
    const known = order[active.id] ?? []
    const knownSet = new Set(known)
    // Rows added since the dialog opened go last, in the order they were added.
    let list = [
      ...known.filter(c => byCode.has(c)).map(c => byCode.get(c) as MappingItem),
      ...active.items.filter(i => !knownSet.has(i.code)),
    ]
    if (filter !== 'all' && filterCodes) {
      list = list.filter(i => filterCodes.has(i.code) || !knownSet.has(i.code))
    }
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(i => i.code.toLowerCase().includes(q))
    return list
  }, [active, order, filter, filterCodes, search])

  if (!open || !active || !stats) return null

  const chooseFilter = (next: Filter, set: MappingSet = active) => {
    setFilter(next)
    setSelected(new Set())
    if (next === 'all') {
      setFilterCodes(null)
      return
    }
    setFilterCodes(
      new Set(
        set.items
          .filter(i => {
            const st = statusOf(i, masterDepartments)
            return next === 'suggested' ? st === 'suggested' : st !== 'mapped'
          })
          .map(i => i.code)
      )
    )
  }

  const chooseSet = (id: string) => {
    setActiveId(id)
    setFilter('all')
    setFilterCodes(null)
    setSearch('')
    setSelected(new Set())
  }

  const handleDone = () => {
    // A pair Carmen's DefaultAccount forbids would fail at posting. Stop here and put the
    // reader on the row, wherever it is, rather than naming a row they cannot see.
    const bad = sets.find(s => statsOf(s, masterDepartments).invalid > 0)
    if (!bad) {
      onDone()
      return
    }
    setAttemptedDone(true)
    setActiveId(bad.id)
    setSearch('')
    chooseFilter('attention', bad)
    const code = bad.items.find(i => statusOf(i, masterDepartments) === 'invalid')?.code
    requestAnimationFrame(() => {
      if (!code) return
      const el = dialogRef.current?.querySelector(`[data-pt="${CSS.escape(code)}"]`)
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    })
  }

  const handleRemove = (code: string) => {
    if (!active.remove) return
    // Where focus goes once the row is gone: the next row, else the one before, else the
    // add button. Left alone it falls to <body>, and Escape stops reaching the dialog.
    const at = visible.findIndex(i => i.code === code)
    const next = visible[at + 1]?.code ?? visible[at - 1]?.code ?? null

    const undo = active.remove(code)
    setSelected(prev => {
      if (!prev.has(code)) return prev
      const copy = new Set(prev)
      copy.delete(code)
      return copy
    })
    // Just the code: which list it left is already the dialog's own heading.
    const id = toast(t('cc.pmRemoved', { code }), {
      duration: 6000,
      // Where every other toast in the app is (bottom-center). On a phone, where this
      // dialog is the whole screen, payment-modal.css lifts the toaster above its footer.
      action: { label: t('cc.pmUndo'), onClick: () => undo() },
    })
    undoToasts.current.push(id)

    requestAnimationFrame(() => {
      const root = dialogRef.current
      const target = next
        ? root?.querySelector<HTMLElement>(`[data-pt="${CSS.escape(next)}"] .pm-select input`)
        : root?.querySelector<HTMLElement>('.pm-add-trigger')
      ;(target ?? root)?.focus()
    })
  }

  const pct = stats.total ? Math.round((stats.mapped / stats.total) * 100) : 0
  const needs = stats.attention - stats.suggested
  const titleId = 'pm-dialog-title'

  const message =
    stats.total === 0
      ? { tone: 'neutral', icon: <Info size={15} />, text: t('cc.pmMsgEmpty') }
      : stats.invalid > 0
        ? {
            tone: 'error',
            icon: <AlertTriangle size={15} />,
            text: t('cc.pmMsgInvalid', { n: stats.invalid }),
          }
        : needs > 0
          ? {
              tone: 'warn',
              icon: <AlertTriangle size={15} />,
              text: t('cc.pmMsgMissing', { n: needs }),
            }
          : stats.suggested > 0
            ? {
                tone: 'neutral',
                icon: <Info size={15} />,
                text: t('cc.pmMsgSuggested', { n: stats.suggested }),
              }
            : {
                tone: 'ok',
                icon: <CheckCircle2 size={15} />,
                text: t('cc.pmMsgAllMapped', { n: stats.total }),
              }

  const chips: Array<{ id: Filter; label: string; n: number }> = [
    { id: 'all', label: t('cc.pmFilterAll'), n: stats.total },
    { id: 'attention', label: t('cc.pmFilterAttention'), n: stats.attention },
  ]
  if (stats.suggested > 0 || filter === 'suggested') {
    chips.push({ id: 'suggested', label: t('cc.pmFilterSuggested'), n: stats.suggested })
  }

  return ReactDOM.createPortal(
    <div
      className="pm-overlay"
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        }
      }}
    >
      <button
        type="button"
        className="pm-backdrop"
        aria-label={t('cc.ptClose')}
        tabIndex={-1}
        onClick={onCancel}
      />
      <div
        ref={dialogRef}
        className="pm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="pm-head">
          <div className="pm-head-row">
            <div className="pm-head-titles">
              <h2 id={titleId} className="pm-title">
                {t('cc.pmTitle')}
              </h2>
              <p className="pm-context">
                {context ? `${context} · ` : ''}
                {active.label}
              </p>
            </div>
            <span className="pm-progress-count">
              {t('cc.pmMappedOf', { mapped: stats.mapped, total: stats.total })}
            </span>
            <button
              type="button"
              className="pm-close"
              onClick={onCancel}
              aria-label={t('cc.ptClose')}
            >
              <X size={18} />
            </button>
          </div>
          <div
            className="pm-progress"
            role="progressbar"
            aria-label={t('cc.pmProgress')}
            aria-valuemin={0}
            aria-valuemax={stats.total}
            aria-valuenow={stats.mapped}
          >
            <span style={{ width: `${pct}%` }} />
          </div>
        </header>

        {sets.length > 1 && (
          <div className="pm-tabs" role="tablist" aria-label={t('cc.pmSets')}>
            {sets.map(s => {
              const st = statsOf(s, masterDepartments)
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={s.id === active.id}
                  className={`pm-tab${s.id === active.id ? ' is-active' : ''}`}
                  onClick={() => chooseSet(s.id)}
                >
                  {s.label}
                  {st.attention > 0 && <span className="pm-tab-count">{st.attention}</span>}
                </button>
              )
            })}
          </div>
        )}

        {selected.size > 0 ? (
          <BulkApplyBar
            count={selected.size}
            masterAccounts={masterAccounts}
            masterDepartments={masterDepartments}
            onApply={patch => {
              active.applyToMany([...selected], patch)
              setSelected(new Set())
            }}
            onClear={() => setSelected(new Set())}
          />
        ) : (
          <div className="pm-toolbar">
            <label className="pm-search">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  setSelected(new Set())
                }}
                placeholder={t('cc.pmSearch')}
                aria-label={t('cc.pmSearch')}
              />
            </label>
            <div className="pm-chips" role="group" aria-label={t('cc.pmFilters')}>
              {chips.map(c => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={filter === c.id}
                  className={`pm-chip${filter === c.id ? ' is-active' : ''}`}
                  onClick={() => chooseFilter(c.id)}
                >
                  {c.label}
                  <span className="pm-chip-count">{c.n}</span>
                </button>
              ))}
            </div>
            <div className="pm-toolbar-end">
              <AISuggestBar
                onSuggest={active.suggest}
                onAcceptAll={active.acceptAll}
                hasSuggestions={stats.suggested > 0}
                loading={active.suggesting}
                disabled={loadingOpts || stats.total === 0}
              />
            </div>
          </div>
        )}

        <div
          className={`pm-message pm-message--${message.tone}`}
          role={attemptedDone && stats.invalid > 0 ? 'alert' : 'status'}
        >
          {message.icon}
          <span>{message.text}</span>
        </div>

        <div className="pm-body">
          {visible.length === 0 && stats.total > 0 && (
            <p className="pm-no-match">{t('cc.pmNoMatch')}</p>
          )}
          <MappingTable
            key={active.id}
            set={active}
            items={visible}
            selected={selected}
            onToggle={(code, checked) =>
              setSelected(prev => {
                const next = new Set(prev)
                if (checked) next.add(code)
                else next.delete(code)
                return next
              })
            }
            onToggleAll={checked =>
              setSelected(checked ? new Set(visible.map(i => i.code)) : new Set())
            }
            onRemove={handleRemove}
            masterAccounts={masterAccounts}
            masterDepartments={masterDepartments}
            startAdding={stats.total === 0}
          />
        </div>

        <footer className="pm-foot">
          <span className="pm-foot-note">{t('cc.pmFootNote')}</span>
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-confirm" onClick={handleDone}>
            {t('cc.pmDone')}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
