import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Layers } from 'lucide-react'
import { fmt, parseNum } from '../../constants/apInvoice'
import { effectiveTaxProfile, apGroupKey } from '../../lib/apGroup'
import type { APLineItem } from '../../hooks/ap-invoice/useAPExtraction'

interface Props {
  show: boolean
  t: Record<string, string>
  lineItems: APLineItem[]
  groupByDescription: (indices: number[], description: string) => boolean
  onClose: () => void
}

// Group-by-description dialog. The user selects rows to merge (any mix of tax profiles is allowed),
// names the group, and clicks Group. Rows with different tax profiles each become their own merged
// row — all sharing the same description. The summary strip adapts: same-profile = total; mixed =
// info message "→ N rows (split by tax profile)". Enter/exit motion mirrors CustomModal.
export default function APGroupModal({ show, t, lineItems, groupByDescription, onClose }: Props) {
  const [desc, setDesc] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (show) {
      setDesc('')
      setSelected(new Set())
    }
  }, [show])

  useEffect(() => {
    if (!show) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [show, onClose])

  const profileLabel = (item: APLineItem) => {
    const p = effectiveTaxProfile(item)
    return p === 'None' ? 'No VAT' : p || '—'
  }

  // Map selected indices to rows, dropping any that fall outside the current list. A group commit
  // shrinks `lineItems` and closes the modal in the same render, so a still-mounted body can briefly
  // see stale indices; filtering here keeps effectiveTaxProfile/parseNum from hitting `undefined`.
  const selectedItems = [...selected]
    .map(i => lineItems[i])
    .filter((it): it is APLineItem => it != null)
  const count = selectedItems.length
  const profileCount = new Set(selectedItems.map(apGroupKey)).size
  const multiRow = count >= 2 && profileCount > 1
  const missingDesc = desc.trim().length === 0 && count >= 2
  const needMoreItems = count === 1
  const canGroup = desc.trim().length > 0 && count >= 2

  const combinedTotal = selectedItems.reduce((sum, it) => sum + parseNum(it.lineTotal), 0)
  const sharedProfile = count >= 1 && !multiRow ? profileLabel(selectedItems[0]) : null
  const allSelected = lineItems.length > 0 && count === lineItems.length

  const toggle = (i: number) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(lineItems.map((_, i) => i)))

  const handleGroup = () => {
    if (!canGroup) return
    if (groupByDescription([...selected], desc.trim())) onClose()
  }

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          className="ap-group-modal-overlay"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="ap-group-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Group by description"
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="ap-group-modal-header">
              <span className="ap-group-modal-header-icon">
                <Layers size={15} strokeWidth={2.25} />
              </span>
              <div className="ap-group-modal-header-text">
                <span className="ap-group-modal-title">Group by description</span>
                <span className="ap-group-modal-subtitle">
                  Combine selected items into one row per tax profile, sharing one name.
                </span>
              </div>
            </div>

            <div className="ap-group-modal-body">
              <div className="ap-group-modal-list-head">
                <span className="ap-group-modal-list-head-label">Select items to combine</span>
                {lineItems.length > 0 && (
                  <button type="button" className="ap-group-modal-selectall" onClick={toggleAll}>
                    {allSelected ? 'Clear all' : 'Select all'}
                  </button>
                )}
              </div>

              <div className="ap-group-modal-list" role="group" aria-label="Line items">
                {lineItems.length === 0 && (
                  <div className="ap-group-modal-empty">No line items to group.</div>
                )}
                {lineItems.map((item, i) => {
                  const isSelected = selected.has(i)
                  const cls = ['ap-group-modal-row', isSelected && 'is-selected']
                    .filter(Boolean)
                    .join(' ')
                  return (
                    <label key={i} className={cls}>
                      <input
                        type="checkbox"
                        className="ap-group-modal-check"
                        checked={isSelected}
                        onChange={() => toggle(i)}
                      />
                      <span className="ap-group-modal-row-desc">
                        {item.description || `(item ${i + 1})`}
                      </span>
                      <span className="ap-group-modal-row-profile">{profileLabel(item)}</span>
                      <span className="ap-group-modal-row-amt">
                        {fmt(parseNum(item.lineTotal))}
                      </span>
                    </label>
                  )
                })}
              </div>

              <div className="ap-group-modal-summary" data-state="ok">
                {count < 2 ? (
                  <span className="ap-group-modal-summary-hint">
                    {needMoreItems ? t.warnSelectMore : 'Select at least two items.'}
                  </span>
                ) : (
                  <>
                    <span className="ap-group-modal-summary-meta">
                      <strong>{count}</strong> items
                      {multiRow ? (
                        <span className="ap-group-modal-summary-hint--info">
                          → {profileCount} rows (split by tax profile)
                        </span>
                      ) : (
                        sharedProfile && (
                          <span className="ap-group-modal-summary-profile">{sharedProfile}</span>
                        )
                      )}
                    </span>
                    <span className="ap-group-modal-summary-total">{fmt(combinedTotal)}</span>
                  </>
                )}
              </div>

              <div className="ap-group-modal-field">
                <label className="ap-group-modal-label" htmlFor="ap-group-desc">
                  Name the grouped line
                </label>
                <input
                  id="ap-group-desc"
                  className={`ap-group-modal-input${missingDesc ? ' ap-group-modal-input--error' : ''}`}
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="e.g. Maintenance services (combined)"
                  autoComplete="new-password"
                />
                {missingDesc && (
                  <div className="ap-group-modal-warn">Enter a name for the combined line.</div>
                )}
              </div>
            </div>

            <div className="ap-group-modal-footer">
              <button type="button" className="btn btn-sm btn-outline" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-confirm"
                disabled={!canGroup}
                onClick={handleGroup}
              >
                Group{count > 0 ? ` ${count}` : ''}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
