import { useCallback, useEffect, useState } from 'react'
import { useT } from '@/i18n/LanguageContext'
import { showToast } from '@/shared/lib/toast'
import { isAccountAllowed } from '@/shared/lib/deptAccounts'
import { useGlMasters } from '@/features/credit-card/hooks/mapping/useGlMasters'
import {
  approvePmsDay,
  getPmsDay,
  rejectPmsDay,
  type PmsDay,
} from '@/features/credit-card/api/pmsReview'
type Pick = { dept: string; acc: string }

/**
 * One parked PMS day in the review modal: what it holds, the reviewer's accounts for its new
 * rows, and Approve / Reject. The email review's `useReviewDocument`, for a document that
 * needs far less: there are no header fields to correct and no amounts to edit — a day is
 * read, not re-keyed, and Carmen's engine decides its sides (decision-log #43) — so the only
 * input is an account for each row Carmen's mapping table cannot place yet.
 */
export function usePmsReview(id: string, onClose: () => void, onDone: () => void) {
  const { t } = useT()
  const masters = useGlMasters()
  const [day, setDay] = useState<PmsDay | null>(null)
  const [loading, setLoading] = useState(true)
  const [gone, setGone] = useState(false)
  const [picks, setPicks] = useState<Record<string, Pick>>({})
  const [busy, setBusy] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [discarding, setDiscarding] = useState(false)

  useEffect(() => {
    let alive = true
    getPmsDay(id)
      .then(d => {
        if (!alive) return
        setDay(d)
        setPicks(
          Object.fromEntries(
            d.new_codes.map(c => [c.key, { dept: c.dept ?? '', acc: c.acc ?? '' }])
          )
        )
      })
      .catch(() => alive && setGone(true))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [id])

  /** What the AI picked for a key — the starting value, and where Undo goes back to. */
  const aiPick = useCallback(
    (key: string): Pick => {
      const c = day?.new_codes.find(n => n.key === key)
      return { dept: c?.dept ?? '', acc: c?.acc ?? '' }
    },
    [day]
  )

  /** Still the machine's answer: tagged AI rather than offering Undo. */
  const isAiPick = useCallback(
    (key: string) => {
      const p = picks[key]
      const ai = aiPick(key)
      return !!ai.acc && p?.dept === ai.dept && p?.acc === ai.acc
    },
    [picks, aiPick]
  )

  const setPick = useCallback(
    (key: string, field: 'dept' | 'acc', value: string) =>
      setPicks(cur => {
        const p = cur[key] ?? { dept: '', acc: '' }
        // A department that does not allow the chosen account clears it, as the JV editor
        // does, rather than leaving a pair Carmen will refuse.
        const next =
          field === 'dept'
            ? { dept: value, acc: isAccountAllowed(value, p.acc, masters.departments) ? p.acc : '' }
            : { ...p, acc: value }
        return { ...cur, [key]: next }
      }),
    [masters.departments]
  )

  const undo = useCallback(
    (key: string) => setPicks(cur => ({ ...cur, [key]: aiPick(key) })),
    [aiPick]
  )

  const unpicked = (day?.new_codes ?? []).filter(c => !(picks[c.key]?.dept && picks[c.key]?.acc))
  // The one reason Approve cannot be pressed. A balance is not one: Carmen's engine decides
  // the sides and refuses a day it cannot post, in its own words (`postError`).
  const blockReason = unpicked.length ? t('pms.blockedPick') : null
  const dirty = (day?.new_codes ?? []).some(c => {
    const p = picks[c.key]
    return p?.dept !== (c.dept ?? '') || p?.acc !== (c.acc ?? '')
  })

  const requestClose = useCallback(() => {
    if (busy) return
    if (dirty) setDiscarding(true)
    else onClose()
  }, [busy, dirty, onClose])

  async function approve() {
    if (!day || blockReason || busy) return
    setBusy(true)
    setPostError(null)
    try {
      const res = await approvePmsDay(
        day.id,
        Object.fromEntries(day.new_codes.map(c => [c.key, picks[c.key]]))
      )
      showToast(t(res.already_posted ? 'pms.alreadyPostedOk' : 'pms.postedOk'), 'success')
      onDone()
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 409) {
        showToast(t('review.alreadyHandled'), 'warning')
        onDone()
        return
      }
      // Carmen's own refusal (a closed period, an account it does not know) stays on
      // screen next to the thing that has to change; the day stays parked.
      setPostError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function reject() {
    if (!day) return
    setBusy(true)
    try {
      await rejectPmsDay(day.id, reason.trim() || undefined)
      showToast(t('pms.rejected'), 'success')
      onDone()
    } catch {
      showToast(t('review.rejectFailed'), 'error')
      setBusy(false)
      setRejecting(false)
    }
  }

  return {
    day,
    loading,
    gone,
    masters,
    picks,
    setPick,
    undo,
    isAiPick,
    blockReason,
    busy,
    postError,
    rejecting,
    setRejecting,
    reason,
    setReason,
    discarding,
    setDiscarding,
    requestClose,
    approve,
    reject,
  }
}
