import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CalendarClock, Wrench, X } from 'lucide-react'
import { getStoredToken, resolveUrl } from '../../lib/api/client'
import { useT } from '../../i18n/LanguageContext'

interface Props {
  children: ReactNode
}

interface Status {
  active: boolean
  message: string
  window_start: string | null
  window_end: string | null
}

const EMPTY: Status = { active: false, message: '', window_start: null, window_end: null }
const DISMISS_KEY = 'maint_banner_dismissed'

async function probe(): Promise<Status> {
  try {
    // Send the token so /status is tenant-aware — without it the poll only sees
    // the global flag and would fight the JWT-scoped 503s (per-tenant reload loop).
    const token = getStoredToken()
    const res = await fetch(
      resolveUrl('/api/v1/maintenance/status'),
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
    )
    if (!res.ok) return EMPTY
    return { ...EMPTY, ...(await res.json()) }
  } catch {
    // Network failure ≠ maintenance — fail open, let the app try to run.
    return EMPTY
  }
}

/** Compact ICT time — the whole product runs in Asia/Bangkok. */
function fmtICT(iso: string, lang: string): string {
  return new Date(iso).toLocaleString(lang === 'th' ? 'th-TH' : 'en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtHM(iso: string, lang: string): string {
  return new Date(iso).toLocaleString(lang === 'th' ? 'th-TH' : 'en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "2h 5m" / "5m" / "<1m" from now to the target. */
function countdown(iso: string): string {
  const mins = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000))
  if (mins < 1) return '<1m'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

/**
 * Full-screen wall + advance-notice banner for maintenance mode. Triggered
 * immediately by the `ocr:maintenance` event any 503 fires (lib/api/client.ts),
 * confirmed on boot + polled every 30s so it clears itself once the backend
 * returns, and shows a countdown banner ahead of a scheduled window.
 */
/** Admin surfaces have their own auth and are allowlisted server-side — they must
 *  never see the wall, or an admin can't reach the toggle to turn maintenance off. */
const isAdminRoute = () => {
  const h = window.location.hash.replace(/^#\/?/, '')
  return h.startsWith('admin') || h.startsWith('order-review')
}

export function MaintenanceGate({ children }: Props) {
  const { t, lang } = useT()
  const [status, setStatus] = useState<Status>(EMPTY)
  const [onAdmin, setOnAdmin] = useState(isAdminRoute)
  const [leaving, setLeaving] = useState(false)
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY)
    } catch {
      return null
    }
  })
  // Tracks whether we've shown the wall, so a later "clear" can hard-reload once.
  const wasActive = useRef(false)
  const retryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let alive = true
    const check = async () => {
      // Skip the network poll while the tab is hidden; resume on visibility.
      if (document.hidden) return
      const res = await probe()
      if (!alive) return
      if (!res.active && wasActive.current) return window.location.reload()
      wasActive.current = res.active
      setStatus(res)
    }
    const onEvent = () => {
      wasActive.current = true
      setStatus(s => ({ ...s, active: true }))
    }
    const onHash = () => setOnAdmin(isAdminRoute())
    const onVisible = () => {
      if (!document.hidden) check()
    }
    check()
    window.addEventListener('ocr:maintenance', onEvent)
    window.addEventListener('hashchange', onHash)
    document.addEventListener('visibilitychange', onVisible)
    // 30s poll doubles as the countdown re-render tick.
    const id = window.setInterval(check, 30_000)
    return () => {
      alive = false
      window.removeEventListener('ocr:maintenance', onEvent)
      window.removeEventListener('hashchange', onHash)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(id)
    }
  }, [])

  const { active, message, window_start, window_end } = status
  const upcoming =
    !active && window_start && window_end && new Date(window_start).getTime() > Date.now()
  // Never gate the admin plane — admins must always reach the toggle.
  const showBanner = Boolean(!onAdmin && upcoming && dismissed !== window_start)
  const showOverlay = !onAdmin && active

  // Reserve space for the fixed banner so it never covers app chrome.
  useEffect(() => {
    // Released on dismiss-click, not on commit, so the page glides up while the
    // banner slides out instead of snapping after it.
    document.body.classList.toggle('has-maint-banner', showBanner && !leaving)
    return () => document.body.classList.remove('has-maint-banner')
  }, [showBanner, leaving])

  // Move focus into the blocking wall so keyboard users aren't left behind it.
  useEffect(() => {
    if (showOverlay) retryRef.current?.focus()
  }, [showOverlay])

  // Dismiss plays the slide-out first; the state commit rides the animationend,
  // so the banner is never yanked out from under the pointer.
  const dismiss = () => setLeaving(true)
  const commitDismiss = () => {
    if (!leaving) return // entrance animation also lands here
    try {
      if (window_start) localStorage.setItem(DISMISS_KEY, window_start)
    } catch {
      /* storage unavailable */
    }
    setLeaving(false)
    setDismissed(window_start)
  }

  return (
    <>
      {showBanner && (
        <div
          className={`maint-banner${leaving ? ' maint-banner--leaving' : ''}`}
          role="status"
          onAnimationEnd={commitDismiss}
        >
          <div className="maint-banner__inner">
            <span className="maint-banner__icon" aria-hidden>
              <CalendarClock size={15} strokeWidth={2} />
            </span>
            <span className="maint-banner__label">{t('maintenance.bannerTitle')}</span>
            <span className="maint-banner__window">
              {fmtICT(window_start!, lang)} – {fmtHM(window_end!, lang)}
            </span>
            <span className="maint-banner__countdown">
              {t('maintenance.bannerIn', { countdown: countdown(window_start!) })}
            </span>
            <button
              type="button"
              className="maint-banner__dismiss"
              aria-label={t('maintenance.dismiss')}
              onClick={dismiss}
            >
              <X size={15} strokeWidth={2.25} />
            </button>
          </div>
        </div>
      )}
      {children}
      {showOverlay && (
        <div
          className="maint-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-label={t('maintenance.title')}
          // Single-action wall: trap Tab on the only control so keyboard focus
          // can never land on the (visually blocked) app behind the scrim.
          onKeyDown={e => {
            if (e.key === 'Tab') {
              e.preventDefault()
              retryRef.current?.focus()
            }
          }}
        >
          <span className="maint-overlay__chip" aria-hidden>
            <Wrench size={26} strokeWidth={1.75} />
          </span>
          <h1 className="maint-overlay__title">{t('maintenance.title')}</h1>
          <p className="maint-overlay__body">{message || t('maintenance.body')}</p>
          {window_end && (
            <p className="maint-overlay__sub">
              {t('maintenance.backBy', { time: fmtHM(window_end, lang) })}
            </p>
          )}
          <button
            type="button"
            ref={retryRef}
            className="maint-overlay__retry"
            onClick={() => window.location.reload()}
          >
            {t('maintenance.retry')}
          </button>
        </div>
      )}
    </>
  )
}
