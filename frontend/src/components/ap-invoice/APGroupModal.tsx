import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Layers } from 'lucide-react'
import { fmt, parseNum } from '../../constants/apInvoice'
import { effectiveTaxProfile, allSameProfile } from '../../lib/apGroup'
import type { APLineItem } from '../../hooks/ap-invoice/useAPExtraction'

interface Props {
  show: boolean
  t: Record<string, string>
  lineItems: APLineItem[]
  groupByDescription: (indices: number[], description: string) => boolean
  onClose: () => void
}

// Group-by-description dialog. Flow is select -> review -> name: the user ticks the rows to merge,
// the summary strip shows the running count, shared tax profile, and combined total, then they name
// the grouped line. Selected rows must share one tax profile; the Group button stays disabled (with
// inline conflict highlighting) until the selection is valid, and the hook re-checks as a backstop.
// Enter/exit motion mirrors CustomModal so every dialog in the app settles the same way.
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

  const selectedItems = [...selected].map(i => lineItems[i])
  const mixed = selected.size >= 2 && !allSameProfile(selectedItems)
  const missingDesc = desc.trim().length === 0 && selected.size >= 2
  const needMoreItems = selected.size === 1
  const canGroup = desc.trim().length > 0 && selected.size >= 2 && !mixed

  const combinedTotal = selectedItems.reduce((sum, it) => sum + parseNum(it.lineTotal), 0)
  const sharedProfile = selected.size >= 1 && !mixed ? profileLabel(selectedItems[0]) : null
  const allSelected = lineItems.length > 0 && selected.size === lineItems.length

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
                  Combine line items that share one tax profile into a single line.
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
                  const conflict = isSelected && mixed
                  const cls = [
                    'ap-group-modal-row',
                    isSelected && 'is-selected',
                    conflict && 'is-conflict',
                  ]
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

              <div className="ap-group-modal-summary" data-state={mixed ? 'error' : 'ok'}>
                {selected.size < 2 ? (
                  <span className="ap-group-modal-summary-hint">
                    {needMoreItems ? t.warnSelectMore : 'Select at least two items.'}
                  </span>
                ) : mixed ? (
                  <span className="ap-group-modal-summary-hint ap-group-modal-summary-hint--error">
                    {t.groupSameProfile}
                  </span>
                ) : (
                  <>
                    <span className="ap-group-modal-summary-meta">
                      <strong>{selected.size}</strong> items
                      {sharedProfile && (
                        <span className="ap-group-modal-summary-profile">{sharedProfile}</span>
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
                  placeholder="e.g. ค่าบำรุงรักษาระบบ (รวม)"
                  autoComplete="off"
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
                Group{selected.size > 0 ? ` ${selected.size}` : ''}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
