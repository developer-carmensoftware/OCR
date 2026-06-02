import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Layers } from 'lucide-react'
import { fmt, parseNum } from '../../constants/apInvoice'
import { effectiveTaxProfile, allSameProfile } from '../../lib/apGroup'
import type { APLineItem } from '../../hooks/ap-invoice/useAPExtraction'
import type { Vendor } from '../../hooks/ap-invoice/useAPVendor'

interface Props {
  show: boolean
  t: Record<string, string>
  lineItems: APLineItem[]
  systemVendor: Vendor
  groupByDescription: (indices: number[], description: string) => boolean
  onClose: () => void
}

// Group-by-description dialog. The user sets the target description first, then ticks the rows to
// merge. Selected rows must share one tax profile — the Group button stays disabled (with an inline
// warning) until the selection is valid, and the hook re-checks as a backstop. Enter/exit motion
// mirrors CustomModal so every dialog in the app settles the same way.
export default function APGroupModal({
  show,
  t,
  lineItems,
  systemVendor,
  groupByDescription,
  onClose,
}: Props) {
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

  const vendorDefault = systemVendor.taxProfileCode1 || ''
  const profileLabel = (item: APLineItem) => {
    const p = effectiveTaxProfile(item, vendorDefault)
    return p === 'None' ? 'No VAT' : p || '—'
  }

  const selectedItems = [...selected].map(i => lineItems[i])
  const mixed = selected.size >= 2 && !allSameProfile(selectedItems, vendorDefault)
  const canGroup = desc.trim().length > 0 && selected.size >= 2 && !mixed

  const toggle = (i: number) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

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
              <Layers size={16} />
              <span>Group by description</span>
            </div>

            <div className="ap-group-modal-body">
              <label className="ap-group-modal-label" htmlFor="ap-group-desc">
                Group description
              </label>
              <input
                id="ap-group-desc"
                className="ap-group-modal-input"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="Describe the grouped line..."
                autoFocus
              />

              <div className="ap-group-modal-hint">
                Select items to combine — they must share the same tax profile.
              </div>

              <div className="ap-group-modal-list">
                {lineItems.map((item, i) => (
                  <label key={i} className="ap-group-modal-row">
                    <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} />
                    <span className="ap-group-modal-row-desc">
                      {item.description || `(item ${i + 1})`}
                    </span>
                    <span className="ap-group-modal-row-profile">{profileLabel(item)}</span>
                    <span className="ap-group-modal-row-amt">{fmt(parseNum(item.lineTotal))}</span>
                  </label>
                ))}
              </div>

              {mixed && <div className="ap-group-modal-warn">{t.groupSameProfile}</div>}
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
                Group{selected.size > 0 ? ` (${selected.size})` : ''}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
