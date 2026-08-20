import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  Bell,
  BellOff,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Sparkles,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import type { Lang, TKey } from '../../i18n/dict'
import '../../styles/components/notification-bell.css'
import { useNotifications } from '../../hooks/notifications'
import { WHATS_NEW_RETURN_KEY } from '../../lib/releaseNotesSeen'
import type { BellItem } from '../../lib/api/notifications'
import type { ReleaseNoteCopy } from '../../content/releaseNotes'

// Per-type presentation: icon + tone class (tone drives the tinted icon container).
const TYPE_META: Record<string, { icon: LucideIcon; tone: string }> = {
  approved: { icon: CheckCircle2, tone: 'success' },
  rejected: { icon: XCircle, tone: 'error' },
  on_hold: { icon: Clock, tone: 'warning' },
  missing_slip: { icon: AlertCircle, tone: 'warning' },
  release_note: { icon: Sparkles, tone: 'info' },
}

type TFn = (key: TKey, vars?: Record<string, string | number>) => string

// Release copy is DATA, not i18n keys — it lives in the content file so a dev
// ships the note in the same PR as the change without touching dict.ts.
function releaseCopy(n: BellItem, lang: Lang): ReleaseNoteCopy {
  return (n.payload as Record<Lang, ReleaseNoteCopy>)[lang]
}

function notifText(n: BellItem, t: TFn): string {
  const p = n.payload as Record<string, unknown>
  switch (n.type) {
    case 'approved':
      return t('notif.approved', { credits: String(p.credits ?? '?') })
    case 'rejected':
      return t('notif.rejected', { reason: String(p.reason ?? '') })
    case 'on_hold':
      return t('notif.onHold')
    case 'missing_slip':
      return t('notif.missingSlip')
    default:
      return n.type
  }
}

// Localized relative time, reusing the admin Order-Review time keys (bilingual).
function timeAgo(iso: string, t: TFn): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return t('orev.time.justNow')
  if (s < 3600) return t('orev.time.mAgo', { n: Math.floor(s / 60) })
  if (s < 86400) return t('orev.time.hAgo', { n: Math.floor(s / 3600) })
  return t('orev.time.dAgo', { n: Math.floor(s / 86400) })
}

export default function NotificationBell() {
  const { t, lang } = useT()
  const { items, unreadCount, markRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Anchor the portaled panel under the bell, right-aligned. The CSS gives it a
  // fixed top-right default, so it never lands mid-screen even before this runs.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const style: React.CSSProperties = { top: r.bottom + 8 }
    // Only the vertical anchor is set on phones: below 480px the panel is a
    // full-width sheet whose left/right come from CSS, and an inline `right`
    // here would beat that media query. Keep the breakpoint in sync with
    // notification-bell.css.
    if (window.innerWidth > 480) style.right = Math.max(12, window.innerWidth - r.right)
    setPanelStyle(style)
  }, [open])

  // Close on outside-click / Escape / resize / scroll-outside. The panel is
  // portaled to body, so checks span BOTH the trigger and the panel; scrolling
  // *inside* the (scrollable) list must not dismiss it.
  useEffect(() => {
    if (!open) return
    const isOutside = (target: Node) =>
      !btnRef.current?.contains(target) && !panelRef.current?.contains(target)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: MouseEvent) => isOutside(e.target as Node) && setOpen(false)
    const onScroll = (e: Event) => isOutside(e.target as Node) && setOpen(false)
    const onResize = () => setOpen(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  const handleItem = (n: BellItem) => {
    setOpen(false)
    // Release notes open the full history page, which clears the seen mark on
    // mount — so no markRead here. Stash where we came from for its back button.
    if (n.type === 'release_note') {
      sessionStorage.setItem(WHATS_NEW_RETURN_KEY, window.location.hash || '#/')
      window.location.hash = '#/whats-new'
      return
    }
    // Deep-link to the specific order when we have it, so the row opens/scrolls
    // into view; the orders route ignores the query suffix when matching.
    window.location.hash = n.order_id ? `#/pricing/orders?id=${n.order_id}` : '#/pricing/orders'
    // Navigate first; marking read is best-effort and must not block it.
    if (!n.read_at) void markRead([n.id])
  }

  return (
    <div className="notif-bell">
      <button
        ref={btnRef}
        type="button"
        className="notif-bell__trigger"
        data-active={open || undefined}
        aria-label={t('notif.bellAria')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <Bell size={17} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="notif-bell__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="notif-bell__panel"
            style={panelStyle}
            role="dialog"
            aria-label={t('notif.title')}
          >
            <header className="notif-bell__header">
              <span className="notif-bell__title">{t('notif.title')}</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notif-bell__mark-all"
                  onClick={() => void markRead()}
                >
                  <CheckCheck size={13} strokeWidth={2.25} />
                  {t('notif.markAllRead')}
                </button>
              )}
            </header>

            {items.length === 0 ? (
              <div className="notif-bell__empty">
                <BellOff size={22} strokeWidth={1.75} />
                <span>{t('notif.empty')}</span>
              </div>
            ) : (
              <ul className="notif-bell__list">
                {items.map(n => {
                  const meta = TYPE_META[n.type] ?? { icon: Bell, tone: 'info' }
                  const Icon = meta.icon
                  const release = n.type === 'release_note' ? releaseCopy(n, lang) : null
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={`notif-bell__item${n.read_at ? '' : ' is-unread'}`}
                        onClick={() => handleItem(n)}
                      >
                        <span className={`notif-bell__icon notif-bell__icon--${meta.tone}`}>
                          <Icon size={16} strokeWidth={2} />
                        </span>
                        <span className="notif-bell__body">
                          <span className="notif-bell__text">
                            {release ? release.title : notifText(n, t)}
                          </span>
                          <time className="notif-bell__time">{timeAgo(n.created_at, t)}</time>
                        </span>
                        {release && (
                          <ChevronRight
                            className="notif-bell__go"
                            size={14}
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                        )}
                        {!n.read_at && <span className="notif-bell__dot" aria-hidden="true" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
