import { useEffect, useReducer, useRef } from 'react'
import { AlertTriangle, Check, Loader2, Pause, Send, X } from 'lucide-react'
import type { AdminCreditOrder } from '../../lib/api/adminClient'
import { useT } from '../../i18n/LanguageContext'

// Reject reasons are shown to the (Thai-default) buyer, so they stay Thai
// regardless of the reviewer's UI language.
export const REJECT_PRESETS = [
  'ยอดเงินในสลิปไม่ตรงกับยอดที่ต้องชำระ',
  'สลิปไม่ชัดเจน อ่านยอด/รายละเอียดไม่ได้',
  'บัญชีปลายทางไม่ใช่บัญชีของบริษัท',
  'สลิปนี้ถูกใช้ยืนยันการชำระไปแล้ว',
]
export const REJECT_OTHER = 'อื่น ๆ (ระบุเหตุผล)'

export function fmtDateTime(s: string | null): string {
  return s ? new Date(s).toLocaleString() : '—'
}

interface ActionsState {
  mode: 'idle' | 'reject' | 'hold'
  preset: string
  reason: string
  holdNote: string
  confirm: 'approve' | null
}

type ActionsAction =
  | { type: 'RESET' }
  | { type: 'SET_MODE'; mode: 'idle' | 'reject' | 'hold' }
  | { type: 'SET_PRESET'; preset: string }
  | { type: 'SET_REASON'; reason: string }
  | { type: 'SET_HOLD_NOTE'; note: string }
  | { type: 'SET_CONFIRM'; confirm: 'approve' | null }
  | { type: 'CHOOSE_PRESET'; preset: string }

const actionsInitial: ActionsState = {
  mode: 'idle',
  preset: REJECT_PRESETS[0],
  reason: REJECT_PRESETS[0],
  holdNote: '',
  confirm: null,
}

function actionsReducer(state: ActionsState, action: ActionsAction): ActionsState {
  switch (action.type) {
    case 'RESET':
      return actionsInitial
    case 'SET_MODE':
      return { ...state, mode: action.mode }
    case 'SET_PRESET':
      return { ...state, preset: action.preset }
    case 'SET_REASON':
      return { ...state, reason: action.reason }
    case 'SET_HOLD_NOTE':
      return { ...state, holdNote: action.note }
    case 'SET_CONFIRM':
      return { ...state, confirm: action.confirm }
    case 'CHOOSE_PRESET':
      return {
        ...state,
        preset: action.preset,
        reason: action.preset === REJECT_OTHER ? '' : action.preset,
      }
    default:
      return state
  }
}

