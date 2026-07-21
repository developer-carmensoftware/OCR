import { useReducer } from 'react'
import { createPortal } from 'react-dom'
import { m, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import { REJECT_PRESETS, REJECT_OTHER } from './OrderActions'

interface State {
  preset: string
  reason: string
}
type Action =
  | { type: 'CHOOSE_PRESET'; preset: string }
  | { type: 'SET_REASON'; reason: string }
  | { type: 'RESET' }

const initial: State = { preset: REJECT_PRESETS[0], reason: REJECT_PRESETS[0] }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'RESET':
      return initial
    case 'SET_REASON':
      return { ...state, reason: action.reason }
    case 'CHOOSE_PRESET':
      return {
        preset: action.preset,
        reason: action.preset === REJECT_OTHER ? '' : action.preset,
      }
    default:
      return state
  }
}

/**
 * One-reason-for-all void prompt for the batch bar — same "pick a preset or type"
 * UX as the single-order void in OrderActions, sharing REJECT_PRESETS so the two
 * never drift. The reason is buyer-visible, applied to every selected order.
 */
export default function VoidReasonModal({
  open,
  count,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean
  count: number
  busy: boolean
  onConfirm: (reason: string) => void
  onCancel: () => void
}) {
  const { t } = useT()
  const reduce = useReducedMotion()
  // reset on close (via AnimatePresence onExitComplete) so each reopen starts fresh
  const [state, dispatch] = useReducer(reducer, initial)
  const { preset, reason } = state

  const boxMotion = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      }
    : {
        initial: { opacity: 0, scale: 0.96, y: 10 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.98, y: 6 },
        transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] as const },
      }

  return createPortal(
    <AnimatePresence onExitComplete={() => dispatch({ type: 'RESET' })}>
      {open && (
        <m.div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <m.div className="modal-box" {...boxMotion}>
            <fieldset className="orev-reject">
              <legend className="orev-verify-eyebrow">
                {t('orev.void.batchTitle', { n: count })} — {t('orev.reject.legend')}
              </legend>
              <div className="orev-reject-presets">
                {[...REJECT_PRESETS, REJECT_OTHER].map(p => (
                  <label key={p} className={`orev-radio${preset === p ? ' is-on' : ''}`}>
                    <input
                      type="radio"
                      name="batch-void-preset"
                      checked={preset === p}
                      onChange={() => dispatch({ type: 'CHOOSE_PRESET', preset: p })}
                    />
                    {p}
                  </label>
                ))}
              </div>
              <textarea
                className="orev-textarea"
                aria-label={t('orev.reject.detailPh')}
                value={reason}
                onChange={e => dispatch({ type: 'SET_REASON', reason: e.target.value })}
                rows={2}
                placeholder={t('orev.reject.detailPh')}
              />
            </fieldset>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" disabled={busy} onClick={onCancel}>
                {t('orev.act.back')}
              </button>
              <button
                type="button"
                className="btn btn-overwrite"
                disabled={busy || !reason.trim()}
                onClick={() => onConfirm(reason.trim())}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}{' '}
                {t('orev.act.confirmVoid')}
              </button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