/** Status-aware action bar: approve (two-tap) / reject-with-reason / hold / post / readonly. */
export function OrderActions({
  order,
  busy,
  onApprove,
  onReject,
  onHold,
  onPostAr,
  onMapAr,
}: {
  order: AdminCreditOrder
  busy: boolean
  onApprove: () => void
  onReject: (reason: string) => void
  onHold: (note: string) => void
  onPostAr: () => void
  onMapAr: () => void
}) {
  const { t } = useT()
  const [state, dispatch] = useReducer(actionsReducer, actionsInitial)
  const { mode, preset, reason, holdNote, confirm } = state
  const confirmTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    dispatch({ type: 'RESET' })
  }, [order.id])

  const arm = (which: 'approve', run: () => void) => {
    if (confirm === which) {
      window.clearTimeout(confirmTimer.current)
      dispatch({ type: 'SET_CONFIRM', confirm: null })
      run()
      return
    }
    dispatch({ type: 'SET_CONFIRM', confirm: which })
    window.clearTimeout(confirmTimer.current)
    confirmTimer.current = window.setTimeout(
      () => dispatch({ type: 'SET_CONFIRM', confirm: null }),
      4000
    )
  }

  // Terminal: complete or void — read-only.
  if (order.status === 'complete' || order.status === 'void') {
    return (
      <div className="orev-actions orev-actions--readonly">
        {order.status === 'complete' && (
          <span className="orev-outcome is-ok">
            <Check size={15} /> {t('orev.outcome.complete', { ref: order.carmen_ar_ref || '—' })}
          </span>
        )}
        {order.status === 'void' && (
          <span className="orev-outcome is-bad">
            <X size={15} />{' '}
            {t('orev.outcome.void', {
              reason: order.rejected_reason || t('orev.outcome.noReason'),
            })}
          </span>
        )}
      </div>
    )
  }

  // Paid: approved — now post to Carmen AR (needs a mapped AR code).
  if (order.status === 'paid') {
    const mapped = !!order.carmen_ar_code
    return (
      <div className="orev-actions">
        <span className="orev-outcome is-ok">
          <Check size={15} />{' '}
          {order.approved_by
            ? t('orev.outcome.approvedBy', {
                who: order.approved_by,
                when: fmtDateTime(order.approved_at),
              })
            : t('orev.outcome.approved', { when: fmtDateTime(order.approved_at) })}
        </span>
        {mapped ? (
          <button
            type="button"
            className="btn btn-confirm orev-approve"
            disabled={busy}
            onClick={onPostAr}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}{' '}
            {t('orev.act.postAr')} · {order.carmen_ar_code}
          </button>
        ) : (
          <button type="button" className="btn btn-outline" onClick={onMapAr}>
            <AlertTriangle size={14} /> {t('orev.inv.mapToAr')}
          </button>
        )}
      </div>
    )
  }

  // In-progress: full decision bar (approve / void / cancel).
  if (mode === 'reject') {
    return (
      <div className="orev-actions orev-actions--form">
        <fieldset className="orev-reject">
          <legend className="orev-verify-eyebrow">{t('orev.reject.legend')}</legend>
          <div className="orev-reject-presets">
            {[...REJECT_PRESETS, REJECT_OTHER].map(p => (
              <label key={p} className={`orev-radio${preset === p ? ' is-on' : ''}`}>
                <input
                  type="radio"
                  name="reject-preset"
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
        <div className="orev-actions-bar">
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={() => dispatch({ type: 'SET_MODE', mode: 'idle' })}
          >
            {t('orev.act.back')}
          </button>
          <button
            type="button"
            className="btn btn-overwrite"
            disabled={busy || !reason.trim()}
            onClick={() => onReject(reason.trim())}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}{' '}
            {t('orev.act.confirmVoid')}
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'hold') {
    return (
      <div className="orev-actions orev-actions--form">
        <label className="orev-field">
          <span className="orev-verify-eyebrow">{t('orev.note.legend')}</span>
          <textarea
            className="orev-textarea"
            value={holdNote}
            onChange={e => dispatch({ type: 'SET_HOLD_NOTE', note: e.target.value })}
            rows={2}
            placeholder={t('orev.note.ph')}
          />
        </label>
        <div className="orev-actions-bar">
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={() => dispatch({ type: 'SET_MODE', mode: 'idle' })}
          >
            {t('orev.act.back')}
          </button>
          <button
            type="button"
            className="btn btn-confirm"
            disabled={busy}
            onClick={() => onHold(holdNote.trim())}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Pause size={14} />}{' '}
            {t('orev.note.save')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="orev-actions">
      <button
        type="button"
        className="btn btn-outline orev-danger"
        disabled={busy}
        onClick={() => dispatch({ type: 'SET_MODE', mode: 'reject' })}
      >
        <X size={14} /> {t('orev.act.void')}
      </button>
      <button
        type="button"
        className="btn btn-outline"
        disabled={busy}
        onClick={() => dispatch({ type: 'SET_MODE', mode: 'hold' })}
      >
        <Pause size={14} /> {t('orev.note.legend')}
      </button>
      <button
        type="button"
        className={`btn btn-confirm orev-approve${confirm === 'approve' ? ' is-confirming' : ''}`}
        disabled={busy}
        onClick={() => arm('approve', onApprove)}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}{' '}
        {confirm === 'approve' ? t('orev.act.confirmApprove') : t('orev.act.approve')}
      </button>
    </div>
  )
}
